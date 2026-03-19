<?php

class EWayBillHelper {

    public static function getDefaultConfig() {
        return [
            'base_url' => $_ENV['EWB_BASE_URL'] ?? 'https://einvapi.charteredinfo.com/v1.03/dec/ewayapi',
            'auth_url' => $_ENV['EWB_AUTH_URL'] ?? 'https://einvapi.charteredinfo.com/v1.03/dec/auth',
            'aspid' => $_ENV['EWB_ASP_ID'] ?? '',
            'password' => $_ENV['EWB_ASP_PASSWORD'] ?? '',
            'timeout' => isset($_ENV['EWB_TIMEOUT']) ? (int)$_ENV['EWB_TIMEOUT'] : 45
        ];
    }

    public static function request($action, $queryParams = [], $payload = null, $method = 'POST', $baseUrl = null) {
        $config = self::getDefaultConfig();

        $aspId = isset($queryParams['aspid']) && $queryParams['aspid'] !== ''
            ? $queryParams['aspid']
            : $config['aspid'];
        $aspPassword = isset($queryParams['password']) && $queryParams['password'] !== ''
            ? $queryParams['password']
            : $config['password'];

        if (empty($aspId)) {
            throw new Exception('EWB_ASP_ID is not configured');
        }

        if (empty($aspPassword)) {
            throw new Exception('EWB_ASP_PASSWORD is not configured');
        }

        if (empty($action)) {
            throw new Exception('E-Way Bill action is required');
        }

        $method = strtoupper($method);

        // Filter out null/empty values from queryParams BEFORE merging so they
        // do not overwrite the resolved aspId/aspPassword from config.
        $cleanQueryParams = array_filter($queryParams, function ($v) { return $v !== null && $v !== ''; });

        $params = array_merge([
            'action' => $action,
            'aspid' => $aspId,
            'password' => $aspPassword
        ], $cleanQueryParams);

        $filteredParams = [];
        foreach ($params as $key => $value) {
            if ($value !== null && $value !== '') {
                $filteredParams[$key] = $value;
            }
        }

        $resolvedBase = ($baseUrl !== null && $baseUrl !== '') ? $baseUrl : $config['base_url'];
        $url = $resolvedBase . '?' . http_build_query($filteredParams);

        if (!function_exists('curl_init')) {
            throw new Exception('cURL extension is required for E-Way Bill integration');
        }

        $ch = curl_init($url);

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json'
        ];

        $curlOptions = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => max(10, (int)$config['timeout']),
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CUSTOMREQUEST => $method
        ];

        if ($payload !== null) {
            $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
            if ($body === false) {
                throw new Exception('Unable to encode request payload');
            }
            $curlOptions[CURLOPT_POSTFIELDS] = $body;
        }

        curl_setopt_array($ch, $curlOptions);

        $rawResponse = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($rawResponse === false) {
            throw new Exception('Unable to reach E-Way Bill provider: ' . $curlError);
        }

        $decoded = json_decode($rawResponse, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $decoded = ['raw' => $rawResponse];
        }

        $decoded = self::normaliseResponse($decoded);

        $providerSuccess = self::isProviderSuccess($decoded, $httpCode);

        return [
            'success' => $providerSuccess,
            'http_code' => $httpCode,
            'response' => $decoded,
            'raw_response' => $rawResponse,
            'request_url' => self::maskSensitiveUrl($url)
        ];
    }

    public static function isProviderSuccess($response, $httpCode) {
        if ($httpCode < 200 || $httpCode >= 300) {
            return false;
        }

        if (!is_array($response)) {
            return true;
        }

        if (isset($response['status_cd'])) {
            $statusCd = (string)$response['status_cd'];
            if ($statusCd === '0') {
                return false;
            }
            return true;
        }

        if (isset($response['status'])) {
            $status = (string)$response['status'];
            if ($status === '0') {
                return false;
            }
            return true;
        }

        if (isset($response['success'])) {
            return (bool)$response['success'];
        }

        return true;
    }

    public static function providerMessage($response) {
        $response = self::normaliseResponse($response);

        if (!is_array($response)) {
            return 'Provider request failed';
        }

        if (isset($response['error']) && is_array($response['error'])) {
            foreach (['message', 'msg', 'errorMessage'] as $field) {
                if (isset($response['error'][$field]) && $response['error'][$field] !== '') {
                    return (string)$response['error'][$field];
                }
            }
        }

        $messageFields = ['message', 'msg', 'error', 'errorMessage', 'statusDesc'];
        foreach ($messageFields as $field) {
            if (isset($response[$field]) && $response[$field] !== '') {
                if (is_array($response[$field])) {
                    continue;
                }
                return (string)$response[$field];
            }
        }

        return 'Provider request failed';
    }

    private static function normaliseResponse($response) {
        if (is_string($response)) {
            $decoded = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return self::normaliseResponse($decoded);
            }
            return $response;
        }

        if (!is_array($response)) {
            return $response;
        }

        if (isset($response['raw']) && is_string($response['raw'])) {
            $decodedRaw = json_decode($response['raw'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return self::normaliseResponse($decodedRaw);
            }
        }

        return $response;
    }

    private static function maskSensitiveUrl($url) {
        $parts = parse_url($url);
        if (!$parts || !isset($parts['query'])) {
            return $url;
        }

        parse_str($parts['query'], $query);
        foreach (['password', 'authtoken', 'ewbpwd', 'username'] as $sensitiveKey) {
            if (isset($query[$sensitiveKey])) {
                $query[$sensitiveKey] = '***';
            }
        }

        $maskedQuery = http_build_query($query);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $path = $parts['path'] ?? '';

        return $scheme . '://' . $host . $path . '?' . $maskedQuery;
    }

    private static function withAliasParams($queryParams) {
        return $queryParams;
    }
}
