CREATE TABLE "vision_notes" (
    "id" TEXT NOT NULL,
    "vision_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_request_id" UUID NOT NULL,
    "text" VARCHAR(200) NOT NULL,
    "style_id" VARCHAR(64) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL,
    "layer_order" INTEGER NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vision_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vision_notes_geometry_bounds_check" CHECK (
      "x" >= (abs("width" * "scale" * cos(radians("rotation"))) + abs("height" * 2.65 * "scale" * sin(radians("rotation")))) / 2
      AND "x" <= 1 - (abs("width" * "scale" * cos(radians("rotation"))) + abs("height" * 2.65 * "scale" * sin(radians("rotation")))) / 2
      AND "y" >= (abs("height" * "scale" * cos(radians("rotation"))) + abs("width" / 0.45 * "scale" * sin(radians("rotation")))) / 2
      AND "y" <= 1 - (abs("height" * "scale" * cos(radians("rotation"))) + abs("width" / 0.45 * "scale" * sin(radians("rotation")))) / 2
    )
);

CREATE UNIQUE INDEX "vision_notes_vision_id_client_request_id_key"
  ON "vision_notes"("vision_id", "client_request_id");
CREATE INDEX "vision_notes_vision_id_is_archived_layer_order_idx"
  ON "vision_notes"("vision_id", "is_archived", "layer_order");
CREATE INDEX "vision_notes_user_id_vision_id_idx"
  ON "vision_notes"("user_id", "vision_id");

ALTER TABLE "vision_notes" ADD CONSTRAINT "vision_notes_vision_id_fkey"
  FOREIGN KEY ("vision_id") REFERENCES "visions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_notes" ADD CONSTRAINT "vision_notes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
