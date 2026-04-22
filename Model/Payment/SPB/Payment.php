<?php
/**
 * PayPal Smart Payment Button for Magento 2.2.3
 * Based on QBO PayPal Commerce Platform — adapted for DE/EUR
 */
namespace PayPal\CommercePlatform\Model\Payment\SPB;

class Payment extends \PayPal\CommercePlatform\Model\Payment\Advanced\Payment
{
    const CODE = 'paypalspb';

    protected $_code = self::CODE;
}