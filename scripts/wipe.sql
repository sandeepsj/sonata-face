-- Wipe student-related data from a local database.
-- Keeps: courses, fee structures, the fee timeline, users and roles.
-- Clears: discounts, payments, derived dues (fee_due), waivers, rebuild jobs, sessions, students.
--
-- Run:
--   PGPASSWORD=sonata123 psql -h localhost -U sandeepsj -d sonata-local -f scripts/wipe.sql
--
-- The DO block introspects pg_tables so it tolerates name variations
-- (singular vs plural, snake_case spellings) without failing on missing tables.

BEGIN;

DO $$
DECLARE
    candidate_tables text[] := ARRAY[
        'discounts',
        'payments',
        'due_waiver',
        'fee_due',
        'dues_rebuild_job',
        'fee_dues_tracker',
        'student_sessions',
        'student'
    ];
    t text;
    found_table text;
BEGIN
    FOREACH t IN ARRAY candidate_tables LOOP
        SELECT tablename INTO found_table
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = t;

        IF found_table IS NOT NULL THEN
            RAISE NOTICE 'Truncating %', found_table;
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', found_table);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- After this runs, courses, fee structures, the timeline, users and roles remain untouched.
-- The seed script (scripts/seed.mjs) will repopulate the cleared tables.
