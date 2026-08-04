-- ============================================================
-- SCHEMAS & DATABASE STRUCTURE - CROQUI WEB (SUPABASE POSTGRESQL)
-- ============================================================

-- 1. Habilitar extensões necessárias (Busca insensível a acentos)
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Usuários e Níveis de Acesso / Permissões
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  birth_year INT,
  role VARCHAR(30) NOT NULL DEFAULT 'public', -- 'admin', 'public'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'approved', 'pending', 'rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Suporte a migração em tabelas existentes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cpf VARCHAR(14) UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_year INT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'public';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Seed Administrador Inicial (Aprovado automaticamente)
INSERT INTO public.users (username, password_hash, name, role, status)
VALUES (
  'admin',
  '$2a$10$7R0Z4G2hN4qD8YpM9W1X4uK3.z.l6E4c.eH0/K4oX2l/9vE4o4c3S', -- hash para admin123
  'Administrador ACE',
  'admin',
  'approved'
)
ON CONFLICT (username) DO UPDATE SET role = 'admin', status = 'approved';

-- 3. Tabela de Croquis de Quarteirões (ACE)
CREATE TABLE IF NOT EXISTS public.croquis (
  id VARCHAR(100) PRIMARY KEY,
  bairro VARCHAR(150) NOT NULL,
  sisloc VARCHAR(50) DEFAULT '',
  regiao VARCHAR(100) NOT NULL,
  quarteirao VARCHAR(100) NOT NULL,
  observacoes TEXT DEFAULT '',
  filename VARCHAR(255) NOT NULL,
  filepath TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  views INT DEFAULT 0,
  downloads INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Índices para Otimização de Performance
CREATE INDEX IF NOT EXISTS idx_croquis_bairro ON public.croquis USING btree (LOWER(bairro));
CREATE INDEX IF NOT EXISTS idx_croquis_regiao ON public.croquis USING btree (LOWER(regiao));
CREATE INDEX IF NOT EXISTS idx_croquis_sisloc ON public.croquis USING btree (LOWER(sisloc));
CREATE INDEX IF NOT EXISTS idx_croquis_quarteirao ON public.croquis USING btree (LOWER(quarteirao));
CREATE INDEX IF NOT EXISTS idx_croquis_updated_at ON public.croquis (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users (status);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users (cpf);

-- 5. Trigger para atualização automática de updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_croquis_updated_at ON public.croquis;
CREATE TRIGGER set_croquis_updated_at
BEFORE UPDATE ON public.croquis
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- 6. Row Level Security (RLS) Policies
ALTER TABLE public.croquis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público para Leitura de Croquis
DROP POLICY IF EXISTS "Croquis públicos para leitura" ON public.croquis;
CREATE POLICY "Croquis públicos para leitura" 
  ON public.croquis FOR SELECT 
  USING (true);

-- Permissão total para chave de serviço (service_role)
DROP POLICY IF EXISTS "Service Role total acesso croquis" ON public.croquis;
CREATE POLICY "Service Role total acesso croquis" 
  ON public.croquis FOR ALL 
  USING (true);

DROP POLICY IF EXISTS "Service Role total acesso users" ON public.users;
CREATE POLICY "Service Role total acesso users" 
  ON public.users FOR ALL 
  USING (true);
