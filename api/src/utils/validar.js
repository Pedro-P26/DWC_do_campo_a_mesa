const { isObjectIdOrHexString } = require('mongoose');
const erro = require('./erro');

function id(valor) {
  if (typeof valor !== 'string' || !isObjectIdOrHexString(valor)) throw erro(400, 'Identificador inválido');
  return valor;
}
function objeto(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw erro(400, 'Dados inválidos');
  return valor;
}
function texto(valor) {
  if (typeof valor !== 'string') throw erro(400, 'Parâmetro inválido');
  return valor;
}
const escaparRegex = (valor) => texto(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escolher = (obj, campos) => Object.fromEntries(campos.filter(c => obj[c] !== undefined).map(c => [c, obj[c]]));
module.exports = { id, objeto, texto, escaparRegex, escolher };
