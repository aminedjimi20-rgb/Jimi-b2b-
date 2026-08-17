-- Jimi Renovation & Installation — Supabase schema
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS everywhere).
--
-- Row Level Security is enabled on every table with ZERO policies attached.
-- That means the public "anon" key can never read or write these tables —
-- only the server-side "service_role" key (used exclusively by our Next.js
-- API routes, never sent to the browser) can. This is what makes seller and
-- buyer private data actually private at the database level, not just
-- hidden in the UI.

create extension if not exists pgcrypto;

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  whatsapp text,
  email text,
  wilaya text,
  company text,
  created_at timestamptz not null default now()
);
alter table sellers enable row level security;

create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text not null,
  whatsapp text,
  email text,
  wilaya text,
  created_at timestamptz not null default now()
);
alter table buyers enable row level security;

-- Single unified lifecycle status for a machine listing:
-- draft | pending | published | rejected | reserved | sold
create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand text not null,
  model text not null,
  year int not null,
  tonnage numeric not null,
  drive text not null default 'hydraulique',
  category text not null default 'injection',
  status text not null default 'published',
  featured boolean not null default false,
  wilaya text default '',
  price numeric,
  price_on_request boolean not null default false,
  video_url text,
  video_thumbnail text,
  video_title text,
  photos jsonb not null default '[]'::jsonb,
  specs jsonb not null default '{}'::jsonb,
  description text not null default '',
  works_performed jsonb not null default '[]'::jsonb,
  defects jsonb not null default '[]'::jsonb,
  accessories jsonb not null default '[]'::jsonb,
  seller_id uuid references sellers(id) on delete set null,
  admin_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table machines enable row level security;
create index if not exists machines_status_idx on machines(status);
create index if not exists machines_seller_id_idx on machines(seller_id);

-- Buyer interest in one machine -> the deal pipeline Jimi manages manually.
create table if not exists machine_leads (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid,
  machine_slug text,
  machine_label text not null,
  seller_id uuid references sellers(id) on delete set null,
  buyer_id uuid not null references buyers(id) on delete cascade,
  message text default '',
  status text not null default 'new',
  commission_type text not null default 'percentage',
  commission_value numeric not null default 0,
  commission_expected_amount numeric,
  commission_status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table machine_leads enable row level security;
create index if not exists machine_leads_buyer_id_idx on machine_leads(buyer_id);
create index if not exists machine_leads_seller_id_idx on machine_leads(seller_id);

-- Generic inbox: buy / service / contact form submissions (not tied to one
-- specific machine listing -- unrelated to the machine_leads deal pipeline).
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'new',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table leads enable row level security;
