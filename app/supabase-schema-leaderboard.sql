-- 애터미 수당체계 학습 퀴즈 앱 — 3단계(랭킹/리더보드) 추가 마이그레이션
--
-- 전제: supabase-schema.sql(quiz_progress 테이블 + RLS)이 이미 실행되어 있어야 합니다.
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.

-- 1) 랭킹에 표시할 닉네임 컬럼 추가 (이메일 등 개인정보를 노출하지 않기 위함)
alter table public.quiz_progress
  add column if not exists nickname text;

-- 2) 전체 사용자 집계 랭킹 조회 함수
--    - quiz_progress는 RLS로 본인 행만 조회 가능하도록 되어 있으므로,
--      "전체 사용자 중 상위 N명"을 보여주려면 RLS를 우회하는 집계 전용 함수가 필요하다.
--    - SECURITY DEFINER로 함수 소유자 권한으로 실행하되, 함수가 반환하는 값은
--      닉네임 + 집계된 정답수/시도수/정답률뿐이라 이메일 등 민감정보는 노출되지 않는다.
--    - 최소 5문제 이상 시도한 사용자만 랭킹에 노출한다(우연한 고정답률 왜곡 방지).
create or replace function public.get_leaderboard(limit_count int default 20)
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
  ) s on true
  where coalesce(s.attempts, 0) >= 5
  order by total_correct desc, accuracy desc
  limit limit_count;
$$;

-- 로그인 여부와 무관하게(anon 포함) 랭킹은 열람 가능하도록 실행 권한을 부여한다.
revoke all on function public.get_leaderboard(int) from public;
grant execute on function public.get_leaderboard(int) to anon, authenticated;
