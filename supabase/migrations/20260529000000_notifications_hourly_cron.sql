-- Switch the notification cron from daily-UTC to hourly so the per-user
-- local-hour gate (isAllowedSendHour in trigger-all.ts) actually fires for
-- every user timezone. The function skips rows whose local hour != active_hours_end,
-- so running once per hour is safe and idempotent.
select cron.unschedule('trigger-notifications-daily');

select cron.schedule(
  'trigger-notifications-hourly',
  '0 * * * *',
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
