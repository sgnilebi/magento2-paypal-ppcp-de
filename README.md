# PayPal PPCP (Complete Payments Platform) für Magento 2.2.3

**DE/EUR-Anpassung** des QBO Mexico PayPal Commerce Platform Moduls für meinereitwelt.de

## Status (24.04.2026)

- ✅ Modul aktiv, Live-Modus (sandbox_flag=0)
- ✅ PayPal Popup öffnet sich (Live)
- ✅ Funding-Eligibility: PAYPAL, CARD, SEPA, PAYLATER, TRUSTLY
- ⚠️ Layout-Probleme offen (siehe LAYOUT-ISSUES.md)

## Installation

```bash
# 1. Modul in app/code/PayPal/CommercePlatform/ kopieren
# 2. Module aktivieren
php bin/magento module:enable PayPal_CommercePlatform
php bin/magento setup:upgrade

# 3. DI kompilieren (ALS www-data!)
sudo -u www-data php bin/magento setup:di:compile

# 4. Static Content deployen
sudo -u www-data php bin/magento setup:static-content:deploy de_DE

# 5. PPCP-Dateien manuell kopieren (ÜBERSCHREIBT deploy!)
cp -r app/code/PayPal/CommercePlatform/view/frontend/web/js/ \
      pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/js/
cp -r app/code/PayPal/CommercePlatform/view/frontend/web/template/ \
      pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/template/
cp app/code/PayPal/CommercePlatform/view/frontend/web/css/paypalcp.css \
   pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/css/
chown -R www-data:www-data pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/

# 6. AGB-Fix JS kopieren
mkdir -p pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_Paypal/js/action/
cp app/design/frontend/TemplateMonster/theme762/Magento_Paypal/web/js/action/set-payment-method.js \
   pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_Paypal/js/action/
chown -R www-data:www-data pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_Paypal/

# 7. Cache leeren (ALS www-data!)
sudo -u www-data php bin/magento cache:clean
```

## KRITISCHE FIXES (ohne diese funktioniert nichts!)

### 1. ProductionEnvironment.php — API-Endpoint

**Problem:** Standardmäßig steht `https://api.paypal.com`, aber PPCP benötigt `https://api-m.paypal.com`
**Symptom:** `invalid_client` Fehler bei Live-API-Calls

```php
// lib/lib/PayPalCheckoutSdk/Core/ProductionEnvironment.php
// ZEILE ÄNDERN:
return "https://api-m.paypal.com";  // war: "https://api.paypal.com"
```

### 2. Config.php — EncryptorInterface für Credential-Decryption

**Problem:** Magento 2.2.3 `backend_model="Encrypted"` speichert Werte mit `0:2:` Prefix. Ohne Encryption können die Credentials nicht gelesen werden.
**Symptom:** PayPal-Buttons erscheinen nicht (hasCredentials = false)

```php
// Model/Config.php — Constructor:
protected $_encryptor;
public function __construct(..., EncryptorInterface $encryptor) {
    $this->_encryptor = $encryptor;
}

// Methoden hinzufügen:
protected function _decryptIfNeeded($value) {
    if (empty($value)) return $value;
    if (strpos($value, ':') !== false && preg_match('/^\d+:\d+:/', $value)) {
        try { return $this->_encryptor->decrypt($value); }
        catch (\Exception $e) { return $value; }
    }
    return $value;
}

public function getClientId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_CLIENT_ID)); }
public function getSecretId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_SECRET_ID)); }
public function getWebhookId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_WEBHOOK_ID)); }
```

### 3. WebhookCsrfBypass — CSRF-Bypass für Webhooks

**Problem:** Magento 2.2.3 hat kein `CsrfAwareActionInterface` (erst ab 2.3). Webhooks werden mit CSRF-Fehler abgewiesen.

**Lösung:** Plugin auf `CsrfValidator::aroundValidate()` das Webhook-Requests exempted.
- Siehe `Plugin/WebhookCsrfBypass.php`
- Registriert in `etc/frontend/di.xml`

### 4. paypal_sdk-adapter.js — KEIN data-namespace

**Problem:** `data-namespace="paypal_sdk"` bewirkt dass der SDK als `window.paypal_sdk` statt `window.paypal` registriert wird.
**Symptom:** `typeof paypal === 'undefined'` im Checkout

```javascript
// NICHT: script.setAttribute('data-namespace', 'paypal_sdk');
// KEIN data-namespace Attribute!
```

### 5. paypal_spb-method.js — paypalMethod und Button-Rendering

- `paypalMethod: 'paypalcp'` — MUSS mit ConfigProvider-Code übereinstimmen
- `getCode: function () { return this.paypalMethod; }` — ohne Parameter!
- `completeRender()` MUSS `loadSdk()` aufrufen
- Funding-Quellen: PAYPAL, SEPA, PAYLATER, TRUSTLY, APPLE_PAY

### 6. paypal-standard.html — Template

- Radio value='paypalcp' (NICHT 'paypalspb_paypal')
- Container-IDs: paypal-button-container, paypal-paylater-container, paypal-sepa-container, paypal-trustly-container
- `afterRender: completeRender()` — löst SDK-Load und Button-Rendering aus

## Backend-Konfiguration

- **Pfad:** Stores → Configuration → Sales → Payment Methods → PayPal CommercePlatform
- **WICHTIG:** IMMER "All Store Views" wählen, NICHT "Default Store View"
- **Aktiv:** Ja
- **Sandbox Mode:** Nein (Live)
- **Client ID / Secret / Webhook ID:** Verschlüsselt gespeichert (0:2: Prefix)
- **SEPA:** Ja
- **Pay Later:** Ja
- **Apple Pay:** Ja (Domain-Verifikation ausstehend)
- **Messages:** Ja
- **ACDC:** Nein

## PayPal Dashboard

- **App-Name:** NVP SOAP Webhooks (trotz des Namens REST API fähig!)
- **Client ID:** AfDfQIQwnz_Eb-56UeC8wJjV875vMeg7EIhzA9EYzP7EnNKpw_2awjz7hR5tpoqxUHkuZU1rz-EtLggd
- **Features:** ACDC, Apple Pay, Subscriptions, Vault, Messages
- **Webhook URL:** https://www.meinereitwelt.de/paypalcheckout/webhooks
- **Webhook ID:** 6YC568539A139993C
- **Webhook Events:** Checkout order approved/completed/voided, Payment capture declined/denied/refunded/pending/completed

## Funding Eligibility (DE, EUR)

| Funding Source | Eligible | Button-Typ |
|---------------|----------|------------|
| PAYPAL | ✅ | Gold, label='paypal' |
| PAYLATER | ✅ | Schwarz, label='paylater' (Ratenzahlung) |
| SEPA | ✅ | Weiß, label='pay' (SEPA Lastschrift) |
| CARD | ✅ | Im PayPal-Popup |
| TRUSTLY | ✅ | Schwarz, label='pay' (Banküberweisung) |
| CREDIT | ❌ | Nicht in DE |
| APPLE_PAY | ❌ | Domain-Verifikation ausstehend |

## WICHTIGE REGELN

1. **NIEMALS** `php bin/magento` als root! Immer als `www-data`
2. **NIEMALS** `rm -rf var/cache/*` — nur `sudo -u www-data php bin/magento cache:clean`
3. **deployed_version.txt** MUSS `1777036944` bleiben — NIEMALS ändern!
4. Nach `composer update`: ProductionEnvironment.php-Fix + WebhookCsrfBypass-Plugin + Config.php-Decryption
5. Nach `setup:static-content:deploy`: PPCP-Dateien manuell kopieren + AGB-Fix JS
6. Nach `setup:di:compile`: `chown -R www-data:www-data generated/`
7. Backend-Konfiguration IMMER in "All Store Views"

## Dateien auf dem Server

```
app/code/PayPal/CommercePlatform/
├── Controller/
│   ├── Order/Index.php          — createOrder API-Call
│   ├── Token/Index.php           — Client Token für ACDC
│   └── Webhook/Index.php        — Webhook-Handler (CSRF-Bypass)
├── Model/
│   ├── Config.php               ★ _decryptIfNeeded() Fix
│   ├── PayPalCPConfigProvider.php ★ enable-funding: sepa,paylater,trustly,applepay
│   ├── Paypal/
│   │   ├── Api.php              ★ ProductionEnvironment mit api-m.paypal.com
│   │   └── Core/                — AccessToken, GenerateToken
├── Plugin/
│   └── WebhookCsrfBypass.php    ★ CSRF-Bypass für Webhooks
├── etc/
│   ├── config.xml               — Standard-Konfiguration
│   ├── module.xml               — Modul-Registrierung
│   ├── frontend/di.xml          ★ CSRF-Bypass Plugin-Registrierung
│   └── adminhtml/system.xml     — Backend-Konfiguration
├── view/frontend/
│   ├── layout/checkout_index_index.xml  — paypalcp Renderer
│   ├── web/
│   │   ├── css/paypalcp.css     ★ Button-Styling
│   │   ├── js/view/payment/
│   │   │   ├── paypal_spb.js     — Renderer-Registrierung (type: 'paypalcp')
│   │   │   ├── paypal_sdk-adapter.js ★ KEIN data-namespace
│   │   │   └── paypal_token-adapter.js
│   │   └── js/view/payment/method-renderer/
│   │       └── paypal_spb-method.js ★ Button-Rendering, funding sources
│   └── template/payment/
│       └── paypal-standard.html  ★ Radio 'paypalcp', Container-IDs
└── lib/lib/PayPalCheckoutSdk/
    └── Core/
        └── ProductionEnvironment.php  ★ api-m.paypal.com Fix
```

★ = Modifizierte Dateien (abweichend vom QBO-Original)