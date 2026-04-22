<?php
/**
 * PayPal PPCP Button Options for Magento 2.2.3
 */
namespace PayPal\CommercePlatform\Model\Config\Source;

class ButtonOptions
{
    public function getLayout()
    {
        return [
            'vertical'   => __('Vertikal'),
            'horizontal' => __('Horizontal')
        ];
    }

    public function getColor()
    {
        return [
            'gold'   => __('Gold'),
            'blue'   => __('Blau'),
            'silver' => __('Silber'),
            'white'  => __('Weiß'),
            'black'  => __('Schwarz')
        ];
    }

    public function getShape()
    {
        return [
            'pill' => __('Abgerundet'),
            'rect' => __('Rechteckig')
        ];
    }

    public function getLabel()
    {
        return [
            'checkout'    => __('Checkout'),
            'pay'         => __('Bezahlen'),
            'buynow'      => __('Sofort kaufen'),
            'paypal'      => __('PayPal'),
        ];
    }

    public function getTagline()
    {
        return [
            'true'  => __('Ja'),
            'false' => __('Nein')
        ];
    }
}