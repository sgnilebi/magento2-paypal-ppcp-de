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
            grandTotal: ko.observable(window.checkoutConfig.payment.paypalcp.grandTotal),
            sdkLoaded: false,
            paypalRendered: false,
            cardRendered: false,

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

            isPayLaterEnabled: function () {
                return this.paypalConfigs.funding && this.paypalConfigs.funding.paylater;
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

                // Re-render buttons when payment method becomes visible
                setTimeout(function() {
                    self.renderVisibleButtons();
                }, 300);
            },

            /**
             * Validate that grand total matches before placing order.
             */
            validateGrandTotal: function () {
                var self = this;
                return new Promise(function (resolve) {
                    var currentGrandTotal = parseFloat(quote.totals().base_grand_total);
                    var previousGrandTotal = parseFloat(self.grandTotal());

                    if (previousGrandTotal !== currentGrandTotal) {
                        self.grandTotal(currentGrandTotal);
                    }
                    resolve();
                });
            },

            renderHostedFields: function () {
                var self = this;

                if (typeof paypal === 'undefined') {
                    return;
                }

                if (this.cardRendered) {
                    return;
                }

                if (!paypal.HostedFields.isEligible()) {
                    self.logger('HostedFields not eligible');
                    self.isVisibleCard(false);
                    return;
                }

                this.cardRendered = true;

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
                                return res.json().then(function (errData) {
                                    var errMsg = $t('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
                                    if (errData && errData.reason) {
                                        try {
                                            var parsed = JSON.parse(errData.reason);
                                            if (parsed && parsed.message) {
                                                errMsg = parsed.message;
                                            }
                                        } catch (e) { }
                                    }
                                    throw new Error(errMsg);
                                });
                            }
                        }).then(function (data) {
                            if (data && data.result && data.result.id) {
                                return data.result.id;
                            }
                            return false;
                        });
                    },
                    onApprove: function (data) {
                        self.orderId = data.orderId;
                        self.validateGrandTotal().then(function () {
                            self.placeOrder();
                        });
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
                                self.validateGrandTotal().then(function () {
                                    self.placeOrder();
                                });
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
                var agreementIds = [];
                jQuery('div.checkout-agreements input[type="checkbox"]:checked').each(function () {
                    agreementIds.push(jQuery(this).val());
                });
                return {
                    method: self.paypalMethod,
                    additional_data: {
                        order_id: self.orderId
                    },
                    extension_attributes: {
                        agreement_ids: agreementIds
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

                if (this.paypalRendered) {
                    return;
                }

                var buttonStyle = {
                    layout: 'vertical'
                };
                if (self.paypalConfigs.style) {
                    buttonStyle.layout = self.paypalConfigs.style.layout || 'vertical';
                    buttonStyle.color = self.paypalConfigs.style.color || 'gold';
                    buttonStyle.shape = self.paypalConfigs.style.shape || 'pill';
                    buttonStyle.label = self.paypalConfigs.style.label || 'paypal';
                    buttonStyle.tagline = self.paypalConfigs.style.tagline === 'true';
                }

                paypal.Buttons({
                    style: buttonStyle,
                    fundingSource: paypal.FUNDING.PAYPAL,
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
                        self.validateGrandTotal().then(function () {
                            self.placeOrder();
                        });
                    },
                    onError: function (err) {
                        self.logger('PayPal button error', err);
                        self.messageContainer.addErrorMessage({
                            message: $t('Die Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.')
                        });
                    }
                }).render('#paypal-button-container');

                // Render Pay Later button if enabled
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.paylater) {
                    var paylaterContainer = document.getElementById('paypal-paylater-container');
                    if (paylaterContainer) {
                        paypal.Buttons({
                            style: {
                                layout: 'vertical',
                                color: 'black',
                                shape: 'rect',
                                label: 'pay'
                            },
                            fundingSource: paypal.FUNDING.PAYLATER,
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
                                    return data.result.id;
                                });
                            },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () {
                                    self.placeOrder();
                                });
                            },
                            onError: function (err) {
                                self.logger('Pay Later button error', err);
                            }
                        }).render('#paypal-paylater-container');
                    }
                }

                // Render SEPA button if enabled
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.sepa) {
                    var sepaContainer = document.getElementById('paypal-sepa-container');
                    if (sepaContainer && paypal.FUNDING.SEPA) {
                        paypal.Buttons({
                            style: {
                                layout: 'vertical',
                                color: 'black',
                                shape: 'rect',
                                label: 'pay'
                            },
                            fundingSource: paypal.FUNDING.SEPA,
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
                                    return data.result.id;
                                });
                            },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () {
                                    self.placeOrder();
                                });
                            },
                            onError: function (err) {
                                self.logger('SEPA button error', err);
                            }
                        }).render('#paypal-sepa-container');
                    }
                }

                // Render Apple Pay button if enabled and eligible
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.applepay) {
                    var applepayContainer = document.getElementById('paypal-applepay-container');
                    if (applepayContainer && paypal.FUNDING.APPLE_PAY) {
                        var applePayButton = paypal.Buttons({
                            style: {
                                layout: 'vertical',
                                color: 'black',
                                shape: 'rect',
                                label: 'pay'
                            },
                            fundingSource: paypal.FUNDING.APPLE_PAY,
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
                                    return data.result.id;
                                });
                            },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () {
                                    self.placeOrder();
                                });
                            },
                            onError: function (err) {
                                self.logger('Apple Pay button error', err);
                            }
                        });

                        if (applePayButton.isEligible()) {
                            applePayButton.render('#paypal-applepay-container');
                        } else {
                            applepayContainer.innerHTML = '';
                            applepayContainer.style.minHeight = '0';
                        }
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

            /**
             * Re-render PayPal buttons when payment section becomes visible.
             * Called after selecting PayPal method (accordion opens).
             */
            renderVisibleButtons: function () {
                var self = this;
                if (typeof paypal !== 'undefined' && self.paypalRendered) {
                    // Force PayPal to recalculate button sizes in now-visible container
                    try {
                        paypal.Buttons().close().then(function() {
                            self.paypalRendered = false;
                            self.renderSmartButton();
                        });
                    } catch(e) {
                        // If close() not available, just force a re-render
                        self.paypalRendered = false;
                        $('#paypal-button-container').empty();
                        self.renderSmartButton();
                    }
                }
            },

            rendersPayments: function () {
                var self = this;
                if (!self.sdkLoaded) {
                    return;
                }
                self.renderSmartButton();
                self.renderHostedFields();
            },

            completeRender: function () {
                var self = this;
                self.isVisibleCard(true);
                $('#paypalcheckout').show();

                self.loadSdk();
            },

            loadSdk: function () {
                var self = this;

                if (self.sdkLoaded) {
                    self.rendersPayments();
                    return;
                }

                if (typeof paypal !== 'undefined') {
                    self.sdkLoaded = true;
                    self.rendersPayments();
                    return;
                }

                var body = $('body').loader();
                body.loader('show');

                paypalSdkAdapter.loadSdk(function () {
                    self.sdkLoaded = true;
                    self.rendersPayments();
                    $('#card-form button#submit').attr('disabled', true);
                    body.loader('hide');
                });
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