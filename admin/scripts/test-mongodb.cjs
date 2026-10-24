const { createRequire } = require('node:module');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');

// Reutiliza a infraestrutura de teste da API; nunca usa o .env da plataforma.
const apiRequire = createRequire(path.resolve(__dirname, '../../api/package.json'));
const { MongoMemoryServer } = apiRequire('mongodb-memory-server');
const bcrypt = apiRequire('bcryptjs');

(async () => {
    const downloadDir = path.resolve(__dirname, '../../api/node_modules/.cache/mongodb-memory-server');
    const binaryName = fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir).find(name => /^mongod-.*\.exe$/.test(name)) : undefined;
    const binary = { downloadDir, ...(binaryName ? { systemBinary: path.join(downloadDir, binaryName) } : {}) };
    const mongo = await MongoMemoryServer.create({ binary, instance: { ip: '127.0.0.1' } });
    try {
        const database = `dcm_admin_test_${randomBytes(8).toString('hex')}`;
        const child = spawn('php', ['artisan', 'test', ...process.argv.slice(2)], {
            cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
            env: { ...process.env, APP_ENV: 'testing', DB_CONNECTION: 'mongodb',
                MONGODB_URI: mongo.getUri(), MONGODB_DATABASE: database,
                ADMIN_MONGO_TESTS: '1', ADMIN_TEST_BCRYPT_HASH: await bcrypt.hash('password123', 4) }
        });
        process.exitCode = await new Promise((resolve, reject) => {
            child.once('error', reject);
            child.once('exit', code => resolve(code ?? 1));
        });
    } finally { await mongo.stop(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
