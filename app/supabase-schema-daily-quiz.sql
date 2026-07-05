-- Marketing Plan 퀴즈 (애터미 수당체계 학습) — 3단계(오늘의 퀴즈) 마이그레이션
--
-- 전제: supabase-schema.sql, supabase-schema-admin-stats.sql이 이미 실행되어 있어야 합니다
--       (quiz_progress 테이블, is_admin() 함수 포함).
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.

-- 1) 오늘의 퀴즈 완료 기록을 저장할 컬럼 (jsonb: { date: "YYYY-MM-DD", correct, total })
--    date는 서버 시간이 아니라 "클라이언트(사용자 브라우저)의 로컬 날짜"를 그대로 저장한다 —
--    사용자마다 시간대가 다를 수 있어 서버 now()로 비교하면 자정 근처에 어긋날 수 있기 때문.
alter table public.quiz_progress add column if not exists daily_quiz jsonb;

-- 2) 관리자용: 오늘 날짜 기준 오늘의 퀴즈 참여자 수 / 평균 정답률.
--    target_date는 관리자 화면을 보는 클라이언트의 로컬 날짜 문자열을 그대로 전달받는다
--    (서버 now()의 시간대와 클라이언트 시간대가 다를 수 있어, 비교 기준을 클라이언트에 맡긴다).
create or replace function public.get_admin_daily_quiz_stats(target_date text)
returns table (
  today_participants bigint,
  today_avg_accuracy numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where qp.daily_quiz->>'date' = target_date)::bigint as today_participants,
    case when coalesce(sum((qp.daily_quiz->>'total')::int) filter (where qp.daily_quiz->>'date' = target_date), 0) > 0
      then round(
        100.0 * sum((qp.daily_quiz->>'correct')::int) filter (where qp.daily_quiz->>'date' = target_date)
        / sum((qp.daily_quiz->>'total')::int) filter (where qp.daily_quiz->>'date' = target_date),
        1)
      else 0
    end as today_avg_accuracy
  from public.quiz_progress qp
  where public.is_admin();
$$;
grant execute on function public.get_admin_daily_quiz_stats(text) to authenticated;
