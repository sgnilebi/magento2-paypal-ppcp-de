<?php
/**
 * Button Shape Source Model
 */
namespace PayPal\CommercePlatform\Model\Config\Source\Button;

class Shape implements \Magento\Framework\Option\ArrayInterface
{
    public function toOptionArray()
    {
        return [
            ['value' => 'pill', 'label' => __('Abgerundet')],
            ['value' => 'rect', 'label' => __('Rechteckig')]
        ];
    }
}