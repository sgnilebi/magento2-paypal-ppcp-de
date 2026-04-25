<?php
/**
 * PayPal PPCP Advanced Payment (Credit Card) for Magento 2.2.3
 * Based on QBO PayPal Commerce Platform — adapted for DE/EUR
 * Billing Agreement dependency removed
 */
namespace PayPal\CommercePlatform\Model\Payment\Advanced;

use Magento\Checkout\Model\Session;
use Magento\Framework\Exception\LocalizedException;
use Magento\Payment\Model\InfoInterface;
use Magento\Sales\Api\OrderRepositoryInterface;
use PayPal\CommercePlatform\Model\Config;

class Payment extends \Magento\Payment\Model\Method\AbstractMethod
{
    const CODE                         = 'paypalcp';

    const PAYMENT_REVIEW_STATE         = 'PENDING';
    const PENDING_PAYMENT_NOTIFICATION = 'Diese Bestellung ist pausiert wegen einer ausstehenden Zahlung. Die Bestellung wird verarbeitet, sobald die Zahlung genehmigt wurde.';
    const DECLINE_ERROR_MESSAGE        = 'Ausstehende Zahlung wird abgelehnt';
    const GATEWAY_ERROR_MESSAGE        = 'Zahlung wurde vom Zahlungs-Gateway abgelehnt';
    const GATEWAY_NOT_TXN_ID_PRESENT   = 'Transaktions-ID nicht vorhanden';
    const DENIED_ERROR_MESSAGE         = 'Fehler bei Gateway-Antwort';
    const COMPLETED_SALE_CODE          = 'COMPLETED';
    const DENIED_SALE_CODE             = 'DENIED';
    const FAILED_STATE_CODE            = 'FAILED';
    const SUCCESS_STATE_CODES          = array("PENDING", "COMPLETED");

    const PAYPAL_CLIENT_METADATA_ID_HEADER = 'PayPal-Client-Metadata-Id';
    const FRAUDNET_CMI_PARAM = 'fraudNetCMI';

    protected $_code = self::CODE;

    protected $_infoBlockType = 'PayPal\CommercePlatform\Block\Info';

    protected $_isGateway    = true;

    protected $_canRefund    = true;
    protected $_canRefundInvoicePartial    = true;
    protected $_canCapture   = true;
    protected $_canAuthorize = true;

    /** @var \Magento\Sales\Model\Order */
    protected $_order        = false;

    protected $_response;

    protected $_successCodes = ['200', '201'];

    protected $_canHandlePendingStatus = true;

    /** @var \PayPal\CommercePlatform\Logger\Handler */
    protected $_logger;

    /** @var \PayPalCheckoutSdk\Orders\OrdersCaptureRequest */
    protected $_paypalOrderCaptureRequest;

    /** @var \PayPal\CommercePlatform\Model\Paypal\Api */
    protected $_paypalApi;

    /** @var \Magento\Framework\Event\ManagerInterface */
    protected $_eventManager;

    /** @var \Magento\Framework\App\Config\ScopeConfigInterface */
    protected $_scopeConfig;

    private $paymentSource;

    /**
     * @var \Magento\Sales\Api\OrderRepositoryInterface
     */
    private $orderRepository;

    /**
     * @var \Magento\Checkout\Model\Session
     */
    protected $checkoutSession;

    /**
     * @var \PayPal\CommercePlatform\Model\Config
     */
    protected $paypalConfig;

    /**
     * @param \Magento\Framework\Model\Context $context
     * @param \Magento\Framework\Registry $registry
     * @param \Magento\Framework\Api\ExtensionAttributesFactory $extensionFactory
     * @param \Magento\Framework\Api\AttributeValueFactory $customAttributeFactory
     * @param \Magento\Payment\Helper\Data $paymentData
     * @param \Magento\Payment\Model\Method\Logger $paymentLogger
     * @param \Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig
     * @param \PayPal\CommercePlatform\Model\Paypal\Api $paypalApi
     * @param \PayPal\CommercePlatform\Logger\Handler $logger
     * @param \Magento\Framework\Event\ManagerInterface $eventManager
     * @param \PayPal\CommercePlatform\Model\Config $paypalConfig
     * @param \Magento\Checkout\Model\Session $checkoutSession
     * @param \Magento\Sales\Api\OrderRepositoryInterface $orderRepository
     * @param array $data
     */
    public function __construct(
        \Magento\Framework\Model\Context $context,
        \Magento\Framework\Registry $registry,
        \Magento\Framework\Api\ExtensionAttributesFactory $extensionFactory,
        \Magento\Framework\Api\AttributeValueFactory $customAttributeFactory,
        \Magento\Payment\Helper\Data $paymentData,
        \Magento\Payment\Model\Method\Logger $paymentLogger,
        \Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig,
        \PayPal\CommercePlatform\Model\Paypal\Api $paypalApi,
        \PayPal\CommercePlatform\Logger\Handler $logger,
        \Magento\Framework\Event\ManagerInterface $eventManager,
        Config $paypalConfig,
        Session $checkoutSession,
        OrderRepositoryInterface $orderRepository,
        \Magento\Framework\Model\ResourceModel\AbstractResource $resource = null,
        \Magento\Framework\Data\Collection\AbstractDb $resourceCollection = null,
        array $data = []
    ) {
        parent::__construct(
            $context,
            $registry,
            $extensionFactory,
            $customAttributeFactory,
            $paymentData,
            $scopeConfig,
            $paymentLogger,
            $resource,
            $resourceCollection,
            $data
        );

        $this->_logger       = $logger;
        $this->_paypalApi    = $paypalApi;
        $this->_scopeConfig  = $scopeConfig;
        $this->_eventManager = $eventManager;
        $this->checkoutSession = $checkoutSession;
        $this->paypalConfig = $paypalConfig;
        $this->paymentSource = null;
        $this->orderRepository = $orderRepository;
    }

    public function refund(InfoInterface $payment, $amount)
    {
        /** @var \Magento\Sales\Model\Order\Payment $payment */
        $paypalOrderId = $payment->getAdditionalInformation('payment_id');
        $creditMemoIndex = (int)$payment->getAdditionalInformation('credit_memo_count') + 1;

        $paypalRefundRequest = new \PayPalCheckoutSdk\Payments\CapturesRefundRequest($paypalOrderId);

        $creditmemo = $payment->getCreditmemo();

        $memoCurrencyCode = $creditmemo->getBaseCurrencyCode();

        $paypalRefundRequest->body = [
            'amount' => [
                'value'         => $amount,
                'currency_code' => $memoCurrencyCode
            ],
            'invoice_id'    => $creditmemo->getInvoiceId() . '-' . $creditMemoIndex,
            'note_to_payer' => $creditmemo->getCustomerNote()
        ];

        $this->_paypalApi->execute($paypalRefundRequest);
        $payment->setAdditionalInformation('credit_memo_count', $creditMemoIndex);
        return $this;
    }

    public function isAvailable(
        \Magento\Quote\Api\Data\CartInterface $quote = null
    ) {
        return parent::isAvailable($quote);
    }

    /**
     * Assign corresponding data
     *
     * @param \Magento\Framework\DataObject|mixed $data
     * @return $this
     * @throws LocalizedException
     */
    public function assignData(\Magento\Framework\DataObject $data)
    {
        parent::assignData($data);

        $infoInstance   = $this->getInfoInstance();
        $infoInstance->setAdditionalInformation('payment_source');

        $additionalData = $data->getData('additional_data') ?: $data->getData();

        foreach ($additionalData as $key => $value) {
            if (!is_object($value)) {
                $infoInstance->setAdditionalInformation($key, $value);
            }
        }

        return $this;
    }

    /**
     * Payment capturing
     *
     * @param \Magento\Payment\Model\InfoInterface $payment
     * @param float $amount
     * @return $this
     * @throws \Magento\Framework\Validator\Exception
     */
    public function capture(\Magento\Payment\Model\InfoInterface $payment, $amount)
    {
        $paypalOrderId = $payment->getAdditionalInformation('order_id');

        /** @var \Magento\Sales\Model\Order */
        $this->_order = $payment->getOrder();

        try {
            $this->validatePayPalOrderAmountBeforeCapture($payment, $paypalOrderId);

            $this->_paypalOrderCaptureRequest = $this->_paypalApi->getOrdersCaptureRequest($paypalOrderId);

            if ($payment->getAdditionalInformation('payment_source')) {
                $this->paymentSource = json_decode($payment->getAdditionalInformation('payment_source'), true);
                $this->_paypalOrderCaptureRequest->body = ['payment_source' => $this->paymentSource];
            }

            $paypalCMID = $payment->getAdditionalInformation(self::FRAUDNET_CMI_PARAM);
            if ($paypalCMID) {
                $this->_paypalOrderCaptureRequest->headers[self::PAYPAL_CLIENT_METADATA_ID_HEADER] = $paypalCMID;
            }

            $this->_eventManager->dispatch('paypalcp_order_capture_before', ['payment' => $payment, 'paypalCMID' => $paypalCMID]);
            $this->_response = $this->_paypalApi->execute($this->_paypalOrderCaptureRequest);
            $this->_processTransaction($payment);
            $this->_eventManager->dispatch('paypalcp_order_capture_after', ['payment' => $payment]);

        } catch (\Exception $e) {
            if ($e instanceof LocalizedException) {
                throw $e;
            }

            $this->_logger->error(sprintf('[PAYPAL COMMERCE CAPTURING ERROR] - %s', $e->getMessage()));

            $this->_logger->error(__METHOD__ . ' | Exception : ' . $e->getMessage());
            $this->_logger->error(__METHOD__ . ' | Exception response : ' . print_r($this->_response, true));

            throw new \Magento\Framework\Exception\LocalizedException(__(self::GATEWAY_ERROR_MESSAGE));
        }
        return $this;
    }

    /**
     * Validate PayPal order amount before capture.
     *
     * @param \Magento\Payment\Model\InfoInterface $payment
     * @param string $paypalOrderId
     * @return void
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    private function validatePayPalOrderAmountBeforeCapture(InfoInterface $payment, $paypalOrderId)
    {
        $paypalOrderAmount = $this->getPayPalOrderAmount($paypalOrderId);
        if ($paypalOrderAmount === null) {
            $this->_logger->debug('[PAYPAL COMMERCE CAPTURE] PayPal order amount not found before capture', [
                'paypal_order_id' => $paypalOrderId
            ]);
            return;
        }

        /** @var \Magento\Sales\Model\Order $order */
        $order = $payment->getOrder();
        $orderTotal = round((float)$order->getGrandTotal(), 2);

        $paypalAmountInCents = (int)round($paypalOrderAmount * 100);
        $orderTotalInCents = (int)round($orderTotal * 100);

        if ($paypalAmountInCents === $orderTotalInCents) {
            return;
        }

        $message = sprintf(
            'Betragsabweichung: PayPal: %s, Bestellung: %s',
            number_format($paypalOrderAmount, 2),
            number_format($orderTotal, 2)
        );

        $this->_logger->debug('[PAYPAL COMMERCE CAPTURE] Amount mismatch detected before capture', [
            'order_id' => $order->getIncrementId(),
            'paypal_amount' => $paypalOrderAmount,
            'order_total' => $orderTotal,
            'paypal_order_id' => $paypalOrderId
        ]);

        if ((bool)$this->getConfigValue('stop_on_amount_mismatch')) {
            throw new LocalizedException(__($message));
        }
    }

    /**
     * Retrieve PayPal order amount from GET order endpoint.
     *
     * @param string $paypalOrderId
     * @return float|null
     */
    private function getPayPalOrderAmount($paypalOrderId)
    {
        $orderGetRequest = $this->_paypalApi->getOrdersGetRequest($paypalOrderId);
        $orderResponse = $this->_paypalApi->execute($orderGetRequest);

        if (empty($orderResponse) || !isset($orderResponse->result)) {
            return null;
        }

        if (!isset($orderResponse->result->purchase_units[0]->amount->value)) {
            return null;
        }

        return round((float)$orderResponse->result->purchase_units[0]->amount->value, 2);
    }

    /**
     * Process Payment Transaction based on response data
     *
     * @param  \Magento\Payment\Model\InfoInterface $payment
     * @return \Magento\Payment\Model\InfoInterface $payment
     */
    protected function _processTransaction(&$payment)
    {
        if (!in_array($this->_response->statusCode, $this->_successCodes)) {
            throw new \Exception(__('Gateway error. Reason: %1', $this->_response->message));
        }

        $state = isset($this->_response->result->purchase_units[0]->payments->captures[0]->status) ? $this->_response->result->purchase_units[0]->payments->captures[0]->status : false;

        if (!$state || is_null($state) || !in_array($state, self::SUCCESS_STATE_CODES)) {
            throw new \Exception(__(self::GATEWAY_ERROR_MESSAGE));
        }

        $_txnId = isset($this->_response->result->purchase_units[0]->payments->captures[0]->id) ? $this->_response->result->purchase_units[0]->payments->captures[0]->id : null;

        if (!$_txnId) {
            throw new \Exception(__(self::GATEWAY_NOT_TXN_ID_PRESENT));
        }

        $infoInstance = $this->getInfoInstance();
        $infoInstance->setAdditionalInformation('payment_id', $_txnId);

        $this->_canHandlePendingStatus = (bool)$this->getConfigValue('handle_pending_payments');

        switch ($state) {
            case self::PAYMENT_REVIEW_STATE:
                if (!$this->_canHandlePendingStatus) {
                    throw new \Exception(__(self::DECLINE_ERROR_MESSAGE));
                }
                $this->setComments($this->_order, __(self::PENDING_PAYMENT_NOTIFICATION), false);
                $payment->setTransactionId($_txnId)
                    ->setIsTransactionPending(true)
                    ->setIsTransactionClosed(false);
                break;
            case self::COMPLETED_SALE_CODE:
                $payment->setTransactionId($_txnId)
                    ->setIsTransactionClosed(true);
                break;
            default:
                $payment->setIsTransactionPending(true);
                break;
        }

        if (property_exists($this->_response->result, 'payment_source')) {
            $paymentSource = $this->_response->result->payment_source;
            $storeId = $this->getStoreId();
            $paypalButtonTitle = $this->_scopeConfig->getValue('payment/paypalcp/title_paypal', \Magento\Store\Model\ScopeInterface::SCOPE_STORE, $storeId);
            $paypalCardTitle = $this->_scopeConfig->getValue('payment/paypalcp/title_card', \Magento\Store\Model\ScopeInterface::SCOPE_STORE, $storeId);

            if ($paymentSource) {
                if (property_exists($paymentSource, 'card')) {
                    $infoInstance->setAdditionalInformation('method_title', $paypalCardTitle);
                    if (property_exists($paymentSource->card, 'last_digits'))
                        $infoInstance->setAdditionalInformation('card_last_digits', $paymentSource->card->last_digits);
                    if (property_exists($paymentSource->card, 'brand'))
                        $infoInstance->setAdditionalInformation('card_brand', $paymentSource->card->brand);
                    if (property_exists($paymentSource->card, 'type'))
                        $infoInstance->setAdditionalInformation('card_type', $paymentSource->card->type);
                } else {
                    $infoInstance->setAdditionalInformation('method_title', $paypalButtonTitle);
                    if (property_exists($paymentSource, 'paypal')) {
                        if (property_exists($paymentSource->paypal, 'email_address')) {
                            $infoInstance->setAdditionalInformation('PayPal Email', $paymentSource->paypal->email_address);
                        }
                        if (property_exists($paymentSource->paypal, 'account_id')) {
                            $infoInstance->setAdditionalInformation('PayPal Account Id', $paymentSource->paypal->account_id);
                        }
                    }
                }
            }
        }

        return $payment;
    }

    /**
     * Set order comments
     */
    public function setComments(&$order, $comment, $isCustomerNotified)
    {
        $history = $order->addStatusHistoryComment($comment, false);
        $history->setIsCustomerNotified($isCustomerNotified);

        return $order;
    }

    /**
     * Get payment store config
     */
    public function getConfigValue($field)
    {
        return $this->_scopeConfig->getValue(
            $this->_preparePathConfig($field),
            \Magento\Store\Model\ScopeInterface::SCOPE_STORE
        );
    }

    protected function _preparePathConfig($field)
    {
        return sprintf('payment/%s/%s', self::CODE, $field);
    }

    public function getConfigData($field, $storeId = null)
    {
        if ('order_place_redirect_url' === $field) {
            return $this->getOrderPlaceRedirectUrl();
        }
        if (null === $storeId) {
            $storeId = $this->getStore();
        }

        $path = 'payment/' . $this->_code . '/' . $field;
        return $this->_scopeConfig->getValue($path, \Magento\Store\Model\ScopeInterface::SCOPE_STORE, $storeId);
    }
}