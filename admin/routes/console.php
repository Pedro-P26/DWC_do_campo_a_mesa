<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use MongoDB\Driver\Exception\Exception;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('mongodb:verificar', function () {
    try {
        DB::connection('mongodb')->getMongoDB()->command(['ping' => 1]);
        $this->info('MongoDB acessível. Base de dados: '.config('database.connections.mongodb.database'));

        return 0;
    } catch (Exception) {
        $this->error('Não foi possível contactar o MongoDB. Verifique MONGODB_URI, MONGODB_DATABASE e as permissões de rede.');

        return 1;
    }
})->purpose('Verificar a ligação ao MongoDB sem alterar dados');
