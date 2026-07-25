-- Preserve the practice events that would otherwise be removed by the
-- Anchor -> Activation/Charge cascade during a burn.
ALTER TABLE "burned_anchors"
ADD COLUMN "activation_history" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "charge_history" JSONB NOT NULL DEFAULT '[]';
