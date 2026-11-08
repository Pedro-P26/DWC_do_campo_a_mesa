// Cada suite cria e encerra os seus serviços e a sua base descartável.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suites = [
  ['SPA, API e Socket.io', 'frontend.js', '--headless'],
  ['Carrinho em desktop', 'carrinho-desktop.js', '--headless'],
  ['Backoffice Laravel', 'admin.cjs']
];

for (const [nome, ficheiro, ...args] of suites) {
  console.log(`\nE2E: ${nome}`);
  const resultado = spawnSync(process.execPath, [path.join(__dirname, ficheiro), ...args], {
    cwd: path.resolve(__dirname, '../..'), stdio: 'inherit', windowsHide: true
  });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.error || resultado.status !== 0) {
    process.exitCode = resultado.status || 1;
    break;
  }
}
