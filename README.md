# 3i Logistics — ERP + WMS

A production-grade, multi-client **ERP + Warehouse Management System** for **3i Logistics Pvt. Ltd.** (3PL partner of Whirlpool Bangladesh), serving **Whirlpool, Robi, Godrej and 3i Internal** operations with strict client-wise data isolation, dynamic RBAC, audit trails, PDF generation, attachment management, PWA support and a responsive SAP Fiori Horizon–inspired interface using Whirlpool Bangladesh branding.

This repository is the **foundation build**: complete backend (database, security, business logic), the full design system, authentication + RBAC + app shell, and **two fully working reference modules — Masters and Inventory** — that establish the exact pattern for the remaining modules.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite 6 · TypeScript |
| State | Zustand |
| Backend | Supabase (PostgreSQL 17, Auth, Storage, Row-Level Security) |
| Forms / validation | React Hook Form |
| Icons | Google Material Symbols |
| Charts | Recharts |
| PDF | @react-pdf/renderer |
| Attachments | Supabase Storage (+ Google Drive field support) |
| PWA | vite-plugin-pwa (offline shell, installable) |
| Deployment | Vercel |

---

## Live backend

A Supabase project has already been provisioned and fully migrated:

- **Project:** `3i-ERP-WMS`  · ref `kstwbkwbsozaboceksmy`
- **Region:** Singapore (ap-southeast-1) — lowest latency for Bangladesh
- **API URL:** `https://kstwbkwbsozaboceksmy.supabase.co`

### Demo login (platform admin — sees all clients)

```
Email:    admin@3ilogistics.com
Password: Admin@123
```

> Change this password before any real use, and create per-client users from **HR & Administration → User Management**.

---

## Getting started

```bash
# 1. install
npm install

# 2. configure environment
cp .env.example .env       # values for the provisioned project are pre-filled

# 3. run
npm run dev                # http://localhost:5173

# 4. production build
npm run build && npm run preview
```

### Environment variables (`.env`)

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
# optional Google Drive attachment integration
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_API_KEY=
VITE_GOOGLE_DRIVE_FOLDER_ID=
```

---

## What is implemented

### Backend (100%)
- **Multi-tenant core** — `clients` (Whirlpool, Robi, Godrej, 3i Internal), `profiles`, `user_clients`, with a client switcher in the UI.
- **Dynamic RBAC** — `roles`, `permissions` (75 module.action permissions), `role_permissions`, `user_roles` (optionally client-scoped). Five seeded roles.
- **Strict client-wise isolation** — Row-Level Security on every business table via `app.has_client_access()`. Platform admins transparently see all clients.
- **Audit trail** — a generic `audit_logs` table fed by an `app.audit_trigger()` attached to every master/transaction table (INSERT/UPDATE/DELETE with before/after JSON + actor).
- **Auto document numbering** — client-wise, atomic `app.next_document_number()` → e.g. `WHP-GRN-2026-00001`, with yearly reset. Sequences seeded for 15 document types × 4 clients.
- **Atomic stock movements** — `app.post_stock_movement()` updates on-hand stock **and** writes the immutable ledger in a single transaction, with negative-stock protection.
- **Inventory model** — `inventory_stock` (good/damaged/quarantine), `inventory_ledger`, `serial_numbers` (warranty tracking), `inventory_snapshots`.
- **Masters** — products (SAP material code, serial/warranty flags, re-stock level), customers (+ multi-address), suppliers, transport vendors (+ multi-vehicle), warehouses, locations (zone/rack/bin), assets, non-inventory items.
- **Attachments & notes** — generic, entity-agnostic tables; Supabase Storage bucket `media` + Google Drive reference columns.

### Frontend
- **SAP Horizon + Whirlpool design system** — Whirlpool blue (`#0033A0`) primary scale + Horizon semantic tokens, Material Symbols, custom Tailwind theme, reusable UI kit (Button, Field, Select, Card, Badge, Tabs, Modal, DataTable, Toaster, states).
- **Auth + RBAC shell** — login, session/profile/permission loading, client switcher, permission-gated routes and nav, responsive collapsible sidebar (all **12 modules**), global cross-module search (Ctrl/⌘-K), profile menu.
- **Masters module (working)** — config-driven; all 8 masters share List / Card / Profile views with attachments, notes, activity timeline, image upload, and RHF-validated create/edit. Transport vendor profiles include multi-vehicle management.
- **Inventory module (working)** — tabs: Dashboard (KPIs + charts), Stock, Ledger, Snapshot, Serial Tracking, Damaged, Quarantine. Includes the **Post Stock Movement** action (calls the atomic DB function), low-stock alerts, and **PDF export**.
- **Dashboard** — live KPIs, top-products bar chart, stock-by-condition donut, recent movements.
- The other **10 modules** (Inbound, Outbound, Reverse Logistics, Transport, Asset, Finance, HR, Reports, Settings) are scaffolded with their real tab structure, ready to be wired using the Masters/Inventory pattern.

---

## Project structure

```
src/
  components/
    ui/         design-system primitives (Button, Field, Card, DataTable, …)
    layout/     AppShell, Sidebar, Topbar, GlobalSearch, RequirePermission
    shared/     PageHeader, SearchBar
  features/
    auth/       LoginPage
    dashboard/  DashboardPage
    masters/    registry.ts (config) + List/Card/Profile/Form/Panels
    inventory/  tabs + StockAdjustModal
    placeholder/ ModulePlaceholder (the 10 pending modules)
  hooks/        useCollection, useDocNumber, useTimeline
  lib/          supabase client, constants (12-module nav), utils
  pdf/          StockReportPDF (@react-pdf/renderer)
  store/        auth (Zustand), ui (toasts/sidebar)
  types/        database.types.ts (generated from Supabase)
```

---

## Business rules enforced

- Whirlpool products carry **SAP material / reference codes** as the primary identifier; barcodes link to them.
- **Serial-tracked** and **warranty** products are modelled for GRN/transfer/delivery/return/exchange/replacement flows.
- **Document numbers** are auto-generated, atomic and **client-wise**.
- **All stock movements** update inventory through a single DB transaction (ledger + on-hand).
- The **ledger is immutable** (insert-only) — the basis for "posted documents cannot be edited".
- **Every change is audited.**
- **Global search** spans modules; **PDF generation** is always available on stock views.

---

## Adding a new module (the pattern)

1. Add tables + RLS + audit/`updated_at` triggers (mirror migration `03_masters`).
2. For master-style data, add a config entry to `src/features/masters/registry.ts` — you get List/Card/Profile/Form for free.
3. For document-style flows (PO, GRN, SO…), use `app.next_document_number()` on create and `app.post_stock_movement()` on post.
4. Gate the route/nav with the relevant `permission` key.

---

## Deployment (Cloudflare Pages)

Connect the repo in **Cloudflare Pages** with:

- **Framework preset:** Vite (or None)
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** set the two `VITE_SUPABASE_*` values (and any optional `VITE_GOOGLE_*` keys) for both Production and Preview.

`public/_redirects` provides the SPA fallback (`/* → /index.html 200`) so client-side routes resolve on direct load/refresh, and `public/_headers` sets asset caching + baseline security headers. Both are copied to the `dist` root at build time.

---

## Security notes / follow-ups

- **Enable leaked-password protection** in Supabase → Auth → Policies (HaveIBeenPwned check).
- Rotate the demo admin password and the anon key for production.
- Database security advisors are otherwise clean (RLS enabled on all tables, no mutable function search paths).

See `ARCHITECTURE.md` for the data model, RLS strategy and core SQL functions.
