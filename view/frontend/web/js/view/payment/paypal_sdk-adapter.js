define([
    'Magento_Checkout/js/view/payment/default',
    'mage/storage',
    'jquery',
    'paypalTokenAdapter',
    'Magento_Customer/js/customer-data'
], function (Component, storage, $, paypalTokenAdapter, customerData) {
    'use strict';
    return {
        componentName: "paypalSdkComponent",
        paypalSdk: window.checkoutConfig.payment.paypalcp.urlSdk,
        onLoadedCallback: '',
        isAcdcEnable: window.checkoutConfig.payment.paypalcp.acdc.enable,

        loadSdk: function (callbackOnLoaded) {
            var self = this;
            self.onLoadedCallback = callbackOnLoaded;

            if (typeof paypal === 'undefined') {

                var clientToken = null;
                if (self.isAcdcEnable) {
                    clientToken = paypalTokenAdapter.generateClientToken();
                }

                var objCallback = {
                    completeCallback: function (resultIndicator, successIndicator) {
                        self.logger('completeCallback complete');
                    },
                    errorCallback: function () {
                        self.logger('Payment errorCallback');
                    },
                    cancelCallback: function () {
                        self.logger('Payment cancelled');
                    },
                    onLoadedCallback: function () {
                        self.logger('PayPal SDK loaded', paypal);
                        $(document).ready(function () {
                            return callbackOnLoaded.call();
                        });
                        self.logger('Load paypal Component');
                    }
                };

                window.ErrorCallback = $.proxy(objCallback, "errorCallback");
                window.CancelCallback = $.proxy(objCallback, "cancelCallback");
                window.CompletedCallback = $.proxy(objCallback, "completeCallback");

                // IMPORTANT: data-client-token must be set on the script element
                // Attributes are set BEFORE the script executes (async download happens first)
                requirejs.load({
                    contextName: '_',
                    onScriptLoad: $.proxy(objCallback, "onLoadedCallback"),
                    config: {
                        baseUrl: self.paypalSdk
                    }
                }, self.componentName, self.paypalSdk);

                var htmlElement = $('[data-requiremodule="' + self.componentName + '"]')[0];

                htmlElement.setAttribute('data-error', 'window.ErrorCallback');
                htmlElement.setAttribute('data-cancel', 'window.ErrorCallback');
                htmlElement.setAttribute('data-complete', 'window.CompletedCallback');

                if (clientToken && self.isAcdcEnable) {
                    htmlElement.setAttribute('data-client-token', clientToken);
                }
            }
        },

        logger: function (message, obj) {
            if (window.checkoutConfig.payment.paypalcp.debug) {
                console.log(message, obj);
            }
        }
    };
});