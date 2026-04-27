# Changelog — PayPal PPCP (CommercePlatform) für Magento 2.2.3

## v2.2 (26.04.2026) — CRITICAL PayPal API Fixes

### 🐛 CRITICAL Behoben
- **AMOUNT_MISMATCH (304.00€ Bestellungen abgelehnt)**:
  - **Ursache:** `$amount = getGrandTotal()` rundete SUMME aller Komponenten anders als PayPal's `breakdown`-Validierung
  - **Fix:** `amount` jetzt aus Einzelkomponenten berechnet: `subtotal + shipping + tax - discount - giftcard - storecredit`
  - **Commit:** `bc4270d` (legacy/v2.1) + `30679a0` (main/v7)
  
- **SCA_WHEN_REQUIRED auf Smart Buttons (UNPROCESSABLE_ENTITY)**:
  - **Ursache:** `payment_source.card` mit `SCA_WHEN_REQUIRED` wurde für ALLE Zahlungen gesetzt (nicht nur Kreditkarten)
  - **Fix:** Block aus `createRequest()` entfernt, triggert nur noch bei ACDC/Card-Flow
  - **Commit:** gleicher wie oben

### 🔍 Analyse-Ergebnisse
- QBO (Mexicaner) hat `AMOUNT_MISMATCH` in `Model/Payment/Advanced/Payment.php` NUR bei Capture validiert, nicht bei Order Create
- Magento 2.2.3 `PaymentInterface` hat KEINEN `paymentData` Setter → `Property "PaymentData" does not have corresponding setter` (separates, harmoses Problem)

---

## v2.1 (25.04.2026) — AGB-Overlays, Vorkasse-Integration, CSS v10

### ✨ Neu
- **AGB-Overlay für PayPal-Sektion** – Halbtransparente Overlay-Schicht über allen PayPal-Buttons, solange AGB nicht akzeptiert sind (`watchAgbCheckboxes()` + `validateAgb()` in JS)
- **Vorkasse (Banküberweisung) AGB-Overlay** – Gleicher Mechanismus für die Vorkasse-Zahlungsmethode (CSS-Klasse `.vorkasse-method`)
- **CSS v10 (604 Zeilen)** – Robuste AGB-Ausrichtung: funktioniert mit BEIDEN Template-Varianten (custom span und Standard-Button), duale Selektoren, responsives Design
- **Card-Button (Kreditkarte)** – Kreditkarte als separater PayPal-Button (nicht nur im Popup), als eigene Funding-Quelle `enable-funding[] = 'card'`
- **Apple-Pay-Button** – Wird gerendert, sobald Domain-Verifikation abgeschlossen ist

### 🔧 Geändert
- **`Model/PayPalCPConfigProvider.php`**:
  - `$enableFunding` umgebaut: `'card'` immer aktiv, `'trustly'` entfernt (jetzt in `$disableFunding`)
  - `$disableFunding = ['credit', 'trustly']` – Trustly deaktiviert (PayPal-Dashboard zeigt Verfügbarkeit, aber nicht gewünscht)
  - Struktur bereinigt, klare Trennung zwischen enable/disable
- **`paypal_spb-method.js`**:
  - Neue Funktionen: `watchAgbCheckboxes()` (überwacht AGB-Checkboxen per Interval), `validateAgb()` (prüft und scrollt bei Fehler)
  - `updateButtonState()` – schaltet Overlay-Klasse `.ppcp-agb-disabled` auf PPCP- und Vorkasse-Sektion
  - 5 Button-Container: PAYPAL, PAYLATER, SEPA, CARD, APPLE_PAY
  - `renderFundingButton()` Helfer für konsistentes Button-Rendering
  - AGB-Validierung in `createOrder()` und `onApprove()`-Callbacks
- **`paypal-standard.html`**:
  - AGB-Overlay-Div (`ppcp-agb-overlay`) mit z-Index 10
  - Container-IDs: `paypal-button-container`, `-paylater-container`, `-sepa-container`, `-card-container`, `-applepay-container`
- **`paypalcp.css`** (v10, 604 Zeilen):
  - Duale Selektoren für AGB-Overlay (`.ppcp-agb-disabled` + `.payment-method._active`)
  - Vorkasse-Overlay (`.vorkasse-method .ppcp-agb-disabled`)
  - AGB-Text-Link-Styling (funktioniert mit span UND button-Element)
  - Radio-Buttons rund und mittig ausgerichtet
  - Responsive Breakpoints (480px, 640px, 768px, 1024px)
  - Mobile: größere Touch-Targets, optimierte Schriftgrößen
- **Vorkasse-Template** (`Magento_OfflinePayments/templates/banktransfer.html`):
  - `vorkasse-agb-overlay` Div für AGB-Abdeckung
- **Layout-XML**: AGB in `beforeMethods`-Position verschoben (global über beiden Zahlungsarten)

### 🐛 Behoben
- **AGB nicht auf Vorkasse anwendbar** – CSS-Overlay und JS-Validierung decken jetzt beide Zahlungsarten ab
- **AGB-Button statt Link** – Duales CSS für span (custom) und button (Standard) Elemente
- **Checkout nach `git checkout` zerstört** – Wiederherstellung aus Backup-Dateien vom 25.04.2026 14:53
- **paypalcp.css nach git-reset verloren** – Manuelle Rekonstruktion aus Chat-Log (v10, 604 Zeilen)
- **Server-Permissions** – `chown -R www-data:www-data` auf generated/, var/, pub/static/

### ⚠️ Bekannte Einschränkungen
- **Trustly** derzeit in `disable-funding` – obwohl PayPal-Dashboard Verfügbarkeit für DE zeigt. Bei Bedarf aktivierbar.
- **Giropay/EPS/Google Pay** – Nicht verfügbar (Giropay eingestellt, EPS nur AT, Google Pay erfordert Dashboard-Aktivierung)
- **Apple Pay** – Domain-Verifikation bei Apple ausstehend, Button erscheint erst nach erfolgreicher Verifikation

---

## v2.0 (24.04.2026) — Live-Modus, 5 Funding-Quellen

### ✨ Neu
- Live-Modus aktiviert (`sandbox_flag=0`)
- 5 Funding-Quellen: PAYPAL, PAYLATER, SEPA, CARD, TRUSTLY
- Apple-Pay-Konfiguration (Domain-Verifikation ausstehend)
- Messages-Komponente (PayPal Ratenzahlungs-Info)

### 🔧 Geändert
- `PayPalCPConfigProvider.php`: Funding-SDK-Konfiguration
- `paypal_spb-method.js`: Button-Rendering für alle Funding-Quellen
- `paypal-standard.html`: Template-Struktur mit 5 Containern

### 🐛 Behoben
- SDK-Ladefehler durch falsche `data-namespace`
- Grand-Total-Validierung für 0,00€ Bestellungen

---

## v1.1 (22.04.2026) — Credential-Decryption, CSRF-Bypass, API-Fix

### ✨ Neu
- `_decryptIfNeeded()` in Config.php – Entschlüsselung von `0:2:`-verschlüsselten Credentials
- `WebhookCsrfBypass`-Plugin – CSRF-Bypass für eingehende Webhooks (Magento 2.2.3 hat kein `CsrfAwareActionInterface`)
- ProductionEnvironment.php – API-Endpoint `api-m.paypal.com` statt `api.paypal.com`
- CSP-Whitelist für PayPal-SDK-Domains
- Deployment-Runbook im README

### 🐛 Behoben
- `invalid_client` bei Live-API-Calls (falscher API-Endpoint)
- Credentials nicht lesbar (fehlende Encryptor-Integration)
- Webhook-403-CSRF-Fehler (fehlender Bypass für Magento 2.2.3)
- `undefined` paypal SDK (data-namespace entfernt)

---

## v1.0 (Initial) — QBO Mexico PPCP Portierung

### ✨ Initiale Version
- Portierung des QBO Mexico PayPal Commerce Platform Moduls auf DE/EUR
- Basis-Funktionen: PayPal-Popup, SEPA, Pay Later
- Grundlegende Backend-Konfiguration
- Composer-2-Hotfix für PayPalCheckoutSdk
