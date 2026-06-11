-- Rode este script no SQL Editor do seu Supabase para ativar 
-- as atualizações em tempo real (Realtime) na tabela de relatos.
-- Isso fará com que as mensagens de chat e atualizações de status
-- apareçam instantaneamente sem precisar recarregar a página!

BEGIN;
  -- Verifica se a publicação supabase_realtime existe, e adiciona a tabela
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reports_paracuru;
COMMIT;

-- Nota: Se der erro dizendo que a tabela "já faz parte da publicação", 
-- significa que o realtime já está ativado para ela e você não precisa se preocupar.
