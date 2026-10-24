@extends('layouts.admin')
@section('title', 'Estado dos serviços')
@section('content')
    <section class="cartao"><h2>Disponibilidade</h2><p>Estado observado na última verificação. O armazenamento precisa de um endereço de verificação configurado.</p>@include('partials.servicos')</section>
@endsection
