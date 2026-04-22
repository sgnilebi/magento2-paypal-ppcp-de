<?php
/**
 * PayPal PPCP Config for Magento 2.2.3
 * Based on QBO PayPal Commerce Platform — adapted for DE/EUR
 */
namespace PayPal\CommercePlatform\Model;

use Magento\Framework\Locale\ResolverInterface;
use Magento\Store\Model\StoreManagerInterface;

class Config
{
    const PAYMENT_COMMERCE_PLATFORM_CODE = 'paypalcp';

    const CONFIG_XML_IS_SANDBOX           = 'sandbox_flag';
    const CONFIG_XML_CLIENT_ID            = 'client_id';
    const CONFIG_XML_SECRET_ID            = 'secret_id';
    const CONFIG_XML_WEBHOOK_ID           = 'webhook_id';
    const CONFIG_XML_TITLE                = 'title';
    const CONFIG_XML_ENABLE_BCDC          = 'enable_bcdc';
    const CONFIG_XML_ENABLE_ACDC          = 'enable_acdc';
    const CONFIG_XML_CARD_FIRST_ACDC      = 'card_fisrt_acdc';
    const CONFIG_XML_LOCALE_CODE          = 'locale';
    const CONFIG_XML_COUNTRY_CODE         = 'country_code';
    const CONFIG_XML_TITLE_METHOD_PAYPAL  = 'title_paypal';
    const CONFIG_XML_TITLE_METHOD_CARD    = 'title_card';
    const CONFIG_XML_ENABLE_ITEMS         = 'enable_items';
    const CONFIG_XML_DEBUG_MODE           = 'debug_mode';

    /**
     * Button customization style options
     */
    const XML_CONFIG_LAYOUT  = 'checkout_button/layout';
    const XML_CONFIG_COLOR   = 'checkout_button/color';
    const XML_CONFIG_SHAPE   = 'checkout_button/shape';
    const XML_CONFIG_LABEL   = 'checkout_button/label';
    const XML_CONFIG_TAGLINE = 'checkout_button/tagline';

    /**
     * @var \Magento\Framework\App\Config\ScopeConfigInterface
     */
    protected $_scopeConfig;

    /** @var \Psr\Log\LoggerInterface */
    protected $_logger;

    /**
     * @var \Magento\Framework\Locale\ResolverInterface
     */
    private $resolverInterface;

    /**
     * @var \Magento\Store\Model\StoreManagerInterface
     */
    private $storeManager;

    public function __construct(
        \Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig,
        \Psr\Log\LoggerInterface $logger,
        StoreManagerInterface $storeManager,
        ResolverInterface $resolverInterface
    ) {
        $this->_scopeConfig = $scopeConfig;
        $this->_logger      = $logger;
        $this->resolverInterface = $resolverInterface;
        $this->storeManager = $storeManager;
    }

    public function isMethodActive($method)
    {
        return $this->_scopeConfig->isSetFlag(
            'payment/' . $method . '/active',
            \Magento\Store\Model\ScopeInterface::SCOPE_STORE
        );
    }

    public function getConfigValue($config)
    {
        return $this->_scopeConfig->getValue(
            $this->_preparePathConfig($config),
            \Magento\Store\Model\ScopeInterface::SCOPE_STORE
        );
    }

    public function isSetFlag($flag)
    {
        return $this->_scopeConfig->isSetFlag(
            $this->_preparePathConfig($flag),
            \Magento\Store\Model\ScopeInterface::SCOPE_STORE
        );
    }

    protected function _preparePathConfig($config, $code = self::PAYMENT_COMMERCE_PLATFORM_CODE)
    {
        return sprintf("payment/%s/%s", $code, $config);
    }

    public function isSandbox()
    {
        return $this->isSetFlag(self::CONFIG_XML_IS_SANDBOX);
    }

    public function getClientId()
    {
        return $this->getConfigValue(self::CONFIG_XML_CLIENT_ID);
    }

    public function getSecretId()
    {
        return $this->getConfigValue(self::CONFIG_XML_SECRET_ID);
    }

    public function getWebhookId()
    {
        return $this->getConfigValue(self::CONFIG_XML_WEBHOOK_ID);
    }

    public function getCurrency()
    {
        return $this->storeManager->getStore()->getBaseCurrency()->getCode();
    }

    public function getLocale()
    {
        $locale = $this->getConfigValue(self::CONFIG_XML_LOCALE_CODE);
        if (!$locale) {
            $locale = $this->resolverInterface->getLocale();
        }
        return $locale;
    }

    public function getCountryCode()
    {
        return $this->getConfigValue(self::CONFIG_XML_COUNTRY_CODE);
    }

    public function isEnableBcdc()
    {
        return $this->isSetFlag(self::CONFIG_XML_ENABLE_BCDC);
    }

    public function isEnableAcdc()
    {
        return $this->isSetFlag(self::CONFIG_XML_ENABLE_ACDC);
    }

    public function isCardFirstAcdc()
    {
        return $this->isSetFlag(self::CONFIG_XML_CARD_FIRST_ACDC);
    }
}