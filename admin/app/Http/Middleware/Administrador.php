<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class Administrador
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless($request->user()?->papel === 'admin', 403, 'Acesso reservado a administradores.');

        return $next($request);
    }
}
