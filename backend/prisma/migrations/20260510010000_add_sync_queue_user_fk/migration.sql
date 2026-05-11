DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'sync_queue'
  ) THEN
    DELETE FROM "sync_queue"
    WHERE NOT EXISTS (
      SELECT 1 FROM "users" u WHERE u."id" = "sync_queue"."userId"
    );

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'sync_queue'
        AND constraint_name = 'sync_queue_userId_fkey'
    ) THEN
      ALTER TABLE "sync_queue"
      ADD CONSTRAINT "sync_queue_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
