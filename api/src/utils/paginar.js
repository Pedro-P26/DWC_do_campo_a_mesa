const erro = require('./erro');

// Sem parâmetros mantém o formato em lista usado pelos restantes clientes.
module.exports = async function paginar(consulta, parametros) {
  if (parametros.pagina === undefined && parametros.limite === undefined) return await consulta;
  const inteiro = (valor, padrao, maximo) => {
    if (valor === undefined) return padrao;
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) > maximo) {
      throw erro(400, 'Paginação inválida');
    }
    return Number(valor);
  };
  const pedida = inteiro(parametros.pagina, 1, Number.MAX_SAFE_INTEGER);
  const limite = inteiro(parametros.limite, 5, 50);
  const total = await consulta.model.countDocuments(consulta.getFilter());
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const pagina = Math.min(pedida, totalPaginas);
  const dados = await consulta.skip((pagina - 1) * limite).limit(limite);
  return { dados, total, pagina, limite, totalPaginas };
};
