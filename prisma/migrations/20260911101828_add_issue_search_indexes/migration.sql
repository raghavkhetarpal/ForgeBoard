-- CreateIndex
CREATE INDEX "issues_project_id_created_at_idx" ON "issues"("project_id", "created_at" DESC);
