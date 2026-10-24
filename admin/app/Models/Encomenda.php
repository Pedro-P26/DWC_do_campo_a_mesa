<?php

namespace App\Models;

class Encomenda extends Documento
{
    protected $table = 'orders';

    protected function casts(): array
    {
        return ['createdAt' => 'datetime'];
    }

    public function compradorConta()
    {
        return $this->belongsTo(User::class, 'comprador');
    }

    public function produtorConta()
    {
        return $this->belongsTo(User::class, 'produtor');
    }

    public function getTotalAttribute(): float
    {
        return round(collect($this->linhas)->sum(fn ($linha) => $linha['precoUnit'] * $linha['quantidade']), 2);
    }
}
