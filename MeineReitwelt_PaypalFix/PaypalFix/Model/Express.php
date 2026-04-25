<?php
namespace MeineReitwelt\PaypalFix\Model;

use Magento\Paypal\Model\Express as PaypalExpress;
use Magento\Quote\Api\Data\PaymentInterface;

class Express extends PaypalExpress
{
    public function assignData(\Magento\Framework\DataObject $data)
    {
        \Magento\Payment\Model\Method\AbstractMethod::assignData($data);
        $additionalData = $data->getData(PaymentInterface::KEY_ADDITIONAL_DATA);
        if (!is_array($additionalData)) {
            return $this;
        }
        foreach ($additionalData as $key => $value) {
            if ($key === \Magento\Framework\Api\ExtensibleDataInterface::EXTENSION_ATTRIBUTES_KEY) {
                continue;
            }
            $this->getInfoInstance()->setAdditionalInformation($key, $value);
        }
        return $this;
    }
}
