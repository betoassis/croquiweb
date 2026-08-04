const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { formatCPF } = require('../middleware/cpfValidator');
const { authenticateAdmin } = require('../middleware/auth');

// Todas as rotas de gerenciamento de usuários exigem privilégios de Admin
router.use(authenticateAdmin);

// GET /api/users - Listar usuários com opção de filtro por status
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const users = await db.getAllUsersAsync(status || null);

    const formatted = users.map(u => ({
      ...u,
      cpfFormatted: formatCPF(u.cpf)
    }));

    return res.json(formatted);
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar lista de usuários.' });
  }
});

// PATCH /api/users/:id/status - Aprovar ou Rejeitar solicitação de acesso
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido. Use "approved", "pending" ou "rejected".' });
    }

    const updated = await db.updateUserStatusAsync(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const message = status === 'approved' 
      ? 'Usuário aprovado com sucesso!' 
      : status === 'rejected' 
      ? 'Solicitação de acesso rejeitada.' 
      : 'Status atualizado com sucesso.';

    return res.json({ message, user: updated });
  } catch (err) {
    console.error('Erro ao atualizar status do usuário:', err);
    return res.status(500).json({ error: 'Erro interno ao alterar status do usuário.' });
  }
});

// PATCH /api/users/:id/role - Alterar função (role) do usuário (admin/public)
router.patch('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'public'].includes(role)) {
      return res.status(400).json({ error: 'Função inválida. Use "admin" ou "public".' });
    }

    const updated = await db.updateUserRoleAsync(req.params.id, role);
    if (!updated) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const message = role === 'admin' 
      ? 'Usuário promovido a Administrador com sucesso!' 
      : 'Função do usuário alterada para Público.';

    return res.json({ message, user: updated });
  } catch (err) {
    console.error('Erro ao atualizar função do usuário:', err);
    return res.status(500).json({ error: 'Erro interno ao alterar função do usuário.' });
  }
});

// DELETE /api/users/:id - Excluir solicitação ou conta de usuário
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await db.deleteUserAsync(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ message: 'Usuário excluído com sucesso!', user: deleted });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    return res.status(500).json({ error: 'Erro interno ao remover usuário.' });
  }
});

module.exports = router;
