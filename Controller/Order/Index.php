<?php
/**
 * PayPal PPCP Order Controller for Magento 2.2.3
 * Oxxo code removed, credentials validation added
 */
namespace PayPal\CommercePlatform\Controller\Order;

use Magento\Framework\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Filesystem\Driver\File;
use PayPal\CommercePlatform\Logger\Handler;
use PayPal\CommercePlatform\Model\Paypal\Order\Request;
use PayPal\CommercePlatform\Model\Config;

class Index extends \Magento\Framework\App\Action\Action
{
    const FRAUDNET_CMI_PARAM = 'fraudNetCMI';
    const CUSTOMER_ID_PARAM = 'customer_email';

    /** @var \Magento\Framework\Filesystem\DriverInterface */
    protected $_driver;

    /** @var \PayPal\CommercePlatform\Logger\Handler */
    protected $_loggerHandler;

    /** @var \PayPal\CommercePlatform\Model\Paypal\Order\Request */
    protected $_paypalOrderRequest;

    /** @var \Magento\Framework\Controller\Result\JsonFactory */
    protected $_resultJsonFactory;

    /** @var Config */
    protected $_paypalConfig;

    public function __construct(
        Context $context,
        File $driver,
        Request $paypalOrderRequest,
        Handler $logger,
        JsonFactory $resultJsonFactory,
        Config $paypalConfig
    ) {
        parent::__construct($context);
        $this->_driver        = $driver;
        $this->_loggerHandler = $logger;
        $this->_paypalOrderRequest = $paypalOrderRequest;
        $this->_resultJsonFactory  = $resultJsonFactory;
        $this->_paypalConfig = $paypalConfig;
    }

    public function execute()
    {
        $resultJson = $this->_resultJsonFactory->create();
        $httpErrorCode = '500';

        try {
            // Check credentials before making API call
            if (!$this->_paypalConfig->hasCredentials()) {
                $this->_loggerHandler->error('[PayPal PPCP] No credentials configured');
                $resultJson->setData(array('reason' => json_encode([
                    'message' => 'PayPal ist nicht konfiguriert. Bitte tragen Sie Client ID und Secret im Backend ein.'
                ])));
                return $resultJson->setHttpResponseCode($httpErrorCode);
            }

            $paramsData = json_decode($this->_driver->fileGetContents('php://input'), true);
            $paypalCMID = isset($paramsData[self::FRAUDNET_CMI_PARAM]) ? $paramsData[self::FRAUDNET_CMI_PARAM] : null;
            $customerEmail = isset($paramsData[self::CUSTOMER_ID_PARAM]) ? $paramsData[self::CUSTOMER_ID_PARAM] : null;

            $response = $this->_paypalOrderRequest->createRequest($customerEmail, $paypalCMID);
        } catch (\Magento\Framework\Exception\LocalizedException $e) {
            $this->_loggerHandler->error($e->getMessage());
            $resultJson->setData(array('reason' => json_encode(['message' => $e->getMessage()])));
            return $resultJson->setHttpResponseCode($httpErrorCode);
        } catch (\Exception $e) {
            $this->_loggerHandler->error($e->getMessage());
            $resultJson->setData(array('reason' => json_encode([
                'message' => 'Ein Fehler ist bei der PayPal-Verbindung aufgetreten. Bitte überprüfen Sie die Zugangsdaten.'
            ])));
            return $resultJson->setHttpResponseCode($httpErrorCode);
        }

        return $resultJson->setData($response);
    }
}