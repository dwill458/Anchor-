alter table users
  add column if not exists notification_state jsonb default '{}'::jsonb,
  add column if not exists fcm_token text,
  add column if not exists apns_token text,
  add column if not exists notifications_enabled boolean default true;

create index if not exists idx_users_notifications_enabled
  on users (notifications_enabled);

-- Store the project URL and service role key in Vault before running the cron job:
--   select vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
--   select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');
--
-- This avoids hard-coding a placeholder project ref in the migration and
-- matches the current Supabase scheduled-function pattern.
select cron.schedule(
  'trigger-notifications-daily',
  '0 0 * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
      ) || '/functions/v1/notifications/trigger-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
