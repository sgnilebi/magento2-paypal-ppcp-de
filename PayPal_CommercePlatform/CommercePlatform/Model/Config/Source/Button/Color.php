<?php
/**
 * Button Color Source Model
 */
namespace PayPal\CommercePlatform\Model\Config\Source\Button;

class Color implements \Magento\Framework\Option\ArrayInterface
{
    public function toOptionArray()
    {
        return [
            ['value' => 'gold', 'label' => __('Gold')],
            ['value' => 'blue', 'label' => __('Blau')],
            ['value' => 'silver', 'label' => __('Silber')],
            ['value' => 'white', 'label' => __('Weiß')],
            ['value' => 'black', 'label' => __('Schwarz')]
        ];
    }
}