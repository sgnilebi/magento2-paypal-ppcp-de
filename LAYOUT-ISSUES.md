# Layout-Probleme — PayPal PPCP Checkout

## Stand: 26.04.2026

✅ **Alle CRITICAL Bugs behoben** (v2.2, 26.04.2026). Layout-Probleme sind kosmetisch.

---

## ✅ Behoben: CRITICAL – AMOUNT_MISMATCH (v2.2, 26.04.)

**Fix:** Siehe CHANGELOG.md und README.md / README_DE.md

---

## ✅ Behoben: CRITICAL – SCA_WHEN_REQUIRED (v2.2, 26.04.)

**Fix:** Siehe CHANGELOG.md und README.md / README_DE.md

## Stand: 24.04.2026

Die PayPal-Buttons funktionieren prinzipiell (Live-Modus, Popup öffnet sich), aber das optische Layout im Checkout hat mehrere Probleme.

---

## Problem 1: PayPal-Buttons zu groß

**Beschreibung:** Die PayPal-Buttons (gelb, 40px im JS-Style) werden von PayPal SDK deutlich größer gerendert als erwartet. Der goldene PayPal-Button dominiert den gesamten Checkout-Bereich optisch.

**Ursache:** PayPal SDK rendert Buttons in einem iframe mit eigenem Styling. Die `height: 40` im JS-Style wird als Minimum interpretiert, aber das SDK fügt Padding, Label-Höhe und Tagline hinzu.

**Mögliche Fixes:**
- `tagline: false` im Button-Style (reduziert Höhe)
- `height: 35` oder `height: 40` (kleinere Werte werden oft ignoriert)
- CSS `max-width: 350px` auf Container begrenzen
- `layout: 'vertical'` beibehalten (horizontal sieht chaotisch aus bei mehreren Funding-Quellen)

**Dateien:**
- `paypal_spb-method.js` — `renderButton()` Style-Parameter
- `paypalcp.css` — Container-Styling

---

## Problem 2: SEPA-Button öffnet PayPal-Popup statt SEPA-Flow

**Beschreibung:** Der SEPA-Button (schwarz, label 'pay') wird gerendert, aber beim Klicken öffnet sich das PayPal-Login-Popup statt eines SEPA-Lastschrift-Formulars.

**Ursache:** Die `createOrder()` Funktion im JS ist für alle Buttons gleich — sie erstellt eine PayPal Order. Der PayPal SDK routed die Funding-Source automatisch. Bei SEPA soll der User direkt ein SEPA-Formular sehen, nicht das PayPal-Login. Dies kann ein SDK-Konfigurationsproblem sein (fehlender `payment_source` Parameter) oder ein Problem mit der `intent=capture` Konfiguration.

**Mögliche Fixes:**
- SEPA-Button mit eigenem `createOrder` das `payment_source: {sepa: {...}}` übergibt
- Prüfen ob `components=hosted-fields` für SEPA benötigt wird
- Alternative: SEPA als "im PayPal-Fenster verfügbar" deklarieren und keinen separaten Button rendern

**Hinweis:** Im Eligibility-Test auf der Seite zeigt SEPA als `ELIGIBLE` — aber das bedeutet nur dass der SDK den Button CAN rendern, nicht dass der Checkout-Flow korrekt ist.

---

## Problem 3: Pay Later / Ratenzahlung Button Label nicht klar

**Beschreibung:** Der Pay Later Button (`label: 'paylater'`) zeigt evtl. "Später bezahlen" oder "Ratenzahlung" — aber aus dem Button-Design geht nicht klar hervor dass es sich um Ratenzahlung handelt. Der Button ist schwarz und kleiner als der PayPal-Button, wirkt wie eine Nebensache.

**Mögliche Fixes:**
- Expliziten Text-Container über dem Button: "Oder in Raten zahlen:"
- `label: 'installment'` testen (PayPal SDK unterstützt verschiedene Labels)
- CSS: deutlichere visuelle Trennung zwischen PayPal und Pay Later
- Pay Later Messages Widget (Ratenzahlung-Info-Text oben) aktivieren

---

## Problem 4: Radio-Button über PayPal-Bereich verwirrend

**Beschreibung:** Magento's OnePage Checkout zeigt jeden Payment-Provider in einem Akkordeon mit Radio-Button. Über dem PayPal-Bereich steht ein Radio-Button mit "PayPal" Label. Der User muss zuerst den Radio-Button klicken, DANN erscheinen die PayPal-Buttons. Das ist verwirrend weil der goldene PayPal-Button selbst schon wie ein Checkout-Button aussieht.

**Ursache:** Standard Magento-Verhalten für Payment-Akkordeon. `completeRender()` macht `$('.ppcp.payment-method').removeClass('_active')` um den Akkordeon-Effekt korrekt zu steuern.

**Mögliche Fixes:**
- PayPal-Sektion als "offen" anzeigen beim Laden (CSS `_active` Klasse)
- Radio-Button und PayPal-Button verknüpfen: Klick auf PayPal-Button setzt auch den Radio-Button
- Layout-XML: PayPal-Sektion expandiert anzeigen, andere kollabiert
- Eigener Checkout-Step nur für PayPal (aufwendiger)

---

## Problem 5: AGB/Widerruf-Checkboxen Zuordnung unklar

**Beschreibung:** Im Checkout stehen AGB- und Widerrufs-Checkboxen innerhalb des PayPal-Bereichs. Es ist nicht klar ob diese nur für PayPal gelten oder generell.

**Ursache:** Das Template bindet `$parent.getRegion('before-place-order')` ein, was die Checkout-Agreements (AGB) rendert. Diese erscheinen INNERHALB des PayPal-Akkordeons.

**Mögliche Fixes:**
- Checkout-Agreements GLOBAL platzieren (nicht pro Payment-Method)
- Template-Ausschnitt für Agreements entfernen und global im Checkout platzieren
- CSS: Agreements-Block optisch vom PayPal-Bereich trennen

---

## Problem 6: Magento Akkordeon-Verhalten

**Beschreibung:** Wenn der User auf "PayPal" klickt, öffnet sich das Akkordeon und zeigt die Buttons. Wenn der User dann auf "Vorkasse" klickt, klappt das PayPal-Akkordeon zu und die Buttons bleiben gerendert aber unsichtbar. Beim erneuten Klick auf "PayPal" muss das Akkordeon wieder aufklappen und die Buttons müssen sichtbar werden.

**Aktuelles Verhalten:** `completeRender()` macht `$('.ppcp.payment-method').removeClass('_active')` — das klappt den Bereich direkt nach dem Rendern wieder zu. Das Original-QBO-Modul hat das auch so gemacht.

**Mögliche Fixes:**
- `renderWhenVisible()` Pattern: Beobachte Sichtbarkeit des Containers und render nur wenn sichtbar
- Magento-Standard-JS für Payment-Method-Akkordeon nutzen
- `_active` Klasse NICHT entfernen — Akkordeon-Verhalten dem Magento-Standard überlassen

---

## Architektur-Überblick: Button-Rendering Flow

```
1. Magento lädt Checkout-Seite
2. paypal_spb.js registriert Renderer (type: 'paypalcp')
3. Template wird gerendert (paypal-standard.html)
4. afterRender → completeRender()
5. completeRender() → removeClass('_active') + loadSdk()
6. loadSdk() → paypal_sdk-adapter.js lädt SDK via <script>
7. SDK geladen → renderButtons()
8. renderButtons() → renderButton() pro Funding-Source
9. paypal.Buttons({style, fundingSource, createOrder, onApprove})
10. User klickt Button → createOrder() → fetch /paypalcheckout/order
11. PayPal Popup öffnet sich
12. User bestätigt → onApprove() → placeOrder()
```

## Funding-Source Button-Styles

| Source | Container-ID | Color | Label | Height |
|--------|-------------|-------|-------|--------|
| PAYPAL | paypal-button-container | gold | paypal | 40 |
| PAYLATER | paypal-paylater-container | black | paylater | 35 |
| SEPA | paypal-sepa-container | white | pay | 35 |
| TRUSTLY | paypal-trustly-container | black | pay | 35 |
| APPLE_PAY | paypal-applepay-container | black | apple | 40 |
| Messages | paypal-messages-container | — | — | — |

## SDK URL Parameter

```
https://www.paypal.com/sdk/js?
  client-id=AfDfQIQ...
  &currency=EUR
  &intent=capture
  &components=buttons,messages
  &enable-funding=sepa,paylater,trustly,applepay
  &disable-funding=credit
  &locale=de_DE
  &debug=true
```

## CSS-Klassen (aktuell)

```css
.ppcp.payment-method .payment-method-content { padding: 10px 0 0 0; }
#paypal-button-container, #paypal-paylater-container, #paypal-sepa-container { max-width: 400px; }
Container:empty → display: none
#paypal-messages-container { text-align: center; margin-top: 5px; }
```

## Nächste Schritte

1. Layout-Prototyp erstellen (HTML/CSS Mock) ohne Magento-Akkordeon
2. SEPA-Flow separat testen (eigenes createOrder mit payment_source?)
3. Pay Later Label-Varianten testen (installment, paylater, später bezahlen)
4. AGB-Checkboxen global im Checkout platzieren
5. Apple Pay Domain-Verifikation in PayPal Dashboard
6. guthaben.css/Template-Overrides für Theme-Integration