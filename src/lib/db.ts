import { Pool } from 'pg';

// Create a connection pool for better performance
let pool: Pool | null = null;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
    return pool;
}

export async function query(text: string, params?: any[]) {
    const pool = getPool();
    const result = await pool.query(text, params);
    return result;
}

export async function getClient() {
    const pool = getPool();
    return await pool.connect();
}
