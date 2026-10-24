// Utilizador: comprador (particular ou restaurante), produtor ou administrador
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  nome: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  papel: { type: String, enum: ['comprador', 'produtor', 'admin'], default: 'comprador' },

  // Dados específicos do produtor (página pública)
  produtor: {
    nomeExploracao: { type: String, trim: true, maxlength: 150 },
    descricao: { type: String, maxlength: 1000 },
    localidade: { type: String, trim: true, maxlength: 150 },
    localizacao: { lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } },
    validado: { type: Boolean, default: false }, // o administrador valida o registo
    rejeitado: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  toJSON: { transform: (doc, dados) => { delete dados.passwordHash; return dados; } }
});

userSchema.methods.publico = function publico() {
  return {
    _id: this._id, id: this._id, nome: this.nome, email: this.email, papel: this.papel,
    ...(this.papel === 'produtor' ? { produtor: this.produtor } : {})
  };
};
userSchema.index({ papel: 1, 'produtor.validado': 1 });

module.exports = model('User', userSchema);
