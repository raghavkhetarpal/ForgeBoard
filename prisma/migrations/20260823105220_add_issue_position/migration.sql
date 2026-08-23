-- DropIndex
DROP INDEX "issues_project_id_status_idx";

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill existing issues with sequential positions
WITH numbered_issues AS (
  SELECT id, row_number() OVER (PARTITION BY project_id, status ORDER BY created_at ASC) as row_num
  FROM "issues"
)
UPDATE "issues"
SET "position" = numbered_issues.row_num * 1024
FROM numbered_issues
WHERE "issues".id = numbered_issues.id;

-- CreateIndex
CREATE INDEX "issues_project_id_status_position_idx" ON "issues"("project_id", "status", "position");
