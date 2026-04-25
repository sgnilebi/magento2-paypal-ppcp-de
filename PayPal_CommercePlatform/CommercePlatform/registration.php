<?php
/**
 * PayPal Commerce Platform — Magento 2 Module
 *
 * Original work: Copyright (c) QBO Tech (https://github.com/qbo-tech/magento2-paypal-commerce-platform)
 * Licensed under the Open Software License v. 3.0 (OSL-3.0)
 *
 * Derivative work: Modified for DE/EUR market by sgnilebi
 * - Removed Oxxo, STC, Billing Agreements, Vault, FraudNet
 * - Localized for German market (DE/EUR)
 * - PHP 7.0 compatibility fixes
 * - Security fixes (authorizationBasic removed, CSRF plugin removed)
 * This derivative work is licensed under OSL-3.0 (see LICENSE.txt)
 */

\Magento\Framework\Component\ComponentRegistrar::register(
    \Magento\Framework\Component\ComponentRegistrar::MODULE,
    'PayPal_CommercePlatform',
    __DIR__
);
