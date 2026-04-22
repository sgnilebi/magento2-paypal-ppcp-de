# PayPal PPCP für Magento 2.2.3 (DE/EUR)

PayPal Commerce Platform (PPCP) Modul für Magento 2.2.3, angepasst für den deutschen Markt.

Basiert auf [qbo-tech/magento2-paypal-commerce-platform](https://github.com/qbo-tech/magento2-paypal-commerce-platform) (OSL-3.0), adaptiert von Mexiko/MXN nach Deutschland/EUR.

## Zahlungsmethoden

| Methode | SDK-Parameter | Beschreibung |
|---------|---------------|--------------|
| PayPal | (default) | PayPal Smart Payment Buttons |
| Kreditkarte (ACDC) | `hosted-fields` | Kreditkartenfelder direkt im Checkout |
| SEPA-Lastschrift | `enable-funding=sepa` | Lastschrift für DE-Kunden |
| Pay Later | `enable-funding=paylater` | "Später bezahlen" (30d), "In 3 Raten" (ab 30€), Ratenzahlung (ab 199€) |
| Pay Later Messages | `components=messages` | Informations-Widget beim Checkout |
| Apple Pay | `enable-funding=applepay` | Erfordert Apple Developer Account + Domain-Verifizierung |

## Voraussetzungen

- Magento 2.2.3+
- PHP 7.0+ (getestet mit 7.0.33)
- PayPal Business Account mit PPCP freigeschaltet
- **Kein Composer nötig** — SDK ist eingebettet (siehe unten)

## Installation

Siehe [PPCP_DEPLOY_RUNBOOK.md](../../magento_import/PPCP_DEPLOY_RUNBOOK.md) für vollständige Deployment-Anleitung.

Kurzform:
```bash
# 1. Modul-Dateien kopieren
cp -r app/code/PayPal/CommercePlatform/ /var/www/meinereitwelt/app/code/PayPal/

# 2. Modul aktivieren
sudo -u www-data php bin/magento module:enable PayPal_CommercePlatform
sudo -u www-data php bin/magento setup:upgrade
sudo -u www-data php bin/magento setup:di:compile
sudo -u www-data php bin/magento setup:static-content:deploy de_DE
sudo -u www-data php bin/magento cache:clean

# 3. Im Backend konfigurieren
# Stores → Configuration → Payment → PayPal Checkout
```

## SDK-Bundling

Das PayPal Checkout SDK (`paypal/paypal-checkout-sdk`) wird nicht über Composer installiert, da der Server Composer 1.5.2 hat (zu alt für packagist.org). Stattdessen sind die SDK-Klassen eingebettet in:

- `lib/PayPalCheckoutSdk/` — Fork von `qbo-tech/paypal-checkout-sdk:1.0.2` (Apache 2.0)
- `lib/PayPalHttp/` — Fork von `qbo-tech/paypalhttp:1.0.1` (MIT)

Namespaces sind identisch mit dem Original-SDK (`PayPalCheckoutSdk\*`, `PayPalHttp\*`).

Siehe `lib/NOTICE.md` für Attribution.

## Bugfixes gegenüber dem QBO-Original

| # | Fix | Issue |
|---|-----|-------|
| 1 | `data.id` → `data.orderID` (HostedFields) | PayPal SDK v5 Rückgabe-Format |
| 2 | `CHECKOUT.ORDER.APPROVED` Webhook-Event | Wurde ignoriert |
| 3 | `async: false` → Promise + sync Fallback | Browser-Thread wurde blockiert |
| 4 | SCA_WHEN_REQUIRED für EU PSD2 | 3D Secure fehlte |
| 5 | brand_name, return_url, cancel_url | PayPal-Popup UX fehlte |
| 6 | Template-Restrukturierung (#21) | PayPal + Karte als separate payment-method Divs |
| 7 | validateGrandTotal() (#18) | Warenkorb-Änderung → Betragsabweichung |
| 8 | SDK enable-funding/disable-funding dynamisch | SEPA, Pay Later, Apple Pay |
| 9 | Backend-Konfiguration Funding Sources | Neue Felder in system.xml |
| 10 | Credentials-Fehlerbehandlung (#14/#15) | Freundliche Meldung wenn Client ID/Secret fehlen |

## Entfernte Features (nicht für DE)

- Oxxo (nur MX)
- Installments / MSI (nur MX)
- Billing Agreement / Reference Transactions
- Vault (Karten speichern)
- FraudNet Integration
- `authorizationBasic` im Frontend (Sicherheitsrisiko)

## Lizenz

OSL-3.0 (wie das QBO-Original)

Eingebettete Bibliotheken:
- PayPal Checkout SDK: Apache 2.0
- PayPal HTTP: MIT