<?php
/**
 * Button Layout Source Model
 */
namespace PayPal\CommercePlatform\Model\Config\Source\Button;

class Layout implements \Magento\Framework\Option\ArrayInterface
{
    public function toOptionArray()
    {
        return [
            ['value' => 'vertical', 'label' => __('Vertikal')],
            ['value' => 'horizontal', 'label' => __('Horizontal')]
        ];
    }
}