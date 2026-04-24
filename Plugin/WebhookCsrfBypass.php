<?php

namespace PayPal\CommercePlatform\Plugin;

/**
 * Plugin to bypass CSRF validation for PayPal Webhook controller.
 * 
 * In Magento 2.2.x, CsrfAwareActionInterface does not exist (added in 2.3+).
 * PayPal webhooks send POST requests without CSRF tokens, so we must
 * bypass CSRF validation for the webhook endpoint.
 */
class WebhookCsrfBypass
{
    /**
     * Bypass CSRF validation for PayPal webhook requests
     *
     * @param \Magento\Framework\App\Request\CsrfValidator $subject
     * @param \Closure $proceed
     * @param \Magento\Framework\App\RequestInterface $request
     * @param \Magento\Framework\App\ActionInterface $action
     * @return void
     */
    public function aroundValidate(
        \Magento\Framework\App\Request\CsrfValidator $subject,
        \Closure $proceed,
        $request,
        $action
    ) {
        if ($action instanceof \PayPal\CommercePlatform\Controller\Webhooks\Index) {
            return; // Skip CSRF validation for webhook endpoint
        }
        $proceed($request, $action);
    }
}
