-- Team Training: each module can be given to specific roles. roles = the roles (or 'all' for everyone) that must do the module;
-- null means "use the default from the session list" (team-training/sessions/index.json, the audience field).
alter table training_settings add column if not exists roles text[];
