alter table users
  add column if not exists notification_state jsonb default '{}'::jsonb,
  add column if not exists fcm_token text,
  add column if not exists apns_token text,
  add column if not exists notifications_enabled boolean default true;

create index if not exists idx_users_notifications_enabled
  on users (notifications_enabled);

-- Replace <PROJECT_REF> with your Supabase project ref (visible in dashboard URL:
-- https://app.supabase.com/project/<PROJECT_REF>).
-- Verify the setting exists first: SELECT current_setting('app.service_role_key');
-- If not set, store the service role key in the Vault and use a helper function instead.
select cron.schedule(
  'trigger-notifications-daily',
  '0 0 * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/notifications/trigger-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
