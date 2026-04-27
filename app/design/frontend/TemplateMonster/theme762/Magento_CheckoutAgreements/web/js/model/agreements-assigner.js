define([
    'jquery'
], function ($) {
    'use strict';

    var agreementsConfig = window.checkoutConfig.checkoutAgreements;

    /** Override default place order action and add agreement_ids to request */
    return function (paymentData) {
        var agreementForm,
            agreementData,
            agreementIds;

        if (!agreementsConfig || !agreementsConfig.isEnabled) {
            return;
        }

        // THEME OVERRIDE: Globaler Selektor statt nur .payment-method._active
        agreementForm = $('div.checkout-agreements input[type="checkbox"]');
        agreementData = agreementForm.serializeArray();
        agreementIds = [];

        agreementData.forEach(function (item) {
            agreementIds.push(item.value);
        });

        if (paymentData['extension_attributes'] === undefined) {
            paymentData['extension_attributes'] = {};
        }

        paymentData['extension_attributes']['agreement_ids'] = agreementIds;
    };
});
