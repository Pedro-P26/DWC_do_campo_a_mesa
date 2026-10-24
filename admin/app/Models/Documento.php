<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

abstract class Documento extends Model
{
    protected $connection = 'mongodb';

    protected $guarded = ['*'];

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = 'updatedAt';
}
