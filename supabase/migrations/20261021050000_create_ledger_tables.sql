-- 가계부 내역
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text not null check (char_length(category) between 1 and 50),
  amount bigint not null check (amount > 0 and amount <= 999999999999),
  memo text not null default '' check (char_length(memo) <= 500),
  created_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions (user_id, date);

-- 월 예산·저금 계획 설정 (사용자당 1행)
create table public.ledger_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  budget bigint not null default 0 check (budget >= 0 and budget <= 999999999999),
  savings_goal bigint not null default 0 check (savings_goal >= 0 and savings_goal <= 999999999999),
  interest_rate numeric not null default 0 check (interest_rate >= 0 and interest_rate <= 100),
  months integer not null default 12 check (months between 1 and 600),
  interest_type text not null default 'simple' check (interest_type in ('simple', 'compound')),
  updated_at timestamptz not null default now()
);

-- 날짜별 날씨 기록
create table public.daily_weather (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  sky text check (sky in ('sunny', 'cloudy', 'overcast', 'rain', 'snow', 'fog', 'thunder')),
  temp numeric(4, 1) check (temp between -60 and 60),
  primary key (user_id, date)
);

alter table public.transactions enable row level security;
alter table public.ledger_settings enable row level security;
alter table public.daily_weather enable row level security;

create policy "own rows: select" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.ledger_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.ledger_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.ledger_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.ledger_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.daily_weather for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.daily_weather for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.daily_weather for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.daily_weather for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.transactions, public.ledger_settings, public.daily_weather from anon;
grant select, insert, update, delete on public.transactions, public.ledger_settings, public.daily_weather to authenticated;

-- 백업 가져오기: replace=true면 기존 내역을 지우고 한 트랜잭션 안에서 바꾼다
create function public.import_transactions(rows jsonb, replace boolean default false)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if replace then
    delete from public.transactions where user_id = uid;
  end if;
  insert into public.transactions (user_id, date, type, category, amount, memo, created_at)
  select uid, r.date, r.type, r.category, r.amount, coalesce(r.memo, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(rows) as r (date date, type text, category text, amount bigint, memo text, created_at timestamptz);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.import_transactions(jsonb, boolean) from public, anon;
grant execute on function public.import_transactions(jsonb, boolean) to authenticated;
