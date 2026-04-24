define(
    [
        'Magento_Checkout/js/view/payment/default',
        'jquery',
        'paypalSdkAdapter',
        'Magento_Checkout/js/action/select-payment-method',
        'Magento_Checkout/js/checkout-data',
        'Magento_Checkout/js/model/quote',
        'ko',
        'mage/translate',
        'mage/storage',
        'Magento_Checkout/js/model/totals'
    ],
    function (Component, $, paypalSdkAdapter, selectPaymentMethodAction, checkoutData, quote, ko, $t, storage, totals) {
        'use strict';

        if (window.checkoutConfig.payment.paypalcp.acdc.enable) {
            window.checkoutConfig.payment.paypalcp.template = 'PayPal_CommercePlatform/payment/paypaladvanced-form';
        } else if (window.checkoutConfig.payment.paypalcp.bcdc.enable) {
            window.checkoutConfig.payment.paypalcp.template = 'PayPal_CommercePlatform/payment/paypal_spb';
        } else {
            window.checkoutConfig.payment.paypalcp.template = 'PayPal_CommercePlatform/payment/paypal-standard';
        }

        return Component.extend({
            defaults: {
                template: window.checkoutConfig.payment.paypalcp.template
            },

            paypalMethod: 'paypalcp',
            orderId: null,
            currentMethod: null,
            selectedMethod: null,
            paypalConfigs: window.checkoutConfig.payment.paypalcp,
            isBcdcEnable: window.checkoutConfig.payment.paypalcp.bcdc.enable,
            isAcdcEnable: window.checkoutConfig.payment.paypalcp.acdc.enable,
            grandTotal: ko.observable(window.checkoutConfig.payment.paypalcp.grandTotal),
            isFormValid: ko.observable(false),

            initialize: function () {
                this._super();
                var self = this;

                quote.totals.subscribe(function (totals) {
                    if (!totals || !totals.base_grand_total) { return; }
                    var current = parseFloat(totals.base_grand_total);
                    var previous = parseFloat(self.grandTotal());
                    if (previous !== current) {
                        self.grandTotal(current);
                        var containers = ['paypal-button-container', 'paypal-paylater-container', 'paypal-sepa-container', 'paypal-trustly-container'];
                        containers.forEach(function(id) {
                            var el = document.getElementById(id);
                            if (el) { el.innerHTML = ''; }
                        });
                        self.renderButtons();
                    }
                });

                return this;
            },

            isActiveBcdc: function () { return (this.isBcdcEnable && !this.isAcdcEnable); },
            isActiveAcdc: function () { return this.isAcdcEnable; },

            isSelected: function () {
                var self = this;
                if (quote.paymentMethod() && (quote.paymentMethod().method == self.paypalMethod)) {
                    return self.selectedMethod;
                }
                return false;
            },

            isRadioButtonVisible: function () { return true; },

            selectedPayPalMethod: function (method) {
                var self = this;
                var data = this.getData();
                self.currentMethod = method;
                self.selectedMethod = method;
                data.method = self.paypalMethod;
                selectPaymentMethodAction(data);
                checkoutData.setSelectedPaymentMethod(self.item.method);
            },

            getCode: function () { return this.paypalMethod; },

            getTitleMethodPaypal: function () {
                if (!this.isBcdcEnable && !this.isAcdcEnable) {
                    return this.paypalConfigs.title;
                }
                return this.paypalConfigs.splitOptions.title_method_paypal;
            },

            getData: function () {
                var self = this;
                return {
                    method: self.paypalMethod,
                    additional_data: {
                        id: self.orderId,
                        order_id: self.orderId,
                        payment_type: self.isAcdcEnable ? 'PayPal_Advanced' : 'PayPal_Basic'
                    }
                };
            },

            validateGrandTotal: function () {
                var self = this;
                return new Promise(function (resolve) {
                    self.grandTotal(parseFloat(quote.totals().base_grand_total));
                    resolve();
                });
            },

            createOrder: function () {
                return fetch('/paypalcheckout/order', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({})
                }).then(function (res) {
                    if (res.ok) { return res.json(); }
                    return res.json().then(function (errData) {
                        var errMsg = $t('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
                        if (errData && errData.reason) {
                            try {
                                var parsed = JSON.parse(errData.reason);
                                if (parsed && parsed.message) { errMsg = parsed.message; }
                            } catch (e) { }
                        }
                        throw new Error(errMsg);
                    });
                }).then(function (data) {
                    if (data && data.result && data.result.id) { return data.result.id; }
                    if (data && data.reason) { throw new Error(data.reason); }
                    throw new Error($t('PayPal Order konnte nicht erstellt werden.'));
                });
            },

            renderButton: function (fundingSource, elementId, buttonStyle) {
                var self = this;

                if (typeof paypal === 'undefined') { return; }

                var defaultStyle = {
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'paypal',
                    height: 40,
                    tagline: false
                };

                var styleConfig = Object.assign({}, defaultStyle, buttonStyle || {});

                var button = paypal.Buttons({
                    style: styleConfig,
                    fundingSource: fundingSource,
                    createOrder: function () {
                        return self.createOrder();
                    },
                    onApprove: function (data) {
                        self.orderId = data.orderID;
                        self.validateGrandTotal().then(function () { self.placeOrder(); });
                    },
                    onCancel: function () {
                        console.log('[PayPal] Payment cancelled');
                    },
                    onError: function (err) {
                        console.error('[PayPal] Button error', err);
                        self.messageContainer.addErrorMessage({
                            message: $t('Die Zahlung konnte nicht verarbeitet werden.')
                        });
                    }
                });

                if (button.isEligible()) {
                    button.render('#' + elementId);
                } else {
                    var container = document.getElementById(elementId);
                    if (container) { container.innerHTML = ''; container.style.display = 'none'; }
                }
            },

            renderButtons: function () {
                var self = this;
                if (typeof paypal === 'undefined') { return; }

                // PayPal Button (gold)
                self.renderButton(paypal.FUNDING.PAYPAL, 'paypal-button-container', {
                    color: 'gold',
                    label: 'paypal',
                    height: 40
                });

                // Pay Later / Ratenzahlung (black, label shows "Ratenzahlung")
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.paylater && paypal.FUNDING.PAYLATER) {
                    self.renderButton(paypal.FUNDING.PAYLATER, 'paypal-paylater-container', {
                        color: 'black',
                        label: 'paylater',
                        height: 35
                    });
                }

                // SEPA Lastschrift (blue-grey)
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.sepa && paypal.FUNDING.SEPA) {
                    self.renderButton(paypal.FUNDING.SEPA, 'paypal-sepa-container', {
                        color: 'white',
                        shape: 'rect',
                        label: 'pay',
                        height: 35
                    });
                }

                // Trustly (Banküberweisung)
                if (paypal.FUNDING.TRUSTLY) {
                    self.renderButton(paypal.FUNDING.TRUSTLY, 'paypal-trustly-container', {
                        color: 'black',
                        label: 'pay',
                        height: 35
                    });
                }

                // Apple Pay
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.applepay && paypal.FUNDING.APPLE_PAY) {
                    self.renderButton(paypal.FUNDING.APPLE_PAY, 'paypal-applepay-container', {
                        color: 'black',
                        label: 'apple',
                        height: 40
                    });
                }

                // Messages Widget (Ratenzahlung Info-Text)
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.messages && paypal.Messages) {
                    paypal.Messages({
                        amount: parseFloat(self.grandTotal()),
                        currency: 'EUR',
                        placement: 'payment'
                    }).render('#paypal-messages-container');
                }
            },

            completeRender: function () {
                var self = this;
                $('.ppcp.payment-method').removeClass('_active');
                self.loadSdk();
                self._enableCheckout();
            },

            loadSdk: function () {
                var self = this;

                if (typeof paypal !== 'undefined') {
                    self.renderButtons();
                    return;
                }

                var body = $('body').loader();
                body.loader('show');

                paypalSdkAdapter.loadSdk(function () {
                    body.loader('hide');
                    if (typeof paypal !== 'undefined') {
                        self.renderButtons();
                    } else {
                        console.error('[PayPal PPCP] SDK loaded but paypal undefined');
                    }
                });
            },

            _enableCheckout: function () {
                var body = $('body').loader();
                body.loader('hide');
            }
        });
    }
);
