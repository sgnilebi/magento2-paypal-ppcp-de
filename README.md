# PayPal PPCP (Complete Payments Platform) for Magento 2.2.3

**DE/EUR Adaptation** of [QBO Tech's PayPal Commerce Platform module](https://github.com/qbo-tech/magento2-paypal-commerce-platform) for [meinereitwelt.de](https://www.meinereitwelt.de)

---

## ⚠️ Branch Structure (Important!)

| Branch | Content | Use Case |
|--------|---------|----------|
| **`main`** | v7 (nested: `PayPal_CommercePlatform/CommercePlatform/`) | Future development, new features |
| **`legacy/v2.1`** | v2.1 (flat: `Model/`, `Controller/`, etc.) | Current production server code |

**Which one do I need?**
- → Server currently runs `legacy/v2.1` (deployed 25.04.2026)
- → `main` is for testing and future v7 migration
- ⚠️ Do NOT mix them! File structures are completely different.

---

## Status (26.04.2026)

- ✅ Module active, Live mode (sandbox_flag=0)
- ✅ PayPal popup opens (Live)
- ✅ 5 funding sources: PAYPAL, PAYLATER, SEPA, CARD, APPLE_PAY
- ✅ AGB overlay for PayPal + bank transfer (CSS v10)
- ✅ Responsive design (480px–1024px+)
- ✅ **AMOUNT_MISMATCH fix** (26.04.2026)
- ✅ **SCA_WHEN_REQUIRED removed** from Smart Buttons (26.04.2026)

## Funding Configuration

| Funding | SDK Key | Button | Status |
|---------|---------|--------|--------|
| PAYPAL | Default | Gold, label='paypal' | ✅ Always active |
| PAYLATER | enable-funding | Black, installment | ✅ Config |
| SEPA | enable-funding | White, direct debit | ✅ Config |
| CARD | enable-funding | Credit card direct | ✅ Always active |
| APPLE_PAY | enable-funding | Apple Pay Button | ✅ Config (domain verification pending) |
| TRUSTLY | disable-funding | — | ❌ Disabled |
| CREDIT | disable-funding | — | ❌ Not available in DE |

## Installation

```bash
# For legacy/v2.1 (current production):
git clone -b legacy/v2.1 https://github.com/sgnilebi/magento2-paypal-ppcp-de.git

# For main/v7 (testing/future):
git clone -b main https://github.com/sgnilebi/magento2-paypal-ppcp-de.git
```

### Deploy to Magento

```bash
# 1. Copy to app/code/ (adjust path for your branch!)
# legacy/v2.1: cp -r Block Controller Model Plugin etc lib view registration.php composer.json /var/www/meinereitwelt/app/code/PayPal/CommercePlatform/
# main/v7: cp -r PayPal_CommercePlatform/CommercePlatform/* /var/www/meinereitwelt/app/code/PayPal/CommercePlatform/

# 2. Enable
sudo -u www-data php bin/magento module:enable PayPal_CommercePlatform
sudo -u www-data php bin/magento setup:upgrade

# 3. Compile and deploy
sudo -u www-data php bin/magento setup:di:compile
sudo -u www-data php bin/magento setup:static-content:deploy de_DE

# 4. Cache clean (NEVER rm -rf!)
sudo -u www-data php bin/magento cache:clean
```

## Critical Fixes (26.04.2026)

### 1. AMOUNT_MISMATCH

**Problem:** `getGrandTotal()` applies rounding after summing all components. PayPal validates `amount.value` == sum of `breakdown` (item_total + shipping + tax - discount). When rounded total ≠ rounded sum → AMOUNT_MISMATCH error.

**Real example:** 304.00€ order rejected because breakdown sum ≠ 304.00€

**Fix in `Model/Paypal/Order/Request.php`:**
```php
$amount = subtotal + shipping + tax - discount - giftcard - storecredit
```

### 2. SCA_WHEN_REQUIRED on Smart Buttons

**Problem:** `payment_source.card` with `SCA_WHEN_REQUIRED` was set for ALL payments, not just cards. PayPal API rejected it for PayPal/PayLater/SEPA.

**Fix:** Removed from global `createRequest()`. Only apply in ACDC/card-specific flow.

### 3. Previous Critical Fixes

| Fix | File | Issue | Symptom |
|-----|------|-------|---------|
| api-m.paypal.com | `lib/ProductionEnvironment.php` | PPCP needs different endpoint | `invalid_client` |
| Encrypted credentials | `Model/Config.php` | Magento 2.2.3 uses `0:2:` prefix | Buttons don't appear |
| CSRF Bypass | `Plugin/WebhookCsrfBypass.php` | M2.2.3 has no `CsrfAwareActionInterface` | Webhooks rejected |
| data-namespace | `paypal_sdk-adapter.js` | Must be `window.paypal` not `window.paypal_sdk` | `typeof paypal === 'undefined'` |

## Deployment Rules

1. **NEVER** run `php bin/magento` as root! Always as `www-data`
2. **NEVER** `rm -rf var/cache/*` — only `sudo -u www-data php bin/magento cache:clean`
3. **ALWAYS** backup before changes
4. Backend config in **"All Store Views"**, NOT "Default Store View"

## Backend Configuration

- **Path:** Stores → Configuration → Sales → Payment Methods → PayPal CommercePlatform
- **Important:** ALWAYS "All Store Views"!
- **Active:** Yes | **Sandbox Mode:** No (Live)
- **Client ID / Secret / Webhook ID:** Encrypted (0:2: prefix)
- **SEPA:** Yes | **Pay Later:** Yes | **Apple Pay:** Yes | **Messages:** Yes
- **ACDC:** No (card button instead of hosted-fields)

## PayPal Dashboard

- **App Name:** NVP SOAP Webhooks (REST API capable despite name)
- **Webhook URL:** https://www.meinereitwelt.de/paypalcheckout/webhooks
- **Webhook Events:** checkout order approved/completed/voided, payment capture declined/denied/refunded/pending/completed

## License

OSL-3.0 (see LICENSE.txt)

---

**German documentation:** See [README_EN.md](README_EN.md) (also covers fixes in English)
