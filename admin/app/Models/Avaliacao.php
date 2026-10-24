<?php

namespace App\Models;

class Avaliacao extends Documento
{
    protected $table = 'reviews';

    protected function casts(): array
    {
        return ['createdAt' => 'datetime', 'visivel' => 'boolean', 'denuncias' => 'integer'];
    }

    public function autorConta()
    {
        return $this->belongsTo(User::class, 'autor');
    }

    public function produtorConta()
    {
        return $this->belongsTo(User::class, 'produtor');
    }
}
