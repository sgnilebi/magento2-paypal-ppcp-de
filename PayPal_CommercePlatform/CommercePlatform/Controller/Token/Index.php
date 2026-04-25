<?php

namespace PayPal\CommercePlatform\Controller\Token;

use Magento\Framework\App\Action\Context;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Filesystem\Driver\File;
use PayPal\CommercePlatform\Logger\Handler;
use PayPal\CommercePlatform\Model\Paypal\Core\Token;
use PayPal\CommercePlatform\Model\Config;

class Index extends \Magento\Framework\App\Action\Action
{

    /** @var \Magento\Framework\Filesystem\DriverInterface */
    protected $_driver;

    /** @var \PayPal\CommercePlatform\Logger\Handler */
    protected $_loggerHandler;

    /** @var Token */
    protected $paypalAccessTokenRequest;

    /** @var \Magento\Framework\Controller\Result\JsonFactory */
    protected $_resultJsonFactory;

    /** @var Config */
    protected $_paypalConfig;

    /**
     * @param \Magento\Framework\App\Action\Context $context
     * @param \Magento\Framework\Filesystem\Driver\File $driver
     * @param Token $paypalAccessTokenRequest
     * @param Handler $logger
     * @param JsonFactory $resultJsonFactory
     * @param Config $paypalConfig
     */
    public function __construct(
        Context $context,
        File $driver,
        Token $paypalAccessTokenRequest,
        Handler $logger,
        JsonFactory $resultJsonFactory,
        Config $paypalConfig
    ) {
        parent::__construct($context);
        $this->_driver        = $driver;
        $this->_loggerHandler = $logger;
        $this->paypalAccessTokenRequest = $paypalAccessTokenRequest;
        $this->_resultJsonFactory  = $resultJsonFactory;
        $this->_paypalConfig = $paypalConfig;
    }

    /**
     * @return \Magento\Framework\App\ResponseInterface|\Magento\Framework\Controller\Result\Json|\Magento\Framework\Controller\ResultInterface
     */
    public function execute()
    {
        $resultJson = $this->_resultJsonFactory->create();
        $httpErrorCode = '500';

        try {
            // Check credentials before making API call
            if (!$this->_paypalConfig->hasCredentials()) {
                $this->_loggerHandler->error('[PayPal PPCP] No credentials configured');
                $resultJson->setData(array(
                    'reason' => json_encode([
                        'message' => 'PayPal ist nicht konfiguriert. Bitte tragen Sie Client ID und Secret im Backend ein.'
                    ])
                ));
                return $resultJson->setHttpResponseCode($httpErrorCode);
            }

            $accessToken = $this->paypalAccessTokenRequest->createRequest();

            if(isset($accessToken->result) && isset($accessToken->result->access_token)){
                $tokenGenerated = $this->paypalAccessTokenRequest->createGenerateTokenRequest($accessToken->result->access_token);
            } else {
                // Credentials might be wrong — PayPal API returned no access token
                $this->_loggerHandler->error('[PayPal PPCP] Access token request failed — check Client ID and Secret');
                throw new \Magento\Framework\Exception\LocalizedException(
                    __('PayPal-Zugangsdaten sind ungültig. Bitte überprüfen Sie Client ID und Secret.')
                );
            }

            if(isset($tokenGenerated->result) && isset($tokenGenerated->result->client_token)){
                $response = ['token' => $tokenGenerated->result->client_token];
            } else {
                throw new \Exception(__('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'));
            }

        } catch (\Magento\Framework\Exception\LocalizedException $e) {
            $this->_loggerHandler->error($e->getMessage());
            $resultJson->setData(array('reason' => json_encode(['message' => $e->getMessage()])));
            return $resultJson->setHttpResponseCode($httpErrorCode);
        } catch (\Exception $e) {
            $this->_loggerHandler->error($e->getMessage());
            $resultJson->setData(array('reason' => json_encode([
                'message' => 'PayPal ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.'
            ])));
            return $resultJson->setHttpResponseCode($httpErrorCode);
        }

        return $resultJson->setData($response);
    }
}