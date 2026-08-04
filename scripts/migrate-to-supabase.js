require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const DB_FILE = path.join(__dirname, '..', 'database', 'croquiweb.json');

async function migrate() {
  console.log('🚀 Iniciando script de migração/atualização para o Supabase...');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'croquis-pdfs';

  if (!supabaseUrl || !supabaseKey || !supabaseUrl.includes('supabase.co')) {
    console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou ANON_KEY) válidos devem estar definidos no arquivo .env!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Arquivo database/croquiweb.json não encontrado para migração.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(DB_FILE, 'utf8');
  const data = JSON.parse(rawData);

  // 1. Migrar/Atualizar Usuário Administrador
  const adminPassword = process.env.ADMIN_PASSWORD || 'assis6259';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const passwordHash = bcrypt.hashSync(adminPassword, 10);

  console.log(`👤 Atualizando usuário administrador ('${adminUsername}')...`);
  
  const adminPayload = {
    username: adminUsername,
    password_hash: passwordHash,
    name: 'Administrador ACE',
    role: 'admin',
    status: 'approved',
    updated_at: new Date().toISOString()
  };

  const { error: userError } = await supabase
    .from('users')
    .upsert(adminPayload, { onConflict: 'username' });

  if (userError) {
    console.warn('⚠️ Alerta ao migrar administrador:', userError.message);
  } else {
    console.log('✅ Usuário administrador migrado/atualizado com sucesso.');
  }

  // 2. Garantir que o Bucket de Storage exista no Supabase
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets && buckets.some(b => b.name === bucketName);
    if (!bucketExists) {
      console.log(`🪣 Criando bucket público de storage: "${bucketName}"...`);
      await supabase.storage.createBucket(bucketName, { public: true });
    }
  } catch (bucketErr) {
    console.warn('⚠️ Nota sobre checagem de Bucket:', bucketErr.message);
  }

  // 3. Migrar Croquis
  if (Array.isArray(data.croquis) && data.croquis.length > 0) {
    console.log(`📄 Migrando ${data.croquis.length} croquis para a tabela 'croquis'...`);

    for (const croqui of data.croquis) {
      let finalFilePath = croqui.filepath;

      if (croqui.filepath && !croqui.filepath.startsWith('http')) {
        const localFullPath = path.join(__dirname, '..', croqui.filepath);
        if (fs.existsSync(localFullPath)) {
          try {
            console.log(`  ⬆️ Fazendo upload do PDF para a nuvem: ${croqui.filename}...`);
            const fileBuffer = fs.readFileSync(localFullPath);
            const storagePath = `croquis/${croqui.id}-${croqui.filename}`;

            const { data: uploadResult, error: uploadErr } = await supabase.storage
              .from(bucketName)
              .upload(storagePath, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true
              });

            if (!uploadErr && uploadResult) {
              const { data: pubData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(storagePath);

              if (pubData && pubData.publicUrl) {
                finalFilePath = pubData.publicUrl;
              }
            }
          } catch (err) {
            console.warn(`  ⚠️ Erro no upload:`, err.message);
          }
        }
      }

      const croquiPayload = {
        id: croqui.id,
        bairro: croqui.bairro,
        sisloc: croqui.sisloc || '',
        regiao: croqui.regiao,
        quarteirao: croqui.quarteirao,
        observacoes: croqui.observacoes || '',
        filename: croqui.filename,
        filepath: finalFilePath,
        file_size: croqui.file_size || 0,
        views: croqui.views || 0,
        downloads: croqui.downloads || 0,
        created_at: croqui.created_at || new Date().toISOString(),
        updated_at: croqui.updated_at || new Date().toISOString()
      };

      const { error: insertErr } = await supabase
        .from('croquis')
        .upsert(croquiPayload, { onConflict: 'id' });

      if (insertErr) {
        console.error(`❌ Erro ao salvar croqui ID ${croqui.id}:`, insertErr.message);
      } else {
        console.log(`  ✅ Croqui ${croqui.bairro} (${croqui.sisloc || 'Sem SISLOC'}) salvo no banco de dados.`);
      }
    }
  }

  console.log('\n🎉 MIGRAÇÃO/ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!');
}

migrate().catch(err => {
  console.error('❌ Erro fatal durante a migração:', err);
  process.exit(1);
});
