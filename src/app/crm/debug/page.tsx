'use client';

import { useEffect, useState } from 'react';
import { getClientSourceDistribution } from '@/app/actions/crm';
import { getDebugInfo } from '@/app/actions/debug';

export default function DebugPage() {
    const [distribution, setDistribution] = useState<any>(null);
    const [dbInfo, setDbInfo] = useState<any>(null);

    useEffect(() => {
        getClientSourceDistribution().then(setDistribution);
        getDebugInfo().then(setDbInfo);
    }, []);

    return (
        <div className="p-8 font-mono text-sm bg-black text-green-400 min-h-screen">
            <h1 className="text-xl font-bold mb-4">Debug: Client Source Distribution</h1>

            <div className="grid grid-cols-2 gap-8">
                <div>
                    <h2 className="text-lg font-bold text-white mb-2">Aggregated Data (Chart Source)</h2>
                    <pre className="bg-gray-900 p-4 rounded border border-gray-800 overflow-auto max-h-[500px]">
                        {JSON.stringify(distribution, null, 2)}
                    </pre>
                </div>

                <div>
                    <h2 className="text-lg font-bold text-white mb-2">Database Inspection (Triggers & Last Record)</h2>
                    <pre className="bg-gray-900 p-4 rounded border border-gray-800 overflow-auto max-h-[500px]">
                        {JSON.stringify(dbInfo, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}
