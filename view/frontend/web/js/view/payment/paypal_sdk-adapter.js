define([
    'jquery',
    'paypalTokenAdapter'
], function ($, paypalTokenAdapter) {
    'use strict';
    return {
        componentName: "paypalSdkComponent",
        paypalSdk: window.checkoutConfig.payment.paypalcp.urlSdk,
        isAcdcEnable: window.checkoutConfig.payment.paypalcp.acdc.enable,
        hasCredentials: window.checkoutConfig.payment.paypalcp.hasCredentials,

        loadSdk: function (callbackOnLoaded) {
            var self = this;

            // Check if credentials are configured
            if (!self.hasCredentials || !self.paypalSdk) {
                console.error('[PayPal PPCP] No credentials or SDK URL.');
                var containers = [
                    document.getElementById('paypal-button-container'),
                    document.getElementById('card-button-container'),
                    document.getElementById('paypal-paylater-container'),
                    document.getElementById('paypal-sepa-container'),
                    document.getElementById('paypal-applepay-container')
                ];
                containers.forEach(function(container) {
                    if (container) {
                        container.innerHTML = '<div style="padding:15px;color:#e02b27;font-size:14px;">PayPal ist nicht konfiguriert.</div>';
                    }
                });
                return;
            }

            // Already loaded?
            if (typeof paypal !== 'undefined') {
                callbackOnLoaded();
                return;
            }

            // Get client token for ACDC if needed
            var sdkUrl = self.paypalSdk;
            if (self.isAcdcEnable) {
                var clientToken = paypalTokenAdapter.generateClientTokenSync();
                if (clientToken) {
                    sdkUrl += '&data-client-token=' + encodeURIComponent(clientToken);
                }
            }

            // Load PayPal SDK via standard <script> tag — much more reliable than requirejs.load()
            var script = document.createElement('script');
            script.src = sdkUrl;
            

            script.onload = function () {
                console.log('[PayPal PPCP] SDK loaded successfully');
                callbackOnLoaded();
            };

            script.onerror = function () {
                console.error('[PayPal PPCP] SDK failed to load');
                var container = document.getElementById('paypal-button-container');
                if (container) {
                    container.innerHTML = '<div style="padding:15px;color:#e02b27;font-size:14px;">PayPal SDK konnte nicht geladen werden. Bitte versuchen Sie es später erneut.</div>';
                }
            };

            document.head.appendChild(script);
        },

        logger: function (message, obj) {
            if (window.checkoutConfig.payment.paypalcp.debug) {
                console.log(message, obj);
            }
        }
    };
});