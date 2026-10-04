-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "used_by" TEXT,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_hash_key" ON "Invite"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_used_by_key" ON "Invite"("used_by");

-- CreateIndex
CREATE INDEX "Invite_created_by_idx" ON "Invite"("created_by");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restrict invite roles to privileged roles only
ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_role_check"
CHECK ("role" IN ('TEACHER', 'ADMIN'));