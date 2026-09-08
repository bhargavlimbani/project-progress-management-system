-- Direct (one-to-one) chat alongside the existing per-project group threads.
CREATE TYPE "ConversationType" AS ENUM ('PROJECT', 'DIRECT');

ALTER TABLE "Conversation"
  ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'PROJECT';

-- DIRECT threads belong to no project, so the link becomes optional.
ALTER TABLE "Conversation" ALTER COLUMN "projectId" DROP NOT NULL;
