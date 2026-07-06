-- Migration: sistema de importação global e atribuição automática de comercial
-- Data: 2026-07-06
--
-- 1) Adiciona a coluna canônica `comercial_id` (responsável comercial pelo lead).
--    Começa NULL (lead fica no Backlog disponível para toda a equipe) e é
--    preenchida automaticamente na primeira movimentação do Backlog.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS comercial_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2) Backfill: migra dados existentes de `assigned_to` para `comercial_id`
--    (mantém compatibilidade com leads já atribuídos antes desta mudança).
UPDATE leads
  SET comercial_id = assigned_to
  WHERE assigned_to IS NOT NULL
    AND comercial_id IS NULL;

-- 3) Índice para filtros por comercial (dashboards, relatórios, comissões).
CREATE INDEX IF NOT EXISTS idx_leads_comercial_id ON leads(comercial_id);

-- 4) Estende a constraint de action_type em activity_logs para permitir os
--    novos eventos de auditoria da atribuição de comercial.
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_type_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_type_check
  CHECK (action_type IN (
    'create', 'update', 'delete', 'move',
    'atribuicao_automatica', 'alteracao_comercial'
  ));
