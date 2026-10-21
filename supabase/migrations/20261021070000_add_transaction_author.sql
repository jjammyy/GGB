-- 내역마다 입력한 사람 이름을 남긴다
alter table public.transactions
  add column author text not null default '' check (char_length(author) <= 20);

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
  insert into public.transactions (date, type, category, amount, memo, author, created_at)
  select r.date, r.type, r.category, r.amount, coalesce(r.memo, ''), coalesce(r.author, ''), coalesce(r.created_at, now())
  from jsonb_to_recordset(rows)
    as r (date date, type text, category text, amount bigint, memo text, author text, created_at timestamptz);
  get diagnostics n = row_count;
  return n;
end;
$$;
