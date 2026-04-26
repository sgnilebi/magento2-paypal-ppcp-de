# PayPal PPCP (Complete Payments Platform) for Magento 2.2.3

**DE/EUR Adaptation** of the QBO Mexico PayPal Commerce Platform module for [meinereitwelt.de](https://www.meinereitwelt.de)

## Status (26.04.2026)

- ✅ Module active, Live mode (sandbox_flag=0)
- ✅ PayPal popup opens (Live)
- ✅ 5 funding sources: PAYPAL, PAYLATER, SEPA, CARD, APPLE_PAY
- ✅ AGB overlay for PayPal + bank transfer (CSS v10)
- ✅ Responsive design (480px–1024px+)
- ✅ AMOUNT_MISMATCH fix (26.04.2026)
- ✅ SCA_WHEN_REQUIRED removed from Smart Buttons (26.04.2026)

## Funding Configuration

| Funding Source | SDK Key | Button | Status |
|---------------|---------|--------|--------|
| PAYPAL | — (Default) | Gold, label='paypal' | ✅ Always active |
| PAYLATER | `enable-funding` | Black, installment | ✅ Config |
| SEPA | `enable-funding` | White, direct debit | ✅ Config |
| CARD | `enable-funding` | Credit card extra | ✅ Always active |
| APPLE_PAY | `enable-funding` | Apple Pay Button | ✅ Config (domain verification pending) |
| TRUSTLY | `disable-funding` | — | ❌ Disabled |
| CREDIT | `disable-funding` | — | ❌ Not in DE |

**Current SDK parameters:**
```
enable-funding=sepa,paylater,applepay,card
disable-funding=credit,trustly
components=buttons,messages,applepay
```

## Installation

```bash
# 1. Copy module to app/code/PayPal/CommercePlatform/
# 2. Enable module
sudo -u www-data php bin/magento module:enable PayPal_CommercePlatform
sudo -u www-data php bin/magento setup:upgrade

# 3. Compile DI
sudo -u www-data php bin/magento setup:di:compile

# 4. Deploy static content
sudo -u www-data php bin/magento setup:static-content:deploy de_DE

# 5. Copy PPCP files manually (OVERWRITES deploy!)
cp -r app/code/PayPal/CommercePlatform/view/frontend/web/js/ \
      pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/js/
cp -r app/code/PayPal/CommercePlatform/view/frontend/web/template/ \
      pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/template/
cp app/code/PayPal/CommercePlatform/view/frontend/web/css/paypalcp.css \
   pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/css/
chown -R www-data:www-data pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/

# 6. Cache clean
sudo -u www-data php bin/magento cache:clean
```

## Critical Fixes (without these nothing works!)

### 1. ProductionEnvironment.php — API Endpoint

**Problem:** Default is `https://api.paypal.com`, but PPCP needs `https://api-m.paypal.com`
**Symptom:** `invalid_client` errors on Live API calls

```php
// lib/lib/PayPalCheckoutSdk/Core/ProductionEnvironment.php
return "https://api-m.paypal.com";  // was: "https://api.paypal.com"
```

### 2. Config.php — EncryptorInterface for Credential Decryption

**Problem:** Magento 2.2.3 `backend_model="Encrypted"` stores values with `0:2:` prefix.
**Symptom:** PayPal buttons don't appear (hasCredentials = false)

```php
// Model/Config.php — Constructor:
protected \$_encryptor;
public function __construct(..., EncryptorInterface $encryptor) {
    $this->_encryptor = $encryptor;
}

public function getClientId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_CLIENT_ID)); }
public function getSecretId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_SECRET_ID)); }
public function getWebhookId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_WEBHOOK_ID)); }
```

### 3. AMOUNT_MISMATCH Fix (26.04.2026)

**Problem:** `getGrandTotal()` applies rounding after summing components. PayPal validates `amount.value` == sum of `breakdown`.
**Fix:** Calculate amount from raw components:
```php
$amount = subtotal + shipping + tax - discount - giftcard - storecredit
```

### 4. SCA_WHEN_REQUIRED Removal (26.04.2026)

**Problem:** `payment_source.card` with `SCA_WHEN_REQUIRED` was set for ALL payments, confusing PayPal API for Smart Buttons.
**Fix:** Removed from global `createRequest()`, only apply in ACDC/card flow.

## Important Rules

1. **NEVER** run `php bin/magento` as root! Always as `www-data`
2. **NEVER** `rm -rf var/cache/*` — only `sudo -u www-data php bin/magento cache:clean`
3. **ALWAYS** backup before changes
4. Backend config in "All Store Views", NOT "Default Store View"

## Backend Configuration

- **Path:** Stores → Configuration → Sales → Payment Methods → PayPal CommercePlatform
- **Important:** ALWAYS "All Store Views", NEVER "Default Store View"
- **Active:** Yes
- **Sandbox Mode:** No (Live)
- **Client ID / Secret / Webhook ID:** Encrypted (0:2: prefix)
- **SEPA:** Yes
- **Pay Later:** Yes
- **Apple Pay:** Yes (domain verification pending)
- **Messages:** Yes
- **ACDC:** No (card button instead of hosted-fields)

## PayPal Dashboard

- **App Name:** NVP SOAP Webhooks (despite name, REST API capable)
- **Features:** ACDC, Apple Pay, Subscriptions, Vault, Messages
- **Webhook URL:** https://www.meinereitwelt.de/paypalcheckout/webhooks
- **Webhook Events:** Checkout order approved/completed/voided, Payment capture declined/denied/refunded/pending/completed

## File Structure (modified files only)

```
app/code/PayPal/CommercePlatform/
├── Model/
│   ├── Config.php                      ★ _decryptIfNeeded() Fix
│   ├── PayPalCPConfigProvider.php      ★ Funding config
│   └── Paypal/
│       ├── Api.php                     ★ ProductionEnvironment with api-m.paypal.com
│       └── Order/Request.php           ★ AMOUNT_MISMATCH + SCA fixes (26.04.2026)
├── Plugin/WebhookCsrfBypass.php        ★ CSRF bypass for webhooks
├── etc/frontend/di.xml                 ★ CSRF bypass registration
└── view/frontend/web/
    ├── css/paypalcp.css                ★ CSS v10 (AGB overlay, responsive)
    └── js/view/payment/method-renderer/
        └── paypal_spb-method.js        ★ AGB watch/validate, 5 buttons

★ = Modified files (different from QBO original)
```

## License

OSL-3.0 (see LICENSE.txt)
