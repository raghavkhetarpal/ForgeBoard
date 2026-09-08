-- CreateTable
CREATE TABLE "GithubIntegration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installedByUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "githubAccountLogin" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepository" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "githubRepoId" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubIntegration_projectId_key" ON "GithubIntegration"("projectId");

-- CreateIndex
CREATE INDEX "GithubIntegration_workspaceId_idx" ON "GithubIntegration"("workspaceId");

-- CreateIndex
CREATE INDEX "GithubIntegration_installedByUserId_idx" ON "GithubIntegration"("installedByUserId");

-- CreateIndex
CREATE INDEX "GithubRepository_integrationId_idx" ON "GithubRepository"("integrationId");

-- CreateIndex
CREATE INDEX "GithubRepository_projectId_idx" ON "GithubRepository"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepository_projectId_githubRepoId_key" ON "GithubRepository"("projectId", "githubRepoId");

-- AddForeignKey
ALTER TABLE "GithubIntegration" ADD CONSTRAINT "GithubIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIntegration" ADD CONSTRAINT "GithubIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIntegration" ADD CONSTRAINT "GithubIntegration_installedByUserId_fkey" FOREIGN KEY ("installedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepository" ADD CONSTRAINT "GithubRepository_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "GithubIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepository" ADD CONSTRAINT "GithubRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
