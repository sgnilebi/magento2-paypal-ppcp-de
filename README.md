# magento2-paypal-ppcp-de

**PayPal PPCP (Complete Payments Platform) für Magento 2.2.3 — DE/EUR**

> **Attribution Notice:** This is a derivative work based on [QBO Tech's PayPal Commerce Platform module](https://github.com/qbo-tech/magento2-paypal-commerce-platform) (v1.7.1), licensed under the Open Software License 3.0 (OSL-3.0). Significant modifications have been made for the German market — see below. This derivative work is also licensed under OSL-3.0.

---

## Was wurde geändert?

| Bereich | Original (QBO/Mexico) | Angepasst (DE/EUR) |
|---------|----------------------|-------------------|
| Sprache/Lokalisierung | Mexiko, MXN, Spanisch | Deutschland, EUR, Deutsch |
| Zahlungsmethoden | PayPal + Oxxo + STC | PayPal Smart Buttons + ACDC (Kreditkarten) |
| Billing Agreements | Ja (Token, Financing) | Nein — komplett entfernt |
| Vault (speichern von Karten) | Ja | Nein — entfernt |
| FraudNet (Betrugserkennung) | Ja | Nein — entfernt |
| authorizationBasic (Frontend) | ❌ Client-Secret an JS gesendet | ✅ Komplett entfernt (Security Fix) |
| CSRF Skip Plugin | ❌ Falscher Modulname, kaputt | ✅ Entfernt (Webhook nutzt CsrfAwareActionInterface) |
| PHP 7.0 | Nein (7.1+ Features) | ✅ Ja (nullable types, strict_types entfernt) |
| Dateien | 117 | 46 (60% Reduktion) |
| Zeilen | ~8.200 | ~3.600 (56% Reduktion) |

---

## Installation

### 1. Modul kopieren

```bash
cd /var/www/meinereitwelt/app/code/PayPal/
git clone https://github.com/sgnilebi/magento2-paypal-ppcp-de.git CommercePlatform
```

### 2. PayPal SDK installieren

```bash
cd /var/www/meinereitwelt
composer require paypal/paypal-checkout-sdk:^1.0 --ignore-platform-reqs
```

### 3. Magento Setup (IMMER als www-data!)

```bash
sudo -u www-data php bin/magento setup:upgrade
sudo -u www-data php bin/magento setup:di:compile
sudo -u www-data php bin/magento setup:static-content:deploy de_DE
sudo -u www-data php bin/magento cache:clean
```

⚠️ **WICHTIG**: Niemals `php bin/magento` als root! Immer als `www-data`.

---

## Konfiguration

### PayPal Sandbox App erstellen

1. Gehe zu https://developer.paypal.com/dashboard/
2. Erstelle eine neue App unter "Apps & Credentials"
3. Sandbox-Modus: Client-ID + Secret kopieren

### Backend-Einstellungen

Stores → Konfiguration → Verkäufe → Zahlungsmethoden → PayPal PPCP

| Einstellung | Beschreibung |
|-------------|-------------|
| Aktiviert | Ja |
| Sandbox-Modus | Ja (zum Testen), Nein (Live) |
| Client-ID | Von PayPal Developer Dashboard |
| Client-Secret | Von PayPal Developer Dashboard |
| ACDC aktivieren | Ja (Kreditkarten-Felder) |
| Button-Stil | Color, Shape, Size konfigurierbar |

### Webhook einrichten

1. In PayPal Developer Dashboard: Webhook erstellen
2. URL: `https://www.meinereitwelt.de/paypalcheckout/webhooks`
3. Event-Typen:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
   - `CHECKOUT.ORDER.APPROVED`

---

## Module-Struktur

```
PayPal/CommercePlatform/
├── Block/
│   └── Info.php                          # Admin Zahlungs-Info
├── Controller/
│   ├── Order/Index.php                   # AJAX Bestellung erstellen
│   ├── Token/Index.php                   # Client-Token für ACDC
│   └── Webhooks/Index.php               # Webhook Handler
├── Logger/
│   └── Handler.php                       # Debug Logger
├── Model/
│   ├── Config.php                        # Modul-Konfiguration
│   ├── Config/Source/ButtonOptions.php   # Button-Stil Optionen
│   ├── PayPalCPConfigProvider.php        # Checkout JS Config
│   ├── Payment/
│   │   ├── Advanced/Payment.php          # ACDC Zahlungsmethode
│   │   └── SPB/Payment.php              # Smart Payment Buttons
│   └── Paypal/
│       ├── Api.php                       # PayPal API Wrapper
│       ├── Core/
│       │   ├── AccessTokenRequest.php    # OAuth Token
│       │   ├── GenerateTokenRequest.php  # Client Token
│       │   └── Token.php                # Token Orchestrator
│       ├── Order/Request.php            # Bestellung an PayPal
│       └── Webhooks/
│           ├── Event.php                # Webhook Events
│           └── VerifyWebhookSignatureRequest.php
├── etc/
│   ├── module.xml                       # Modul-Registrierung
│   ├── config.xml                       # Default-Konfiguration
│   ├── payment.xml                      # Zahlungsmethoden
│   ├── csp_whitelist.xml               # CSP Whitelist
│   ├── adminhtml/system.xml            # Backend-Konfiguration
│   └── frontend/
│       ├── di.xml                       # ConfigProvider
│       └── routes.xml                   # Route: paypalcheckout
├── view/
│   ├── adminhtml/templates/info/default.phtml
│   └── frontend/
│       ├── layout/checkout_index_index.xml
│       ├── templates/
│       │   ├── info/default.phtml
│       │   └── success.phtml
│       ├── requirejs-config.js
│       ├── web/
│       │   ├── css/paypalcp.css
│       │   ├── images/ (visa, mastercard, amex SVGs)
│       │   ├── js/view/payment/
│       │   │   ├── paypal_spb.js
│       │   │   ├── paypal_advanced.js
│       │   │   ├── paypal_sdk-adapter.js
│       │   │   └── paypal_token-adapter.js
│       │   ├── js/view/payment/method-renderer/
│       │   │   ├── paypal_spb-method.js
│       │   │   └── paypaladvanced-method.js
│       │   └── template/payment/
│       │       ├── paypal-standard.html
│       │       ├── paypal_spb.html
│       │       └── paypaladvanced-form.html
│       └── ...
├── registration.php
└── composer.json
```

---

## Security

- ✅ **Kein Client-Secret im Frontend** — authorizationBasic komplett entfernt
- ✅ **Client-Token** wird serverseitig generiert, nur temporär gültig
- ✅ **CSRF-Schutz** — Webhook nutzt CsrfAwareActionInterface (kein fehlerhaftes Skip-Plugin)
- ✅ **CSP-Whitelist** — Nur PayPal-Domains erlaubt

---

## Kompatibilität

| Voraussetzung | Version |
|---------------|---------|
| Magento | 2.2.x |
| PHP | 7.0+ |
| paypal/paypal-checkout-sdk | ^1.0 (PHP 5.3+) |

---

## ⚠️ Bekannte Einschränkungen

- Kein Vault (Karten speichern) — absichtlich entfernt
- Kein FraudNet — absichtlich entfernt (PayPal hat eigene Betrugserkennung)
- Keine Ratenzahlung — in DE nicht unterstützt
- Kein Billing Agreement / Tokenized Payments
- Nach `setup:static-content:deploy de_DE` muss ggf. das PayPal set-payment-method.js Override manuell kopiert werden (falls das alte PayPal Express Theme-Override noch aktiv ist — siehe PayPal-Fix Dokumentation)

---

## Lizenz

**Open Software License 3.0 (OSL-3.0)**

Dieses Modul ist ein Derivative Work des [QBO PayPal Commerce Platform Moduls](https://github.com/qbo-tech/magento2-paypal-commerce-platform) von QBO Tech. Das Original steht unter OSL-3.0, und gemäß §1c der Lizenz wird dieses Derivative Work unter der gleichen Lizenz veröffentlicht.

Siehe [LICENSE.txt](LICENSE.txt) für den vollständigen Lizenztext.

**Original-Autor:** QBO Tech — https://github.com/qbo-tech  
**Derivative Work:** sgnilebi — https://github.com/sgnilebi  
**Änderungen:** Lokalisierung DE/EUR, Entfernung von Oxxo/STC/Billing/Vault/FraudNet, PHP 7.0 Kompatibilität, Security Fixes