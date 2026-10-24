<?php

namespace App\Models;

class Leilao extends Documento
{
    protected $table = 'auctions';

    protected function casts(): array
    {
        return ['iniciaEm' => 'datetime', 'terminaEm' => 'datetime'];
    }

    public function produtorConta()
    {
        return $this->belongsTo(User::class, 'produtor');
    }
}
