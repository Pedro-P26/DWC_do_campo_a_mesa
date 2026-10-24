<?php

return [
    'api_url' => rtrim(env('API_URL', 'http://127.0.0.1:3000'), '/'),
    'storage_health_url' => env('STORAGE_HEALTH_URL'),
];
