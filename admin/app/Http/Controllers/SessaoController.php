<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class SessaoController extends Controller
{
    public function create()
    {
        return view('auth.login');
    }

    public function store(Request $request)
    {
        $dados = $request->validate(['email' => 'required|email|max:254', 'password' => 'required|string|max:72']);
        $utilizador = User::where('email', mb_strtolower(trim($dados['email'])))->first();
        // password_verify aceita os hashes bcrypt $2a$/$2b$ criados pelo bcryptjs da API.
        $valido = password_verify($dados['password'], $utilizador?->passwordHash ?? '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
        if (! $valido || $utilizador?->papel !== 'admin') {
            throw ValidationException::withMessages(['email' => 'Credenciais inválidas ou conta sem acesso à administração.']);
        }

        Auth::login($utilizador);
        $request->session()->regenerate();

        return redirect()->intended(route('admin.inicio'));
    }

    public function destroy(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
