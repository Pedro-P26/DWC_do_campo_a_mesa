// Ponto de entrada: servidor HTTP partilhado pela API REST e pelo Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { ligarBD } = require('./config/db');
const registarSockets = require('./sockets');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não está definida');
  await ligarBD();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' }
  });

  // Disponibiliza o io às rotas (ex.: notificar o comprador quando a encomenda muda)
  app.set('io', io);
  registarSockets(io);
  const pararValidacao = await require('./services/validacaoProdutores')(io);
  const pararCiclo = require('./services/cicloLeiloes')(io);
  server.on('close', pararCiclo);
  server.on('close', () => pararValidacao().catch(console.error));

  server.listen(PORT, () => {
    console.log(`API em http://localhost:${PORT}`);
    console.log(`Documentação em http://localhost:${PORT}/api-docs`);
  });
}

iniciar().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
