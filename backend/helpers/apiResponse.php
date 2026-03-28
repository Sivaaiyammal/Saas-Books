<?php

class ApiResponse {

    public static function success($data = null, $message = 'Success', $code = 200) {
        while (ob_get_level() > 0) { ob_end_clean(); }
        http_response_code($code);
        header('Content-Type: application/json');

        $response = [
            'success' => true,
            'message' => $message
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        echo json_encode($response, JSON_PRETTY_PRINT);
        exit;
    }

    public static function error($message = 'An error occurred', $code = 400, $errors = null) {
        while (ob_get_level() > 0) { ob_end_clean(); }
        http_response_code($code);
        header('Content-Type: application/json');

        $response = [
            'success' => false,
            'message' => $message
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        echo json_encode($response, JSON_PRETTY_PRINT);
        exit;
    }

    public static function unauthorized($message = 'Unauthorized access') {
        self::error($message, 401);
    }

    public static function forbidden($message = 'Access forbidden') {
        self::error($message, 403);
    }

    public static function notFound($message = 'Resource not found') {
        self::error($message, 404);
    }

    public static function validationError($errors, $message = 'Validation failed') {
        self::error($message, 422, $errors);
    }

    public static function serverError($message = 'Internal server error') {
        self::error($message, 500);
    }

    public static function created($data = null, $message = 'Resource created successfully') {
        self::success($data, $message, 201);
    }

    public static function noContent() {
        http_response_code(204);
        exit;
    }
}
