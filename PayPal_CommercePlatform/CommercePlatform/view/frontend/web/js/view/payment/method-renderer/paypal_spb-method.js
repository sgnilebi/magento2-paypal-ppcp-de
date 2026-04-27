/**
 * PayPal PPCP Smart Payment Buttons — v7
 * 
 * CHANGES v7:
 * - Google Pay via paypal.Googlepay() component (NOT FUNDING source)
 * - Trustly via paypal.Buttons({fundingSource: paypal.FUNDING.TRUSTLY})
 * - Token Bug Fix: Client token for guest checkout works (send empty body)
 * - Fixed enable-funding: removed invalid "googlepay" value
 * - AGB overlay covers both PayPal and Vorkasse sections
 */
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
            sdkLoaded: false,
            buttonsRendered: false,
            googlepayRendered: false,

            initialize: function () {
                this._super();
                var self = this;

                // Re-render buttons when grand total changes (e.g. coupon applied)
                quote.totals.subscribe(function (totals) {
                    if (!totals || !totals.base_grand_total) { return; }
                    var current = parseFloat(totals.base_grand_total);
                    var previous = parseFloat(self.grandTotal());
                    if (previous !== current) {
                        self.grandTotal(current);
                        self.renderButtons();
                    }
                });

                // Watch AGB checkboxes and enable/disable payment buttons
                self.watchAgbCheckboxes();

                return this;
            },

            /**
             * Watch AGB/Widerruf checkboxes.
             * When both are checked → enable PayPal buttons + Vorkasse.
             * When not all checked → disable and show warning overlay.
             */
            watchAgbCheckboxes: function () {
                var self = this;

                var checkInterval = setInterval(function () {
                    var $agbCheckboxes = $('div.checkout-agreements input[type="checkbox"]');
                    if ($agbCheckboxes.length > 0) {
                        clearInterval(checkInterval);
                        self.updateButtonState();
                        $agbCheckboxes.on('change', function () {
                            self.updateButtonState();
                        });
                    }
                }, 500);

                setTimeout(function () {
                    clearInterval(checkInterval);
                }, 10000);
            },

            /**
             * Enable or disable PayPal buttons AND Vorkasse based on AGB state.
             */
            updateButtonState: function () {
                var $agbCheckboxes = $('div.checkout-agreements input[type="checkbox"]:visible');
                var allChecked = true;

                $agbCheckboxes.each(function () {
                    if (!$(this).is(':checked')) {
                        allChecked = false;
                        return false;
                    }
                });

                // Toggle on both PayPal section and Vorkasse section
                var $paymentSections = $('.ppcp.payment-method, .vorkasse-method');
                if (allChecked) {
                    $paymentSections.removeClass('ppcp-agb-disabled');
                } else {
                    $paymentSections.addClass('ppcp-agb-disabled');
                }
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
                var agreementIds = [];
                jQuery('div.checkout-agreements input[type="checkbox"]:checked').each(function () {
                    agreementIds.push(jQuery(this).val());
                });
                return {
                    method: self.paypalMethod,
                    additional_data: {
                        id: self.orderId,
                        order_id: self.orderId,
                        payment_type: self.isAcdcEnable ? 'PayPal_Advanced' : 'PayPal_Basic'
                    },
                    extension_attributes: {
                        agreement_ids: agreementIds
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

            /**
             * Validate AGB before placing order.
             */
            validateAgb: function () {
                var $agbCheckboxes = $('div.checkout-agreements input[type="checkbox"]:visible');
                var allChecked = true;

                $agbCheckboxes.each(function () {
                    if (!$(this).is(':checked')) {
                        allChecked = false;
                        return false;
                    }
                });

                if (!allChecked) {
                    $('html, body').animate({
                        scrollTop: $('.checkout-agreements-block').offset().top - 100
                    }, 300);

                    var $block = $('.checkout-agreements-block');
                    $block.css('border-color', '#e02b27');
                    setTimeout(function () {
                        $block.css('border-color', '#ffc439');
                    }, 2000);

                    return false;
                }

                return true;
            },

            createOrder: function () {
                if (!this.validateAgb()) {
                    return Promise.reject(new Error($t('Bitte stimmen Sie den AGB zu.')));
                }

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

            /**
             * Render PayPal payment buttons.
             */
            renderButtons: function () {
                var self = this;

                if (typeof paypal === 'undefined') { return; }

                var mainContainer = document.getElementById('paypal-button-container');
                if (!mainContainer) { return; }

                // Clear all containers before re-rendering
                mainContainer.innerHTML = '';
                var subContainers = ['paypal-paylater-container', 'paypal-sepa-container', 'paypal-card-container', 'paypal-applepay-container', 'paypal-trustly-container'];
                subContainers.forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el) { el.innerHTML = ''; }
                });

                self.buttonsRendered = false;

                try {
                    // === PayPal Button ===
                    var paypalBtn = paypal.Buttons({
                        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 40, tagline: false },
                        fundingSource: paypal.FUNDING.PAYPAL,
                        createOrder: function () { return self.createOrder(); },
                        onApprove: function (data) {
                            self.orderId = data.orderID;
                            self.validateGrandTotal().then(function () { self.placeOrder(); });
                        },
                        onCancel: function () { console.log('[PayPal PPCP] PayPal payment cancelled'); },
                        onError: function (err) {
                            console.error('[PayPal PPCP] PayPal button error', err);
                            self.messageContainer.addErrorMessage({ message: $t('Die Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.') });
                        }
                    });

                    if (paypalBtn.isEligible()) {
                        paypalBtn.render('#paypal-button-container');
                        self.buttonsRendered = true;
                    }

                    // === Pay Later (Ratenzahlung) ===
                    if (self.paypalConfigs.funding && self.paypalConfigs.funding.paylater && paypal.FUNDING.PAYLATER) {
                        var paylaterBtn = paypal.Buttons({
                            style: { layout: 'vertical', color: 'black', shape: 'rect', label: 'paylater', height: 35, tagline: false },
                            fundingSource: paypal.FUNDING.PAYLATER,
                            createOrder: function () { return self.createOrder(); },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () { self.placeOrder(); });
                            },
                            onCancel: function () {},
                            onError: function (err) {
                                self.messageContainer.addErrorMessage({ message: $t('Die Ratenzahlung konnte nicht verarbeitet werden.') });
                            }
                        });
                        if (paylaterBtn.isEligible()) { paylaterBtn.render('#paypal-paylater-container'); }
                        else { var plC = document.getElementById('paypal-paylater-container'); if (plC) { plC.style.display = 'none'; } }
                    }

                    // === SEPA Lastschrift ===
                    if (self.paypalConfigs.funding && self.paypalConfigs.funding.sepa && paypal.FUNDING.SEPA) {
                        var sepaBtn = paypal.Buttons({
                            style: { layout: 'vertical', color: 'white', shape: 'rect', label: 'pay', height: 35, tagline: false },
                            fundingSource: paypal.FUNDING.SEPA,
                            createOrder: function () { return self.createOrder(); },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () { self.placeOrder(); });
                            },
                            onCancel: function () {},
                            onError: function (err) {
                                self.messageContainer.addErrorMessage({ message: $t('Die SEPA-Lastschrift konnte nicht verarbeitet werden.') });
                            }
                        });
                        if (sepaBtn.isEligible()) { sepaBtn.render('#paypal-sepa-container'); }
                        else { var sepaC = document.getElementById('paypal-sepa-container'); if (sepaC) { sepaC.style.display = 'none'; } }
                    }

                    // === Kreditkarte / Debitkarte (CARD) ===
                    if (paypal.FUNDING.CARD) {
                        var cardBtn = paypal.Buttons({
                            style: { layout: 'vertical', color: 'black', shape: 'rect', label: 'pay', height: 35, tagline: false },
                            fundingSource: paypal.FUNDING.CARD,
                            createOrder: function () { return self.createOrder(); },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () { self.placeOrder(); });
                            },
                            onCancel: function () {},
                            onError: function (err) {
                                self.messageContainer.addErrorMessage({ message: $t('Die Kartenzahlung konnte nicht verarbeitet werden.') });
                            }
                        });
                        if (cardBtn.isEligible()) { cardBtn.render('#paypal-card-container'); }
                        else {
                            var cardC = document.getElementById('paypal-card-container');
                            if (cardC) { cardC.style.display = 'none'; }
                            var cardLabel = cardC ? cardC.nextElementSibling : null;
                            if (cardLabel && cardLabel.classList.contains('ppcp-label-line')) { cardLabel.style.display = 'none'; }
                        }
                    }

                    // === Apple Pay ===
                    if (self.paypalConfigs.funding && self.paypalConfigs.funding.applepay && paypal.FUNDING.APPLE_PAY) {
                        var appleBtn = paypal.Buttons({
                            style: { layout: 'vertical', color: 'black', shape: 'rect', label: 'apple', height: 40, tagline: false },
                            fundingSource: paypal.FUNDING.APPLE_PAY,
                            createOrder: function () { return self.createOrder(); },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () { self.placeOrder(); });
                            },
                            onCancel: function () {},
                            onError: function (err) { console.error('[PayPal PPCP] Apple Pay button error', err); }
                        });
                        if (appleBtn.isEligible()) { appleBtn.render('#paypal-applepay-container'); }
                        else { var appleC = document.getElementById('paypal-applepay-container'); if (appleC) { appleC.style.display = 'none'; } }
                    }

                    // === Trustly (Sofortüberweisung) ===
                    if (self.paypalConfigs.funding && self.paypalConfigs.funding.trustly && paypal.FUNDING.TRUSTLY) {
                        var trustlyBtn = paypal.Buttons({
                            style: { layout: 'vertical', color: 'white', shape: 'rect', label: 'pay', height: 35, tagline: false },
                            fundingSource: paypal.FUNDING.TRUSTLY,
                            createOrder: function () { return self.createOrder(); },
                            onApprove: function (data) {
                                self.orderId = data.orderID;
                                self.validateGrandTotal().then(function () { self.placeOrder(); });
                            },
                            onCancel: function () {},
                            onError: function (err) {
                                self.messageContainer.addErrorMessage({ message: $t('Die Sofortüberweisung konnte nicht verarbeitet werden.') });
                            }
                        });
                        if (trustlyBtn.isEligible()) { trustlyBtn.render('#paypal-trustly-container'); }
                        else { var trustlyC = document.getElementById('paypal-trustly-container'); if (trustlyC) { trustlyC.style.display = 'none'; } }
                    }

                    console.log('[PayPal PPCP] All buttons rendered');

                    // Google Pay is rendered separately via paypal.Googlepay() component
                    self.renderGooglePay();

                    self.updateButtonState();

                } catch (err) {
                    console.error('[PayPal PPCP] renderButtons error:', err);
                    mainContainer.innerHTML = '<div class="ppcp-notice">' + $t('PayPal Buttons konnten nicht geladen werden.') + '</div>';
                }

                // === Pay Later Messages widget ===
                if (self.paypalConfigs.funding && self.paypalConfigs.funding.messages && paypal.Messages) {
                    try {
                        var msgContainer = document.getElementById('paypal-messages-container');
                        if (msgContainer) {
                            paypal.Messages({
                                amount: parseFloat(self.grandTotal()),
                                currency: 'EUR',
                                placement: 'payment'
                            }).render('#paypal-messages-container');
                        }
                    } catch (e) { console.warn('[PayPal PPCP] Messages widget error:', e); }
                }
            },

            /**
             * Render Google Pay button via paypal.Googlepay() component.
             * Google Pay is NOT a paypal.FUNDING source — it uses a separate API.
             */
            renderGooglePay: function () {
                var self = this;

                if (!self.paypalConfigs.funding || !self.paypalConfigs.funding.googlepay) {
                    // Google Pay not enabled — hide container
                    var gpC = document.getElementById('paypal-googlepay-container');
                    if (gpC) { gpC.style.display = 'none'; }
                    var gpL = gpC ? gpC.nextElementSibling : null;
                    if (gpL && gpL.classList.contains('ppcp-label-line')) { gpL.style.display = 'none'; }
                    return;
                }

                if (typeof paypal === 'undefined' || typeof paypal.Googlepay === 'undefined') {
                    console.warn('[PayPal PPCP] Google Pay component not available in SDK (components=googlepay missing?)');
                    var gpC = document.getElementById('paypal-googlepay-container');
                    if (gpC) { gpC.style.display = 'none'; }
                    var gpL = gpC ? gpC.nextElementSibling : null;
                    if (gpL && gpL.classList.contains('ppcp-label-line')) { gpL.style.display = 'none'; }
                    return;
                }

                if (self.googlepayRendered) { return; }

                try {
                    var googlepayConfig = {
                        createOrder: function () {
                            return self.createOrder();
                        },
                        onApprove: function (data) {
                            self.orderId = data.orderID;
                            self.validateGrandTotal().then(function () { self.placeOrder(); });
                        },
                        onError: function (err) {
                            console.error('[PayPal PPCP] Google Pay error:', err);
                            self.messageContainer.addErrorMessage({
                                message: $t('Google Pay konnte nicht verarbeitet werden.')
                            });
                        },
                        style: {
                            color: 'black',
                            type: 'pay'
                        }
                    };

                    var googlepayInstance = paypal.Googlepay();
                    googlepayInstance.config(googlepayConfig);

                    var gpContainer = document.getElementById('paypal-googlepay-container');
                    if (gpContainer) {
                        googlepayInstance.render('#paypal-googlepay-container');
                        self.googlepayRendered = true;
                        console.log('[PayPal PPCP] Google Pay rendered');
                    }
                } catch (err) {
                    console.error('[PayPal PPCP] Google Pay render error:', err);
                    var gpC = document.getElementById('paypal-googlepay-container');
                    if (gpC) { gpC.style.display = 'none'; }
                    var gpL = gpC ? gpC.nextElementSibling : null;
                    if (gpL && gpL.classList.contains('ppcp-label-line')) { gpL.style.display = 'none'; }
                }
            },

            completeRender: function () {
                var self = this;
                var paypalSection = $('.ppcp.payment-method');
                if (paypalSection.length && !paypalSection.hasClass('_active')) {
                    paypalSection.addClass('_active');
                }
                self.loadSdk();
                self._enableCheckout();
            },

            loadSdk: function () {
                var self = this;
                if (typeof paypal !== 'undefined') {
                    self.sdkLoaded = true;
                    self.renderButtons();
                    return;
                }
                if (self.sdkLoaded) { return; }
                var body = $('body').loader();
                body.loader('show');
                paypalSdkAdapter.loadSdk(function () {
                    body.loader('hide');
                    self.sdkLoaded = true;
                    if (typeof paypal !== 'undefined') { self.renderButtons(); }
                    else { console.error('[PayPal PPCP] SDK loaded but paypal undefined'); }
                });
            },

            _enableCheckout: function () {
                var body = $('body').loader();
                body.loader('hide');
            }
        });
    }
);
