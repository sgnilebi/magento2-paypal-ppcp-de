<?php
/**
 * PayPal PPCP Order Request for Magento 2.2.3
 * Billing Agreement code removed
 */
namespace PayPal\CommercePlatform\Model\Paypal\Order;

class Request
{
    const DECIMAL_PRECISION = 2;
    const PAYMENT_METHOD = 'paypal';
    const ALLOWED_PAYMENT_METHOD = 'IMMEDIATE_PAY';
    const DISCOUNT_ITEM_NAME = 'Discount Item';
    const PAYPAL_CLIENT_METADATA_ID_HEADER = 'PayPal-Client-Metadata-Id';

    /** @var \Magento\Checkout\Model\Session $checkoutSession */
    protected $_checkoutSession;

    /** @var \PayPal\CommercePlatform\Model\Paypal\Api */
    protected $_paypalApi;

    /** @var \PayPal\CommercePlatform\Model\Config */
    protected $_paypalConfig;

    /** @var \PayPalCheckoutSdk\Orders\OrdersCreateRequest */
    protected $_orderCreateRequest;

    /** @var \Magento\Framework\Controller\Result\JsonFactory */
    protected $_resultJsonFactory;

    /** @var \PayPal\CommercePlatform\Logger\Handler */
    protected $_loggerHandler;

    /** @var \Magento\Framework\Event\ManagerInterface */
    protected $_eventManager;

    /** @var \Magento\Quote\Model\Quote */
    protected $_quote;

    /** @var \Magento\Customer\Helper\Address */
    protected $_addressHelper = null;

    /** @var \Magento\Quote\Model\Quote\Address */
    protected $_customerAddress = null;

    /** @var \Magento\Quote\Model\Quote\Address */
    protected $_customerBillingAddress = null;

    /** @var \Magento\Framework\Locale\Resolver */
    protected $localeResolver;

    /** @var \Magento\Store\Model\StoreManagerInterface */
    protected $_storeManager;

    /** @var \Magento\Payment\Model\Cart\SalesModel\Factory */
    protected $_cartFactory;

    /** @var \Magento\Payment\Model\Cart\SalesModel\SalesModelInterface */
    protected $_cartPayment;

    protected $_customer;

    /** @var \Magento\Quote\Model\QuoteRepository */
    private $quoteRepository;

    public static $_cancelUrl;
    public static $_returnUrl;
    public static $_notifyUrl;

    public function __construct(
        \Magento\Checkout\Model\Session $checkoutSession,
        \PayPal\CommercePlatform\Model\Paypal\Api $paypalApi,
        \PayPal\CommercePlatform\Model\Config $paypalConfig,
        \Magento\Framework\Controller\Result\JsonFactory $resultJsonFactory,
        \PayPal\CommercePlatform\Logger\Handler $logger,
        \Magento\Framework\Locale\Resolver $localeResolver,
        \Magento\Customer\Helper\Address $addressHelper,
        \Magento\Checkout\Model\Cart $cart,
        \Magento\Store\Model\StoreManagerInterface $storeManager,
        \Magento\Payment\Model\Cart\SalesModel\Factory $cartFactory,
        \Magento\Customer\Model\Session $customerSession,
        \Magento\Framework\Event\ManagerInterface $eventManager,
        \Magento\Quote\Model\QuoteRepository $quoteRepository
    ) {
        $this->_loggerHandler = $logger;
        $this->_paypalApi = $paypalApi;
        $this->_paypalConfig = $paypalConfig;
        $this->_eventManager = $eventManager;

        $this->_orderCreateRequest = $this->_paypalApi->getOrderCreateRequest();
        $this->_resultJsonFactory = $resultJsonFactory;
        $this->_checkoutSession = $checkoutSession;

        $this->_quote = $checkoutSession->getQuote();
        $this->_cartFactory = $cartFactory;
        $this->_cartPayment = $this->_cartFactory->create($this->_quote);
        $this->_customer = $customerSession->getCustomer();
        $this->_logger = $logger;

        $this->_customerBillingAddress = $cart->getQuote()->getBillingAddress();
        $this->_customerAddress = $cart->getQuote()->getShippingAddress();

        $this->_addressHelper = $addressHelper;
        $this->localeResolver = $localeResolver;
        $this->_storeManager = $storeManager;
        $this->quoteRepository = $quoteRepository;
        self::$_cancelUrl = $this->_storeManager->getStore()->getUrl('checkout/cart');
        self::$_returnUrl = $this->_storeManager->getStore()->getUrl('checkout/cart');
    }

    /**
     * Create and execute PayPal order request
     *
     * @param string $customerEmail
     * @param string $paypalCMID
     * @return \PayPalHttp\HttpResponse
     */
    public function createRequest($customerEmail, $paypalCMID)
    {
        $this->_orderCreateRequest->prefer('return=representation');

        if ($customerEmail) {
            $this->_quote->setCustomerEmail($customerEmail);
        }
        $requestBody = $this->buildRequestBody();


        if ($paypalCMID) {
            $this->_orderCreateRequest->headers[self::PAYPAL_CLIENT_METADATA_ID_HEADER] = $paypalCMID;
        }

        $this->_orderCreateRequest->body = $requestBody;

        try {
            $this->_eventManager->dispatch('paypalcp_create_order_before',
                ['paypalCMID' => $paypalCMID, 'quote' => $this->_quote, 'customer' => $this->_customer]);

            $response = $this->_paypalApi->execute($this->_orderCreateRequest);

            $this->_eventManager->dispatch('paypalcp_create_order_after',
                ['quote' => $this->_quote, 'paypalResponse' => $response]);
        } catch (\Exception $e) {
            $this->_loggerHandler->error($e->getMessage());
            throw $e;
        }

        return $response;
    }

    private function buildRequestBody()
    {
        if (!$this->_quote->getReserveOrderId()) {
            $this->_quote->reserveOrderId();
            $this->quoteRepository->save($this->_quote);
        }

        $currencyCode = $this->_quote->getBaseCurrencyCode();
        $discount = abs($this->_cartPayment->getBaseDiscountAmount() ?: 0);
        $giftCard = abs($this->_quote->getBaseGiftCardsAmountUsed() ?: 0);
        $storeCredit = abs($this->_quote->getBaseCustomerBalAmountUsed() ?: 0);
        $amount = $this->_formatPrice(
            $this->_cartPayment->getBaseSubtotal()
            + $this->_cartPayment->getBaseShippingAmount()
            + $this->_cartPayment->getBaseTaxAmount()
            - $discount
            - $giftCard
            - $storeCredit
        );
        $subtotal = $this->_formatPrice($this->_cartPayment->getBaseSubtotal());
        $shippingAmount = $this->_formatPrice($this->_cartPayment->getBaseShippingAmount());
        $taxAmount = $this->_formatPrice($this->_cartPayment->getBaseTaxAmount());

        $requestBody = [
            'intent' => 'CAPTURE',
            'application_context' => [
                'brand_name' => $this->_storeManager->getStore()->getFrontendName() ?: $this->_storeManager->getStore()->getName(),
                'return_url' => $this->_storeManager->getStore()->getUrl('checkout/cart'),
                'cancel_url' => $this->_storeManager->getStore()->getUrl('checkout/cart'),
                'shipping_preference' => $this->_quote->isVirtual() ? 'NO_SHIPPING' : 'SET_PROVIDED_ADDRESS'
            ],
            'payer' => $this->_getPayer(),
            'purchase_units' => [
                [
                    'invoice_id' => sprintf('%s-%s', \date('Ymdhis'), $this->_quote->getReservedOrderId()),
                    'amount' => [
                        'currency_code' => $currencyCode,
                        'value' => $amount
                    ]
                ]
            ]
        ];

        if ($this->_paypalConfig->isSetFlag(\PayPal\CommercePlatform\Model\Config::CONFIG_XML_ENABLE_ITEMS)) {
            $requestBody['purchase_units'][0]['items'] = $this->getItemsFormatted();
            $requestBody['purchase_units'][0]['amount']['breakdown'] = [
                'item_total' => [
                    'value' => $subtotal,
                    'currency_code' => $currencyCode
                ],
                'shipping' => [
                    'value' => $shippingAmount,
                    'currency_code' => $currencyCode
                ],
                'discount' => $this->_getDiscountAmount(),
                'tax_total' => [
                    'value' => $taxAmount,
                    'currency_code' => $currencyCode
                ]
            ];
        }

        if (!$this->_quote->isVirtual()) {
            $requestBody['purchase_units'][0]['shipping'] = [
                'name' => ['full_name' => $this->_customerAddress->getFirstname() . ' ' . $this->_customerAddress->getLastname()],
                'address' => $this->_getShippingAddress(),
            ];
        }

        return $requestBody;
    }

    protected function _getPayer()
    {
        $ret = [
            'email_address' => $this->_customerAddress->getEmail(),
            'name' => [
                'given_name' => $this->_customerAddress->getFirstname(),
                'surname' => $this->_customerAddress->getLastname()
            ],
        ];

        if ($this->_customerAddress->getTelephone() && strlen($this->_customerAddress->getTelephone()) > 1) {
            $ret['phone'] = [
                'phone_number' => [
                    'national_number' => $this->_customerAddress->getTelephone()
                ]
            ];
        }

        return $ret;
    }

    public function getItemsFormatted()
    {
        $paypalItems = [];
        $currencyCode = $this->_quote->getBaseCurrencyCode();

        foreach ($this->_quote->getAllVisibleItems() as $item) {
            $paypalItems[] = [
                'name' => $item->getName(),
                'sku' => $item->getSku(),
                'description' => $item->getDescription(),
                'unit_amount' => [
                    'currency_code' => $currencyCode,
                    'value' => $this->_formatPrice($item->getPrice())
                ],
                'tax' => [
                    'currency_code' => $currencyCode,
                    'value' => $this->_formatPrice($item->getTaxAmount())
                ],
                'quantity' => $item->getQty()
            ];
        }

        return $paypalItems;
    }

    protected function _getDiscountAmount()
    {
        if ($this->_cartPayment->getBaseDiscountAmount() && $this->_cartPayment->getBaseDiscountAmount() != 0) {
            $discount = $this->_cartPayment->getBaseDiscountAmount();

            $discount = ($discount < 0) ? $discount * -1 : $discount;

            if ($this->_quote->getBaseGiftCardsAmountUsed()) {
                $discount += $this->_quote->getBaseGiftCardsAmountUsed();
            }
            if ($this->_quote->getBaseCustomerBalAmountUsed()) {
                $discount += $this->_quote->getBaseCustomerBalAmountUsed();
            }

            return [
                'value' => $this->_formatPrice($discount),
                'currency_code' => $this->_quote->getBaseCurrencyCode()
            ];
        }
    }

    protected function _getShippingAddress()
    {
        return $this->_prepareAddress($this->_customerAddress);
    }

    protected function _prepareAddress($address)
    {
        $region = $address->getRegionCode() ? $address->getRegionCode() : $address->getRegion();
        $addressLines = $this->_prepareAddressLines($address);

        return array(
            'admin_area_2' => $address->getCity(),
            'admin_area_1' => $region ?: 'n/a',
            'postal_code' => $address->getPostcode(),
            'country_code' => $address->getCountryId(),
            'address_line_1' => $addressLines['line1'],
            'address_line_2' => $addressLines['line2'],
        );
    }

    protected function _prepareAddressLines($address)
    {
        $street = $this->_addressHelper->convertStreetLines($address->getStreet(), 2);
        $_address['line1'] = isset($street[0]) ? $street[0] : '';
        $_address['line2'] = isset($street[1]) ? $street[1] : '';

        return $_address;
    }

    protected function _formatPrice($string)
    {
        return sprintf('%.2F', $string);
    }
}