require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'croquis-pdfs';

let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.includes('supabase.co')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    console.log('✅ Client Supabase inicializado com sucesso.');
  } catch (err) {
    console.warn('⚠️ Falha ao inicializar client Supabase:', err.message);
  }
} else {
  console.log('ℹ️ Supabase não configurado ou credenciais ausentes. Operando em modo de Fallback Local JSON.');
}

/**
 * Utilitário para verificar se o Supabase está ativo e configurado
 */
function isSupabaseConfigured() {
  return supabase !== null;
}

/**
 * Upload de PDF para o Supabase Storage Bucket
 * @param {string} storagePath - Caminho de destino no Bucket (ex: 'centro/croqui-q01.pdf')
 * @param {Buffer} fileBuffer - Conteúdo binário do arquivo
 * @param {string} mimeType - Content type (application/pdf)
 */
async function uploadPdfToStorage(storagePath, fileBuffer, mimeType = 'application/pdf') {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase Storage não está configurado.');
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    console.error('Erro ao enviar arquivo para o Supabase Storage:', error);
    throw error;
  }

  // Obter URL pública do arquivo armazenado
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  return {
    path: data.path,
    publicUrl: publicUrlData ? publicUrlData.publicUrl : ''
  };
}

/**
 * Exclusão de PDF do Supabase Storage Bucket
 * @param {string} storagePath 
 */
async function deletePdfFromStorage(storagePath) {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([storagePath]);

  if (error) {
    console.error('Erro ao remover arquivo do Supabase Storage:', error);
  }
}

module.exports = {
  supabase,
  isSupabaseConfigured,
  uploadPdfToStorage,
  deletePdfFromStorage,
  bucketName
};
