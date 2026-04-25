<?php
/**
 * PayPal PPCP Token for Magento 2.2.3
 * Billing Agreement code removed
 * FIX: Guest checkout sends "{}" string instead of {"customer_id":null}
 * PayPalHttp requires body to be string or array — stdClass causes "Body must be either string or array" error
 */
namespace PayPal\CommercePlatform\Model\Paypal\Core;

class Token
{
    /** @var \Magento\Checkout\Model\Session $checkoutSession */
    protected $_checkoutSession;

    /** @var \PayPal\CommercePlatform\Model\Paypal\Api $paypalApi */
    protected $_paypalApi;

    /** @var AccessTokenRequest */
    protected $_accessTokenRequest;

    /** @var \PayPal\CommercePlatform\Logger\Handler */
    protected $_loggerHandler;

    /** @var \Magento\Framework\Event\ManagerInterface */
    protected $_eventManager;

    /** @var \Magento\Quote\Model\Quote */
    protected $_quote;

    protected $_customer;

    public function __construct(
        \Magento\Checkout\Model\Session $checkoutSession,
        \PayPal\CommercePlatform\Model\Paypal\Api $paypalApi,
        \PayPal\CommercePlatform\Logger\Handler $logger,
        \Magento\Customer\Model\Session $customerSession,
        \Magento\Framework\Event\ManagerInterface $eventManager
    ) {
        $this->_loggerHandler  = $logger;
        $this->_paypalApi     = $paypalApi;
        $this->_eventManager  = $eventManager;
        $this->_checkoutSession = $checkoutSession;
        $this->_quote = $checkoutSession->getQuote();
        $this->_customer = $customerSession->getCustomer();
    }

    /**
     * Create OAuth access token request
     */
    public function createRequest()
    {
        $this->_accessTokenRequest = $this->_paypalApi->getAccessTokenRequest($this->_paypalApi->getAuthorizationString());
        $this->_accessTokenRequest->body = [
            'grant_type' => 'client_credentials',
            'response_type' => 'token'
        ];

        try {
            $this->_eventManager->dispatch('paypalcp_access_token_before', ['quote' => $this->_quote, 'customer' => $this->_customer]);

            $response = $this->_paypalApi->execute($this->_accessTokenRequest);
            $this->_eventManager->dispatch('paypalcp_access_token_after', ['quote' => $this->_quote, 'paypalResponse' => $response]);
        } catch (\Exception $e) {
            $this->_loggerHandler->error($e->getMessage());
            throw $e;
        }

        return $response;
    }

    /**
     * Generate client token for PayPal JS SDK (needed for ACDC hosted fields)
     * FIX: For guest users, send "{}" string instead of {"customer_id":null}
     * PayPalHttp requires body to be string or array — stdClass causes error
     *
     * @param string $accessToken
     * @return \PayPalHttp\HttpResponse
     */
    public function createGenerateTokenRequest($accessToken)
    {
        $customerId = $this->_customer->getId();
        $generateTokenRequest = $this->_paypalApi->getGenerateTokenRequest($accessToken, $customerId);

        // For guest users (no customer ID), send "{}" string which PayPal accepts.
        // For logged-in users, send array ["customer_id" => "123"] which gets json_encoded.
        // NOTE: PayPalHttp only accepts string or array for body — stdClass causes an error.
        if ($customerId) {
            $generateTokenRequest->body = ['customer_id' => (string)$customerId];
        } else {
            $generateTokenRequest->body = '{}';
        }

        try {
            $this->_eventManager->dispatch('paypalcp_generate_token_before', ['quote' => $this->_quote, 'customer' => $this->_customer]);

            $response = $this->_paypalApi->execute($generateTokenRequest);
            $this->_eventManager->dispatch('paypalcp_generate_token_after', ['quote' => $this->_quote, 'paypalResponse' => $response]);
        } catch (\Exception $e) {
            $this->_loggerHandler->error($e->getMessage());
            throw $e;
        }

        return $response;
    }
}
