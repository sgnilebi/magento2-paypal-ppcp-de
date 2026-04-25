<?php

namespace PayPal\CommercePlatform\Model\Paypal\Core;

use PayPalHttp\HttpRequest;

class GenerateTokenRequest extends HttpRequest
{
    public function __construct($accessToken, $customerId = null)
    {
        parent::__construct("/v1/identity/generate-token", "POST");
        $this->headers["Authorization"] = "Bearer " . $accessToken;
        $this->headers["Content-Type"] = "application/json";

        if ($customerId) {
            $this->body = ["customer_id" => $customerId];
        } else {
            // For guest checkout: PayPal rejects {"customer_id":null} as MALFORMED_REQUEST_JSON.
            // PayPalHttp accepts string body and sends it as-is (no json_encode).
            // Empty JSON object "{}" is what PayPal expects for guests.
            $this->body = "{}";
        }
    }
}
