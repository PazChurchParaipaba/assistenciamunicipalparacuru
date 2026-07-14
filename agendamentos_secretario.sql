-- Criação das tabelas para o Agendamento com o Secretário

-- 1. Tabela de Agendas (Dias de atendimento)
CREATE TABLE IF NOT EXISTS public.agendas_secretario (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data date NOT NULL,
  programacao text NOT NULL,
  vagas_totais integer NOT NULL DEFAULT 0,
  vagas_ocupadas integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Agendamentos (Cidadãos)
CREATE TABLE IF NOT EXISTS public.agendamentos_cidadao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id uuid REFERENCES public.agendas_secretario(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text DEFAULT 'Confirmado',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- UPDATE: Adicionando as novas colunas caso as tabelas já existam
ALTER TABLE public.agendas_secretario ADD COLUMN IF NOT EXISTS horarios text;
ALTER TABLE public.agendas_secretario ALTER COLUMN programacao DROP NOT NULL;

ALTER TABLE public.agendamentos_cidadao ADD COLUMN IF NOT EXISTS horario_escolhido text;
ALTER TABLE public.agendamentos_cidadao ADD COLUMN IF NOT EXISTS pauta text;

-- Configurando RLS (Row Level Security)

-- Agendas: Todos podem ver, mas só pode inserir/atualizar quem gerencia pelo painel (pode ser contornado no client-side para o MVP, ou configurar políticas restritas).
-- Como não temos auth nativo do Supabase configurado estritamente com roles para os admin de painel, permitiremos leitura para todos e edição para todos no BD, 
-- e a proteção será feita via client-side verificando o email de admin. Para produção, recomendaria RLS baseado em email/JWT.
ALTER TABLE public.agendas_secretario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de agendas para todos" ON public.agendas_secretario
  FOR SELECT USING (true);

CREATE POLICY "Permitir insercao/update em agendas" ON public.agendas_secretario
  FOR ALL USING (true);

ALTER TABLE public.agendamentos_cidadao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de agendamentos para todos" ON public.agendamentos_cidadao
  FOR SELECT USING (true);

CREATE POLICY "Permitir insercao em agendamentos" ON public.agendamentos_cidadao
  FOR INSERT WITH CHECK (true);
  
CREATE POLICY "Permitir update em agendamentos" ON public.agendamentos_cidadao
  FOR UPDATE USING (true);
