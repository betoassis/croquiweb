const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { supabase, isSupabaseConfigured } = require('./supabaseClient');

const DB_FILE = path.join(__dirname, 'croquiweb.json');

// Initial local schema structure for local fallback
const initialData = {
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
    name: 'Administrador ACE',
    role: 'admin',
    status: 'approved'
  },
  users: [
    {
      id: 'usr-admin-default',
      username: process.env.ADMIN_USERNAME || 'admin',
      passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
      name: 'Administrador ACE',
      cpf: '',
      birth_year: null,
      role: 'admin',
      status: 'approved',
      created_at: new Date().toISOString()
    }
  ],
  croquis: [
    {
      id: 'croqui-demo-1',
      bairro: 'Centro',
      sisloc: '001',
      regiao: 'Região Central',
      quarteirao: '15 Quarteirões',
      observacoes: 'Croqui geral do Bairro Centro composto por 15 quarteirões comerciais e residenciais.',
      filename: 'croqui_centro_q01.pdf',
      filepath: '/uploads/centro/regiao-central/demo-croqui-centro-q01.pdf',
      file_size: 245760,
      views: 14,
      downloads: 6,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'croqui-demo-2',
      bairro: 'São José',
      sisloc: '045',
      regiao: 'Região Norte',
      quarteirao: '22 Quarteirões',
      observacoes: 'Bairro residencial São José com 22 quarteirões e presença de terrenos baldios.',
      filename: 'croqui_sao_jose_q14.pdf',
      filepath: '/uploads/sao-jose/regiao-norte/demo-croqui-sao-jose-q14.pdf',
      file_size: 312000,
      views: 29,
      downloads: 12,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'croqui-demo-3',
      bairro: 'Jardim América',
      sisloc: '102',
      regiao: 'Região Sul',
      quarteirao: '10 Quarteirões',
      observacoes: 'Croqui do Jardim América contendo 10 quarteirões de médio porte. Foco em inspeção de caixas d\'água.',
      filename: 'croqui_jardim_america_q08.pdf',
      filepath: '/uploads/jardim-america/regiao-sul/demo-croqui-jardim-america-q08.pdf',
      file_size: 189440,
      views: 8,
      downloads: 3,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ],
  history: []
};

// Ensure local database file exists when offline
function initDb() {
  if (isSupabaseConfigured()) return;
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    saveDb(initialData);
  }
}

function getDb() {
  try {
    initDb();
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.users) data.users = initialData.users;
    return data;
  } catch (err) {
    console.error('Erro ao ler banco de dados local:', err);
    return initialData;
  }
}

function saveDb(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar banco de dados local:', err);
  }
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanCPFString(cpfStr) {
  return String(cpfStr || '').replace(/\D/g, '');
}

const db = {
  isSupabase: isSupabaseConfigured,

  // User Management Methods (Async + Local Fallback)
  async getUserByUsernameAsync(username) {
    if (!username) return null;
    const cleanUser = username.trim().toLowerCase();

    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .ilike('username', cleanUser)
        .limit(1)
        .single();

      if (data) {
        return {
          id: data.id,
          username: data.username,
          passwordHash: data.password_hash,
          name: data.name,
          cpf: data.cpf || '',
          birthYear: data.birth_year,
          role: data.role || 'public',
          status: data.status || 'pending',
          createdAt: data.created_at
        };
      }
      return null;
    }

    const data = getDb();
    const user = (data.users || []).find(u => u.username.toLowerCase() === cleanUser);
    if (user) return user;
    if (data.admin && data.admin.username.toLowerCase() === cleanUser) {
      return {
        id: 'admin-id',
        username: data.admin.username,
        passwordHash: data.admin.passwordHash,
        name: data.admin.name,
        role: 'admin',
        status: 'approved'
      };
    }
    return null;
  },

  async getUserByCpfAsync(cpf) {
    if (!cpf) return null;
    const cleanCPF = cleanCPFString(cpf);

    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('cpf', cleanCPF)
        .limit(1)
        .single();

      if (data) {
        return {
          id: data.id,
          username: data.username,
          passwordHash: data.password_hash,
          name: data.name,
          cpf: data.cpf,
          birthYear: data.birth_year,
          role: data.role,
          status: data.status,
          createdAt: data.created_at
        };
      }
      return null;
    }

    const data = getDb();
    return (data.users || []).find(u => cleanCPFString(u.cpf) === cleanCPF) || null;
  },

  async createUserAsync(userData) {
    const cleanCPF = cleanCPFString(userData.cpf);
    const newUser = {
      username: userData.username.trim(),
      password_hash: bcrypt.hashSync(userData.password, 10),
      name: userData.name.trim(),
      cpf: cleanCPF,
      birth_year: parseInt(userData.birthYear, 10),
      role: userData.role || 'public',
      status: userData.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      let { data, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST204' || error.message.includes('column')) {
          console.warn('⚠️ Tabela users do Supabase necessita da atualização das colunas cpf e birth_year. Execute database/schema.sql no SQL Editor do Supabase.');
          // Tentativa com payload base
          const basePayload = {
            username: newUser.username,
            password_hash: newUser.password_hash,
            name: newUser.name,
            role: newUser.role,
            created_at: newUser.created_at
          };
          const retry = await supabase.from('users').insert([basePayload]).select().single();
          if (!retry.error && retry.data) {
            data = retry.data;
          } else {
            console.error('Erro ao criar usuário no Supabase:', retry.error || error);
            throw (retry.error || error);
          }
        } else {
          console.error('Erro ao criar usuário no Supabase:', error);
          throw error;
        }
      }
      return {
        id: data.id,
        username: data.username,
        name: data.name,
        cpf: data.cpf || cleanCPF,
        birthYear: data.birth_year || userData.birthYear,
        role: data.role || 'public',
        status: data.status || 'pending',
        createdAt: data.created_at
      };
    }

    const data = getDb();
    if (!data.users) data.users = [];
    const localUser = {
      id: 'usr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      username: newUser.username,
      passwordHash: newUser.password_hash,
      name: newUser.name,
      cpf: newUser.cpf,
      birth_year: newUser.birth_year,
      role: newUser.role,
      status: newUser.status,
      created_at: newUser.created_at
    };
    data.users.push(localUser);
    saveDb(data);
    return localUser;
  },

  async getAllUsersAsync(statusFilter = null) {
    if (isSupabaseConfigured()) {
      let query = supabase
        .from('users')
        .select('id, username, name, cpf, birth_year, role, status, created_at')
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao listar usuários no Supabase:', error);
        return [];
      }
      return (data || []).map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        cpf: u.cpf,
        birthYear: u.birth_year,
        role: u.role,
        status: u.status,
        createdAt: u.created_at
      }));
    }

    const data = getDb();
    let list = data.users || [];
    if (statusFilter) {
      list = list.filter(u => u.status === statusFilter);
    }
    return list.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      cpf: u.cpf,
      birthYear: u.birth_year,
      role: u.role,
      status: u.status,
      createdAt: u.created_at
    }));
  },

  async updateUserStatusAsync(userId, newStatus) {
    if (!['approved', 'pending', 'rejected'].includes(newStatus)) {
      throw new Error('Status inválido.');
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST204' || error.message.includes('column')) {
          console.warn('⚠️ Coluna status ainda não existe na tabela users do Supabase. Retornando atualização simulada.');
          return { id: userId, status: newStatus };
        }
        console.error('Erro ao atualizar status do usuário no Supabase:', error);
        throw error;
      }
      return data;
    }

    const data = getDb();
    const user = (data.users || []).find(u => u.id === userId);
    if (user) {
      user.status = newStatus;
      saveDb(data);
      return user;
    }
    return null;
  },

  async deleteUserAsync(userId) {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao deletar usuário do Supabase:', error);
        throw error;
      }
      return data;
    }

    const data = getDb();
    const index = (data.users || []).findIndex(u => u.id === userId);
    if (index !== -1) {
      const [removed] = data.users.splice(index, 1);
      saveDb(data);
      return removed;
    }
    return null;
  },

  async updateUserRoleAsync(userId, newRole) {
    if (!['admin', 'public'].includes(newRole)) {
      throw new Error('Função (role) inválida.');
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar função do usuário no Supabase:', error);
        throw error;
      }
      return data;
    }

    const dbData = getDb();
    if (!dbData.users) dbData.users = [];
    const userIndex = dbData.users.findIndex(u => u.id === userId || u.username === userId);
    if (userIndex !== -1) {
      dbData.users[userIndex].role = newRole;
      dbData.users[userIndex].updated_at = new Date().toISOString();
      saveDb(dbData);
      return dbData.users[userIndex];
    }
    return null;
  },

  async updateUserPasswordAsync(userId, newPassword) {
    const passwordHash = bcrypt.hashSync(newPassword, 10);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar senha no Supabase:', error);
        return null;
      }
      return data;
    }

    const dbData = getDb();
    if (!dbData.users) dbData.users = [];
    const userIndex = dbData.users.findIndex(u => u.id === userId || u.username === userId);
    if (userIndex !== -1) {
      dbData.users[userIndex].password_hash = passwordHash;
      dbData.users[userIndex].passwordHash = passwordHash;
      dbData.users[userIndex].updated_at = new Date().toISOString();
      saveDb(dbData);
      return dbData.users[userIndex];
    }
    return null;
  },

  // Legacy Admin queries
  async getAdminAsync() {
    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (data) {
        return {
          username: data.username,
          passwordHash: data.password_hash,
          name: data.name,
          role: data.role || 'admin',
          status: data.status || 'approved'
        };
      }
    }
    return this.getAdmin();
  },

  getAdmin() {
    const data = getDb();
    return data.admin || initialData.admin;
  },

  async verifyAdminPasswordAsync(username, password) {
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'assis6259';

    // 1. Checagem direta contra as credenciais do arquivo .env
    if (username.trim().toLowerCase() === envUser.toLowerCase() && password === envPass) {
      // Sincronizar hash atualizado no Supabase se necessário
      if (isSupabaseConfigured()) {
        try {
          const newHash = bcrypt.hashSync(envPass, 10);
          await supabase
            .from('users')
            .update({ password_hash: newHash, updated_at: new Date().toISOString() })
            .eq('username', envUser);
        } catch (err) {
          console.warn('⚠️ Alerta ao atualizar hash do admin no Supabase:', err.message);
        }
      }
      return true;
    }

    // 2. Checagem contra o banco de dados
    const user = await this.getUserByUsernameAsync(username);
    if (!user) return false;
    
    const storedHash = user.passwordHash || user.password_hash;
    if (storedHash && bcrypt.compareSync(password, storedHash)) {
      return true;
    }

    return false;
  },

  verifyAdminPassword(username, password) {
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'assis6259';
    if (username.trim().toLowerCase() === envUser.toLowerCase() && password === envPass) {
      return true;
    }

    const admin = this.getAdmin();
    if (admin && admin.username && admin.username.toLowerCase() === username.toLowerCase()) {
      if (admin.passwordHash && bcrypt.compareSync(password, admin.passwordHash)) {
        return true;
      }
    }
    return false;
  },

  // Croquis CRUD
  async getAllCroquisAsync(filters = {}) {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('croquis')
          .select('*')
          .order('updated_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        let result = data || [];
        const search = normalizeText(filters.search);
        const bairro = normalizeText(filters.bairro);
        const regiao = normalizeText(filters.regiao);
        const quarteirao = normalizeText(filters.quarteirao);
        const sisloc = normalizeText(filters.sisloc);

        if (search) {
          result = result.filter(c =>
            normalizeText(c.bairro).includes(search) ||
            normalizeText(c.sisloc).includes(search) ||
            normalizeText(c.regiao).includes(search) ||
            normalizeText(c.quarteirao).includes(search) ||
            normalizeText(c.observacoes).includes(search)
          );
        }
        if (bairro) result = result.filter(c => normalizeText(c.bairro).includes(bairro));
        if (regiao) result = result.filter(c => normalizeText(c.regiao).includes(regiao));
        if (quarteirao) result = result.filter(c => normalizeText(c.quarteirao).includes(quarteirao));
        if (sisloc) result = result.filter(c => normalizeText(c.sisloc).includes(sisloc));

        return result;
      } catch (err) {
        console.error('Erro ao consultar croquis no Supabase:', err);
      }
    }
    return this.getAllCroquis(filters);
  },

  getAllCroquis(filters = {}) {
    const data = getDb();
    let result = [...data.croquis];

    const search = normalizeText(filters.search);
    const bairro = normalizeText(filters.bairro);
    const regiao = normalizeText(filters.regiao);
    const quarteirao = normalizeText(filters.quarteirao);
    const sisloc = normalizeText(filters.sisloc);

    if (search) {
      result = result.filter(c =>
        normalizeText(c.bairro).includes(search) ||
        normalizeText(c.sisloc).includes(search) ||
        normalizeText(c.regiao).includes(search) ||
        normalizeText(c.quarteirao).includes(search) ||
        normalizeText(c.observacoes).includes(search)
      );
    }

    if (bairro) result = result.filter(c => normalizeText(c.bairro).includes(bairro));
    if (regiao) result = result.filter(c => normalizeText(c.regiao).includes(regiao));
    if (quarteirao) result = result.filter(c => normalizeText(c.quarteirao).includes(quarteirao));
    if (sisloc) result = result.filter(c => normalizeText(c.sisloc).includes(sisloc));

    result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return result;
  },

  async getCroquiByIdAsync(id) {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('croquis')
        .select('*')
        .eq('id', id)
        .single();

      if (data && !error) return data;
    }
    return this.getCroquiById(id);
  },

  getCroquiById(id) {
    const data = getDb();
    return data.croquis.find(c => c.id === id) || null;
  },

  async createCroquiAsync(croquiData) {
    const newCroqui = {
      id: 'croqui-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      bairro: croquiData.bairro.trim(),
      sisloc: croquiData.sisloc ? croquiData.sisloc.trim() : '',
      regiao: croquiData.regiao.trim(),
      quarteirao: croquiData.quarteirao.trim(),
      observacoes: croquiData.observacoes ? croquiData.observacoes.trim() : '',
      filename: croquiData.filename,
      filepath: croquiData.filepath,
      file_size: croquiData.file_size || 0,
      views: 0,
      downloads: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('croquis')
        .insert([newCroqui])
        .select()
        .single();

      if (error) {
        console.error('Erro ao inserir croqui no Supabase:', error);
        throw error;
      }
      return data;
    }

    return this.createCroqui(croquiData);
  },

  createCroqui(croquiData) {
    const data = getDb();
    const newCroqui = {
      id: 'croqui-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      bairro: croquiData.bairro.trim(),
      sisloc: croquiData.sisloc ? croquiData.sisloc.trim() : '',
      regiao: croquiData.regiao.trim(),
      quarteirao: croquiData.quarteirao.trim(),
      observacoes: croquiData.observacoes ? croquiData.observacoes.trim() : '',
      filename: croquiData.filename,
      filepath: croquiData.filepath,
      file_size: croquiData.file_size || 0,
      views: 0,
      downloads: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    data.croquis.unshift(newCroqui);
    saveDb(data);
    return newCroqui;
  },

  async updateCroquiAsync(id, updateData) {
    if (isSupabaseConfigured()) {
      const existing = await this.getCroquiByIdAsync(id);
      if (!existing) return null;

      const payload = {
        updated_at: new Date().toISOString()
      };
      if (updateData.bairro !== undefined) payload.bairro = updateData.bairro.trim();
      if (updateData.sisloc !== undefined) payload.sisloc = updateData.sisloc.trim();
      if (updateData.regiao !== undefined) payload.regiao = updateData.regiao.trim();
      if (updateData.quarteirao !== undefined) payload.quarteirao = updateData.quarteirao.trim();
      if (updateData.observacoes !== undefined) payload.observacoes = updateData.observacoes.trim();

      if (updateData.filename && updateData.filepath) {
        payload.filename = updateData.filename;
        payload.filepath = updateData.filepath;
        if (updateData.file_size) payload.file_size = updateData.file_size;
      }

      const { data, error } = await supabase
        .from('croquis')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar croqui no Supabase:', error);
        throw error;
      }
      return data;
    }

    return this.updateCroqui(id, updateData);
  },

  updateCroqui(id, updateData) {
    const data = getDb();
    const index = data.croquis.findIndex(c => c.id === id);
    if (index === -1) return null;

    const existing = data.croquis[index];
    const updated = {
      ...existing,
      bairro: updateData.bairro !== undefined ? updateData.bairro.trim() : existing.bairro,
      sisloc: updateData.sisloc !== undefined ? updateData.sisloc.trim() : existing.sisloc,
      regiao: updateData.regiao !== undefined ? updateData.regiao.trim() : existing.regiao,
      quarteirao: updateData.quarteirao !== undefined ? updateData.quarteirao.trim() : existing.quarteirao,
      observacoes: updateData.observacoes !== undefined ? updateData.observacoes.trim() : existing.observacoes,
      updated_at: new Date().toISOString()
    };

    if (updateData.filename && updateData.filepath) {
      updated.filename = updateData.filename;
      updated.filepath = updateData.filepath;
      if (updateData.file_size) updated.file_size = updateData.file_size;
    }

    data.croquis[index] = updated;
    saveDb(data);
    return updated;
  },

  async deleteCroquiAsync(id) {
    if (isSupabaseConfigured()) {
      const existing = await this.getCroquiByIdAsync(id);
      if (!existing) return null;

      const { error } = await supabase
        .from('croquis')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar croqui do Supabase:', error);
        throw error;
      }
      return existing;
    }
    return this.deleteCroqui(id);
  },

  deleteCroqui(id) {
    const data = getDb();
    const index = data.croquis.findIndex(c => c.id === id);
    if (index === -1) return null;

    const [deleted] = data.croquis.splice(index, 1);
    saveDb(data);
    return deleted;
  },

  async incrementViewAsync(id) {
    if (isSupabaseConfigured()) {
      const croqui = await this.getCroquiByIdAsync(id);
      if (croqui) {
        const newViews = (croqui.views || 0) + 1;
        await supabase
          .from('croquis')
          .update({ views: newViews })
          .eq('id', id);
        return newViews;
      }
      return 0;
    }
    return this.incrementView(id);
  },

  incrementView(id) {
    const data = getDb();
    const croqui = data.croquis.find(c => c.id === id);
    if (croqui) {
      croqui.views = (croqui.views || 0) + 1;
      saveDb(data);
      return croqui.views;
    }
    return 0;
  },

  async incrementDownloadAsync(id) {
    if (isSupabaseConfigured()) {
      const croqui = await this.getCroquiByIdAsync(id);
      if (croqui) {
        const newDownloads = (croqui.downloads || 0) + 1;
        await supabase
          .from('croquis')
          .update({ downloads: newDownloads })
          .eq('id', id);
        return newDownloads;
      }
      return 0;
    }
    return this.incrementDownload(id);
  },

  incrementDownload(id) {
    const data = getDb();
    const croqui = data.croquis.find(c => c.id === id);
    if (croqui) {
      croqui.downloads = (croqui.downloads || 0) + 1;
      saveDb(data);
      return croqui.downloads;
    }
    return 0;
  },

  async getStatsAsync() {
    if (isSupabaseConfigured()) {
      const croquis = await this.getAllCroquisAsync();
      const totalCroquis = croquis.length;
      const bairrosSet = new Set(croquis.map(c => (c.bairro || '').toLowerCase()));
      const totalViews = croquis.reduce((sum, c) => sum + (c.views || 0), 0);
      const totalDownloads = croquis.reduce((sum, c) => sum + (c.downloads || 0), 0);

      let lastUploadDate = null;
      if (croquis.length > 0) {
        const dates = croquis.map(c => new Date(c.created_at || c.updated_at).getTime());
        const maxDate = Math.max(...dates);
        lastUploadDate = new Date(maxDate).toISOString();
      }

      return {
        totalCroquis,
        bairrosCount: bairrosSet.size,
        totalViews,
        totalDownloads,
        lastUploadDate
      };
    }
    return this.getStats();
  },

  getStats() {
    const data = getDb();
    const croquis = data.croquis;

    const totalCroquis = croquis.length;
    const bairrosSet = new Set(croquis.map(c => c.bairro.toLowerCase()));
    const totalViews = croquis.reduce((sum, c) => sum + (c.views || 0), 0);
    const totalDownloads = croquis.reduce((sum, c) => sum + (c.downloads || 0), 0);

    let lastUploadDate = null;
    if (croquis.length > 0) {
      const dates = croquis.map(c => new Date(c.created_at || c.updated_at).getTime());
      const maxDate = Math.max(...dates);
      lastUploadDate = new Date(maxDate).toISOString();
    }

    return {
      totalCroquis,
      bairrosCount: bairrosSet.size,
      totalViews,
      totalDownloads,
      lastUploadDate
    };
  }
};

// Initialize DB for local mode
initDb();

module.exports = db;
