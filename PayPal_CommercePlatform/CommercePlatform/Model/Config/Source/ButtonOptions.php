<?php
/**
 * PayPal PPCP Button Options for Magento 2.2.3
 * Source models for system.xml select fields
 */
namespace PayPal\CommercePlatform\Model\Config\Source;

class ButtonOptions implements \Magento\Framework\Option\ArrayInterface
{
    public function toOptionArray()
    {
        return [];
    }

    public static function getLayoutOptions()
    {
        return [
            ['value' => 'vertical', 'label' => __('Vertikal')],
            ['value' => 'horizontal', 'label' => __('Horizontal')]
        ];
    }

    public static function getColorOptions()
    {
        return [
            ['value' => 'gold', 'label' => __('Gold')],
            ['value' => 'blue', 'label' => __('Blau')],
            ['value' => 'silver', 'label' => __('Silber')],
            ['value' => 'white', 'label' => __('Weiß')],
            ['value' => 'black', 'label' => __('Schwarz')]
        ];
    }

    public static function getShapeOptions()
    {
        return [
            ['value' => 'pill', 'label' => __('Abgerundet')],
            ['value' => 'rect', 'label' => __('Rechteckig')]
        ];
    }

    public static function getLabelOptions()
    {
        return [
            ['value' => 'checkout', 'label' => __('Checkout')],
            ['value' => 'pay', 'label' => __('Bezahlen')],
            ['value' => 'buynow', 'label' => __('Sofort kaufen')],
            ['value' => 'paypal', 'label' => __('PayPal')]
        ];
    }

    public static function getTaglineOptions()
    {
        return [
            ['value' => 'true', 'label' => __('Ja')],
            ['value' => 'false', 'label' => __('Nein')]
        ];
    }
}