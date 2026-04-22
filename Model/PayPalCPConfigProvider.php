<?php
/**
 * PayPal PPCP Config Provider for Magento 2.2.3
 * SECURITY FIX: authorizationBasic removed — never expose client secret to frontend!
 * Client token is generated server-side via /paypalcheckout/token/ endpoint
 */
namespace PayPal\CommercePlatform\Model;

class PayPalCPConfigProvider implements \Magento\Checkout\Model\ConfigProviderInterface
{
    const BASE_URL_SDK = 'https://www.paypal.com/sdk/js?';
    const SDK_CONFIG_CLIENT_ID  = 'client-id';
    const SDK_CONFIG_CURRENCY   = 'currency';
    const SDK_CONFIG_DEBUG      = 'debug';
    const SDK_CONFIG_COMPONENTS = 'components';
    const SDK_CONFIG_LOCALE     = 'locale';
    const SDK_CONFIG_INTENT     = 'intent';
    const SDK_CONFIG_DISABLE_FUNDING = 'disable-funding';

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
        $config = [
            'payment' => [
                $this->_payment_code => [
                    'title' => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_TITLE),
                    'urlSdk' => $this->getUrlSdk(),
                    'style'  => [
                        'layout'  => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_LAYOUT),
                        'color'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_COLOR),
                        'shape'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_SHAPE),
                        'label'   => $this->_paypalConfig->getConfigValue(\PayPal\CommercePlatform\Model\Config::XML_CONFIG_LABEL),
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

        if ($this->_paypalConfig->isEnableAcdc()) {
            $this->_params[self::SDK_CONFIG_COMPONENTS] = 'hosted-fields,buttons';
            $this->_params[self::SDK_CONFIG_DISABLE_FUNDING] = 'card,credit';
        }
    }

    public function validateCustomerId()
    {
        if ($this->_customerSession->isLoggedIn()) {
            return $this->_customerSession->getCustomerId();
        }

        return null;
    }
}