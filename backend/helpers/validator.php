<?php

class Validator {

    public static function validate($data, $rules) {
        $errors = [];

        foreach ($rules as $field => $ruleString) {
            $rulesArray = explode('|', $ruleString);

            foreach ($rulesArray as $rule) {
                $ruleParts = explode(':', $rule);
                $ruleName = $ruleParts[0];
                $ruleValue = $ruleParts[1] ?? null;

                $error = self::validateRule($field, $data[$field] ?? null, $ruleName, $ruleValue, $data);

                if ($error) {
                    if (!isset($errors[$field])) {
                        $errors[$field] = [];
                    }
                    $errors[$field][] = $error;
                }
            }
        }

        return $errors;
    }

    private static function validateRule($field, $value, $rule, $ruleValue = null, $allData = []) {
        switch ($rule) {
            case 'required':
                if (empty($value) && $value !== '0') {
                    return ucfirst($field) . ' is required';
                }
                break;

            case 'email':
                if (!empty($value) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    return ucfirst($field) . ' must be a valid email address';
                }
                break;

            case 'min':
                if (!empty($value) && strlen($value) < $ruleValue) {
                    return ucfirst($field) . " must be at least {$ruleValue} characters";
                }
                break;

            case 'max':
                if (!empty($value) && strlen($value) > $ruleValue) {
                    return ucfirst($field) . " must not exceed {$ruleValue} characters";
                }
                break;

            case 'numeric':
                if (!empty($value) && !is_numeric($value)) {
                    return ucfirst($field) . ' must be a number';
                }
                break;

            case 'integer':
                if (!empty($value) && !filter_var($value, FILTER_VALIDATE_INT)) {
                    return ucfirst($field) . ' must be an integer';
                }
                break;

            case 'phone':
                if (!empty($value) && !preg_match('/^[0-9]{10,15}$/', $value)) {
                    return ucfirst($field) . ' must be a valid phone number';
                }
                break;

            case 'alpha':
                if (!empty($value) && !preg_match('/^[a-zA-Z\s]+$/', $value)) {
                    return ucfirst($field) . ' must contain only letters';
                }
                break;

            case 'alphanumeric':
                if (!empty($value) && !preg_match('/^[a-zA-Z0-9\s]+$/', $value)) {
                    return ucfirst($field) . ' must contain only letters and numbers';
                }
                break;

            case 'confirmed':
                $confirmField = $field . '_confirmation';
                if (isset($allData[$confirmField]) && $value !== $allData[$confirmField]) {
                    return ucfirst($field) . ' confirmation does not match';
                }
                break;

            case 'unique':
                break;

            case 'exists':
                break;

            case 'date':
                if (!empty($value) && !strtotime($value)) {
                    return ucfirst($field) . ' must be a valid date';
                }
                break;

            case 'url':
                if (!empty($value) && !filter_var($value, FILTER_VALIDATE_URL)) {
                    return ucfirst($field) . ' must be a valid URL';
                }
                break;

            case 'in':
                if (!empty($value) && $ruleValue) {
                    $allowedValues = explode(',', $ruleValue);
                    if (!in_array($value, $allowedValues)) {
                        return ucfirst($field) . ' must be one of: ' . implode(', ', $allowedValues);
                    }
                }
                break;

            case 'regex':
                if (!empty($value) && $ruleValue && !preg_match($ruleValue, $value)) {
                    return ucfirst($field) . ' format is invalid';
                }
                break;
        }

        return null;
    }

    public static function sanitize($data) {
        if (is_array($data)) {
            return array_map([self::class, 'sanitize'], $data);
        }

        return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
    }

    public static function sanitizeInput($data, $fields = []) {
        $sanitized = [];

        if (empty($fields)) {
            $fields = array_keys($data);
        }

        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $sanitized[$field] = self::sanitize($data[$field]);
            }
        }

        return $sanitized;
    }
}
