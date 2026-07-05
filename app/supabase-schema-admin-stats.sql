-- 애터미 수당체계 학습 퀴즈 앱 — 3단계(관리자용 조직 통계 대시보드) 마이그레이션
--
-- 전제: supabase-schema.sql, supabase-schema-leaderboard.sql, supabase-schema-questions-cms.sql,
--       supabase-schema-team.sql이 이미 실행되어 있어야 합니다 (is_admin() 함수 포함).
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
--
-- 모든 함수는 마지막에 "where public.is_admin()" 조건을 둬서, 관리자가 아닌 사용자가
-- 호출하면 예외 없이 그냥 빈 결과(0행)만 돌려받는다 — RLS를 우회하는 SECURITY DEFINER
-- 함수이므로 이 가드가 실제 보안 경계다.

-- 1) 전체 개요: 가입자 수, 참여자 수, 총 풀이 수, 전체 정답률, 팀 수
create or replace function public.get_admin_overview()
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
grant execute on function public.get_admin_overview() to authenticated;

-- 2) 카테고리별 정답률 (전체 사용자 합산) — history의 문제 id를 questions 테이블과 매칭해
--    카테고리를 알아낸다. 이미 삭제된 문제 id의 기록은 매칭되지 않아 자연스럽게 제외된다.
create or replace function public.get_admin_category_stats()
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
  group by q.category
  order by total_attempts desc;
$$;
grant execute on function public.get_admin_category_stats() to authenticated;

-- 3) 팀별 현황 (개인 랭킹의 get_team_leaderboard와 달리 최소 시도 수 제한 없이 전체 팀을 보여준다)
create or replace function public.get_admin_team_stats()
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
  left join public.quiz_progress qp on qp.team_id = t.id
  left join lateral (
    select
      sum((entry.value->>'attempts')::int) as attempts,
      sum((entry.value->>'correct')::int) as correct
    from jsonb_each(qp.history) as entry
  ) s on true
  where public.is_admin()
  group by t.id, t.name
  order by total_correct desc;
$$;
grant execute on function public.get_admin_team_stats() to authenticated;

-- 4) 개인별 현황 (닉네임순이 아니라 풀이 수 순, 최소 시도 수 제한 없음 — 랭킹용이 아니라 운영 확인용)
create or replace function public.get_admin_user_stats(limit_count int default 100)
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
  ) s on true
  where public.is_admin()
  order by total_attempts desc
  limit limit_count;
$$;
grant execute on function public.get_admin_user_stats(int) to authenticated;
