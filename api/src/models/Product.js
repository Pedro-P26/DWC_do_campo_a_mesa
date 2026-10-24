const { Schema, model, Types } = require('mongoose');

const productSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 150 },
  descricao: { type: String, maxlength: 1000 },
  ingredientes: [{ type: String, trim: true, maxlength: 100 }],
  categoria: {
    type: String,
    enum: ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'],
    required: true
  },
  preco: { type: Number, required: true, min: 0 },
  unidade: { type: String, default: 'kg' }, // kg, unid., garrafa, 500 g…
  stock: { type: Number, default: 0, min: 0 },
  biologico: { type: Boolean, default: false },
  epocas: [{ type: String, enum: ['Primavera', 'Verão', 'Outono', 'Inverno'] }],
  imagemUrl: String // Passo 8: URL da imagem no storage da Cloud
}, { timestamps: true });

// Índices para os filtros e a página pública do produtor.
productSchema.index({ produtor: 1 });
productSchema.index({ categoria: 1, preco: 1 });
productSchema.index({ epocas: 1 });

module.exports = model('Product', productSchema);
