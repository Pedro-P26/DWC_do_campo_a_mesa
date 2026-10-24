<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Auth\User as Authenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory;

    protected $connection = 'mongodb';

    protected $table = 'users';

    protected $guarded = ['*'];

    protected $hidden = ['passwordHash', 'remember_token'];

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = 'updatedAt';

    public function getAuthPasswordName(): string
    {
        return 'passwordHash';
    }

    public function getRememberTokenName(): string
    {
        return '';
    }

    protected function casts(): array
    {
        return [
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function scopePendentes($query)
    {
        return $query->where('papel', 'produtor')->where('produtor.validado', false)
            ->where('produtor.rejeitado', '!=', true);
    }

    public function getEstadoProdutorAttribute(): string
    {
        if (data_get($this->produtor, 'validado')) {
            return 'Aprovado';
        }

        return data_get($this->produtor, 'rejeitado') ? 'Rejeitado' : 'Pendente';
    }
}
