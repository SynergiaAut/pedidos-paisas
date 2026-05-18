# ADR 001: Architecture & Stack Definition

## Status
Accepted

## Context
"Granero los Paisas" needs a high-speed order entry system ("Fast Order") to run parallel to their legacy invoicing software. The key constraints are speed (100+ orders/day), manual data transfer pain, and real-time coordination between order takers, dispatchers, and cashiers.

## Decision
We will run a **Next.js Web Application** optimized for desktop use.

### 1. Framework: Next.js 14 (App Router)
- **Why**: React ecosystem allows for rich UI components ("Magic Paste" logic). Next.js provides easy routing and API capabilities.
- **Hosting**: Vercel (recommended) or any Node.js server. Local network serving is also possible.

### 2. Database & Realtime: Supabase
- **Why**: The "Dispatch" view needs to update *instantly* without refreshing. Supabase provides Realtime subscriptions out of the box with PostgreSQL.
- **Auth**: We will use Supabase Auth for the 3 roles (Admin, Cajero, Despachador).

### 3. "Magic Paste" Pattern
- **Problem**: Users hate copying 5-6 fields manually from the invoice software.
- **Solution**: We will implement a smart regex parser. The user performs ONE copy (Ctrl+C) of the receipt text (or selects all text), and in our app presses a "Paste Invoice" button. The app parses:
    - Invoice Numbers (Format: F-12345)
    - Total Value (Format: $XX.XXX)
    - Client Name (Heuristic detection)

### 4. Styling: TailwindCSS
- **Why**: Rapid development of a "Premium" dark-mode aesthetic as requested.

## Consequences
- Requires a stable internet connection for Supabase (Realtime). If internet is spotty, we might need a local-first sync engine (like RxDB), but Supabase is chosen for simplicity initially.
