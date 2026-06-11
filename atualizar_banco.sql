-- Rode este comando no SQL Editor do seu Supabase para adicionar as novas colunas
-- que estão faltando e causando o erro 400.

ALTER TABLE public.reports_paracuru 
ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'Problema',
ADD COLUMN IF NOT EXISTS user_id uuid, -- ou text se você estiver salvando o id como texto
ADD COLUMN IF NOT EXISTS chat_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS responsavel text,
ADD COLUMN IF NOT EXISTS notas_internas text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS endereco text;

-- Remove a obrigatoriedade dos campos de foto e localização
-- pois os formulários rápidos (Dúvida/Feedback) não enviam esses dados.
ALTER TABLE public.reports_paracuru ALTER COLUMN photo DROP NOT NULL;
ALTER TABLE public.reports_paracuru ALTER COLUMN location_lat DROP NOT NULL;
ALTER TABLE public.reports_paracuru ALTER COLUMN location_lng DROP NOT NULL;


-- Crie também a tabela de responsáveis, caso ela não exista
CREATE TABLE IF NOT EXISTS public.responsaveis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  secretaria text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
