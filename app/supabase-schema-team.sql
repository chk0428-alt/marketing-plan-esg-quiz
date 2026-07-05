-- 애터미 수당체계 학습 퀴즈 앱 — 3단계(팀 학습 모드) 마이그레이션
--
-- 전제: supabase-schema.sql, supabase-schema-leaderboard.sql이 이미 실행되어 있어야 합니다.
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.

-- 1) 팀 테이블. invite_code는 팀원을 초대할 때 공유하는 코드다.
--    RLS로 직접 SELECT/INSERT를 허용하지 않고, 아래 함수들을 통해서만 접근한다
--    (invite_code가 전체 공개 조회로 새어나가면 아무나 초대코드 없이 팀에 들어올 수 있으므로).
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
-- teams 테이블에는 어떤 역할에도 정책을 주지 않는다(기본 전체 차단).
-- 아래 SECURITY DEFINER 함수들이 필요한 범위만 좁혀서 노출한다.

-- 2) 사용자 1명당 소속 팀은 최대 1개. quiz_progress에 team_id를 추가한다.
alter table public.quiz_progress
  add column if not exists team_id uuid references public.teams(id) on delete set null;

-- 3) 팀 생성: 이름을 받아 무작위 초대코드로 팀을 만들고, 만든 사람을 그 팀에 즉시 가입시킨다.
create or replace function public.create_team(p_name text)
returns table (team_id uuid, team_name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception '팀 이름을 입력해주세요.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.teams (name, invite_code, created_by)
    values (trim(p_name), v_code, auth.uid())
    returning id into v_id;
  update public.quiz_progress set team_id = v_id where user_id = auth.uid();
  return query select v_id, trim(p_name), v_code;
end;
$$;
grant execute on function public.create_team(text) to authenticated;

-- 4) 초대코드로 팀 참가: 코드가 올바르면 호출한 사용자를 해당 팀에 가입시킨다.
create or replace function public.join_team_by_code(p_code text)
returns table (team_id uuid, team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  select id, name into v_id, v_name from public.teams where invite_code = upper(trim(p_code));
  if v_id is null then
    raise exception '유효하지 않은 초대코드입니다.';
  end if;
  update public.quiz_progress set team_id = v_id where user_id = auth.uid();
  return query select v_id, v_name;
end;
$$;
grant execute on function public.join_team_by_code(text) to authenticated;

-- 5) 내 팀 정보 조회 (이름 + 초대코드 — 초대코드는 현재 팀원 본인에게만 보여준다)
create or replace function public.get_my_team()
returns table (team_id uuid, team_name text, invite_code text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.invite_code
  from public.teams t
  join public.quiz_progress qp on qp.team_id = t.id
  where qp.user_id = auth.uid();
$$;
grant execute on function public.get_my_team() to authenticated;

-- 6) 내 팀 구성원 목록 (닉네임 + 개인 통계만 노출, 이메일 등은 노출하지 않는다)
create or replace function public.get_team_members()
returns table (nickname text, total_attempts bigint, total_correct bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(qp.nickname), ''), '익명 학습자') as nickname,
    coalesce(s.attempts, 0)::bigint as total_attempts,
    coalesce(s.correct, 0)::bigint as total_correct
  from public.quiz_progress qp
  left join lateral (
    select
      sum((entry.value->>'attempts')::int) as attempts,
      sum((entry.value->>'correct')::int) as correct
    from jsonb_each(qp.history) as entry
  ) s on true
  where qp.team_id = (select team_id from public.quiz_progress where user_id = auth.uid())
    and (select team_id from public.quiz_progress where user_id = auth.uid()) is not null;
$$;
grant execute on function public.get_team_members() to authenticated;

-- 7) 팀 대항 랭킹: 팀별 합산 정답수 기준. 개인 랭킹과 동일하게 최소 5문제 이상 누적된
--    팀만 노출한다.
create or replace function public.get_team_leaderboard(limit_count int default 20)
returns table (
  team_name text,
  member_count bigint,
  total_attempts bigint,
  total_correct bigint,
  accuracy numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.name as team_name,
    count(distinct qp.user_id) as member_count,
    coalesce(sum(s.attempts), 0)::bigint as total_attempts,
    coalesce(sum(s.correct), 0)::bigint as total_correct,
    case when coalesce(sum(s.attempts), 0) > 0
      then round(100.0 * sum(s.correct) / sum(s.attempts), 1)
      else 0
    end as accuracy
  from public.teams t
  join public.quiz_progress qp on qp.team_id = t.id
  left join lateral (
    select
      sum((entry.value->>'attempts')::int) as attempts,
      sum((entry.value->>'correct')::int) as correct
    from jsonb_each(qp.history) as entry
  ) s on true
  group by t.id, t.name
  having coalesce(sum(s.attempts), 0) >= 5
  order by total_correct desc, accuracy desc
  limit limit_count;
$$;
grant execute on function public.get_team_leaderboard(int) to anon, authenticated;

-- 8) 팀 나가기는 본인 행의 team_id를 null로 바꾸는 것뿐이라 기존
--    "quiz_progress_update_own" 정책(본인 행 UPDATE 허용)으로 이미 커버된다.
--    별도 함수 없이 클라이언트에서 update team_id = null 로 처리한다.
