'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { PUBLIC_PATH_PREFIXES } from '@/lib/public-routes';

export function ConditionalTopBar() {
    const pathname = usePathname();

    // Si es una ruta pública, no renderizamos el TopBar interno
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));

    if (isPublic) {
        return null;
    }

    return <TopBar />;
}
