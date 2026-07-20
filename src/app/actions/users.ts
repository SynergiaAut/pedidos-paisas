"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import {
    getDefaultAccessForRole,
    isKnownUserRole,
    normalizeAccessModules,
    type AccessModule,
    type UserRole,
} from "@/lib/user-roles";
import { createClient } from "@/utils/supabase/server";

export interface ManagedUserProfile {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    is_active: boolean;
    app_permissions: AccessModule[];
    updated_at: string | null;
}

export interface UsersAdminState {
    users: ManagedUserProfile[];
    supportsGranularPermissions: boolean;
}

type ProfileRow = {
    id: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    app_permissions?: unknown;
    updated_at: string | null;
};

type ActionResult<T> =
    | { success: true; data: T; warning?: string }
    | { success: false; error: string };

async function assertAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error("Sesion no valida.");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || profile?.role !== "admin" || profile?.is_active === false) {
        throw new Error("No autorizado.");
    }

    return user.id;
}

export async function getManagedUsers(): Promise<ActionResult<UsersAdminState>> {
    try {
        await assertAdmin();

        let admin: ReturnType<typeof createAdminClient> | null = null;
        let emailsById = new Map<string, string | null>();

        try {
            admin = createAdminClient();
        } catch {
            admin = null;
        }

        const reader = admin ?? (await createClient());
        const { data, error } = await reader
            .from("profiles")
            .select("*")
            .order("updated_at", { ascending: false, nullsFirst: false });

        if (error) {
            throw error;
        }

        if (admin) {
            const { data: authData } = await admin.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
            });
            emailsById = new Map((authData?.users ?? []).map((user) => [user.id, user.email ?? null]));
        }

        return {
            success: true,
            data: {
                users: ((data ?? []) as ProfileRow[]).map((profile) => {
                const role = isKnownUserRole(profile.role) ? profile.role : "user";
                const storedPermissions = normalizeAccessModules(profile.app_permissions);

                return {
                    id: profile.id,
                    full_name: profile.full_name,
                    role: profile.role,
                    is_active: profile.is_active,
                    updated_at: profile.updated_at,
                    email: emailsById.get(profile.id) ?? null,
                    app_permissions: storedPermissions.length > 0 ? storedPermissions : getDefaultAccessForRole(role),
                };
                }),
                supportsGranularPermissions: (data ?? []).some((profile) =>
                    Object.prototype.hasOwnProperty.call(profile, "app_permissions")
                ),
            },
        };
    } catch (error) {
        const message = friendlyUserAdminError(getErrorMessage(error, "No se pudieron cargar los usuarios."));
        return { success: false, error: message };
    }
}

export async function createManagedUser(input: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    app_permissions?: AccessModule[];
}): Promise<ActionResult<ManagedUserProfile>> {
    try {
        await assertAdmin();

        const email = input.email.trim().toLowerCase();
        const fullName = input.full_name.trim();

        if (!email || !email.includes("@")) {
            throw new Error("Correo invalido.");
        }

        if (!fullName) {
            throw new Error("El nombre es obligatorio.");
        }

        if (!input.password || input.password.length < 6) {
            throw new Error("La contrasena temporal debe tener al menos 6 caracteres.");
        }

        if (!isKnownUserRole(input.role)) {
            throw new Error("Rol invalido.");
        }

        const permissions = normalizeAccessModules(input.app_permissions);
        const finalPermissions = permissions.length > 0 ? permissions : getDefaultAccessForRole(input.role);
        const admin = createAdminClient();

        const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
            },
        });

        if (authError || !authData.user) {
            throw authError ?? new Error("No se pudo crear el usuario.");
        }

        const profilePayload = {
            id: authData.user.id,
            full_name: fullName,
            role: input.role,
            is_active: true,
            app_permissions: finalPermissions,
            updated_at: new Date().toISOString(),
        };

        const { data: profile, error: profileError } = await admin
            .from("profiles")
            .upsert(profilePayload, { onConflict: "id" })
            .select("id, full_name, role, is_active, app_permissions, updated_at")
            .single();

        if (!profileError) {
            return {
                success: true,
                data: {
                    ...profile,
                    email,
                    app_permissions: normalizeAccessModules(profile.app_permissions),
                },
            };
        }

        if (!isSchemaCompatibilityError(profileError.message)) {
            throw profileError;
        }

        const fallbackProfile = await createLegacyCompatibleProfile(admin, {
            id: authData.user.id,
            fullName,
            requestedRole: input.role,
            email,
        });

        return {
            success: true,
            data: fallbackProfile,
            warning: "Usuario creado, pero la base aun no tiene la migracion 030. Quedo con perfil compatible; aplica 030 para guardar rol y accesos granulares.",
        };
    } catch (error) {
        const message = error instanceof Error ? friendlyUserAdminError(error.message) : "No se pudo crear el usuario.";
        return { success: false, error: message };
    }
}

export async function updateManagedUser(input: {
    id: string;
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
    app_permissions?: AccessModule[];
}): Promise<ActionResult<ManagedUserProfile>> {
    try {
        const currentAdminId = await assertAdmin();

        if (!input.id) {
            throw new Error("Usuario invalido.");
        }

        if (input.role && !isKnownUserRole(input.role)) {
            throw new Error("Rol invalido.");
        }

        if (input.id === currentAdminId && input.role && input.role !== "admin") {
            throw new Error("No puedes quitarte el rol administrador desde tu propia sesion.");
        }

        if (input.id === currentAdminId && input.is_active === false) {
            throw new Error("No puedes desactivar tu propia cuenta.");
        }

        const patch: Record<string, string | boolean | AccessModule[]> = {
            updated_at: new Date().toISOString(),
        };

        if (typeof input.full_name === "string") {
            patch.full_name = input.full_name.trim();
        }

        if (input.role) {
            patch.role = input.role;
        }

        if (typeof input.is_active === "boolean") {
            patch.is_active = input.is_active;
        }

        if (input.app_permissions) {
            patch.app_permissions = normalizeAccessModules(input.app_permissions);
        }

        const admin = createAdminClient();
        const { data, error } = await admin
            .from("profiles")
            .update(patch)
            .eq("id", input.id)
            .select("id, full_name, role, is_active, app_permissions, updated_at")
            .single();

        if (error) {
            if (input.app_permissions && isSchemaCompatibilityError(getErrorMessage(error, ""))) {
                throw new Error("Falta aplicar la migracion 030 para guardar accesos granulares.");
            }

            throw error;
        }

        const { data: authUser } = await admin.auth.admin.getUserById(input.id);

        return {
            success: true,
            data: {
                ...data,
                email: authUser.user?.email ?? null,
                app_permissions: normalizeAccessModules(data.app_permissions),
            },
        };
    } catch (error) {
        const message = friendlyUserAdminError(getErrorMessage(error, "No se pudo actualizar el usuario."));
        return { success: false, error: message };
    }
}

function friendlyUserAdminError(message: string) {
    if (message.toLowerCase().includes("app_permissions")) {
        return "Falta aplicar la migracion 030 para guardar accesos granulares.";
    }

    if (message.toLowerCase().includes("profiles_role_check")) {
        return "Falta aplicar la migracion 030 para usar roles operativos como pedidos, despacho, inventario o cuadre.";
    }

    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        return "Falta configurar SUPABASE_SERVICE_ROLE_KEY para crear usuarios desde administracion.";
    }

    if (message.toLowerCase().includes("already been registered") || message.toLowerCase().includes("already exists")) {
        return "Ese correo ya existe en autenticacion. Usa otro correo o edita el usuario existente.";
    }

    return message;
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;

    if (error && typeof error === "object") {
        const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
        return [maybeError.message, maybeError.details, maybeError.hint, maybeError.code]
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .join(" ");
    }

    return fallback;
}

function isSchemaCompatibilityError(message: string) {
    const normalized = message.toLowerCase();
    return normalized.includes("app_permissions") || normalized.includes("profiles_role_check");
}

async function createLegacyCompatibleProfile(
    admin: ReturnType<typeof createAdminClient>,
    input: {
        id: string;
        fullName: string;
        requestedRole: UserRole;
        email: string;
    }
): Promise<ManagedUserProfile> {
    const basePayload = {
        id: input.id,
        full_name: input.fullName,
        role: input.requestedRole,
        is_active: true,
        updated_at: new Date().toISOString(),
    };

    const { data: profileWithoutPermissions, error: roleError } = await admin
        .from("profiles")
        .upsert(basePayload, { onConflict: "id" })
        .select("id, full_name, role, is_active, updated_at")
        .single();

    if (!roleError) {
        return {
            ...profileWithoutPermissions,
            email: input.email,
            app_permissions: getDefaultAccessForRole(input.requestedRole),
        };
    }

    if (!roleError.message.toLowerCase().includes("profiles_role_check")) {
        throw roleError;
    }

    const { data: legacyProfile, error: legacyError } = await admin
        .from("profiles")
        .upsert({ ...basePayload, role: "user" }, { onConflict: "id" })
        .select("id, full_name, role, is_active, updated_at")
        .single();

    if (legacyError) {
        throw legacyError;
    }

    return {
        ...legacyProfile,
        email: input.email,
        app_permissions: getDefaultAccessForRole(input.requestedRole),
    };
}
