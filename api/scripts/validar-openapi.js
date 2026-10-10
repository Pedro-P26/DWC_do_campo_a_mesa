const path = require('node:path');
const SwaggerParser = require('@apidevtools/swagger-parser');

SwaggerParser.validate(path.join(__dirname, '..', 'openapi.yaml')).then(doc => {
  const metodos = ['get', 'post', 'put', 'patch', 'delete'];
  const operacoes = Object.values(doc.paths).reduce((s, rota) => s + metodos.filter(m => rota[m]).length, 0);
  console.log(`OpenAPI ${doc.openapi} válido: ${Object.keys(doc.paths).length} caminhos e ${operacoes} operações.`);
}).catch(err => { console.error(err.message); process.exitCode = 1; });
