ALTER TABLE "user_settings"
ADD COLUMN "sessionAudioDefaults" JSONB;

UPDATE "user_settings"
SET "sessionAudioDefaults" = jsonb_build_object(
  'focus', jsonb_build_object(
    'guidanceVoice', CASE WHEN "focusSessionAudio" = 'ambient' THEN 'female' ELSE 'none' END,
    'backgroundAudio', CASE WHEN "focusSessionAudio" = 'ambient' THEN 'ambient' ELSE 'off' END
  ),
  'deep_prime', jsonb_build_object(
    'guidanceVoice', CASE WHEN "primeSessionAudio" = 'ambient' THEN 'female' ELSE 'none' END,
    'backgroundAudio', CASE WHEN "primeSessionAudio" = 'ambient' THEN 'ambient' ELSE 'off' END
  )
)
WHERE "sessionAudioDefaults" IS NULL;

ALTER TABLE "user_settings"
ALTER COLUMN "sessionAudioDefaults" SET NOT NULL,
ALTER COLUMN "sessionAudioDefaults" SET DEFAULT
  '{"focus":{"guidanceVoice":"female","backgroundAudio":"ambient"},"deep_prime":{"guidanceVoice":"female","backgroundAudio":"ambient"}}'::jsonb;
