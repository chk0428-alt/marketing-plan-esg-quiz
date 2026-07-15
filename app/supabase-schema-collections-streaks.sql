-- 애터미 학습 퀴즈 앱 — 5-3단계(기념 컬렉션: 스트릭 6종) 마이그레이션
--
-- 전제: supabase-schema-collections.sql이 이미 실행되어 있어야 합니다
--       (quiz_badges 테이블, evaluate_and_award_badges() 포함).
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
--
-- 범위(PRD_5단계_기념카드.md 9절, 5-3단계): 학습 스트릭 3종(3/7/10일) + 오늘의 퀴즈 스트릭
-- 3종(3/7/10일, 정답 무관) = 6종. 5-1/5-2에서 만든 13종 + 이 6종 = 19종 전체 완성.
--
-- 참여 이력을 통째로(날짜 배열 등) 쌓지 않고, "현재 연속 일수 + 마지막 참여일"만
-- 최소한으로 저장한다 -- 무한정 커지는 로그 테이블 없이 스트릭 판정에 필요한 만큼만 둔다.
-- 날짜는 서버 now()가 아니라 클라이언트(사용자 브라우저)의 로컬 날짜 문자열을 그대로
-- 받는다 -- daily_quiz 컬럼과 동일한 이유(사용자마다 시간대가 달라 자정 근처에 어긋날 수 있음).

-- 1) 스트릭 상태 컬럼 2개. {"current": N, "last_date": "YYYY-MM-DD"} 형태.
alter table public.quiz_progress
  add column if not exists study_streak jsonb not null default '{"current":0,"last_date":null}'::jsonb;
alter table public.quiz_progress
  add column if not exists daily_quiz_streak jsonb not null default '{"current":0,"last_date":null}'::jsonb;

-- 2) 활동 기록 함수 -- "학습"(문제를 1개 이상 풀이) 또는 "오늘의 퀴즈"(정답 무관 참여) 중
--    하나를 클라이언트가 알려주면, 어제 이미 기록이 있었으면 연속 일수를 늘리고
--    (오늘 이미 기록했으면 그대로 두고), 아니면(하루 이상 건너뛰었거나 첫 기록이면) 1로
--    리셋한다. 같은 날 여러 번 호출해도 안전(멱등)하다.
create or replace function public.record_activity(p_kind text, p_today text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state jsonb;
  v_yesterday text;
  v_current int;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_kind not in ('study', 'daily_quiz') then
    raise exception '유효하지 않은 활동 종류입니다.';
  end if;

  if p_kind = 'study' then
    select study_streak into v_state from public.quiz_progress where user_id = v_user;
  else
    select daily_quiz_streak into v_state from public.quiz_progress where user_id = v_user;
  end if;
  v_state := coalesce(v_state, '{"current":0,"last_date":null}'::jsonb);

  if (v_state->>'last_date') = p_today then
    return v_state; -- 오늘 이미 기록됨, 변화 없음(멱등)
  end if;

  v_yesterday := (p_today::date - interval '1 day')::date::text;
  if (v_state->>'last_date') = v_yesterday then
    v_current := coalesce((v_state->>'current')::int, 0) + 1;
  else
    v_current := 1; -- 하루 이상 건너뛰었거나 첫 기록
  end if;

  v_state := jsonb_build_object('current', v_current, 'last_date', p_today);

  if p_kind = 'study' then
    update public.quiz_progress set study_streak = v_state where user_id = v_user;
  else
    update public.quiz_progress set daily_quiz_streak = v_state where user_id = v_user;
  end if;

  return v_state;
end;
$$;
grant execute on function public.record_activity(text, text) to authenticated;

-- 3) evaluate_and_award_badges() 재정의 -- 기존 13종 판정 로직은 그대로 두고,
--    스트릭 6종 판정만 추가한다(study_streak/daily_quiz_streak의 current 값 기준).
drop function if exists public.evaluate_and_award_badges();

create or replace function public.evaluate_and_award_badges()
returns table (code text, earned_ts timestamptz, is_new boolean)
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
    -- (알려진 한계: get_leaderboard가 user_id를 반환하지 않아 닉네임+집계치로 대조한다.
    --  닉네임이 동일한 다른 사용자가 있으면 이론상 오탐될 수 있다 — PRD 7절 오픈 이슈.)
    if exists (
      select 1 from public.get_leaderboard(20, v_domain) lb
      where lb.nickname = coalesce(nullif(trim(v_nickname), ''), '익명 학습자')
    ) then
      v_qualifies := array_append(v_qualifies, v_prefix || '_top20');
    end if;
  end loop;

  -- 애터미 퍼펙트(★5): 두 도메인 퍼펙트의 AND — 8절에서 의도된 동시 발급 지점
  if 'mp_perfect' = any(v_qualifies) and 'esg_perfect' = any(v_qualifies) then
    v_qualifies := array_append(v_qualifies, 'atomy_perfect');
  end if;

  -- 학습 스트릭 3종(★1/★2/★3) -- "학습" = 문제를 1개 이상 풀이(정답 여부 무관)
  if v_study_current >= 3 then v_qualifies := array_append(v_qualifies, 'study_streak_3'); end if;
  if v_study_current >= 7 then v_qualifies := array_append(v_qualifies, 'study_streak_7'); end if;
  if v_study_current >= 10 then v_qualifies := array_append(v_qualifies, 'study_streak_10'); end if;

  -- 오늘의 퀴즈 스트릭 3종(★1/★2/★3) -- 정답 여부와 무관하게 참여만 하면 됨
  if v_daily_current >= 3 then v_qualifies := array_append(v_qualifies, 'daily_quiz_streak_3'); end if;
  if v_daily_current >= 7 then v_qualifies := array_append(v_qualifies, 'daily_quiz_streak_7'); end if;
  if v_daily_current >= 10 then v_qualifies := array_append(v_qualifies, 'daily_quiz_streak_10'); end if;

  insert into public.quiz_badges (user_id, badge_code)
  select v_user, item from unnest(v_qualifies) as item
  on conflict (user_id, badge_code) do nothing;

  -- 아래 select list 3개 컬럼은 이름이 아니라 위치 순서로 반환 타입(code, earned_ts, is_new)에 매핑된다.
  return query
    select b.badge_code, b.earned_at, not (b.badge_code = any(v_before))
    from public.quiz_badges b
    where b.user_id = v_user
    order by b.earned_at;
end;
$$;

grant execute on function public.evaluate_and_award_badges() to authenticated;
