-- Grupo "Apenas mata-mata": quando ligado, o bolão só conta os jogos da fase
-- eliminatória (ignora "Group Stage"). Útil pra quem cria o grupo já com a
-- fase de grupos da Copa em andamento/encerrada e quer começar do zero no KO.
--
-- Rodar manual no SQL Editor (deploy de código NÃO roda migração).

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS apenas_mata_mata boolean NOT NULL DEFAULT false;
