<?php
/**
 * Button Tagline Source Model
 */
namespace PayPal\CommercePlatform\Model\Config\Source\Button;

class Tagline implements \Magento\Framework\Option\ArrayInterface
{
    public function toOptionArray()
    {
        return [
            ['value' => 'true', 'label' => __('Ja')],
            ['value' => 'false', 'label' => __('Nein')]
        ];
    }
}