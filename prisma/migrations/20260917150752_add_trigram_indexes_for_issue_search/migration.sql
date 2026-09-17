-- Enable pg_trgm extension for fast ILIKE wildcard text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on issues(title) and issues(description)
CREATE INDEX IF NOT EXISTS "issues_title_trgm_idx" ON "issues" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "issues_description_trgm_idx" ON "issues" USING gin ("description" gin_trgm_ops);