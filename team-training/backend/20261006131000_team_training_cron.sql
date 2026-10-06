-- Every morning at 07:00 UTC (08:00 in summer, 07:00 in winter) ask training-api to email anyone whose training is overdue.
-- The function does nothing if the "automatic reminders" switch in the Training record settings is off, and never emails
-- the same person more than once a week. Run AFTER 20261006130000_team_training.sql and after deploying training-api.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'training-overdue-reminders',
  '0 7 * * *',
  $$
  select net.http_post(
    url     := 'https://safcrtrfdzsnftghibot.supabase.co/functions/v1/training-api',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{"action":"cron.reminders"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
