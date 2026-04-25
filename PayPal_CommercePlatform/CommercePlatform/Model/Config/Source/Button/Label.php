<?php
/**
 * Button Label Source Model
 */
namespace PayPal\CommercePlatform\Model\Config\Source\Button;

class Label implements \Magento\Framework\Option\ArrayInterface
{
    public function toOptionArray()
    {
        return [
            ['value' => 'checkout', 'label' => __('Checkout')],
            ['value' => 'pay', 'label' => __('Bezahlen')],
            ['value' => 'buynow', 'label' => __('Sofort kaufen')],
            ['value' => 'paypal', 'label' => __('PayPal')]
        ];
    }
}