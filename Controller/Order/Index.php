<?php
/**
 * PayPal PPCP Order Controller for Magento 2.2.3
 * Oxxo code removed
 */
namespace PayPal\CommercePlatform\Controller\Order;

use Magento\Framework\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Filesystem\Driver\File;
use PayPal\CommercePlatform\Logger\Handler;
use PayPal\CommercePlatform\Model\Paypal\Order\Request;

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

    public function __construct(
        Context $context,
        File $driver,
        Request $paypalOrderRequest,
        Handler $logger,
        JsonFactory $resultJsonFactory
    ) {
        parent::__construct($context);
        $this->_driver        = $driver;
        $this->_loggerHandler = $logger;
        $this->_paypalOrderRequest = $paypalOrderRequest;
        $this->_resultJsonFactory  = $resultJsonFactory;
    }

    public function execute()
    {
        $resultJson = $this->_resultJsonFactory->create();
        $httpErrorCode = '500';
        try {
            $paramsData = json_decode($this->_driver->fileGetContents('php://input'), true);
            $paypalCMID = isset($paramsData[self::FRAUDNET_CMI_PARAM]) ? $paramsData[self::FRAUDNET_CMI_PARAM] : null;
            $customerEmail = isset($paramsData[self::CUSTOMER_ID_PARAM]) ? $paramsData[self::CUSTOMER_ID_PARAM] : null;

            $response = $this->_paypalOrderRequest->createRequest($customerEmail, $paypalCMID);
        } catch (\Exception $e) {
            $this->_loggerHandler->error($e->getMessage());
            $resultJson->setData(array('reason' => __('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.')));

            return $resultJson->setHttpResponseCode($httpErrorCode);
        }

        return $resultJson->setData($response);
    }
}