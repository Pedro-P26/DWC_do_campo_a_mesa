const { ciclo } = require('./tempoReal');
module.exports = (io, intervalo = 2000) => {
  let ocupado = false;
  const executar = async () => {
    if (ocupado) return;
    ocupado = true;
    try { await ciclo(io); } catch (err) { console.error('Falha no ciclo dos leilões:', err); }
    finally { ocupado = false; }
  };
  const timer = setInterval(executar, intervalo);
  executar();
  return () => clearInterval(timer);
};
