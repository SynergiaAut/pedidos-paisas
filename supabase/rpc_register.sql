-- Function: register_new_client
-- Purpose: Bypasses RLS and formatting logic on the client side, running safely on the server.
CREATE OR REPLACE FUNCTION register_new_client(
        p_first_name text,
        p_last_name text,
        p_phone text,
        p_document_id text,
        p_address text
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER -- <--- THE MAGIC: Runs with Admin privileges!
    AS $$
DECLARE new_id uuid;
BEGIN -- Check if phone already exists manually to give nice error
IF EXISTS (
    SELECT 1
    FROM public.clients
    WHERE phone = p_phone
) THEN RETURN json_build_object(
    'success',
    false,
    'message',
    'Este número ya está registrado.'
);
END IF;
INSERT INTO public.clients (
        first_name,
        last_name,
        full_name,
        phone,
        document_id,
        address
    )
VALUES (
        UPPER(p_first_name),
        UPPER(p_last_name),
        UPPER(TRIM(p_first_name || ' ' || p_last_name)),
        p_phone,
        p_document_id,
        UPPER(p_address)
    )
RETURNING id INTO new_id;
RETURN json_build_object('success', true, 'id', new_id);
EXCEPTION
WHEN OTHERS THEN RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;
-- Critical: Allow public access to this function
GRANT EXECUTE ON FUNCTION register_new_client TO anon,
    authenticated;