<?php

use App\Http\Controllers\PainelController;
use Illuminate\Support\Facades\Route;

// Apenas a página de apresentação da base; autenticação e dados serão integrados depois.
Route::get('/', PainelController::class)->name('admin.inicio');
