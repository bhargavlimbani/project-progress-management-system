-- Break-glass/owner accounts are hidden from every listing in the UI.
ALTER TABLE "User" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
