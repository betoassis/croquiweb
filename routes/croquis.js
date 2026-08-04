const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
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
      if (req.file) removeFile(req.file.path);
      return res.status(400).json({ error: 'Bairro, Região e Quarteirão são campos obrigatórios.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'É necessário anexar um arquivo PDF para o croqui.' });
    }

    let filePath = req.file.path.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/');

    // Se o Supabase estiver configurado, envia também o arquivo para o Supabase Storage na nuvem
    if (isSupabaseConfigured()) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const storagePath = `croquis/${Date.now()}-${req.file.originalname}`;
        const uploaded = await uploadPdfToStorage(storagePath, fileBuffer, req.file.mimetype);
        if (uploaded && uploaded.publicUrl) {
          filePath = uploaded.publicUrl;
        }
      } catch (storageErr) {
        console.warn('⚠️ Não foi possível salvar no Supabase Storage. Mantendo caminho local:', storageErr.message);
      }
    }

    const newCroqui = await db.createCroquiAsync({
      bairro,
      sisloc: sisloc || '',
      regiao,
      quarteirao,
      observacoes: observacoes || '',
      filename: req.file.originalname,
      filepath: filePath,
      file_size: req.file.size
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
      if (req.file) removeFile(req.file.path);
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Selecione um novo arquivo PDF para substituição.' });
    }

    // Remover arquivo local antigo se existir
    if (!existing.filepath.startsWith('http')) {
      removeFile(existing.filepath);
    }

    let filePath = req.file.path.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/');

    if (isSupabaseConfigured()) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const storagePath = `croquis/${Date.now()}-${req.file.originalname}`;
        const uploaded = await uploadPdfToStorage(storagePath, fileBuffer, req.file.mimetype);
        if (uploaded && uploaded.publicUrl) {
          filePath = uploaded.publicUrl;
        }
      } catch (storageErr) {
        console.warn('⚠️ Não foi possível atualizar no Supabase Storage. Mantendo caminho local:', storageErr.message);
      }
    }

    const updated = await db.updateCroquiAsync(req.params.id, {
      filename: req.file.originalname,
      filepath: filePath,
      file_size: req.file.size
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

    // Remove file from disk or storage
    if (!existing.filepath.startsWith('http')) {
      removeFile(existing.filepath);
    }

    // Delete from DB
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
    if (!croqui) {
      return res.status(404).json({ error: 'Croqui não encontrado.' });
    }

    await db.incrementDownloadAsync(req.params.id);

    if (croqui.filepath.startsWith('http')) {
      // Redireciona para o Supabase Storage público se o PDF estiver na nuvem
      return res.redirect(croqui.filepath);
    }

    const fullPath = path.join(__dirname, '..', croqui.filepath);
    if (fs.existsSync(fullPath)) {
      return res.download(fullPath, croqui.filename);
    } else {
      return res.status(404).json({ error: 'Arquivo PDF físico não encontrado no servidor.' });
    }
  } catch (err) {
    console.error('Erro ao processar download:', err);
    return res.status(500).json({ error: 'Erro interno ao processar download.' });
  }
});

module.exports = router;
