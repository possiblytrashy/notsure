-- ============================================================================
-- OUSTED — Required Supabase Database Migrations
-- Run these in your Supabase SQL Editor
-- ============================================================================

-- 1. WEBHOOK IDEMPOTENCY LOG
create table if not exists webhook_log (
  id uuid default gen_random_uuid() primary key,
  reference text unique not null,
  event_type text,
  amount numeric,
  status text default 'processing',
  result_summary text,
  error_message text,
  duration_ms int,
  raw_payload text,
  processed_at timestamptz default now()
);
create index if not exists idx_webhook_log_reference on webhook_log(reference);

-- 2. WAITLIST TABLE
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  tier_id uuid references ticket_tiers(id) on delete cascade,
  email text not null,
  name text,
  position int not null,
  notified_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_waitlist_event on waitlist(event_id, tier_id);
create index if not exists idx_waitlist_email on waitlist(email);

-- 3. VOTE TRANSACTIONS LOG
create table if not exists vote_transactions (
  id uuid default gen_random_uuid() primary key,
  reference text unique not null,
  candidate_id uuid,
  contest_id uuid,
  competition_id uuid,
  voter_email text,
  vote_count int not null default 0,
  amount_paid numeric,
  created_at timestamptz default now()
);

-- 4. ADD COLUMNS TO EXISTING TABLES (if not already present)
alter table tickets add column if not exists tier_name text;
alter table tickets add column if not exists base_amount numeric;
alter table tickets add column if not exists is_reseller_purchase boolean default false;
alter table events add column if not exists tickets_sold int default 0;

-- 5. ENABLE ROW-LEVEL SECURITY (RLS) — CRITICAL FOR SECURITY
alter table tickets enable row level security;
alter table events enable row level security;
alter table ticket_tiers enable row level security;

-- Allow public read for events
create policy if not exists "events_public_read" on events
  for select using (is_deleted = false);

-- Allow public read for ticket_tiers
create policy if not exists "tiers_public_read" on ticket_tiers
  for select using (true);

-- Only service role can write tickets (via API)
create policy if not exists "tickets_service_role_insert" on tickets
  for insert with check (auth.role() = 'service_role');

-- Users can view their own tickets
create policy if not exists "tickets_owner_read" on tickets
  for select using (guest_email = auth.email() or auth.role() = 'service_role');

-- 6. ATOMIC VOTE INCREMENT FUNCTION
create or replace function increment_vote_count(p_candidate_id uuid, p_vote_increment int)
returns void language plpgsql security definer as $$
begin
  update candidates
  set vote_count = vote_count + p_vote_increment
  where id = p_candidate_id;
end;
$$;

-- 7. RESELLER CLICK TRACKING (already exists in your schema, ensure it's atomic)
create or replace function increment_reseller_clicks(link_id uuid)
returns void language plpgsql security definer as $$
begin
  update event_resellers
  set click_count = coalesce(click_count, 0) + 1
  where id = link_id;
end;
$$;

-- 8. INDEX OPTIMIZATIONS
create index if not exists idx_tickets_event on tickets(event_id);
create index if not exists idx_tickets_reference on tickets(reference);
create index if not exists idx_tickets_email on tickets(guest_email);
create index if not exists idx_tickets_status on tickets(status);
create index if not exists idx_events_deleted on events(is_deleted, date);
create index if not exists idx_tiers_event on ticket_tiers(event_id);

-- ============================================================================
-- NOTES:
-- • Enable Supabase Realtime for: events, tickets, candidates
-- • Storage buckets needed: event-images, event-assets, competition-images
-- • Set PAYSTACK_SECRET_KEY and NEXT_PUBLIC_BASE_URL in Vercel env vars
-- ============================================================================
