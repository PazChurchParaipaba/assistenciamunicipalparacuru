-- Como a tabela já faz parte da publicação (erro 42710), 
-- o realtime já está ativado no seu banco!

-- PORÉM, para que o painel e o aplicativo consigam comparar o que mudou 
-- (por exemplo, saber se houve uma NOVA mensagem ou uma mudança de STATUS),
-- precisamos garantir que o Supabase envie os dados antigos ("old record")
-- junto com a notificação.

-- Rode este comando no SQL Editor para configurar a Identidade de Réplica para FULL:
ALTER TABLE public.reports_paracuru REPLICA IDENTITY FULL;
