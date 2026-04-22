define([
    'jquery',
    'mage/translate',
    'Magento_Ui/js/model/messageList'
], function ($, $t, globalMessageList) {
    'use strict';

    return {
        urlAccessToken: '/paypalcheckout/token/index',

        /**
         * Generate client token for ACDC hosted fields (async).
         * Returns a Promise that resolves with the token string.
         */
        generateClientToken: function () {
            var self = this;
            return $.ajax({
                url: self.urlAccessToken,
                method: 'POST',
                timeout: 30000
            }).then(function (response) {
                if (response && response.token) {
                    return response.token;
                }
                return $.Deferred().reject('No token in response');
            }).fail(function () {
                console.error('[PayPal PPCP] Error generating client token');
                globalMessageList.addErrorMessage({
                    message: $t('PayPal ist derzeit nicht verfügbar. Bitte wählen Sie eine andere Zahlungsmethode.')
                });
            });
        },

        /**
         * Synchronous fallback for backward compatibility.
         * Used by sdk-adapter which needs the token before SDK loads.
         */
        generateClientTokenSync: function () {
            var self = this;
            var response = $.ajax({
                url: self.urlAccessToken,
                method: 'POST',
                timeout: 30000,
                async: false
            });

            if (response && response.responseJSON && response.responseJSON.token) {
                return response.responseJSON.token;
            }

            console.error('[PayPal PPCP] Error generating client token (sync)');
            globalMessageList.addErrorMessage({
                message: $t('PayPal ist derzeit nicht verfügbar. Bitte wählen Sie eine andere Zahlungsmethode.')
            });
            return null;
        }
    };
});
