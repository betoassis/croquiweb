/**
 * CROQUI WEB - ADMIN PANEL & USER MANAGEMENT CONTROLLER
 */

window.AdminApp = (function() {
  let token = localStorage.getItem('croqui_jwt_token') || null;
  let currentUser = null;
  let allCroquis = [];
  let allUsers = [];

  // Helper Dynamic DOM Getters (Garante que os elementos sempre existam após o carregamento do DOM)
  const el = {
    navAdminBtn: () => document.getElementById('nav-admin'),
    navAuthContainer: () => document.getElementById('nav-auth-container'),
    btnOpenLogin: () => document.getElementById('btn-open-login'),
    publicView: () => document.getElementById('public-view'),
    adminView: () => document.getElementById('admin-view'),
    authRequiredView: () => document.getElementById('auth-required-view'),
    modalLogin: () => document.getElementById('modal-login'),
    formLogin: () => document.getElementById('form-login'),
    loginError: () => document.getElementById('login-error'),
    btnSwitchToRegister: () => document.getElementById('btn-switch-to-register'),
    modalRegister: () => document.getElementById('modal-register'),
    formRegister: () => document.getElementById('form-register'),
    registerError: () => document.getElementById('register-error'),
    registerSuccess: () => document.getElementById('register-success'),
    inputRegCpf: () => document.getElementById('reg-cpf'),
    modalUpload: () => document.getElementById('modal-upload'),
    formUpload: () => document.getElementById('form-upload'),
    uploadError: () => document.getElementById('upload-error'),
    modalEdit: () => document.getElementById('modal-edit'),
    formEdit: () => document.getElementById('form-edit'),
    editError: () => document.getElementById('edit-error'),
    modalReplace: () => document.getElementById('modal-replace'),
    formReplace: () => document.getElementById('form-replace'),
    replaceError: () => document.getElementById('replace-error'),
    modalCreateAdmin: () => document.getElementById('modal-create-admin'),
    formCreateAdmin: () => document.getElementById('form-create-admin'),
    modalForgotPassword: () => document.getElementById('modal-forgot-password'),
    formForgotPassword: () => document.getElementById('form-forgot-password'),
    inputResetCpf: () => document.getElementById('reset-cpf'),
    btnLogout: () => document.getElementById('btn-logout'),
    tabDashBtn: () => document.getElementById('side-tab-dash'),
    tabCroquisBtn: () => document.getElementById('side-tab-croquis'),
    tabUsersBtn: () => document.getElementById('side-tab-users'),
    tabExtBtn: () => document.getElementById('side-tab-ext'),
    sectionDash: () => document.getElementById('admin-section-dashboard'),
    sectionCroquis: () => document.getElementById('admin-section-croquis'),
    sectionUsers: () => document.getElementById('admin-section-users'),
    sectionExt: () => document.getElementById('admin-section-extensions')
  };

  function init() {
    setupEventListeners();
    setupCpfMask();
    checkAuthStatus();
  }

  function setupCpfMask() {
    [el.inputRegCpf(), el.inputResetCpf()].forEach(inputCpf => {
      if (!inputCpf) return;
      inputCpf.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 9) {
          value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
          value = value.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
        } else if (value.length > 3) {
          value = value.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
        }
        e.target.value = value;
      });
    });
  }

  function checkAuthStatus() {
    if (!token) {
      currentUser = null;
      updateNavForPublic();
      showAuthRequiredView();
      return;
    }

    fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Sessão expirada');
      return res.json();
    })
    .then(data => {
      currentUser = data.user;
      updateNavForAdmin(data.user);

      if (currentUser.role === 'admin' && window.location.hash === '#admin') {
        showAdminView();
      } else {
        showPublicView();
      }
    })
    .catch(err => {
      logout();
    });
  }

  function updateFabVisibility() {
    const fab = document.getElementById('fab-container');
    if (!fab) return;
    const activeModal = document.querySelector('.modal.active');
    if (token && currentUser && !activeModal) {
      fab.style.display = 'flex';
    } else {
      fab.style.display = 'none';
      const fabMenu = document.getElementById('fab-menu');
      const fabMainBtn = document.getElementById('fab-main-btn');
      if (fabMenu) fabMenu.style.display = 'none';
      if (fabMainBtn) fabMainBtn.classList.remove('active');
    }
  }

  function updateNavForPublic() {
    token = null;
    currentUser = null;
    updateFabVisibility();
    const navAdmin = el.navAdminBtn();
    if (navAdmin) navAdmin.style.display = 'none';

    const container = el.navAuthContainer();
    if (container) {
      container.innerHTML = `
        <button class="btn-admin-login" id="btn-open-login-dynamic">
          🔑 Entrar / Logar
        </button>
      `;
      document.getElementById('btn-open-login-dynamic')?.addEventListener('click', () => openModal(el.modalLogin()));
    }
  }

  function updateNavForAdmin(user) {
    currentUser = user;
    updateFabVisibility();
    const isAdmin = user && user.role === 'admin';
    const navAdmin = el.navAdminBtn();
    if (navAdmin) {
      navAdmin.style.display = isAdmin ? 'inline-block' : 'none';
    }

    const container = el.navAuthContainer();
    if (container) {
      container.innerHTML = `
        <div class="nav-user-controls">
          <span class="nav-user-greeting">Olá, <strong>${user.name}</strong></span>
          <button class="btn-top-logout" id="btn-top-logout">
            🚪 Sair
          </button>
        </div>
      `;
      document.getElementById('btn-top-logout')?.addEventListener('click', logout);
    }
  }

  function login(username, password) {
    const errBox = el.loginError();
    if (errBox) errBox.style.display = 'none';
    
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      token = data.token;
      currentUser = data.user;
      localStorage.setItem('croqui_jwt_token', token);
      closeModal(el.modalLogin());
      
      const form = el.formLogin();
      if (form) form.reset();
      
      updateNavForAdmin(data.user);

      if (data.user.role === 'admin') {
        showAdminView();
      } else {
        showPublicView();
      }
    })
    .catch(err => {
      if (errBox) {
        errBox.textContent = 'Erro ao realizar login. Tente novamente.';
        errBox.style.display = 'block';
      }
    });
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    const errBox = el.registerError();
    const succBox = el.registerSuccess();
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    const payload = {
      name: document.getElementById('reg-name').value,
      username: document.getElementById('reg-username').value,
      password: document.getElementById('reg-password').value,
      cpf: document.getElementById('reg-cpf').value,
      birthYear: document.getElementById('reg-birth-year').value
    };

    const submitBtn = document.getElementById('btn-submit-register');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Solicitação';
      }

      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      if (succBox) {
        succBox.textContent = data.message;
        succBox.style.display = 'block';
      }
      
      const form = el.formRegister();
      if (form) form.reset();

      setTimeout(() => {
        closeModal(el.modalRegister());
        openModal(el.modalLogin());
      }, 3500);
    })
    .catch(err => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Solicitação';
      }
      if (errBox) {
        errBox.textContent = 'Erro de conexão ao realizar cadastro.';
        errBox.style.display = 'block';
      }
    });
  }

  function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('croqui_jwt_token');
    updateNavForPublic();
    showAuthRequiredView();
    window.location.hash = 'public';
  }

  function showAuthRequiredView() {
    const admin = el.adminView();
    const publicV = el.publicView();
    const authGate = el.authRequiredView();

    if (admin) admin.style.display = 'none';
    if (publicV) publicV.style.display = 'none';
    if (authGate) authGate.style.display = 'block';

    const navAdmin = el.navAdminBtn();
    if (navAdmin) navAdmin.style.display = 'none';
    document.getElementById('nav-public')?.classList.remove('active');

    openModal(el.modalLogin());
  }

  function showAdminView() {
    if (!token || !currentUser) {
      showAuthRequiredView();
      return;
    }

    if (currentUser.role !== 'admin') {
      alert('Acesso restrito: A área administrativa é exclusiva para Administradores.');
      showPublicView();
      return;
    }

    const authGate = el.authRequiredView();
    const publicV = el.publicView();
    const admin = el.adminView();

    if (authGate) authGate.style.display = 'none';
    if (publicV) publicV.style.display = 'none';
    if (admin) admin.style.display = 'flex';

    document.getElementById('nav-public')?.classList.remove('active');
    const navAdmin = el.navAdminBtn();
    if (navAdmin) {
      navAdmin.style.display = 'inline-block';
      navAdmin.classList.add('active');
    }

    loadDashboardStats();
    loadAdminCroquisTable();
  }

  function showPublicView() {
    if (!currentUser || !token) {
      showAuthRequiredView();
      return;
    }

    const authGate = el.authRequiredView();
    const publicV = el.publicView();
    const admin = el.adminView();

    if (authGate) authGate.style.display = 'none';
    if (admin) admin.style.display = 'none';
    if (publicV) publicV.style.display = 'block';

    const navAdmin = el.navAdminBtn();
    if (navAdmin) navAdmin.classList.remove('active');
    document.getElementById('nav-public')?.classList.add('active');

    if (window.PublicApp) window.PublicApp.loadCroquis();
  }

  function switchSubTab(tabName) {
    const tabDashBtn = el.tabDashBtn();
    const tabCroquisBtn = el.tabCroquisBtn();
    const tabUsersBtn = el.tabUsersBtn();
    const tabExtBtn = el.tabExtBtn();

    const sectionDash = el.sectionDash();
    const sectionCroquis = el.sectionCroquis();
    const sectionUsers = el.sectionUsers();
    const sectionExt = el.sectionExt();

    [tabDashBtn, tabCroquisBtn, tabUsersBtn, tabExtBtn].forEach(b => b && b.classList.remove('active'));
    [sectionDash, sectionCroquis, sectionUsers, sectionExt].forEach(s => s && (s.style.display = 'none'));

    if (tabName === 'dash') {
      if (tabDashBtn) tabDashBtn.classList.add('active');
      if (sectionDash) sectionDash.style.display = 'block';
      loadDashboardStats();
    } else if (tabName === 'croquis') {
      if (tabCroquisBtn) tabCroquisBtn.classList.add('active');
      if (sectionCroquis) sectionCroquis.style.display = 'block';
      loadAdminCroquisTable();
    } else if (tabName === 'users') {
      if (tabUsersBtn) tabUsersBtn.classList.add('active');
      if (sectionUsers) sectionUsers.style.display = 'block';
      loadAdminUsersTable();
    } else if (tabName === 'ext') {
      if (tabExtBtn) tabExtBtn.classList.add('active');
      if (sectionExt) sectionExt.style.display = 'block';
    }
  }

  function loadDashboardStats() {
    fetch('/api/stats')
      .then(res => res.json())
      .then(stats => {
        document.getElementById('stat-total-pdf').textContent = stats.totalCroquis;
        document.getElementById('stat-bairros').textContent = stats.bairrosCount;
        document.getElementById('stat-views').textContent = stats.totalViews;
        document.getElementById('stat-downloads').textContent = stats.totalDownloads;

        const lastDateEl = document.getElementById('stat-last-upload');
        if (stats.lastUploadDate) {
          const dateStr = new Date(stats.lastUploadDate).toLocaleString('pt-BR');
          lastDateEl.innerHTML = `<strong>Data/Hora:</strong> ${dateStr}`;
        } else {
          lastDateEl.textContent = 'Nenhum upload registrado.';
        }
      })
      .catch(err => console.error('Erro ao carregar estatísticas:', err));
  }

  function loadAdminCroquisTable() {
    fetch('/api/croquis')
      .then(res => res.json())
      .then(data => {
        allCroquis = data;
        populateAdminFilters(data);
        applyAdminFilters();
      })
      .catch(err => console.error('Erro ao carregar tabela admin:', err));
  }

  function loadAdminUsersTable() {
    const statusFilter = document.getElementById('admin-filter-user-status')?.value || '';
    const url = statusFilter ? `/api/users?status=${statusFilter}` : '/api/users';

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      allUsers = data;
      renderAdminUsersTable(data);
    })
    .catch(err => console.error('Erro ao carregar usuários:', err));
  }

  function renderAdminUsersTable(users) {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">
            Nenhuma solicitação de usuário encontrada para este filtro.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = users.map(u => {
      let statusBadge = '';
      if (u.status === 'approved') {
        statusBadge = '<span class="badge" style="background:#e6f4ea; color:#137333; font-weight:600;">✅ Aprovado</span>';
      } else if (u.status === 'rejected') {
        statusBadge = '<span class="badge" style="background:#fce8e6; color:#c5221f; font-weight:600;">❌ Rejeitado</span>';
      } else {
        statusBadge = '<span class="badge" style="background:#fef7e0; color:#b06000; font-weight:600;">🕒 Pendente</span>';
      }

      const roleBadge = u.role === 'admin' 
        ? '<span class="badge badge-sisloc">ADMIN</span>' 
        : '<span class="badge">PÚBLICO</span>';

      const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-';

      return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td><code>${u.username}</code></td>
          <td>${u.cpfFormatted || u.cpf || '-'}</td>
          <td>${u.birthYear || '-'}</td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td>${dateStr}</td>
          <td>
            <div class="actions-cell">
              ${u.status !== 'approved' ? `<button class="btn-icon" title="Aprovar Usuário" style="background:#e6f4ea;" onclick="AdminApp.updateUserStatus('${u.id}', 'approved')">✅ Aprovar</button>` : ''}
              ${u.status !== 'rejected' ? `<button class="btn-icon" title="Rejeitar Solicitação" style="background:#fce8e6;" onclick="AdminApp.updateUserStatus('${u.id}', 'rejected')">❌ Rejeitar</button>` : ''}
              ${u.role === 'admin' 
                ? `<button class="btn-icon" title="Alterar para Usuário Público" style="background:#fef7e0;" onclick="AdminApp.updateUserRole('${u.id}', 'public')">👤 Tornado Público</button>`
                : `<button class="btn-icon" title="Promover a Administrador" style="background:#e8f0fe; color:#1a73e8;" onclick="AdminApp.updateUserRole('${u.id}', 'admin')">⭐ Promover a Admin</button>`
              }
              <button class="btn-icon delete" title="Excluir Conta" onclick="AdminApp.deleteUser('${u.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateUserStatus(userId, newStatus) {
    const actionName = newStatus === 'approved' ? 'aprovar' : 'rejeitar';
    if (!confirm(`Tem certeza que deseja ${actionName} esta solicitação de usuário?`)) return;

    fetch(`/api/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert('Erro: ' + data.error);
        return;
      }
      alert(data.message);
      loadAdminUsersTable();
    })
    .catch(err => alert('Erro de conexão ao alterar status do usuário.'));
  }

  function updateUserRole(userId, newRole) {
    const actionName = newRole === 'admin' ? 'promover este usuário a ADMINISTRADOR' : 'alterar a função deste usuário para PÚBLICO';
    if (!confirm(`Tem certeza que deseja ${actionName}?`)) return;

    fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: newRole })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert('Erro: ' + data.error);
        return;
      }
      alert(data.message);
      loadAdminUsersTable();
    })
    .catch(err => alert('Erro de conexão ao alterar função do usuário.'));
  }

  function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir esta conta de usuário? Esta ação não pode ser desfeita.')) return;

    fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert('Erro: ' + data.error);
        return;
      }
      alert(data.message);
      loadAdminUsersTable();
    })
    .catch(err => alert('Erro ao excluir usuário.'));
  }

  function populateAdminFilters(data) {
    const selectBairro = document.getElementById('admin-filter-bairro');
    const selectRegiao = document.getElementById('admin-filter-regiao');
    if (!selectBairro || !selectRegiao) return;

    const currentB = selectBairro.value;
    const currentR = selectRegiao.value;

    const bairros = Array.from(new Set(data.map(c => c.bairro))).sort();
    const regioes = Array.from(new Set(data.map(c => c.regiao))).sort();

    selectBairro.innerHTML = `<option value="">Todos os Bairros (${bairros.length})</option>` +
      bairros.map(b => `<option value="${b}">${b}</option>`).join('');

    selectRegiao.innerHTML = `<option value="">Todas as Regiões (${regioes.length})</option>` +
      regioes.map(r => `<option value="${r}">${r}</option>`).join('');

    selectBairro.value = currentB;
    selectRegiao.value = currentR;
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

  function applyAdminFilters() {
    const searchInput = document.getElementById('admin-table-search');
    const selectBairro = document.getElementById('admin-filter-bairro');
    const selectRegiao = document.getElementById('admin-filter-regiao');

    const q = normalizeText(searchInput ? searchInput.value : '');
    const b = normalizeText(selectBairro ? selectBairro.value : '');
    const r = normalizeText(selectRegiao ? selectRegiao.value : '');

    const filtered = allCroquis.filter(c => {
      const matchSearch = !q ||
        normalizeText(c.bairro).includes(q) ||
        normalizeText(c.sisloc).includes(q) ||
        normalizeText(c.regiao).includes(q) ||
        normalizeText(c.quarteirao).includes(q) ||
        normalizeText(c.observacoes).includes(q);

      const matchBairro = !b || normalizeText(c.bairro) === b;
      const matchRegiao = !r || normalizeText(c.regiao) === r;

      return matchSearch && matchBairro && matchRegiao;
    });

    renderAdminTable(filtered);
  }

  function formatQuarteirao(val) {
    if (!val && val !== 0) return '0 Quarteirões';
    const str = val.toString().trim();
    const digitsOnly = str.replace(/\D+/g, '');
    if (digitsOnly.length > 0) {
      const num = parseInt(digitsOnly, 10);
      return num === 1 ? `${num} Quarteirão` : `${num} Quarteirões`;
    }
    return str;
  }

  function renderAdminTable(croquis) {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    if (!croquis || croquis.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">
            Nenhum croqui encontrado. Clique em "Cadastrar Novo Croqui" acima.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = croquis.map(c => `
      <tr>
        <td><span class="badge badge-sisloc">${c.sisloc ? 'SISLOC ' + c.sisloc : 'N/A'}</span></td>
        <td>${c.bairro}</td>
        <td>${c.regiao}</td>
        <td><strong>${formatQuarteirao(c.quarteirao)}</strong></td>
        <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${c.observacoes || '-'}
        </td>
        <td>👁️ ${c.views || 0} | 📥 ${c.downloads || 0}</td>
        <td>${new Date(c.updated_at).toLocaleDateString('pt-BR')}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" title="Editar Metadados" onclick="AdminApp.openEditModal('${c.id}')">✏️</button>
            <button class="btn-icon replace" title="Substituir PDF" onclick="AdminApp.openReplaceModal('${c.id}')">🔄</button>
            <button class="btn-icon delete" title="Excluir" onclick="AdminApp.deleteCroqui('${c.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function handleUploadSubmit(e) {
    e.preventDefault();
    const errBox = el.uploadError();
    if (errBox) errBox.style.display = 'none';

    const formData = new FormData();
    formData.append('bairro', document.getElementById('upload-bairro').value);
    formData.append('sisloc', document.getElementById('upload-sisloc').value);
    formData.append('regiao', document.getElementById('upload-regiao').value);
    formData.append('quarteirao', document.getElementById('upload-quarteirao').value);
    formData.append('observacoes', document.getElementById('upload-observacoes').value);

    const fileInput = document.getElementById('upload-pdf');
    if (fileInput.files.length > 0) {
      formData.append('pdf', fileInput.files[0]);
    }

    const saveBtn = document.getElementById('btn-save-upload');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Enviando...';
    }

    fetch('/api/croquis', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar Croqui';
      }

      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      closeModal(el.modalUpload());
      const form = el.formUpload();
      if (form) form.reset();
      const uploadBadge = document.getElementById('upload-pdf-badge');
      if (uploadBadge) {
        uploadBadge.innerHTML = '';
        uploadBadge.style.display = 'none';
      }

      loadDashboardStats();
      loadAdminCroquisTable();
      alert('Croqui cadastrado com sucesso!');
    })
    .catch(err => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar Croqui';
      }
      if (errBox) {
        errBox.textContent = 'Erro ao enviar arquivo. Tente novamente.';
        errBox.style.display = 'block';
      }
    });
  }

  function openEditModal(id) {
    const croqui = allCroquis.find(c => c.id === id);
    if (!croqui) return;

    document.getElementById('edit-id').value = croqui.id;
    document.getElementById('edit-bairro').value = croqui.bairro;
    document.getElementById('edit-sisloc').value = croqui.sisloc || '';
    document.getElementById('edit-regiao').value = croqui.regiao;
    document.getElementById('edit-quarteirao').value = croqui.quarteirao;
    document.getElementById('edit-observacoes').value = croqui.observacoes || '';

    const errBox = el.editError();
    if (errBox) errBox.style.display = 'none';
    openModal(el.modalEdit());
  }

  function handleEditSubmit(e) {
    e.preventDefault();
    const errBox = el.editError();
    if (errBox) errBox.style.display = 'none';

    const id = document.getElementById('edit-id').value;
    const body = {
      bairro: document.getElementById('edit-bairro').value,
      sisloc: document.getElementById('edit-sisloc').value,
      regiao: document.getElementById('edit-regiao').value,
      quarteirao: document.getElementById('edit-quarteirao').value,
      observacoes: document.getElementById('edit-observacoes').value
    };

    fetch(`/api/croquis/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      closeModal(el.modalEdit());
      loadAdminCroquisTable();
      alert('Metadados do croqui atualizados!');
    })
    .catch(err => {
      if (errBox) {
        errBox.textContent = 'Erro ao atualizar dados.';
        errBox.style.display = 'block';
      }
    });
  }

  function openReplaceModal(id) {
    const croqui = allCroquis.find(c => c.id === id);
    if (!croqui) return;

    document.getElementById('replace-id').value = croqui.id;
    document.getElementById('replace-quarteirao-title').textContent = `${croqui.bairro} (${croqui.quarteirao})`;

    const replaceBadge = document.getElementById('replace-pdf-badge');
    if (replaceBadge) {
      replaceBadge.innerHTML = '';
      replaceBadge.style.display = 'none';
    }

    const errBox = el.replaceError();
    if (errBox) errBox.style.display = 'none';
    openModal(el.modalReplace());
  }

  function handleReplaceSubmit(e) {
    e.preventDefault();
    const errBox = el.replaceError();
    if (errBox) errBox.style.display = 'none';

    const id = document.getElementById('replace-id').value;
    const fileInput = document.getElementById('replace-pdf');
    if (!fileInput.files.length) return;

    const formData = new FormData();
    formData.append('pdf', fileInput.files[0]);

    fetch(`/api/croquis/${id}/replace`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      closeModal(el.modalReplace());
      const form = el.formReplace();
      if (form) form.reset();
      const replaceBadge = document.getElementById('replace-pdf-badge');
      if (replaceBadge) {
        replaceBadge.innerHTML = '';
        replaceBadge.style.display = 'none';
      }
      loadAdminCroquisTable();
      alert('Arquivo PDF substituído com sucesso!');
    })
    .catch(err => {
      if (errBox) {
        errBox.textContent = 'Erro ao substituir arquivo PDF.';
        errBox.style.display = 'block';
      }
    });
  }

  function deleteCroqui(id) {
    const croqui = allCroquis.find(c => c.id === id);
    if (!croqui) return;

    if (!confirm(`Tem certeza que deseja excluir o croqui ${croqui.quarteirao} (${croqui.bairro})? Esta ação não pode ser desfeita.`)) {
      return;
    }

    fetch(`/api/croquis/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert('Erro ao excluir: ' + data.error);
        return;
      }
      loadDashboardStats();
      loadAdminCroquisTable();
      alert('Croqui excluído com sucesso.');
    })
    .catch(err => {
      alert('Erro de conexão ao excluir croqui.');
    });
  }

  function openModal(m) {
    if (m) m.classList.add('active');
    updateFabVisibility();
  }

  function closeModal(m) {
    if (m) m.classList.remove('active');
    updateFabVisibility();
  }

  function handleCreateAdminSubmit(e) {
    e.preventDefault();
    const errBox = document.getElementById('create-admin-error');
    const succBox = document.getElementById('create-admin-success');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    const payload = {
      name: document.getElementById('admin-name').value,
      username: document.getElementById('admin-username').value,
      password: document.getElementById('admin-password').value,
      cpf: document.getElementById('admin-cpf').value,
      birthYear: document.getElementById('admin-birth-year').value,
      role: 'admin',
      status: 'approved'
    };

    const submitBtn = document.getElementById('btn-submit-create-admin');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Criando...';
    }

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(async data => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar Administrador';
      }

      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      if (data.user && data.user.username) {
        try {
          await fetch(`/api/users/${data.user.username}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'approved' })
          });
          await fetch(`/api/users/${data.user.username}/role`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role: 'admin' })
          });
        } catch (e) {
          console.warn('Alerta na aprovação do novo admin:', e);
        }
      }

      if (succBox) {
        succBox.textContent = 'Novo Administrador cadastrado com sucesso!';
        succBox.style.display = 'block';
      }
      el.formCreateAdmin()?.reset();

      setTimeout(() => {
        closeModal(el.modalCreateAdmin());
        loadAdminUsersTable();
      }, 2000);
    })
    .catch(err => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar Administrador';
      }
      if (errBox) {
        errBox.textContent = 'Erro de conexão ao cadastrar administrador.';
        errBox.style.display = 'block';
      }
    });
  }

  function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    const errBox = document.getElementById('forgot-error');
    const succBox = document.getElementById('forgot-success');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    const payload = {
      username: document.getElementById('reset-username').value,
      cpf: document.getElementById('reset-cpf').value,
      birthYear: document.getElementById('reset-birth-year').value,
      newPassword: document.getElementById('reset-new-password').value
    };

    const submitBtn = document.getElementById('btn-submit-forgot');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Redefinindo...';
    }

    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Redefinir Senha';
      }

      if (data.error) {
        if (errBox) {
          errBox.textContent = data.error;
          errBox.style.display = 'block';
        }
        return;
      }

      if (succBox) {
        succBox.textContent = data.message;
        succBox.style.display = 'block';
      }
      el.formForgotPassword()?.reset();

      setTimeout(() => {
        closeModal(el.modalForgotPassword());
        openModal(el.modalLogin());
      }, 2500);
    })
    .catch(err => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Redefinir Senha';
      }
      if (errBox) {
        errBox.textContent = 'Erro de conexão ao redefinir a senha.';
        errBox.style.display = 'block';
      }
    });
  }

  function setupEventListeners() {
    document.getElementById('nav-public')?.addEventListener('click', (e) => {
      e.preventDefault();
      showPublicView();
    });

    el.navAdminBtn()?.addEventListener('click', (e) => {
      e.preventDefault();
      showAdminView();
    });

    document.getElementById('brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      showPublicView();
    });

    el.btnOpenLogin()?.addEventListener('click', () => openModal(el.modalLogin()));
    document.getElementById('btn-gate-open-login')?.addEventListener('click', () => openModal(el.modalLogin()));
    document.getElementById('btn-gate-open-register')?.addEventListener('click', () => {
      closeModal(el.modalLogin());
      openModal(el.modalRegister());
    });

    document.getElementById('btn-open-create-admin')?.addEventListener('click', () => openModal(el.modalCreateAdmin()));

    document.getElementById('btn-open-forgot-password')?.addEventListener('click', () => {
      closeModal(el.modalLogin());
      openModal(el.modalForgotPassword());
    });

    el.btnSwitchToRegister()?.addEventListener('click', () => {
      closeModal(el.modalLogin());
      openModal(el.modalRegister());
    });

    el.formLogin()?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      login(u, p);
    });

    el.formRegister()?.addEventListener('submit', handleRegisterSubmit);
    el.formCreateAdmin()?.addEventListener('submit', handleCreateAdminSubmit);
    el.formForgotPassword()?.addEventListener('submit', handleForgotPasswordSubmit);
    el.btnLogout()?.addEventListener('click', logout);

    // Sub-tab navigation
    el.tabDashBtn()?.addEventListener('click', () => switchSubTab('dash'));
    el.tabCroquisBtn()?.addEventListener('click', () => switchSubTab('croquis'));
    el.tabUsersBtn()?.addEventListener('click', () => switchSubTab('users'));
    el.tabExtBtn()?.addEventListener('click', () => switchSubTab('ext'));

    document.getElementById('btn-open-upload')?.addEventListener('click', () => openModal(el.modalUpload()));
    document.getElementById('btn-open-upload-dash')?.addEventListener('click', () => {
      switchSubTab('croquis');
      openModal(el.modalUpload());
    });

    el.formUpload()?.addEventListener('submit', handleUploadSubmit);
    el.formEdit()?.addEventListener('submit', handleEditSubmit);
    el.formReplace()?.addEventListener('submit', handleReplaceSubmit);

    document.getElementById('admin-table-search')?.addEventListener('input', applyAdminFilters);
    document.getElementById('admin-filter-bairro')?.addEventListener('change', applyAdminFilters);
    document.getElementById('admin-filter-regiao')?.addEventListener('change', applyAdminFilters);
    document.getElementById('admin-filter-user-status')?.addEventListener('change', loadAdminUsersTable);

    document.getElementById('btn-admin-clear-filters')?.addEventListener('click', () => {
      const searchInput = document.getElementById('admin-table-search');
      const selectBairro = document.getElementById('admin-filter-bairro');
      const selectRegiao = document.getElementById('admin-filter-regiao');
      if (searchInput) searchInput.value = '';
      if (selectBairro) selectBairro.value = '';
      if (selectRegiao) selectRegiao.value = '';
      applyAdminFilters();
    });

    document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', () => closeModal(el.modalLogin())));
    document.querySelectorAll('.btn-close-register').forEach(b => b.addEventListener('click', () => closeModal(el.modalRegister())));
    document.querySelectorAll('.class-close-upload').forEach(b => b.addEventListener('click', () => closeModal(el.modalUpload())));
    document.querySelectorAll('.class-close-edit').forEach(b => b.addEventListener('click', () => closeModal(el.modalEdit())));
    document.querySelectorAll('.class-close-replace').forEach(b => b.addEventListener('click', () => closeModal(el.modalReplace())));
    document.querySelectorAll('.class-close-create-admin').forEach(b => b.addEventListener('click', () => closeModal(el.modalCreateAdmin())));
    document.querySelectorAll('.class-close-forgot').forEach(b => b.addEventListener('click', () => closeModal(el.modalForgotPassword())));
  }

  return {
    init,
    showAdminView,
    showPublicView,
    showAuthRequiredView,
    openEditModal,
    openReplaceModal,
    deleteCroqui,
    updateUserStatus,
    updateUserRole,
    deleteUser,
    updateFabVisibility,
    getCurrentUser: () => currentUser
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.AdminApp.init();
});
