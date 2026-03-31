<?php
$data = [
    'name' => 'Test Item T-001i',
    'item_code' => 'T-001i',
    'item_group_id' => null,
    'unit_id' => null,
    'tax_id' => null,
    'opening_stock' => 0,
    'opening_rate' => 0,
    'opening_value' => 0,
    'standard_cost' => 0,
    'standard_price' => 0,
    'is_service' => 0,
    'track_inventory' => 1
];

$ch = curl_init('http://localhost/api/v1/masters/item.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
$response = curl_exec($ch);
echo "Response: " . $response . "\n";
