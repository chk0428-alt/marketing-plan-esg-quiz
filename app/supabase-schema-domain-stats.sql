-- 애터미 학습 퀴즈 앱 — 4-3단계(통계/운영 고도화) 마이그레이션
--
-- 전제: supabase-schema.sql, supabase-schema-leaderboard.sql, supabase-schema-team.sql,
--       supabase-schema-admin-stats.sql, supabase-schema-daily-quiz.sql, supabase-schema-domain.sql이
--       이미 실행되어 있어야 합니다 (domain/report_year/is_active 컬럼 포함).
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
--
-- 이 마이그레이션은 기존 랭킹/팀/관리자통계/오늘의퀴즈 RPC들에 p_domain 파라미터를 추가해
-- 통합('all')/마케팅플랜(marketing_plan)/ESG(esg) 3종 조회를 지원한다. 함수 시그니처가
-- 바뀌므로(파라미터 추가) 오버로드 충돌을 피하기 위해 기존 함수를 명시적으로 DROP한 뒤
-- 새 시그니처로 다시 만든다.
--
-- 참고: "도메인별 정답률의 가중 평균(가중치=응시 문항 수)"은 수학적으로 해당 도메인들의
-- 정답 수 합계 ÷ 시도 수 합계와 동일하다. 따라서 p_domain='all'일 때는 도메인 필터를 걸지
-- 않는 것만으로 이미 가중 평균 산식을 만족한다(4-1단계 이전 get_leaderboard(int)와 동일 결과).

-- ============================================================
-- 0) 팀 챌린지 도메인 태그 컬럼 (아래 2), 3) 섹션의 함수 본문이 t.domain을 참조하므로
--    반드시 해당 함수들보다 먼저 컬럼을 추가해야 한다 — SQL 언어 함수는 CREATE FUNCTION
--    시점에 본문을 스키마와 함께 파싱/검증하므로, 컬럼이 없으면 그 자리에서 실패한다.
--    유효한 도메인 값은 questions.domain과 마찬가지로 클라이언트(DOMAINS 배열) 및
--    create_team() 함수 내부 검증이 기준이며, 여기서는 하드코딩된 CHECK로 제한하지 않는다.
-- ============================================================
alter table public.teams
  add column if not exists domain text;

-- ============================================================
-- 1) 개인 랭킹: 통합/마케팅플랜/ESG 3종
-- ============================================================
drop function if exists public.get_leaderboard(int);

create or replace function public.get_leaderboard(limit_count int default 20, p_domain text default 'all')
returns table (
  nickname text,
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
    coalesce(nullif(trim(qp.nickname), ''), '익명 학습자') as nickname,
    coalesce(s.attempts, 0)::bigint as total_attempts,
    coalesce(s.correct, 0)::bigint as total_correct,
    case when coalesce(s.attempts, 0) > 0
      then round(100.0 * s.correct / s.attempts, 1)
      else 0
    end as accuracy
  from public.quiz_progress qp
  left join lateral (
    select
      sum((entry.value->>'attempts')::int) as attempts,
      sum((entry.value->>'correct')::int) as correct
    from jsonb_each(qp.history) as entry
    left join public.questions q on q.id = entry.key
    where p_domain = 'all' or q.domain = p_domain
  ) s on true
  where coalesce(s.attempts, 0) >= 5
  order by total_correct desc, accuracy desc
  limit limit_count;
$$;

revoke all on function public.get_leaderboard(int, text) from public;
grant execute on function public.get_leaderboard(int, text) to anon, authenticated;

-- ============================================================
-- 2) 팀 대항 랭킹 / 내 팀 구성원: 통합/마케팅플랜/ESG 3종
-- ============================================================
drop function if exists public.get_team_leaderboard(int);

create or replace function public.get_team_leaderboard(limit_count int default 20, p_domain text default 'all')
returns table (
  team_name text,
  team_domain text,
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
    t.domain as team_domain,
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
    left join public.questions q on q.id = entry.key
    where p_domain = 'all' or q.domain = p_domain
  ) s on true
  group by t.id, t.name, t.domain
  having coalesce(sum(s.attempts), 0) >= 5
  order by total_correct desc, accuracy desc
  limit limit_count;
$$;

revoke all on function public.get_team_leaderboard(int, text) from public;
grant execute on function public.get_team_leaderboard(int, text) to anon, authenticated;

drop function if exists public.get_team_members();

create or replace function public.get_team_members(p_domain text default 'all')
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
    left join public.questions q on q.id = entry.key
    where p_domain = 'all' or q.domain = p_domain
  ) s on true
  where qp.team_id = (select team_id from public.quiz_progress where user_id = auth.uid())
    and (select team_id from public.quiz_progress where user_id = auth.uid()) is not null;
$$;

grant execute on function public.get_team_members(text) to authenticated;

-- ============================================================
-- 3) 관리자 통계: 전체 개요 / 카테고리별 / 팀별 / 개인별 — 통합/마케팅플랜/ESG 3종
-- ============================================================
drop function if exists public.get_admin_overview();

create or replace function public.get_admin_overview(p_domain text default 'all')
returns table (
  total_users bigint,
  active_users bigint,
  total_attempts bigint,
  total_correct bigint,
  overall_accuracy numeric,
  total_teams bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with per_user as (
    select
      qp.user_id,
      coalesce(s.attempts, 0) as attempts,
      coalesce(s.correct, 0) as correct
    from public.quiz_progress qp
    left join lateral (
      select
        sum((entry.value->>'attempts')::int) as attempts,
        sum((entry.value->>'correct')::int) as correct
      from jsonb_each(qp.history) as entry
      left join public.questions q on q.id = entry.key
      where p_domain = 'all' or q.domain = p_domain
    ) s on true
  )
  select
    (select count(*) from per_user)::bigint as total_users,
    (select count(*) from per_user where attempts > 0)::bigint as active_users,
    coalesce((select sum(attempts) from per_user), 0)::bigint as total_attempts,
    coalesce((select sum(correct) from per_user), 0)::bigint as total_correct,
    case when coalesce((select sum(attempts) from per_user), 0) > 0
      then round(100.0 * (select sum(correct) from per_user) / (select sum(attempts) from per_user), 1)
      else 0
    end as overall_accuracy,
    (select count(*) from public.teams)::bigint as total_teams
  where public.is_admin();
$$;
grant execute on function public.get_admin_overview(text) to authenticated;

drop function if exists public.get_admin_category_stats();

create or replace function public.get_admin_category_stats(p_domain text default 'all')
returns table (
  category text,
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
    q.category,
    coalesce(sum((per_q.value->>'attempts')::int), 0)::bigint as total_attempts,
    coalesce(sum((per_q.value->>'correct')::int), 0)::bigint as total_correct,
    case when coalesce(sum((per_q.value->>'attempts')::int), 0) > 0
      then round(100.0 * sum((per_q.value->>'correct')::int) / sum((per_q.value->>'attempts')::int), 1)
      else 0
    end as accuracy
  from public.quiz_progress qp
  cross join lateral jsonb_each(qp.history) as per_q
  join public.questions q on q.id = per_q.key
  where public.is_admin()
    and (p_domain = 'all' or q.domain = p_domain)
  group by q.category
  order by total_attempts desc;
$$;
grant execute on function public.get_admin_category_stats(text) to authenticated;

drop function if exists public.get_admin_team_stats();

create or replace function public.get_admin_team_stats(p_domain text default 'all')
returns table (
  team_name text,
  team_domain text,
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
    t.domain as team_domain,
    count(distinct qp.user_id) as member_count,
    coalesce(sum(s.attempts), 0)::bigint as total_attempts,
    coalesce(sum(s.correct), 0)::bigint as total_correct,
    case when coalesce(sum(s.attempts), 0) > 0
      then round(100.0 * sum(s.correct) / sum(s.attempts), 1)
      else 0
    end as accuracy
  from public.teams t
  left join public.quiz_progress qp on qp.team_id = t.id
  left join lateral (
    select
      sum((entry.value->>'attempts')::int) as attempts,
      sum((entry.value->>'correct')::int) as correct
    from jsonb_each(qp.history) as entry
    left join public.questions q on q.id = entry.key
    where p_domain = 'all' or q.domain = p_domain
  ) s on true
  where public.is_admin()
  group by t.id, t.name, t.domain
  order by total_correct desc;
$$;
grant execute on function public.get_admin_team_stats(text) to authenticated;

drop function if exists public.get_admin_user_stats(int);

create or replace function public.get_admin_user_stats(limit_count int default 100, p_domain text default 'all')
returns table (
  nickname text,
  total_attempts bigint,
  total_correct bigint,
  accuracy numeric,
  team_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(qp.nickname), ''), '익명 학습자') as nickname,
    coalesce(s.attempts, 0)::bigint as total_attempts,
    coalesce(s.correct, 0)::bigint as total_correct,
    case when coalesce(s.attempts, 0) > 0 then round(100.0 * s.correct / s.attempts, 1) else 0 end as accuracy,
    t.name as team_name
  from public.quiz_progress qp
  left join public.teams t on t.id = qp.team_id
  left join lateral (
    select
      sum((entry.value->>'attempts')::int) as attempts,
      sum((entry.value->>'correct')::int) as correct
    from jsonb_each(qp.history) as entry
    left join public.questions q on q.id = entry.key
    where p_domain = 'all' or q.domain = p_domain
  ) s on true
  where public.is_admin()
  order by total_attempts desc
  limit limit_count;
$$;
grant execute on function public.get_admin_user_stats(int, text) to authenticated;

-- ============================================================
-- 4) 오늘의 퀴즈 통계: daily_quiz가 도메인별 슬롯 구조로 바뀜에 따라 갱신
--    ({date,correct,total} 평면 구조 → { marketing_plan: {...}, esg: {...} })
--    p_domain='all'이면 두 도메인 중 하나라도 오늘 완료한 사용자를 참여자로 집계한다.
-- ============================================================
drop function if exists public.get_admin_daily_quiz_stats(text);

create or replace function public.get_admin_daily_quiz_stats(target_date text, p_domain text default 'all')
returns table (
  today_participants bigint,
  today_avg_accuracy numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with per_user as (
    select
      (p_domain in ('all', 'marketing_plan') and qp.daily_quiz->'marketing_plan'->>'date' = target_date) as mp_done,
      (p_domain in ('all', 'esg') and qp.daily_quiz->'esg'->>'date' = target_date) as esg_done,
      (case when p_domain in ('all', 'marketing_plan') and qp.daily_quiz->'marketing_plan'->>'date' = target_date
        then (qp.daily_quiz->'marketing_plan'->>'correct')::int else 0 end)
      + (case when p_domain in ('all', 'esg') and qp.daily_quiz->'esg'->>'date' = target_date
        then (qp.daily_quiz->'esg'->>'correct')::int else 0 end) as correct_today,
      (case when p_domain in ('all', 'marketing_plan') and qp.daily_quiz->'marketing_plan'->>'date' = target_date
        then (qp.daily_quiz->'marketing_plan'->>'total')::int else 0 end)
      + (case when p_domain in ('all', 'esg') and qp.daily_quiz->'esg'->>'date' = target_date
        then (qp.daily_quiz->'esg'->>'total')::int else 0 end) as total_today
    from public.quiz_progress qp
    where public.is_admin()
  )
  select
    count(*) filter (where mp_done or esg_done)::bigint as today_participants,
    case when coalesce(sum(total_today), 0) > 0
      then round(100.0 * sum(correct_today) / sum(total_today), 1)
      else 0
    end as today_avg_accuracy
  from per_user;
$$;
grant execute on function public.get_admin_daily_quiz_stats(text, text) to authenticated;

-- ============================================================
-- 5) 팀 챌린지 도메인 태그 관련 함수: 팀 생성 시 특정 도메인 전용 챌린지로 표시할 수
--    있게 한다(컬럼 자체는 0번 섹션에서 이미 추가함). 팀 멤버십은 여전히 계정당 1개로
--    도메인과 무관하게 유지된다 — 이 태그는 순수 표시/필터용이며, 랭킹 집계 자체는 위
--    p_domain 파라미터로 언제든 도메인별로 조회 가능하다. "ESG 팀 챌린지"처럼 이름
--    대신 정식 분류로 보여주기 위한 용도.
-- ============================================================
drop function if exists public.create_team(text);

create or replace function public.create_team(p_name text, p_domain text default null)
returns table (team_id uuid, team_name text, invite_code text, team_domain text)
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
  if p_domain is not null and p_domain not in ('marketing_plan', 'esg') then
    raise exception '유효하지 않은 학습 영역입니다.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.teams (name, invite_code, created_by, domain)
    values (trim(p_name), v_code, auth.uid(), p_domain)
    returning id into v_id;
  update public.quiz_progress set team_id = v_id where user_id = auth.uid();
  return query select v_id, trim(p_name), v_code, p_domain;
end;
$$;
grant execute on function public.create_team(text, text) to authenticated;

drop function if exists public.get_my_team();

create or replace function public.get_my_team()
returns table (team_id uuid, team_name text, invite_code text, team_domain text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.invite_code, t.domain
  from public.teams t
  join public.quiz_progress qp on qp.team_id = t.id
  where qp.user_id = auth.uid();
$$;
grant execute on function public.get_my_team() to authenticated;
