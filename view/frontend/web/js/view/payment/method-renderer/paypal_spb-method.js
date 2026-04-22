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

            isActiveBcdc: function () {
                return (this.isBcdcEnable && !this.isAcdcEnable);
            },

            isActiveAcdc: function () {
                return this.isAcdcEnable;
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

                paypal.Buttons({
                    style: buttonStyle,
                    fundingSource: fundingSource,
                    createOrder: function () {
                        var body = JSON.stringify({});
                        return fetch('/paypalcheckout/order', {
                            method: 'post',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: body
                        }).then(function (res) {
                            if (res.ok) {
                                return res.json();
                            } else {
                                self.messageContainer.addErrorMessage({
                                    message: $t('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.')
                                });
                                return false;
                            }
                        }).then(function (data) {
                            if (data && data.result && data.result.id) {
                                return data.result.id;
                            }
                            return false;
                        });
                    },
                    onApprove: function (data) {
                        self.orderId = data.orderID;
                        self.placeOrder();
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
                }).render('#' + elementId);
            },

            renderButtons: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    self.logger('PayPal SDK not loaded yet');
                    return;
                }

                var paypalContainer = document.getElementById('paypal-button-container');
                if (paypalContainer) {
                    paypalContainer.innerHTML = '';
                    self.renderButton(paypal.FUNDING.PAYPAL, 'paypal-button-container');
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