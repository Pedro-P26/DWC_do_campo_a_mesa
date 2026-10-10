// Cliente HTTP da API: junta o URL base e o token JWT a cada pedido
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const USAR_DADOS_SIMULADOS = import.meta.env.VITE_USAR_DADOS_SIMULADOS === 'true';

export class ErroApi extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
    this.status = codigo;
  }
}

async function tratar(resposta, token) {
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 401 && token) window.dispatchEvent(new CustomEvent('sessao-invalida', { detail: token }));
    throw new ErroApi(dados?.erro || `Erro ${resposta.status}`, resposta.status);
  }
  return dados;
}

export async function api(caminho, { metodo = 'GET', corpo, token, signal } = {}) {
  const resposta = await fetch(`${API_URL}/api${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal
  });
  return tratar(resposta, token);
}

export async function enviarFicheiro(caminho, campo, ficheiro, token) {
  const dados = new FormData();
  dados.append(campo, ficheiro);
  const resposta = await fetch(`${API_URL}/api${caminho}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: dados
  });
  return tratar(resposta, token);
}
