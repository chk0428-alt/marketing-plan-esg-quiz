-- 애터미 학습 퀴즈 앱 — 5단계 기념 컬렉션: 통합 TOP 20 컬렉션(★3, 신규) 마이그레이션
--
-- 전제: supabase-schema-collections.sql, supabase-schema-collections-streaks.sql,
--       supabase-schema-collections-seen.sql이 이미 실행되어 있어야 합니다.
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
--
-- 마케팅플랜/ESG 개별 TOP20(mp_top20/esg_top20)과 별개로, 두 도메인을 합산한 통합
-- 랭킹(get_leaderboard(20, 'all') -- 랭킹 화면의 "통합" 탭과 동일 기준) TOP 20에 든
-- 학습자에게 주는 20번째 컬렉션이다. 반환 타입(code, earned_ts, is_new, seen)은 바뀌지
-- 않으므로 DROP 없이 CREATE OR REPLACE만으로 충분하다.

create or replace function public.evaluate_and_award_badges()
returns table (code text, earned_ts timestamptz, is_new boolean, seen boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_history jsonb;
  v_nickname text;
  v_study_current int;
  v_daily_current int;
  v_qualifies text[] := '{}';
  v_before text[];
  v_domain text;
  v_diff text;
  v_prefix text;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select history, nickname, coalesce((study_streak->>'current')::int, 0), coalesce((daily_quiz_streak->>'current')::int, 0)
    into v_history, v_nickname, v_study_current, v_daily_current
  from public.quiz_progress where user_id = v_user;
  v_history := coalesce(v_history, '{}'::jsonb);

  select coalesce(array_agg(qb.badge_code), '{}') into v_before
  from public.quiz_badges qb where qb.user_id = v_user;

  -- 이 사용자가 "최소 1회 정답 처리"한 활성 문항 목록(재응시로 극복한 문항 포함)
  create temporary table tmp_cleared on commit drop as
  select q.id, q.domain, q.category, q.difficulty
  from public.questions q
  where q.is_active = true
    and exists (
      select 1 from jsonb_each(v_history) e
      where e.key = q.id and coalesce((e.value->>'correct')::int, 0) >= 1
    );

  foreach v_domain in array array['marketing_plan', 'esg'] loop
    v_prefix := case v_domain when 'marketing_plan' then 'mp' else 'esg' end;

    -- 초급/중급/고급 마스터 (★1/★1/★2): 해당 (도메인,난이도)의 활성 문항 전체를 커버
    foreach v_diff in array array['초급', '중급', '고급'] loop
      if (select count(*) from public.questions
            where domain = v_domain and difficulty = v_diff and is_active = true) > 0
        and (select count(*) from public.questions
              where domain = v_domain and difficulty = v_diff and is_active = true)
          = (select count(*) from tmp_cleared where domain = v_domain and difficulty = v_diff)
      then
        v_qualifies := array_append(v_qualifies, v_prefix || '_' ||
          (case v_diff when '초급' then 'beginner' when '중급' then 'intermediate' else 'advanced' end) || '_master');
      end if;
    end loop;

    -- 카테고리 5 클리어(★3): 9개 카테고리 중 "전 문항 커버"된 카테고리가 5개 이상
    if (
      select count(*) from (
        select q.category
        from public.questions q
        where q.domain = v_domain and q.is_active = true
        group by q.category
        having count(*) filter (
          where q.id in (select id from tmp_cleared where domain = v_domain)
        ) = count(*)
      ) fully_cleared_categories
    ) >= 5 then
      v_qualifies := array_append(v_qualifies, v_prefix || '_category5');
    end if;

    -- 도메인 퍼펙트(★4): 해당 도메인의 활성 문항 전체를 커버
    if (select count(*) from public.questions where domain = v_domain and is_active = true) > 0
      and (select count(*) from public.questions where domain = v_domain and is_active = true)
        = (select count(*) from tmp_cleared where domain = v_domain)
    then
      v_qualifies := array_append(v_qualifies, v_prefix || '_perfect');
    end if;

    -- 도메인 TOP20(★3): get_leaderboard 근사 매칭 재사용
    if exists (
      select 1 from public.get_leaderboard(20, v_domain) lb
      where lb.nickname = coalesce(nullif(trim(v_nickname), ''), '익명 학습자')
    ) then
      v_qualifies := array_append(v_qualifies, v_prefix || '_top20');
    end if;
  end loop;

  -- 통합 TOP20(★3, 신규): 마케팅플랜+ESG를 합산한 통합 랭킹(랭킹 화면의 "통합" 탭과 동일 기준)
  if exists (
    select 1 from public.get_leaderboard(20, 'all') lb
    where lb.nickname = coalesce(nullif(trim(v_nickname), ''), '익명 학습자')
  ) then
    v_qualifies := array_append(v_qualifies, 'total_top20');
  end if;

  -- 애터미 퍼펙트(★5): 두 도메인 퍼펙트의 AND
  if 'mp_perfect' = any(v_qualifies) and 'esg_perfect' = any(v_qualifies) then
    v_qualifies := array_append(v_qualifies, 'atomy_perfect');
  end if;

  -- 학습 스트릭 3종(★1/★2/★3)
  if v_study_current >= 3 then v_qualifies := array_append(v_qualifies, 'study_streak_3'); end if;
  if v_study_current >= 7 then v_qualifies := array_append(v_qualifies, 'study_streak_7'); end if;
  if v_study_current >= 10 then v_qualifies := array_append(v_qualifies, 'study_streak_10'); end if;

  -- 오늘의 퀴즈 스트릭 3종(★1/★2/★3)
  if v_daily_current >= 3 then v_qualifies := array_append(v_qualifies, 'daily_quiz_streak_3'); end if;
  if v_daily_current >= 7 then v_qualifies := array_append(v_qualifies, 'daily_quiz_streak_7'); end if;
  if v_daily_current >= 10 then v_qualifies := array_append(v_qualifies, 'daily_quiz_streak_10'); end if;

  insert into public.quiz_badges (user_id, badge_code)
  select v_user, item from unnest(v_qualifies) as item
  on conflict (user_id, badge_code) do nothing;

  -- 아래 select list 4개 컬럼은 이름이 아니라 위치 순서로 반환 타입(code, earned_ts, is_new, seen)에 매핑된다.
  return query
    select b.badge_code, b.earned_at, not (b.badge_code = any(v_before)), b.seen
    from public.quiz_badges b
    where b.user_id = v_user
    order by b.earned_at;
end;
$$;

grant execute on function public.evaluate_and_award_badges() to authenticated;
