const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const navegador of ['chromium', 'firefox', 'webkit']) {
  console.log(`\nSuite E2E completa: ${navegador}`);
  const resultado = spawnSync(process.execPath, [path.join(__dirname, 'frontend.js'), '--headless', `--browser=${navegador}`], {
    cwd: path.resolve(__dirname, '../..'), stdio: 'inherit', windowsHide: true
  });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.error || resultado.status !== 0) { process.exitCode = resultado.status || 1; break; }
}
