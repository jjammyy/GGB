-- 로그인 없이 쓰는 하나의 공용 가계부로 바꾼다.
-- 공개 키로 누구나 읽고 쓸 수 있으므로, 사이트 주소를 아는 사람은 내역을 보고 고칠 수 있다.

drop policy "own rows: select" on public.transactions;
drop policy "own rows: insert" on public.transactions;
drop policy "own rows: update" on public.transactions;
drop policy "own rows: delete" on public.transactions;
drop policy "own rows: select" on public.ledger_settings;
drop policy "own rows: insert" on public.ledger_settings;
drop policy "own rows: update" on public.ledger_settings;
drop policy "own rows: delete" on public.ledger_settings;
drop policy "own rows: select" on public.daily_weather;
drop policy "own rows: insert" on public.daily_weather;
drop policy "own rows: update" on public.daily_weather;
drop policy "own rows: delete" on public.daily_weather;

drop function public.import_transactions(jsonb, boolean);

-- 내역: 사용자 구분 없음
alter table public.transactions drop column user_id;
create index transactions_date_idx on public.transactions (date);

-- 설정: 항상 id = 1 인 한 행
alter table public.ledger_settings drop column user_id;
alter table public.ledger_settings add column id smallint primary key default 1 check (id = 1);

-- 날씨: 날짜당 한 행
alter table public.daily_weather drop column user_id;
alter table public.daily_weather add primary key (date);

create policy "shared ledger" on public.transactions for all to anon, authenticated using (true) with check (true);
create policy "shared ledger" on public.ledger_settings for all to anon, authenticated using (true) with check (true);
create policy "shared ledger" on public.daily_weather for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.transactions, public.ledger_settings, public.daily_weather to anon, authenticated;

-- 백업 가져오기: replace=true면 기존 내역을 지우고 한 트랜잭션 안에서 바꾼다
create function public.import_transactions(rows jsonb, replace boolean default false)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if replace then
    delete from public.transactions where true;
  end if;
  insert into public.transactions (date, type, category, amount, memo, created_at)
  select r.date, r.type, r.category, r.amount, coalesce(r.memo, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(rows) as r (date date, type text, category text, amount bigint, memo text, created_at timestamptz);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.import_transactions(jsonb, boolean) from public;
grant execute on function public.import_transactions(jsonb, boolean) to anon, authenticated;
