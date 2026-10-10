const User = require('../models/User');
const a = require('../utils/async');
const erro = require('../utils/erro');

module.exports = a(async (req, res, next) => {
  const produtor = await User.exists({ _id: req.user.id, papel: 'produtor', 'produtor.validado': true });
  if (!produtor) throw erro(403, 'O produtor ainda não foi validado');
  next();
});
