-- 1. Adiciona a coluna perfil na tabela servidores (se ela não existir)
-- Define o valor padrão como 'admin' para não quebrar o acesso dos gestores atuais
ALTER TABLE public.servidores 
ADD COLUMN IF NOT EXISTS perfil text DEFAULT 'admin';

-- 2. Adiciona a coluna tecnico_id na tabela de chamados (reports_paracuru)
-- Isso vai armazenar qual técnico foi atribuído para o chamado
ALTER TABLE public.reports_paracuru
ADD COLUMN IF NOT EXISTS tecnico_id uuid REFERENCES public.servidores(id);

-- Opcional: Criar um índice para deixar a busca mais rápida quando o técnico abrir o app dele
CREATE INDEX IF NOT EXISTS idx_reports_paracuru_tecnico ON public.reports_paracuru(tecnico_id);
