# PayPal PPCP (Complete Payments Platform) für Magento 2.2.3

**DE/EUR-Anpassung** des QBO Mexico PayPal Commerce Platform Moduls für [meinereitwelt.de](https://www.meinereitwelt.de)

## Status (26.04.2026)

- ✅ Modul aktiv, Live-Modus (sandbox_flag=0)
- ✅ PayPal Popup öffnet sich (Live)
- ✅ 5 Funding-Quellen: PAYPAL, PAYLATER, SEPA, CARD, APPLE_PAY
- ✅ AGB-Overlay für PayPal + Vorkasse (CSS v10)
- ✅ Responsives Design (480px–1024px+)
- ✅ **AMOUNT_MISMATCH Fix** — Amount jetzt aus Einzelkomponenten, nicht `getGrandTotal()` (26.04.2026)
- ✅ **SCA_WHEN_REQUIRED entfernt** von Smart Buttons — nur noch bei ACDC/Karten-Flow (26.04.2026)
- ✅ **PaymentData Warnung identifiziert** — harmlose M2.2.3 Limitation

## Funding-Konfiguration

| Funding Source | SDK-Key | Button | Status |
|---------------|---------|--------|--------|
| PAYPAL | – (Default) | Gold, label='paypal' | ✅ Immer aktiv |
| PAYLATER | `enable-funding` | Schwarz, Ratenzahlung | ✅ Config |
| SEPA | `enable-funding` | Weiß, Lastschrift | ✅ Config |
| CARD | `enable-funding` | Kreditkarte extra | ✅ Immer aktiv |
| APPLE_PAY | `enable-funding` | Apple Pay Button | ✅ Config (Domain-Verifikation ausstehend) |
| TRUSTLY | `disable-funding` | – | ❌ Deaktiviert |
| CREDIT | `disable-funding` | – | ❌ Nicht in DE |
| GIROPAY | – | – | ❌ Eingestellt (2024) |
| EPS | – | – | ❌ Nur Österreich |
| GOOGLE_PAY | – | – | ❌ Erfordert Dashboard-Aktivierung |

**SDK-Parameter aktuell:**
```
enable-funding=sepa,paylater,applepay,card
disable-funding=credit,trustly
components=buttons,messages,applepay
```

## AGB-Overlay-System (v2.1)

Das Modul erzwingt AGB-Akzeptanz vor Zahlungsauslösung – für ALLE Zahlungsarten:

### Wie es funktioniert
1. **JS** (`paypal_spb-method.js`):
   - `watchAgbCheckboxes()` – Überwacht AGB-Checkboxen (Standard und Custom), aktualisiert Overlay-Status
   - `validateAgb()` – Prüft auf unchecked, scrollt zur Checkbox, blendet rot ein
   - `createOrder()` – Bricht ab wenn AGB nicht checked (Promise-return)
   - `updateButtonState()` – Schaltet `.ppcp-agb-disabled` auf PPCP- und Vorkasse-Sektion
2. **CSS** (`paypalcp.css` v10):
   - `.ppcp-agb-disabled` overlay mit halbtransparentem Hintergrund (rgba(255,255,255,0.8))
   - Z-Index 10, absolute Positionierung über den Buttons
   - Vorkasse: `.vorkasse-method .ppcp-agb-disabled`
   - Duale Selektoren für AGB-Text-Link (funktioniert mit span UND button)
3. **Template** (`paypal-standard.html`):
   - Overlay-Div `.ppcp-agb-overlay` mit "Bitte akzeptieren Sie die AGB"-Nachricht

### Betroffene Dateien
```
app/code/PayPal/CommercePlatform/
├── Model/PayPalCPConfigProvider.php       – Funding-Konfiguration
└── view/frontend/web/
    ├── css/paypalcp.css                  – AGB-Overlay, Vorkasse, Responsive (604 Zeilen)
    ├── js/view/payment/method-renderer/
    │   └── paypal_spb-method.js          – AGB-Watch/Validate, Button-Rendering
    └── template/payment/
        └── paypal-standard.html          – AGB-Overlay, 5 Button-Container

app/design/frontend/TemplateMonster/theme762/
├── Magento_CheckoutAgreements/layout/
│   └── checkout_index_index.xml          – AGB in beforeMethods
└── Magento_OfflinePayments/templates/
    └── banktransfer.html                 – Vorkasse AGB-Overlay
```

## Installation

```bash
# 1. Modul in app/code/PayPal/CommercePlatform/ kopieren
# 2. Module aktivieren
sudo -u www-data php bin/magento module:enable PayPal_CommercePlatform
sudo -u www-data php bin/magento setup:upgrade

# 3. DI kompilieren
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

# 6. AGB-Fix JS kopieren (falls AGB-Overlay nicht funktioniert)
mkdir -p pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_Paypal/js/action/
cp app/design/frontend/TemplateMonster/theme762/Magento_Paypal/web/js/action/set-payment-method.js \
   pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_Paypal/js/action/
chown -R www-data:www-data pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_Paypal/

# 7. Cache leeren
sudo -u www-data php bin/magento cache:clean
```

## Deployment-Schnellbefehl (nur PPCP-Updates)

```bash
cd /var/www/meinereitwelt
sudo -u www-data php bin/magento setup:static-content:deploy de_DE

cp -r app/code/PayPal/CommercePlatform/view/frontend/web/js/ \
      pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/js/
cp -r app/code/PayPal/CommercePlatform/view/frontend/web/template/ \
      pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/template/
cp app/code/PayPal/CommercePlatform/view/frontend/web/css/paypalcp.css \
   pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/css/
chown -R www-data:www-data pub/static/frontend/TemplateMonster/theme762/de_DE/PayPal_CommercePlatform/

# Vorkasse-Template deployen
cp app/design/frontend/TemplateMonster/theme762/Magento_OfflinePayments/templates/banktransfer.html \
   pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_OfflinePayments/templates/
chown www-data:www-data pub/static/frontend/TemplateMonster/theme762/de_DE/Magento_OfflinePayments/templates/banktransfer.html

sudo -u www-data php bin/magento cache:clean
```

## KRITISCHE FIXES (ohne diese funktioniert nichts!)

### 1. ProductionEnvironment.php – API-Endpoint

**Problem:** Standardmäßig steht `https://api.paypal.com`, aber PPCP benötigt `https://api-m.paypal.com`
**Symptom:** `invalid_client` Fehler bei Live-API-Calls

```php
// lib/lib/PayPalCheckoutSdk/Core/ProductionEnvironment.php
return "https://api-m.paypal.com";  // war: "https://api.paypal.com"
```

### 2. Config.php – EncryptorInterface für Credential-Decryption

**Problem:** Magento 2.2.3 `backend_model="Encrypted"` speichert Werte mit `0:2:` Prefix.
**Symptom:** PayPal-Buttons erscheinen nicht (hasCredentials = false)

```php
// Model/Config.php – Constructor:
protected $_encryptor;
public function __construct(..., EncryptorInterface $encryptor) {
    $this->_encryptor = $encryptor;
}

public function getClientId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_CLIENT_ID)); }
public function getSecretId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_SECRET_ID)); }
public function getWebhookId() { return $this->_decryptIfNeeded($this->getConfigValue(self::CONFIG_XML_WEBHOOK_ID)); }
```

### 3. WebhookCsrfBypass – CSRF-Bypass für Webhooks

**Problem:** Magento 2.2.3 hat kein `CsrfAwareActionInterface` (erst ab 2.3). Webhooks werden mit CSRF-Fehler abgewiesen.

**Lösung:** Plugin auf `CsrfValidator::aroundValidate()` das Webhook-Requests exempted.
- Siehe `Plugin/WebhookCsrfBypass.php`
- Registriert in `etc/frontend/di.xml`

### 4. paypal_sdk-adapter.js – KEIN data-namespace

**Problem:** `data-namespace="paypal_sdk"` bewirkt dass der SDK als `window.paypal_sdk` statt `window.paypal` registriert wird.
**Symptom:** `typeof paypal === 'undefined'` im Checkout

```javascript
// NICHT: script.setAttribute('data-namespace', 'paypal_sdk');
// KEIN data-namespace Attribute!
```

## WICHTIGE REGELN

1. **NIEMALS** `php bin/magento` als root! Immer als `www-data`
2. **NIEMALS** `rm -rf var/cache/*` – nur `sudo -u www-data php bin/magento cache:clean`
3. **NIEMALS** `git checkout -- datei.php` ohne vorherigen Backup! Verwendet `git restore` oder erstellt vorher Kopien.
4. **deployed_version.txt** MUSS `1777036944` bleiben – NIEMALS ändern!
5. Nach `composer update`: ProductionEnvironment.php-Fix + WebhookCsrfBypass-Plugin + Config.php-Decryption prüfen
6. Nach `setup:static-content:deploy`: PPCP-Dateien + Vorkasse-Template kopieren (siehe Deployment-Befehl oben)
7. Nach `setup:di:compile`: `chown -R www-data:www-data generated/ var/`
8. Backend-Konfiguration IMMER in "All Store Views" bearbeiten, nicht "Default Store View"
9. Vor Code-Änderungen: Backup erstellen! Server: `cp -r app/code/PayPal/CommercePlatform app/code/PayPal/CommercePlatform.BACKUP.DATUM` + Lokal: alle 4 Schlüsseldateien (ConfigProvider, JS, HTML, CSS)

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
- **ACDC:** Nein (Card-Button statt hosted-fields)

## PayPal Dashboard

- **App-Name:** NVP SOAP Webhooks (trotz Namens REST API fähig!)
- **Features:** ACDC, Apple Pay, Subscriptions, Vault, Messages
- **Webhook URL:** https://www.meinereitwelt.de/paypalcheckout/webhooks
- **Webhook ID:** 6YC568539A139993C
- **Webhook Events:** Checkout order approved/completed/voided, Payment capture declined/denied/refunded/pending/completed

## Dateistruktur (nur modifizierte Dateien)

```
app/code/PayPal/CommercePlatform/
├── CHANGELOG.md                        ★ Versionshistorie
├── Controller/
│   ├── Order/Index.php                  — createOrder API-Call
│   ├── Token/Index.php                  — Client Token für ACDC
│   └── Webhook/Index.php               — Webhook-Handler (CSRF-Bypass)
├── Model/
│   ├── Config.php                      ★ _decryptIfNeeded() Fix
│   ├── PayPalCPConfigProvider.php      ★ enable-funding: sepa,paylater,applepay,card; disable: credit,trustly
│   ├── Paypal/
│   │   ├── Api.php                     ★ ProductionEnvironment mit api-m.paypal.com
│   │   └── Core/                       — AccessToken, GenerateToken
├── Plugin/
│   └── WebhookCsrfBypass.php           ★ CSRF-Bypass für Webhooks
├── etc/
│   ├── config.xml                      — Standard-Konfiguration
│   ├── module.xml                      — Modul-Registrierung
│   ├── frontend/di.xml                 ★ CSRF-Bypass Plugin-Registrierung
│   └── adminhtml/system.xml            — Backend-Konfiguration
├── view/frontend/
│   ├── layout/checkout_index_index.xml — paypalcp Renderer
│   └── web/
│       ├── css/paypalcp.css            ★ CSS v10 (AGB-Overlay, Vorkasse, Responsive)
│       ├── js/view/payment/
│       │   ├── paypal_spb.js           — Renderer-Registrierung (type: 'paypalcp')
│       │   ├── paypal_sdk-adapter.js   ★ KEIN data-namespace
│       │   └── paypal_token-adapter.js
│       └── js/view/payment/method-renderer/
│           └── paypal_spb-method.js    ★ AGB Watch/Validate, 5 Funding-Buttons
└── view/frontend/web/template/payment/
    └── paypal-standard.html             ★ AGB-Overlay, 5 Container

★ = Modifizierte Dateien (abweichend vom QBO-Original)
```
