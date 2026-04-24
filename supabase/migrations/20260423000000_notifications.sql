alter table users
  add column if not exists notification_state jsonb default '{}'::jsonb,
  add column if not exists fcm_token text,
  add column if not exists apns_token text,
  add column if not exists notifications_enabled boolean default true;

create index if not exists idx_users_notifications_enabled
  on users (notifications_enabled);

select cron.schedule(
  'trigger-notifications-daily',
  '0 0 * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_PROJECT.functions.supabase.co/notifications/trigger-all',
      headers := jsonb_build_object(
        'authorization', 'Bearer ' || current_setting('app.service_role_key')
      )
    ) as request_id;
  $$
);
