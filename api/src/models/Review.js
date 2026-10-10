// Coleção independente: consulta por produtor/produto e moderação pelo administrador.
const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  encomenda: { type: Types.ObjectId, ref: 'Order', required: true },
  classificacao: { type: Number, min: 1, max: 5, required: true, validate: Number.isInteger },
  comentario: { type: String, maxlength: 1000 },
  denuncias: { type: Number, default: 0, min: 0 },
  visivel: { type: Boolean, default: true }
}, { timestamps: true });

// Uma avaliação de cada produto (ou do produtor) por encomenda e autor.
reviewSchema.index({ encomenda: 1, autor: 1, produto: 1 }, {
  unique: true, partialFilterExpression: { encomenda: { $type: 'objectId' } }
});
reviewSchema.index({ produtor: 1, visivel: 1 });
reviewSchema.index({ produto: 1, visivel: 1 });
module.exports = model('Review', reviewSchema);
