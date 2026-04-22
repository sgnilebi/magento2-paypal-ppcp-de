define(
    [
        'Magento_Checkout/js/view/payment/default',
        'mage/storage',
        'jquery',
        'paypalSdkAdapter',
        'Magento_Checkout/js/action/select-payment-method',
        'Magento_Checkout/js/checkout-data',
        'Magento_Checkout/js/model/quote',
        'ko',
        'Magento_Checkout/js/model/totals',
        'mage/translate'
    ],
    function (Component, storage, $, paypalSdkAdapter, selectPaymentMethodAction, checkoutData, quote, ko, totals, $t) {
        'use strict';

        return Component.extend({
            defaults: {
                template: 'PayPal_CommercePlatform/payment/paypaladvanced-form'
            },

            paypalMethod: 'paypalcp',
            orderId: null,
            paypalConfigs: window.checkoutConfig.payment.paypalcp,
            isBcdcEnable: window.checkoutConfig.payment.paypalcp.bcdc.enable,
            isAcdcEnable: window.checkoutConfig.payment.paypalcp.acdc.enable,
            selectedMethod: null,
            isFormValid: ko.observable(false),

            getCode: function (method) {
                return method;
            },

            isSelected: function () {
                if (!this.isAcdcEnable) {
                    return false;
                }
                if (quote.paymentMethod() && (quote.paymentMethod().method == this.paypalMethod)) {
                    return this.selectedMethod;
                }
                return false;
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

            selectedPayPalMethod: function (method) {
                var self = this;
                var data = this.getData();
                this.selectedMethod = method;
                data.method = this.paypalMethod;
                selectPaymentMethodAction(data);
                checkoutData.setSelectedPaymentMethod(this.item.method);
            },

            renderHostedFields: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    return;
                }

                if (!paypal.HostedFields.isEligible()) {
                    self.logger('HostedFields not eligible');
                    self.isVisibleCard(false);
                    return;
                }

                paypal.HostedFields.render({
                    styles: {
                        'input': {
                            'font-size': '14px',
                            'color': '#3A3A3A',
                            'font-family': "'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
                        },
                        '.valid': {
                            'color': 'black'
                        },
                        '.invalid': {
                            'color': 'red'
                        }
                    },
                    fields: {
                        number: {
                            selector: '#card-number',
                            placeholder: 'Kartennummer'
                        },
                        cvv: {
                            selector: '#cvv',
                            placeholder: 'Sicherheitscode'
                        },
                        expirationDate: {
                            selector: '#expiration-date',
                            placeholder: 'MM / JJ'
                        }
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
                        self.orderId = data.id;
                        self.placeOrder();
                    },
                    onError: function (err) {
                        self.logger('HostedFields error', err);
                        self.messageContainer.addErrorMessage({
                            message: $t('Die Zahlung konnte nicht verarbeitet werden. Bitte überprüfen Sie Ihre Kartendaten.')
                        });
                    }
                }).then(function (hf) {
                    $('#card-form button#submit').attr('disabled', true);

                    $('#card-holder-name').bind('input', function () {
                        self.isValidFields(hf);
                    });

                    hf.on('empty', function (event) {
                        self.isValidFields(hf);
                    });

                    hf.on('notEmpty', function (event) {
                        self.isValidFields(hf);
                    });

                    hf.on('validityChange', function (event) {
                        self.isValidFields(hf);
                    });

                    $('#co-payment-form, #card-form').submit(function (event) {
                        event.preventDefault();

                        $('#submit').prop('disabled', true);
                        var body = $('body').loader();
                        body.loader('show');

                        var submitOptions = {
                            cardholderName: document.getElementById('card-holder-name').value
                        };

                        hf.submit(submitOptions)
                            .then(function (payload) {
                                self.orderId = payload.orderId;
                                self.placeOrder();
                                self.enableCheckout();
                            })
                            .catch(function (err) {
                                self.logger('Card submit error', err);
                                if (err.hasOwnProperty('details')) {
                                    self.messageContainer.addErrorMessage({
                                        message: $t('Die Zahlung konnte nicht verarbeitet werden. Bitte überprüfen Sie Ihre Kartendaten.')
                                    });
                                }
                                self.enableCheckout();
                            });
                        return false;
                    });
                });
            },

            getData: function () {
                var self = this;
                return {
                    method: self.paypalMethod,
                    additional_data: {
                        order_id: self.orderId
                    }
                };
            },

            isValidFields: function (hostedFieldsInstance) {
                var state = hostedFieldsInstance.getState();
                var formValid = Object.keys(state.fields).every(function (key) {
                    return !state.fields[key].isEmpty;
                });

                if (formValid && $('#card-holder-name').val() !== '') {
                    $('#card-form button#submit').attr('disabled', false);
                    this.isFormValid(true);
                    return true;
                } else {
                    $('#card-form button#submit').attr('disabled', true);
                    this.isFormValid(false);
                    return false;
                }
            },

            renderSmartButton: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    $('#paypal-button-container').html($t('PayPal ist derzeit nicht verfügbar.'));
                    return;
                }

                paypal.Buttons({
                    style: {
                        layout: 'horizontal'
                    },
                    commit: true,
                    createOrder: function () {
                        return fetch('/paypalcheckout/order', {
                            method: 'post',
                            headers: {
                                'content-type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: JSON.stringify({})
                        }).then(function (res) {
                            return res.json();
                        }).then(function (data) {
                            if (data.reason) {
                                self.messageContainer.addErrorMessage({
                                    message: $t('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.')
                                });
                                return false;
                            }
                            return data.result.id;
                        });
                    },
                    onApprove: function (data) {
                        self.orderId = data.orderID;
                        self.placeOrder();
                    },
                    onError: function (err) {
                        self.logger('PayPal button error', err);
                        self.messageContainer.addErrorMessage({
                            message: $t('Die Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.')
                        });
                    }
                }).render('#paypal-button-container');
            },

            rendersPayments: function () {
                var self = this;
                self.renderHostedFields();
                self.renderSmartButton();
            },

            completeRender: function () {
                var self = this;

                if (!self.isAcdcEnable) {
                    return false;
                }

                var body = $('body').loader();
                body.loader('show');
                self.initializeEvents();
                body.loader('hide');
            },

            initializeEvents: function () {
                var self = this;
                self.isVisibleCard(true);
                $('#paypalcheckout').show();
                self.loadSdk();
            },

            loadSdk: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    var body = $('body').loader();
                    body.loader('show');

                    paypalSdkAdapter.loadSdk(function () {
                        self.rendersPayments();
                        $('#card-form button#submit').attr('disabled', true);
                        body.loader('hide');
                    });
                } else {
                    self.rendersPayments();
                }
            },

            enableCheckout: function () {
                $('#submit').prop('disabled', false);
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