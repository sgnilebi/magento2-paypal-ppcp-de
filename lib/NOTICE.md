# Bundled SDK Libraries

This module bundles the following PayPal SDK libraries to avoid Composer dependency issues on PHP 7.0 / Magento 2.2.3:

## PayPalCheckoutSdk
- Source: https://github.com/qbo-tech/Checkout-PHP-SDK (v1.0.2)
- Forked from: https://github.com/paypal/Checkout-PHP-SDK
- License: Apache License 2.0 (see PayPalCheckoutSdk/LICENSE)
- Namespace: PayPalCheckoutSdk\

## PayPalHttp
- Source: https://github.com/qbo-tech/paypalhttp_php (v1.0.1)
- Forked from: https://github.com/paypal/paypalhttp_php
- License: MIT (see PayPalHttp/LICENSE)
- Namespace: PayPalHttp\

These are unmodified copies of the QBO Tech forks (which have identical namespaces
to the official PayPal SDKs). Bundling avoids the Composer 2 requirement that
prevents installation on older Magento 2.2.x servers.
