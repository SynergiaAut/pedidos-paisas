export const USER_ROLES = [
    {
        value: "admin",
        label: "Administrador",
        shortLabel: "Admin",
        description: "Acceso completo al sistema, configuracion y usuarios.",
    },
    {
        value: "pedidos",
        label: "Pedidos",
        shortLabel: "Pedidos",
        description: "Toma pedidos, confirma facturas y gestiona clientes.",
    },
    {
        value: "despacho",
        label: "Despacho",
        shortLabel: "Despacho",
        description: "Coordina entregas, domiciliarios y estados operativos.",
    },
    {
        value: "inventario",
        label: "Inventario",
        shortLabel: "Inventario",
        description: "Consulta catalogo, conteos, descuadres y calidad de datos.",
    },
    {
        value: "cuadre",
        label: "Cuadre",
        shortLabel: "Cuadre",
        description: "Revisa cierres diarios, vendedores y caja operativa.",
    },
    {
        value: "analitica",
        label: "Analitica",
        shortLabel: "Analitica",
        description: "Consulta reportes, tendencias, margenes y KPIs.",
    },
    {
        value: "user",
        label: "Operacion general",
        shortLabel: "General",
        description: "Rol heredado para usuarios sin perfil operativo definido.",
    },
] as const;

export type UserRole = (typeof USER_ROLES)[number]["value"];

export const USER_ROLE_VALUES = USER_ROLES.map((role) => role.value);

export const ACCESS_MODULES = [
    {
        value: "pedidos",
        label: "Pedidos",
        description: "Mesa multi-pedido, captura y seguimiento operativo.",
    },
    {
        value: "despacho",
        label: "Despacho",
        description: "Gestion de domiciliarios, estados y entregas.",
    },
    {
        value: "crm",
        label: "CRM",
        description: "Clientes, datos de contacto y fidelizacion.",
    },
    {
        value: "inventario",
        label: "Inventario",
        description: "Catalogo, conteos, validacion y calidad de datos.",
    },
    {
        value: "cuadre",
        label: "Cuadre",
        description: "Cierre diario, vendedores, caja y conciliacion.",
    },
    {
        value: "analitica",
        label: "Analitica",
        description: "Dashboards, margenes, tendencias y reportes.",
    },
    {
        value: "admin",
        label: "Administracion",
        description: "Usuarios, perfiles y configuracion sensible.",
    },
] as const;

export type AccessModule = (typeof ACCESS_MODULES)[number]["value"];

export const ACCESS_MODULE_VALUES = ACCESS_MODULES.map((module) => module.value);

export const ROLE_DEFAULT_ACCESS: Record<UserRole, AccessModule[]> = {
    admin: ["pedidos", "despacho", "crm", "inventario", "cuadre", "analitica", "admin"],
    pedidos: ["pedidos", "crm"],
    despacho: ["despacho", "pedidos"],
    inventario: ["inventario"],
    cuadre: ["cuadre", "analitica"],
    analitica: ["analitica", "inventario", "cuadre"],
    user: ["pedidos"],
};

export function getRoleMeta(role: string | null | undefined) {
    return USER_ROLES.find((item) => item.value === role) ?? USER_ROLES[USER_ROLES.length - 1];
}

export function isKnownUserRole(role: string): role is UserRole {
    return USER_ROLE_VALUES.includes(role as UserRole);
}

export function normalizeAccessModules(value: unknown): AccessModule[] {
    if (!Array.isArray(value)) return [];

    return Array.from(
        new Set(
            value.filter((item): item is AccessModule =>
                typeof item === "string" && ACCESS_MODULE_VALUES.includes(item as AccessModule)
            )
        )
    );
}

export function getDefaultAccessForRole(role: UserRole): AccessModule[] {
    return ROLE_DEFAULT_ACCESS[role] ?? ROLE_DEFAULT_ACCESS.user;
}
