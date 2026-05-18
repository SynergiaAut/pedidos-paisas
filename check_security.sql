SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies
WHERE
    tablename = 'clients';

SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM
    information_schema.triggers
WHERE
    event_object_table = 'clients';

SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'source';
