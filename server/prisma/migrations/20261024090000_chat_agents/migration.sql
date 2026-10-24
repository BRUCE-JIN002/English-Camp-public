CREATE TABLE "ChatAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatAgent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatAgent_userId_role_key" ON "ChatAgent"("userId", "role");
ALTER TABLE "ChatAgent" ADD CONSTRAINT "ChatAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
