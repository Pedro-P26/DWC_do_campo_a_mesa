<?php

use App\Http\Controllers\GestaoController;
use App\Http\Controllers\PainelController;
use App\Http\Controllers\ServicosController;
use App\Http\Controllers\SessaoController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [SessaoController::class, 'create'])->name('login');
    Route::post('/login', [SessaoController::class, 'store'])->middleware('throttle:login')->name('login.store');
});

Route::middleware(['auth', 'admin'])->name('admin.')->group(function () {
    Route::get('/', PainelController::class)->name('inicio');
    Route::post('/logout', [SessaoController::class, 'destroy'])->name('logout');
    Route::get('/painel/estado', [PainelController::class, 'estado'])->name('estado');
    Route::get('/produtores', [GestaoController::class, 'produtores'])->name('produtores');
    Route::patch('/produtores/{id}/validacao', [GestaoController::class, 'validarProdutor'])->where('id', '[a-fA-F0-9]{24}')->name('produtores.validar');
    Route::get('/moderacao', [GestaoController::class, 'moderacao'])->name('moderacao');
    Route::patch('/moderacao/{id}', [GestaoController::class, 'moderar'])->where('id', '[a-fA-F0-9]{24}')->name('moderacao.alterar');
    Route::get('/utilizadores', [GestaoController::class, 'utilizadores'])->name('utilizadores');
    Route::get('/encomendas', [GestaoController::class, 'encomendas'])->name('encomendas');
    Route::get('/leiloes', [GestaoController::class, 'leiloes'])->name('leiloes');
    Route::get('/servicos', [ServicosController::class, 'index'])->name('servicos');
    Route::get('/servicos/estado', [ServicosController::class, 'estado'])->middleware('throttle:20,1')->name('servicos.estado');
});
