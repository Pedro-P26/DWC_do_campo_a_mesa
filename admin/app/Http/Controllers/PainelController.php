<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

class PainelController extends Controller
{
    public function __invoke(): View
    {
        return view('admin.inicio');
    }
}
