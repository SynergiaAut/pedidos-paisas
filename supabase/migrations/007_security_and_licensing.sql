-- 1. ENHANCE RBAC
-- Drop existing check constraint if possible, or just add new values via update (Postgres limitation with check constraints usually requires drop/add)
-- Safer approach: Drop constraint and re-add with new allowed values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'user', 'cashier', 'kitchen'));

-- 2. LICENSING SYSTEM
-- Table to store valid license keys and their binding to specific hardware
CREATE TABLE IF NOT EXISTS public.software_licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    license_key text NOT NULL UNIQUE,
    hardware_id text, -- Nullable initially, set upon activation
    client_name text NOT NULL, -- Who owns this license
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    activated_at timestamp with time zone,
    expires_at timestamp with time zone,
    last_check_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.software_licenses ENABLE ROW LEVEL SECURITY;

-- POLICIES for Licensing
-- 1. Read: Allow reading license info to validate (public for now to allow check before login, or constrained by anon key + funcs)
-- Ideally, we use a database function to check, but for PoC direct select is easier if we secure it.
-- Let's allow public read for the specific key they are checking
CREATE POLICY "Allow public read of licenses by key" ON public.software_licenses
    FOR SELECT USING (true); -- Refine later if needed to avoid scraping

-- 2. Activation: Allow updating hardware_id ONLY if it's currently null (First activation)
CREATE POLICY "Allow activation (bind hardware)" ON public.software_licenses
    FOR UPDATE
    USING (hardware_id IS NULL)
    WITH CHECK (hardware_id IS NOT NULL);

-- 3. Admin: Full access
-- (Assuming we have a way to identify admin, but for now Supabase dashboard users are admins)

-- 3. HELPER FUNCTION FOR ACTIVATION
-- It is safer to use a function to handle activation to ensure atomicity and logic
CREATE OR REPLACE FUNCTION public.activate_license(p_license_key text, p_hardware_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license public.software_licenses%ROWTYPE;
BEGIN
    -- Check if license exists
    SELECT * INTO v_license FROM public.software_licenses WHERE license_key = p_license_key;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'License key not found');
    END IF;

    -- Check status
    IF v_license.status != 'ACTIVE' THEN
        RETURN json_build_object('success', false, 'message', 'License is not active');
    END IF;

    -- Check if already activated
    IF v_license.hardware_id IS NOT NULL THEN
        -- Allow re-activation ONLY if hardware_id matches (Idempotency)
        IF v_license.hardware_id = p_hardware_id THEN
             RETURN json_build_object('success', true, 'message', 'License already active on this device');
        ELSE
             RETURN json_build_object('success', false, 'message', 'License already used on another device');
        END IF;
    END IF;

    -- Activate
    UPDATE public.software_licenses
    SET hardware_id = p_hardware_id,
        activated_at = now()
    WHERE id = v_license.id;

    RETURN json_build_object('success', true, 'message', 'Activation successful');
END;
$$;

-- Seed a Demo License for the PoC
INSERT INTO public.software_licenses (license_key, client_name)
VALUES ('POC-2026-GRANERO-PAISAS', 'Granero Los Paisas POC')
ON CONFLICT (license_key) DO NOTHING;
