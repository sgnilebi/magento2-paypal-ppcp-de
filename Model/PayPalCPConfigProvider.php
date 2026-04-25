<?php
/**
 * PayPal PPCP Config Provider for Magento 2.2.3
 * SECURITY FIX: authorizationBasic removed — never expose client secret to frontend!
 * Client token is generated server-side via /paypalcheckout/token/ endpoint
 * 
 * Funding sources for DE: SEPA, Pay Later, Card, Apple Pay, Messages widget
 * Trustly removed — not a payment method we want
 * Card added as separate button for direct credit/debit card payment
 */
namespace PayPal\CommercePlatform\Model;

class PayPalCPConfigProvider implements \Magento\Checkout\Model\ConfigProviderInterface
{
    const BASE_URL_SDK = 'https://www.paypal.com/sdk/js?';
    const SDK_CONFIG_CLIENT_ID       = 'client-id';
    const SDK_CONFIG_CURRENCY        = 'currency';
    const SDK_CONFIG_DEBUG            = 'debug';
    const SDK_CONFIG_COMPONENTS       = 'components';
    const SDK_CONFIG_LOCALE           = 'locale';
    const SDK_CONFIG_INTENT           = 'intent';
    const SDK_CONFIG_DISABLE_FUNDING  = 'disable-funding';
    const SDK_CONFIG_ENABLE_FUNDING   = 'enable-funding';

    protected $_payment_code = \PayPal\CommercePlatform\Model\Config::PAYMENT_COMMERCE_PLATFORM_CODE;

    protected $_params = [];

    /** @var \PayPal\CommercePlatform\Model\Config */
    protected $_paypalConfig;

    /** @var \Magento\Customer\Model\Session */
    protected $_customerSession;

    /** @var \Magento\Checkout\Model\Session */
    protected $_checkoutSession;

    /** @var \PayPal\CommercePlatform\Logger\Handler */
    protected $_logger;

    public function __construct(
        \PayPal\CommercePlatform\Model\Config $paypalConfig,
        \Magento\Customer\Model\Session $customerSession,
        \Magento\Checkout\Model\Session $checkoutSession,
        \PayPal\CommercePlatform\Logger\Handler $logger
    ) {
        $this->_paypalConfig    = $paypalConfig;
        $this->_customerSession = $customerSession;
        $this->_checkoutSession = $checkoutSession;
        $this->_logger          = $logger;
    }

    public function getGrandTotal()
    {
        return $this->_checkoutSession->getQuote()->getGrandTotal();
    }

    public function getConfig()
    {
        if (!$this->_paypalConfig->isMethodActive($this->_payment_code)) {
            return [];
        }

        // Check if credentials are configured — show friendly message if not
        $hasCredentials = $this->_paypalConfig->hasCredentials();

        $config = [
            'payment' => [
                $this->_payment_code => [
                    'title' => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_TITLE),
                    'urlSdk' => $hasCredentials ? $this->getUrlSdk() : '',
                    'hasCredentials' => $hasCredentials,
                    'style'  => [
                        'layout'  => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_LAYOUT),
                        'color'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_COLOR),
                        'shape'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_SHAPE),
                        'label'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_LABEL),
                        'tagline' => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_TAGLINE),
                    ],
                    'grandTotal' => $this->getGrandTotal(),
                    'customer' => [
                        'id' => $this->validateCustomerId(),
                    ],
                    'bcdc' => [
                        'enable' => $this->_paypalConfig->isEnableBcdc(),
                    ],
                    'acdc' => [
                        'enable' => $this->_paypalConfig->isEnableAcdc(),
                        'card_fisrt_acdc' => $this->_paypalConfig->isCardFirstAcdc(),
                    ],
                    'funding' => [
                        'sepa'     => $this->_paypalConfig->isEnableSepa(),
                        'paylater' => $this->_paypalConfig->isEnablePayLater(),
                        'applepay' => $this->_paypalConfig->isEnableApplePay(),
                        'messages' => $this->_paypalConfig->isEnablePayLater() && $this->_paypalConfig->isEnableMessages(),
                    ],
                    'splitOptions' => [
                        'title_method_paypal' => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_TITLE_METHOD_PAYPAL),
                        'title_method_card'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_TITLE_METHOD_CARD),
                    ],
                    'debug' => $this->_paypalConfig->isSetFlag(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_DEBUG_MODE),
                ]
            ]
        ];

        $this->_logger->debug(__METHOD__ . ' | CONFIG ' . print_r($config, true));

        return $config;
    }

    public function getUrlSdk()
    {
        $this->buildParams();

        return self::BASE_URL_SDK . http_build_query($this->_params);
    }

    private function buildParams()
    {
        $this->_params = [
            self::SDK_CONFIG_CLIENT_ID  => $this->_paypalConfig->getClientId(),
            self::SDK_CONFIG_CURRENCY   => $this->_paypalConfig->getCurrency(),
            self::SDK_CONFIG_DEBUG      => $this->_paypalConfig->isSetFlag(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_DEBUG_MODE) ? 'true' : 'false',
            self::SDK_CONFIG_LOCALE     => $this->_paypalConfig->getLocale(),
            self::SDK_CONFIG_INTENT     => 'capture',
        ];

        // Build components list
        $components = ['buttons'];
        if ($this->_paypalConfig->isEnableAcdc()) {
            $components[] = 'hosted-fields';
        }
        if ($this->_paypalConfig->isEnablePayLater() && $this->_paypalConfig->isEnableMessages()) {
            $components[] = 'messages';
        }
        $this->_params[self::SDK_CONFIG_COMPONENTS] = implode(',', $components);

        // Build enable-funding list (methods that are NOT shown by default in DE)
        $enableFunding = [];
        if ($this->_paypalConfig->isEnableSepa()) {
            $enableFunding[] = 'sepa';
        }
        if ($this->_paypalConfig->isEnablePayLater()) {
            $enableFunding[] = 'paylater';
        }
        if ($this->_paypalConfig->isEnableApplePay()) {
            $enableFunding[] = 'applepay';
        }
        // Card (Kreditkarte) — separate button for direct card payment without PayPal account
        $enableFunding[] = 'card';
        if (!empty($enableFunding)) {
            $this->_params[self::SDK_CONFIG_ENABLE_FUNDING] = implode(',', $enableFunding);
        }

        // Disable funding sources we don't want
        $disableFunding = ['credit', 'trustly']; // PayPal Credit not for DE, Trustly not wanted
        if ($this->_paypalConfig->isEnableAcdc()) {
            // When ACDC is on, card button is redundant — hosted-fields handles it
            $disableFunding[] = 'card';
        }
        // When ACDC is off, card stays in enable-funding as a separate button
        $this->_params[self::SDK_CONFIG_DISABLE_FUNDING] = implode(',', $disableFunding);
    }

    public function validateCustomerId()
    {
        if ($this->_customerSession->isLoggedIn()) {
            return $this->_customerSession->getCustomerId();
        }

        return null;
    }
}