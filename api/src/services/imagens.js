// Passo 8: guardar as imagens dos produtos no storage da Cloud (Azure Blob Storage).
// Em AWS: @aws-sdk/client-s3 · Em Google Cloud: @google-cloud/storage
const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const erro = require('../utils/erro');
const TIPOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

let container;
function obterContainer() {
  if (!container) {
    if (!process.env.STORAGE_CONN) throw new Error('STORAGE_CONN não está definida');
    container = BlobServiceClient
      .fromConnectionString(process.env.STORAGE_CONN)
      .getContainerClient(process.env.STORAGE_CONTAINER || 'produtos');
  }
  return container;
}

/**
 * @param {{ buffer: Buffer, originalname: string, mimetype: string }} ficheiro (multer)
 * @returns {Promise<string>} URL público da imagem
 */
async function guardarImagem(ficheiro, req) {
  const extensao = Object.hasOwn(TIPOS, ficheiro.mimetype) ? TIPOS[ficheiro.mimetype] : undefined;
  if (!extensao) throw erro(400, 'Formato de imagem não suportado (JPEG, PNG ou WebP)');
  const nome = `${crypto.randomUUID()}${extensao}`;
  if (!process.env.STORAGE_CONN) {
    const pasta = path.join(__dirname, '..', '..', 'uploads');
    await fs.mkdir(pasta, { recursive: true });
    await fs.writeFile(path.join(pasta, nome), ficheiro.buffer);
    return `${req.protocol}://${req.get('host')}/uploads/${nome}`;
  }
  const blob = obterContainer().getBlockBlobClient(nome);
  await blob.uploadData(ficheiro.buffer, {
    blobHTTPHeaders: { blobContentType: ficheiro.mimetype }
  });
  return blob.url;
}

module.exports = { guardarImagem };
