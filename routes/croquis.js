const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const db = require('../database/db');
const { isSupabaseConfigured, uploadPdfToStorage, deletePdfFromStorage } = require('../database/supabaseClient');
const { authenticateAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Helper to remove physical local file safely
function removeFile(relativePath) {
  if (!relativePath) return;
  const fullPath = path.join(__dirname, '..', relativePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.error('Erro ao deletar arquivo local:', fullPath, err);
    }
  }
}

// Helper para obter buffer de PDF remoto (Supabase Storage)
async function fetchRemoteBuffer(url) {
  if (typeof fetch === 'function') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchRemoteBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP Status ${res.statusCode}`));
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// GET /api/croquis - Public search & filter
router.get('/', async (req, res) => {
  try {
    const { search, bairro, regiao, quarteirao, sisloc } = req.query;
    const list = await db.getAllCroquisAsync({ search, bairro, regiao, quarteirao, sisloc });
    return res.json(list);
  } catch (err) {
    console.error('Erro ao buscar croquis:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar croquis.' });
  }
});

// GET /api/croquis/:id/file - Serve PDF file stream for viewer (Public)
router.get('/:id/file', async (req, res) => {
  try {
    const croqui = await db.getCroquiByIdAsync(req.params.id);
    if (!croqui || !croqui.filepath) {
      return res.status(404).json({ error: 'Croqui ou arquivo não encontrado.' });
    }

    if (croqui.filepath.startsWith('http')) {
      try {
        const buffer = await fetchRemoteBuffer(croqui.filepath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(croqui.filename || 'croqui.pdf')}"`);
        return res.send(buffer);
      } catch (cloudErr) {
        console.error('Erro ao obter PDF remoto do Supabase para visualização:', cloudErr.message);
        return res.redirect(croqui.filepath);
      }
    }

    const fullPath = path.join(__dirname, '..', croqui.filepath);
    if (fs.existsSync(fullPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(croqui.filename || 'croqui.pdf')}"`);
      return res.sendFile(fullPath);
    } else {
      return res.status(404).json({ error: 'Arquivo PDF físico não encontrado no servidor.' });
    }
  } catch (err) {
    console.error('Erro ao carregar arquivo do croqui:', err);
    return res.status(500).json({ error: 'Erro interno ao carregar arquivo.' });
  }
});

// GET /api/croquis/:id - Get single croqui details
router.get('/:id', async (req, res) => {
  try {
    const croqui = await db.getCroquiByIdAsync(req.params.id);
    if (!croqui) {
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }
    return res.json(croqui);
  } catch (err) {
    console.error('Erro ao obter croqui:', err);
    return res.status(500).json({ error: 'Erro ao buscar detalhes do croqui.' });
  }
});

// POST /api/croquis - Upload new Croqui (Admin protected)
router.post('/', authenticateAdmin, upload.single('pdf'), async (req, res) => {
  try {
    const { bairro, sisloc, regiao, quarteirao, observacoes } = req.body;

    if (!bairro || !regiao || !quarteirao) {
      return res.status(400).json({ error: 'Bairro, Região e Quarteirão são campos obrigatórios.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'É necessário anexar um arquivo PDF para o croqui.' });
    }

    const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    let filePath = '';

    if (isSupabaseConfigured() && fileBuffer) {
      try {
        const cleanFileName = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const storagePath = `croquis/${Date.now()}-${cleanFileName}`;
        const uploaded = await uploadPdfToStorage(storagePath, fileBuffer, req.file.mimetype || 'application/pdf');
        if (uploaded && uploaded.publicUrl) {
          filePath = uploaded.publicUrl;
        }
      } catch (storageErr) {
        console.warn('⚠️ Falha ao salvar no Supabase Storage:', storageErr.message);
      }
    }

    if (!filePath) {
      try {
        const bairroFolder = (bairro || 'geral').toLowerCase().replace(/\s+/g, '-');
        const regiaoFolder = (regiao || 'geral').toLowerCase().replace(/\s+/g, '-');
        const localDir = path.join(__dirname, '..', 'uploads', bairroFolder, regiaoFolder);
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        const localFileName = `${Date.now()}-${fileName}`;
        const fullLocalPath = path.join(localDir, localFileName);
        if (fileBuffer) fs.writeFileSync(fullLocalPath, fileBuffer);
        filePath = `/uploads/${bairroFolder}/${regiaoFolder}/${localFileName}`;
      } catch (localErr) {
        console.warn('⚠️ Aviso ao gravar arquivo localmente:', localErr.message);
      }
    }

    const newCroqui = await db.createCroquiAsync({
      bairro,
      sisloc: sisloc || '',
      regiao,
      quarteirao,
      observacoes: observacoes || '',
      filename: fileName,
      filepath: filePath,
      file_size: fileSize
    });

    return res.status(201).json({
      message: 'Croqui cadastrado com sucesso!',
      croqui: newCroqui
    });
  } catch (err) {
    console.error('Erro ao cadastrar croqui:', err);
    return res.status(500).json({ error: 'Erro interno ao salvar croqui.' });
  }
});

// PUT /api/croquis/:id - Update Croqui Metadata (Admin protected)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { bairro, sisloc, regiao, quarteirao, observacoes } = req.body;
    const existing = await db.getCroquiByIdAsync(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }

    const updated = await db.updateCroquiAsync(req.params.id, {
      bairro,
      sisloc,
      regiao,
      quarteirao,
      observacoes
    });

    return res.json({
      message: 'Croqui atualizado com sucesso!',
      croqui: updated
    });
  } catch (err) {
    console.error('Erro ao atualizar croqui:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar dados do croqui.' });
  }
});

// POST /api/croquis/:id/replace - Replace PDF file (Admin protected)
router.post('/:id/replace', authenticateAdmin, upload.single('pdf'), async (req, res) => {
  try {
    const existing = await db.getCroquiByIdAsync(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Selecione um novo arquivo PDF para substituição.' });
    }

    const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    let filePath = '';

    if (isSupabaseConfigured() && fileBuffer) {
      try {
        const cleanFileName = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const storagePath = `croquis/${Date.now()}-${cleanFileName}`;
        const uploaded = await uploadPdfToStorage(storagePath, fileBuffer, req.file.mimetype || 'application/pdf');
        if (uploaded && uploaded.publicUrl) {
          filePath = uploaded.publicUrl;
        }
      } catch (storageErr) {
        console.warn('⚠️ Não foi possível atualizar no Supabase Storage:', storageErr.message);
      }
    }

    if (!filePath) {
      filePath = existing.filepath;
    }

    const updated = await db.updateCroquiAsync(req.params.id, {
      filename: fileName,
      filepath: filePath,
      file_size: fileSize
    });

    return res.json({
      message: 'Arquivo PDF substituído com sucesso!',
      croqui: updated
    });
  } catch (err) {
    console.error('Erro ao substituir PDF:', err);
    return res.status(500).json({ error: 'Erro interno ao substituir o arquivo PDF.' });
  }
});

// DELETE /api/croquis/:id - Delete Croqui (Admin protected)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const existing = await db.getCroquiByIdAsync(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }

    if (existing.filepath && existing.filepath.startsWith('http')) {
      try {
        const urlParts = existing.filepath.split('/croquis-pdfs/');
        if (urlParts.length > 1) {
          const storagePath = urlParts[1];
          await deletePdfFromStorage(storagePath);
        }
      } catch (storageErr) {
        console.warn('⚠️ Alerta ao remover do Supabase Storage:', storageErr.message);
      }
    } else if (existing.filepath) {
      removeFile(existing.filepath);
    }

    const deleted = await db.deleteCroquiAsync(req.params.id);

    return res.json({
      message: 'Croqui excluído com sucesso!',
      croqui: deleted
    });
  } catch (err) {
    console.error('Erro ao excluir croqui:', err);
    return res.status(500).json({ error: 'Erro interno ao excluir croqui.' });
  }
});

// POST /api/croquis/:id/view - Increment View Counter (Public)
router.post('/:id/view', async (req, res) => {
  try {
    const views = await db.incrementViewAsync(req.params.id);
    return res.json({ views });
  } catch (err) {
    console.error('Erro ao incrementar visualizações:', err);
    return res.status(500).json({ error: 'Erro ao registrar visualização.' });
  }
});

// POST /api/croquis/:id/download - Increment Download Counter & Return File (Public)
router.post('/:id/download', async (req, res) => {
  try {
    const croqui = await db.getCroquiByIdAsync(req.params.id);
    if (!croqui || !croqui.filepath) {
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }

    await db.incrementDownloadAsync(req.params.id);

    if (croqui.filepath.startsWith('http')) {
      try {
        const buffer = await fetchRemoteBuffer(croqui.filepath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(croqui.filename || 'croqui.pdf')}"`);
        return res.send(buffer);
      } catch (cloudErr) {
        console.error('Erro ao obter PDF remoto para download:', cloudErr.message);
        return res.status(404).json({ error: 'Arquivo PDF não encontrado na nuvem.' });
      }
    }

    const fullPath = path.join(__dirname, '..', croqui.filepath);
    if (fs.existsSync(fullPath)) {
      return res.download(fullPath, croqui.filename || 'croqui.pdf');
    } else {
      return res.status(404).json({ error: 'Arquivo PDF físico não encontrado no servidor.' });
    }
  } catch (err) {
    console.error('Erro ao processar download:', err);
    return res.status(500).json({ error: 'Erro interno ao processar download.' });
  }
});

module.exports = router;
