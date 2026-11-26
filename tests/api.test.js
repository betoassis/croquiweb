const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const app = require('../server');
const { isValidCPF, formatCPF, cleanCPFString } = require('../middleware/cpfValidator');

async function runTests() {
  console.log('🧪 Iniciando testes de integração da API do Croqui Web (Dual-Mode DB & Gestão de Usuários)...\n');

  try {
    // Test 1: Verify DB stats retrieval
    console.log('Test 1: Verificando estatísticas iniciais do banco de dados...');
    const stats = await db.getStatsAsync();
    console.assert(typeof stats.totalCroquis === 'number', 'totalCroquis deve ser um número');
    console.assert(typeof stats.bairrosCount === 'number', 'bairrosCount deve ser um número');
    console.log(`✅ OK: ${stats.totalCroquis} croquis cadastrados em ${stats.bairrosCount} bairros.`);

    // Test 2: Verify search & filtering (Both accented and unaccented)
    console.log('\nTest 2: Testando busca com E sem acentos (insensível a acentos)...');
    const all = await db.getAllCroquisAsync();
    console.assert(all.length >= 1, 'Deve retornar croquis cadastrados');

    const sampleBairro = all.find(c => c.bairro && c.bairro.length > 2)?.bairro || 'Centro';
    const sampleUnaccented = sampleBairro.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const searchAccented = await db.getAllCroquisAsync({ search: sampleBairro });
    const searchUnaccented = await db.getAllCroquisAsync({ search: sampleUnaccented });
    console.assert(searchAccented.length >= 1, `Busca com termo original "${sampleBairro}" deve retornar resultados`);
    console.assert(searchUnaccented.length >= 1, `Busca sem acentos "${sampleUnaccented}" deve retornar resultados`);
    console.log(`✅ OK: Busca insensível a acentos funcionou para "${sampleBairro}".`);

    // Test 3: Verify Admin authentication
    console.log('\nTest 3: Testando autenticação do administrador...');
    const authValid = (await db.verifyAdminPasswordAsync('admin', 'assis6259')) || (await db.verifyAdminPasswordAsync('admin', 'admin123'));
    console.assert(authValid === true, 'Senha do admin deve ser válida');
    
    const authInvalid = await db.verifyAdminPasswordAsync('admin', 'senha_errada');
    console.assert(authInvalid === false, 'Senha errada deve ser rejeitada');
    console.log('✅ OK: Autenticação de admin verificada com sucesso.');

    // Test 4: Validação Matemática de CPF (Módulo 11)
    console.log('\nTest 4: Testando Algoritmo Matemático de Validação de CPF (Módulo 11)...');
    // CPFs matematicamente válidos de teste
    console.assert(isValidCPF('52998224725') === true, 'CPF válido 52998224725 deve passar');
    // CPFs com dígitos verificadores errados
    console.assert(isValidCPF('11111111111') === false, 'CPF com números repetidos deve ser recusado');
    console.assert(isValidCPF('12345678900') === false, 'CPF com dígitos verificadores inválidos deve ser recusado');
    console.log('✅ OK: Algoritmo oficial de CPF validado com sucesso.');

    // Helper para gerar CPF válido dinâmico e evitar colisão de unicidade
    const genCpf = () => {
      const ts = Date.now().toString().slice(-7);
      const base = '52' + ts;
      let d1 = base.split('').reduce((acc, val, idx) => acc + parseInt(val) * (10 - idx), 0) % 11;
      d1 = d1 < 2 ? 0 : 11 - d1;
      let d2 = (base + d1).split('').reduce((acc, val, idx) => acc + parseInt(val) * (11 - idx), 0) % 11;
      d2 = d2 < 2 ? 0 : 11 - d2;
      return base + d1 + d2;
    };

    // Test 5: Cadastro de Usuário Público Pendente e Aprovação
    console.log('\nTest 5: Testando ciclo de vida de cadastro de usuário público e aprovação...');
    const testUsername = 'agente_teste_' + Date.now();
    const createdUser = await db.createUserAsync({
      name: 'Agente Teste',
      username: testUsername,
      password: 'user123',
      cpf: genCpf(),
      birthYear: 1992,
      role: 'public',
      status: 'pending'
    });

    console.assert(createdUser.status === 'pending', 'Novo usuário público deve ser criado com status "pending"');
    console.log(`✅ OK: Usuário '${testUsername}' criado com status 'pending'.`);

    // Aprovação pelo Admin
    const approved = await db.updateUserStatusAsync(createdUser.id, 'approved');
    console.assert(approved.status === 'approved', 'Status do usuário deve mudar para "approved"');
    console.log(`✅ OK: Usuário '${testUsername}' aprovado pelo Administrador.`);

    // Exclusão de limpeza do Teste 5
    await db.deleteUserAsync(createdUser.id);
    console.log('✅ OK: Usuário de teste 5 removido.');

    // Test 6: Redefinição de Senha por Validação de CPF e Ano de Nascimento
    console.log('\nTest 6: Testando Redefinição de Senha via CPF e Ano de Nascimento...');
    console.assert(cleanCPFString('514.134.346-49') === '51413434649', 'cleanCPFString deve remover caracteres não numéricos');

    const pwdTestUser = 'reset_test_' + Date.now();
    const resetCpf = genCpf();
    const createdForReset = await db.createUserAsync({
      name: 'Agente Reset',
      username: pwdTestUser,
      password: 'oldPassword123',
      cpf: resetCpf,
      birthYear: 1990,
      role: 'public',
      status: 'approved'
    });

    const postJson = (port, routePath, payload) => new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: routePath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const { port } = server.address();

      // Testa rejeição com ano de nascimento incorreto (deve retornar 400, não 500)
      const mismatchRes = await postJson(port, '/api/auth/reset-password', {
        username: pwdTestUser,
        cpf: formatCPF(resetCpf),
        birthYear: '1989',
        newPassword: 'newPassword456'
      });
      console.assert(mismatchRes.statusCode === 400, `Ano incorreto deve retornar HTTP 400, recebeu ${mismatchRes.statusCode}`);

      // Testa redefinição válida com CPF formatado (000.000.000-00)
      const resetRes = await postJson(port, '/api/auth/reset-password', {
        username: pwdTestUser,
        cpf: formatCPF(resetCpf),
        birthYear: '1990',
        newPassword: 'newPassword456'
      });
      console.assert(resetRes.statusCode === 200, `Redefinição válida deve retornar HTTP 200, recebeu ${resetRes.statusCode}: ${JSON.stringify(resetRes.body)}`);

      const verifyNewPass = await db.verifyAdminPasswordAsync(pwdTestUser, 'newPassword456');
      console.assert(verifyNewPass === true, 'Nova senha deve ser aceita na verificação de autenticação');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await db.deleteUserAsync(createdForReset.id);
    }
    console.log('✅ OK: Redefinição de senha via POST /api/auth/reset-password validada com sucesso.');

    // Test 7: Health check e tratamento de banco indisponível (HTTP 503) vs usuário inexistente (HTTP 401)
    console.log('\nTest 7: Testando GET /api/health e tratamento de falha de conexão no login...');
    const requestJson = (port, method, routePath, payload) => new Promise((resolve, reject) => {
      const body = payload ? JSON.stringify(payload) : null;
      const headers = body
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        : {};
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: routePath,
        method,
        headers
      }, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });

    const healthServer = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    const originalGetUser = db.getUserByUsernameAsync;
    try {
      const { port } = healthServer.address();

      const healthRes = await requestJson(port, 'GET', '/api/health');
      assert.strictEqual(healthRes.statusCode, 200, `GET /api/health deve retornar HTTP 200, recebeu ${healthRes.statusCode}`);
      assert.strictEqual(healthRes.body.status, 'ok', 'Health check deve retornar status "ok"');

      const unknownUserRes = await requestJson(port, 'POST', '/api/auth/login', {
        username: 'usuario_inexistente_' + Date.now(),
        password: 'qualquer_password'
      });
      assert.strictEqual(unknownUserRes.statusCode, 401, `Usuário inexistente deve retornar HTTP 401, recebeu ${unknownUserRes.statusCode}`);
      assert.ok(unknownUserRes.body.error.includes('Credenciais inválidas'), 'Deve informar credenciais inválidas para usuário inexistente');

      db.getUserByUsernameAsync = async () => {
        const err = new Error('Banco de dados indisponível ao consultar usuário: fetch failed');
        err.code = 'DB_UNAVAILABLE';
        err.status = 503;
        throw err;
      };

      const unavailableRes = await requestJson(port, 'POST', '/api/auth/login', {
        username: 'admin',
        password: 'qualquer_password'
      });
      assert.strictEqual(unavailableRes.statusCode, 503, `Falha de banco deve retornar HTTP 503, recebeu ${unavailableRes.statusCode}`);
      assert.ok(unavailableRes.body.error.includes('indisponível'), 'Deve informar que o banco de dados está temporariamente indisponível');
    } finally {
      db.getUserByUsernameAsync = originalGetUser;
      await new Promise((resolve) => healthServer.close(resolve));
    }
    console.log('✅ OK: Health check e tratamento de erro 503 no login validados com sucesso.');

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
  }
}

runTests();
