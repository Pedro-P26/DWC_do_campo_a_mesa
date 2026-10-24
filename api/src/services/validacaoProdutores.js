const mongoose = require('mongoose');

module.exports = async function observarValidacao(io) {
  const stream = mongoose.connection.collection('users').watch([
    { $match: { operationType: { $in: ['update', 'replace'] }, 'fullDocument.papel': 'produtor', 'fullDocument.produtor.validado': true } }
  ], { fullDocument: 'updateLookup', maxAwaitTimeMS: 500 });
  let parado = false;
  function notificar(change) {
    if (!change) return;
    const campos = change.updateDescription?.updatedFields;
    if (change.operationType === 'replace' || campos?.['produtor.validado'] === true || campos?.produtor?.validado === true) {
      const id = String(change.documentKey._id);
      io.to(`user:${id}`).emit('conta-validada', { id });
    }
  }
  
  try { notificar(await stream.tryNext()); }
  catch (err) { await stream.close(); throw err; }
  const consumo = (async () => {
    try {
      while (!parado) notificar(await stream.tryNext());
    } catch (err) {
      if (!parado) console.error('Falha ao observar aprovações de produtores:', err.message);
    }
  })();
  return async () => { parado = true; await stream.close(); await consumo; };
};
