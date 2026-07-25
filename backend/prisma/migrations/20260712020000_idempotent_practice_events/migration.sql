ALTER TABLE "activations" ADD COLUMN "client_event_id" TEXT;
ALTER TABLE "charges" ADD COLUMN "client_event_id" TEXT;

CREATE UNIQUE INDEX "activations_user_id_client_event_id_key"
ON "activations"("userId", "client_event_id");

CREATE UNIQUE INDEX "charges_user_id_client_event_id_key"
ON "charges"("userId", "client_event_id");
