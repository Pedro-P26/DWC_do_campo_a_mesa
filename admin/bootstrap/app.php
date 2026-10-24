<?php

use App\Http\Middleware\Administrador;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use MongoDB\Driver\Exception\Exception;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['admin' => Administrador::class]);
        $middleware->redirectUsersTo('/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Exception $exception, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Não foi possível contactar o MongoDB. Tente novamente.'], 503);
            }

            return response()->view('errors.mongo', [], 503);
        });
    })->create();
