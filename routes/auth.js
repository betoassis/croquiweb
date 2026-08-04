const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { isValidCPF, formatCPF } = require('../middleware/cpfValidator');
const { JWT_SECRET, authenticateAdmin } = require('../middleware/auth');

// POST /api/auth/register - Cadastro de Usuário Público (Status: Pending)
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, cpf, birthYear } = req.body;

    if (!name || !username || !password || !cpf || !birthYear) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios (Nome, Usuário, Senha, CPF e Ano de Nascimento).' });
    }

    // 1. Validação Matemática Oficial do CPF (Módulo 11)
    if (!isValidCPF(cpf)) {
      return res.status(400).json({ error: 'O CPF informado é inválido. Por favor, verifique os dígitos digitados.' });
    }

    // 2. Validação do Ano de Nascimento
    const currentYear = new Date().getFullYear();
    const parsedYear = parseInt(birthYear, 10);
    if (isNaN(parsedYear) || parsedYear < 1920 || parsedYear > currentYear - 14) {
      return res.status(400).json({ error: `Ano de nascimento inválido. Insira um ano válido entre 1920 e ${currentYear - 14}.` });
    }

    // 3. Verificar duplicidade de Usuário
    const existingUser = await db.getUserByUsernameAsync(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso. Escolha outro.' });
    }

    // 4. Verificar duplicidade de CPF
    const existingCPF = await db.getUserByCpfAsync(cpf);
    if (existingCPF) {
      return res.status(400).json({ error: 'Este CPF já foi cadastrado no sistema.' });
    }

    // 5. Criar Conta com Status PENDENTE
    const newUser = await db.createUserAsync({
      name,
      username,
      password,
      cpf,
      birthYear: parsedYear,
      role: 'public',
      status: 'pending'
    });

    return res.status(201).json({
      message: 'Solicitação de cadastro realizada com sucesso! Sua conta aguarda aprovação de um administrador.',
      user: {
        username: newUser.username,
        name: newUser.name,
        cpf: formatCPF(newUser.cpf),
        status: newUser.status
      }
    });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const user = await db.getUserByUsernameAsync(username);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o usuário e a senha.' });
    }

    const isValidPassword = await db.verifyAdminPasswordAsync(username, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o usuário e a senha.' });
    }

    // Trava de Segurança por Status da Conta
    const userStatus = user.status || 'approved';
    if (userStatus === 'pending') {
      return res.status(403).json({
        error: 'Sua conta foi criada e está AGUARDANDO APROVAÇÃO do administrador. Tente novamente mais tarde.'
      });
    }

    if (userStatus === 'rejected') {
      return res.status(403).json({
        error: 'Sua solicitação de acesso foi recusada pelo administrador.'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role || 'public',
        status: userStatus
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role || 'public',
        status: userStatus
      }
    });
  } catch (err) {
    console.error('Erro na autenticação:', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar usuário.' });
  }
});

// GET /api/auth/verify
router.get('/verify', authenticateAdmin, (req, res) => {
  return res.json({
    valid: true,
    user: req.admin
  });
});

// POST /api/auth/reset-password - Redefinição de senha por validação de CPF e Ano de Nascimento
router.post('/reset-password', async (req, res) => {
  try {
    const { username, cpf, birthYear, newPassword } = req.body;

    if (!username || !cpf || !birthYear || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos (usuário, CPF, ano de nascimento e nova senha) são obrigatórios.' });
    }

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
    }

    // 1. Validação Matemática Oficial do CPF
    if (!isValidCPF(cpf)) {
      return res.status(400).json({ error: 'O CPF informado é inválido. Verifique os dígitos.' });
    }

    // 2. Buscar usuário no banco
    const user = await db.getUserByUsernameAsync(username.trim());
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado. Verifique o nome de usuário digitado.' });
    }

    // 3. Verificar se o CPF e Ano de Nascimento conferem com o cadastro do usuário
    const cleanInputCPF = cleanCPFString(cpf);
    const cleanUserCPF = cleanCPFString(user.cpf || '');
    const parsedBirthYear = parseInt(birthYear, 10);
    const userBirthYear = parseInt(user.birthYear || user.birth_year, 10);

    if (cleanInputCPF !== cleanUserCPF || parsedBirthYear !== userBirthYear) {
      return res.status(400).json({
        error: 'Dados de verificação incorretos. O CPF ou ano de nascimento não conferem com o cadastro deste usuário.'
      });
    }

    // 4. Atualizar a senha no banco de dados
    const updated = await db.updateUserPasswordAsync(user.id, newPassword);
    if (!updated) {
      return res.status(500).json({ error: 'Erro ao atualizar a senha no banco de dados.' });
    }

    return res.json({
      message: 'Sua senha foi redefinida com sucesso! Você já pode efetuar o login com a nova senha.'
    });
  } catch (err) {
    console.error('Erro na redefinição de senha:', err);
    return res.status(500).json({ error: 'Erro interno ao redefinir a senha.' });
  }
});

module.exports = router;
