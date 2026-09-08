-- CreateTable
CREATE TABLE "issue_pull_requests" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "github_repository_id" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_status" TEXT NOT NULL,
    "pr_url" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "github_delivery_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_pull_requests_github_repository_id_pr_number_idx" ON "issue_pull_requests"("github_repository_id", "pr_number");

-- CreateIndex
CREATE UNIQUE INDEX "issue_pull_requests_issue_id_github_repository_id_pr_number_key" ON "issue_pull_requests"("issue_id", "github_repository_id", "pr_number");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_github_delivery_id_key" ON "webhook_deliveries"("github_delivery_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_received_at_idx" ON "webhook_deliveries"("received_at");

-- AddForeignKey
ALTER TABLE "issue_pull_requests" ADD CONSTRAINT "issue_pull_requests_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_pull_requests" ADD CONSTRAINT "issue_pull_requests_github_repository_id_fkey" FOREIGN KEY ("github_repository_id") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
