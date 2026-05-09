-- Wipe student-related data from sonata-local.
-- Keeps: courses, fee_structures, users (auth), and any other reference tables.
-- Clears: payments, fee_dues_tracker, student_sessions, students, plus any join tables.
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
        'payment_discount', 'payment_discounts',
        'payment', 'payments',
        'fee_dues_tracker', 'fee_dues',
        'student_session', 'student_sessions',
        'student', 'students'
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

-- After this runs, courses + fee_structures + users remain untouched.
-- The seed script (scripts/seed.mjs) will repopulate the cleared tables.
