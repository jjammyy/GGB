-- 입력한 사람 이름 대신 입력 시간(created_at)을 보여 주기로 해서 이름 칸을 없앤다
create or replace function public.import_transactions(rows jsonb, replace boolean default false)
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

alter table public.transactions drop column author;
