-- =============================================================================
-- 0003 — team_stage enum was missing 'pre-a'
--
-- lib/data/types.ts's TeamStage type has always included 'pre-a' (used by 2 of
-- the real 20 teams, whose stage in data/startups.json is "Pre-A"), but the
-- `team_stage` enum in schema.sql never did. Any project provisioned from
-- schema.sql before this file rejects those 2 teams' import with an invalid
-- enum value error. schema.sql itself is fixed going forward; run this against
-- a project that was already stood up from the old version.
--
-- `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction as a
-- statement that uses the new value, so this must be its own statement/run,
-- separate from whatever inserts the teams. It is otherwise safe to re-run —
-- `IF NOT EXISTS` makes a second run a no-op rather than an error.
-- =============================================================================

alter type team_stage add value if not exists 'pre-a';
