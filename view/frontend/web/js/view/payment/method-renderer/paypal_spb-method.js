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

            paypalMethod: 'paypalspb',
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
                    if (!totals || !totals.base_grand_total) {
                        return;
                    }
                    var currentGrandTotal = parseFloat(totals.base_grand_total);
                    var previousGrandTotal = parseFloat(self.grandTotal());

                    if (previousGrandTotal !== currentGrandTotal) {
                        var container = document.getElementById('paypal-button-container');
                        if (container) {
                            container.innerHTML = '';
                        }
                        var cardContainer = document.getElementById('card-button-container');
                        if (cardContainer) {
                            cardContainer.innerHTML = '';
                        }
                        if (cardContainer || container) {
                            self.renderButtons();
                        }
                    }
                    self.grandTotal(currentGrandTotal);
                });

                return this;
            },

            /**
             * Validate that the grand total hasn't changed since the PayPal order was created.
             * Called before placeOrder to prevent amount mismatch.
             * Returns a Promise that resolves when totals are validated.
             */
            validateGrandTotal: function () {
                var self = this;
                return new Promise(function (resolve) {
                    var currentGrandTotal = parseFloat(quote.totals().base_grand_total);
                    var previousGrandTotal = parseFloat(self.grandTotal());

                    if (previousGrandTotal !== currentGrandTotal) {
                        self.logger('Grand total changed: ' + previousGrandTotal + ' → ' + currentGrandTotal);
                        self.grandTotal(currentGrandTotal);
                        // Re-render buttons with new amount
                        var container = document.getElementById('paypal-button-container');
                        if (container) {
                            container.innerHTML = '';
                            self.renderButtons();
                        }
                    }
                    self.grandTotal(currentGrandTotal);
                    resolve();
                });
            },

            isActiveBcdc: function () {
                return (this.isBcdcEnable && !this.isAcdcEnable);
            },

            isActiveAcdc: function () {
                return this.isAcdcEnable;
            },

            isPayLaterEnabled: function () {
                return this.paypalConfigs.funding && this.paypalConfigs.funding.paylater;
            },

            isSelected: function () {
                if (quote.paymentMethod() && (quote.paymentMethod().method == this.paypalMethod)) {
                    return this.selectedMethod;
                }
                return false;
            },

            selectedPayPalMethod: function (method) {
                var self = this;
                var data = this.getData();
                self.currentMethod = method;
                self.selectedMethod = method;
                data.method = self.paypalMethod;
                selectPaymentMethodAction(data);
                checkoutData.setSelectedPaymentMethod(self.item.method);
            },

            isVisibleCard: function () {
                return this.isAcdcEnable;
            },

            getTitleMethodPaypal: function () {
                if (!this.isBcdcEnable && !this.isAcdcEnable) {
                    return this.paypalConfigs.title;
                }
                return this.paypalConfigs.splitOptions.title_method_paypal;
            },

            getTitleMethodCard: function () {
                return this.paypalConfigs.splitOptions.title_method_card;
            },

            getCode: function (method) {
                return method;
            },

            getData: function () {
                var self = this;
                var paymentType = self.isAcdcEnable ? 'PayPal_Advanced' : 'PayPal_Basic';

                var data = {
                    method: self.paypalMethod,
                    additional_data: {
                        id: self.orderId,
                        order_id: self.orderId,
                        payment_type: paymentType
                    }
                };

                return data;
            },

            /**
             * Create PayPal order via server endpoint.
             * Shared between PayPal button and HostedFields.
             */
            createOrder: function () {
                return fetch('/paypalcheckout/order', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({})
                }).then(function (res) {
                    if (res.ok) {
                        return res.json();
                    } else {
                        return res.json().then(function (errData) {
                            var errMsg = $t('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
                            if (errData && errData.reason) {
                                try {
                                    var parsed = JSON.parse(errData.reason);
                                    if (parsed && parsed.message) {
                                        errMsg = parsed.message;
                                    }
                                } catch (e) {
                                    // Not JSON, use default message
                                }
                            }
                            throw new Error(errMsg);
                        });
                    }
                }).then(function (data) {
                    if (data && data.result && data.result.id) {
                        return data.result.id;
                    }
                    if (data && data.reason) {
                        throw new Error(data.reason);
                    }
                    throw new Error($t('PayPal Order konnte nicht erstellt werden.'));
                });
            },

            renderButton: function (fundingSource, elementId) {
                var self = this;

                if (typeof paypal === 'undefined') {
                    $('#' + elementId).html($t('PayPal ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.'));
                    return;
                }

                var buttonStyle = {};
                if (self.paypalConfigs.style) {
                    buttonStyle = {
                        layout: self.paypalConfigs.style.layout || 'vertical',
                        color: self.paypalConfigs.style.color || 'gold',
                        shape: self.paypalConfigs.style.shape || 'pill',
                        label: self.paypalConfigs.style.label || 'paypal',
                        tagline: self.paypalConfigs.style.tagline === 'true'
                    };
                }

                // For non-PayPal funding sources (Apple Pay, SEPA etc.), override style
                if (fundingSource && fundingSource !== paypal.FUNDING.PAYPAL) {
                    buttonStyle.layout = buttonStyle.layout || 'vertical';
                    if (!buttonStyle.color) buttonStyle.color = 'black';
                    if (!buttonStyle.shape) buttonStyle.shape = 'rect';
                }

                var button = paypal.Buttons({
                    style: buttonStyle,
                    fundingSource: fundingSource,
                    createOrder: function () {
                        self.logger('createOrder for fundingSource: ' + (fundingSource || 'default'));
                        return self.createOrder();
                    },
                    onApprove: function (data) {
                        self.orderId = data.orderID;
                        self.validateGrandTotal().then(function () {
                            self.placeOrder();
                        });
                    },
                    onCancel: function () {
                        self.logger('PayPal payment cancelled by user');
                    },
                    onError: function (err) {
                        self.logger('PayPal button error', err);
                        self.messageContainer.addErrorMessage({
                            message: $t('Die Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.')
                        });
                    }
                });

                if (button.isEligible()) {
                    button.render('#' + elementId);
                } else {
                    self.logger('Button not eligible for fundingSource: ' + fundingSource);
                    var container = document.getElementById(elementId);
                    if (container) {
                        container.innerHTML = '';
                        container.style.minHeight = '0';
                    }
                }
            },

            renderButtons: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    self.logger('PayPal SDK not loaded yet');
                    return;
                }

                // Always render PayPal button
                var paypalContainer = document.getElementById('paypal-button-container');
                if (paypalContainer) {
                    paypalContainer.innerHTML = '';
                    self.renderButton(paypal.FUNDING.PAYPAL, 'paypal-button-container');
                }

                // Render Pay Later button if enabled (separate from PayPal button)
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.paylater) {
                    var paylaterContainer = document.getElementById('paypal-paylater-container');
                    if (paylaterContainer) {
                        paylaterContainer.innerHTML = '';
                        self.renderButton(paypal.FUNDING.PAYLATER, 'paypal-paylater-container');
                    }
                }

                // Render SEPA button if enabled
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.sepa) {
                    var sepaContainer = document.getElementById('paypal-sepa-container');
                    if (sepaContainer) {
                        sepaContainer.innerHTML = '';
                        self.renderButton(paypal.FUNDING.SEPA, 'paypal-sepa-container');
                    }
                }

                // Render Apple Pay button if eligible
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.applepay) {
                    var applepayContainer = document.getElementById('paypal-applepay-container');
                    if (applepayContainer) {
                        applepayContainer.innerHTML = '';
                        self.renderButton(paypal.FUNDING.APPLE_PAY, 'paypal-applepay-container');
                    }
                }

                // Render Pay Later messages widget
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.messages) {
                    var messagesContainer = document.getElementById('paypal-messages-container');
                    if (messagesContainer && paypal.Messages) {
                        paypal.Messages({
                            amount: parseFloat(self.grandTotal()),
                            currency: 'EUR',
                            placement: 'payment'
                        }).render('#paypal-messages-container');
                    }
                }
            },

            completeRender: function () {
                var self = this;

                $('.ppcp.payment-method').removeClass('_active');
                self.initializeEvents();
                self._enableCheckout();
            },

            initializeEvents: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    self.loadSdk();
                    return;
                }
                self.renderButtons();
            },

            loadSdk: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    var body = $('body').loader();
                    body.loader('show');

                    paypalSdkAdapter.loadSdk(function () {
                        self.renderButtons();
                        body.loader('hide');
                    });
                }
            },

            _enableCheckout: function () {
                var body = $('body').loader();
                body.loader('hide');
            },

            logger: function (message, obj) {
                if (window.checkoutConfig.payment.paypalcp.debug) {
                    console.log(message, obj);
                }
            }
        });
    }
);