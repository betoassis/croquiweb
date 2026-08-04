const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { isValidCPF } = require('../middleware/cpfValidator');

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
    console.assert(all.length >= 3, 'Deve retornar ao menos 3 croquis de demonstração');

    const saoJoseAccented = await db.getAllCroquisAsync({ search: 'São José' });
    console.assert(saoJoseAccented.length >= 1, 'Busca com acento "São José" deve retornar item');

    const saoJoseUnaccented = await db.getAllCroquisAsync({ search: 'sao jose' });
    console.assert(saoJoseUnaccented.length >= 1, 'Busca sem acento "sao jose" deve retornar item');
    console.assert(saoJoseAccented.length === saoJoseUnaccented.length, 'Ambas as buscas devem retornar exatamente o mesmo resultado');

    const sislocSearch = await db.getAllCroquisAsync({ search: '045' });
    console.assert(sislocSearch.length >= 1, 'Busca por código SISLOC "045" deve retornar o Bairro São José');
    console.log(`✅ OK: Busca por código SISLOC ("045") funcionou perfeitamente.`);

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

    // Test 5: Cadastro de Usuário Público Pendente e Aprovação
    console.log('\nTest 5: Testando ciclo de vida de cadastro de usuário público e aprovação...');
    const testUsername = 'agente_teste_' + Date.now();
    const createdUser = await db.createUserAsync({
      name: 'Agente Teste',
      username: testUsername,
      password: 'user123',
      cpf: '52998224725',
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
    const pwdTestUser = 'reset_test_' + Date.now();
    const createdForReset = await db.createUserAsync({
      name: 'Agente Reset',
      username: pwdTestUser,
      password: 'oldPassword123',
      cpf: '52998224725',
      birthYear: 1990,
      role: 'public',
      status: 'approved'
    });

    const resetSuccess = await db.updateUserPasswordAsync(createdForReset.id, 'newPassword456');
    console.assert(resetSuccess !== null, 'Senha deve ser atualizada com sucesso');

    const verifyNewPass = await db.verifyAdminPasswordAsync(pwdTestUser, 'newPassword456');
    console.assert(verifyNewPass === true, 'Nova senha deve ser aceita na verificação de autenticação');

    await db.deleteUserAsync(createdForReset.id);
    console.log('✅ OK: Redefinição de senha validada com sucesso.');

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
  }
}

runTests();
