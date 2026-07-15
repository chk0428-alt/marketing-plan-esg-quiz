-- 애터미 학습 퀴즈 앱 — 5-1단계(기념 컬렉션: 신규 데이터 없이 가능한 13종) 마이그레이션
--
-- 전제: supabase-schema.sql, supabase-schema-domain.sql, supabase-schema-leaderboard.sql,
--       supabase-schema-domain-stats.sql이 이미 실행되어 있어야 합니다
--       (quiz_progress.history/nickname, questions.domain/difficulty/category/is_active,
--        get_leaderboard(int, text) 포함).
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
--
-- 범위(PRD_5단계_기념카드.md 9절, 5-1단계): 마케팅플랜 6종 + ESG 6종 + 애터미 퍼펙트 1종 = 13종.
-- 학습 스트릭 6종(신규 날짜별 참여 이력 필요)은 5-3단계로 남겨둔다.

-- 1) 사용자가 보유한 컬렉션(뱃지)을 저장한다. badge_code는 클라이언트(collections.js)의
--    BADGES 목록과 1:1로 대응한다.
create table if not exists public.quiz_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

alter table public.quiz_badges enable row level security;

drop policy if exists "quiz_badges_select_own" on public.quiz_badges;
create policy "quiz_badges_select_own"
  on public.quiz_badges for select
  using (auth.uid() = user_id);

-- insert/update는 오직 아래 evaluate_and_award_badges()(SECURITY DEFINER)를 통해서만
-- 일어난다 — 클라이언트가 스스로 뱃지를 써넣을 수 있는 통로를 열어두지 않기 위해
-- authenticated에는 insert/update 정책을 별도로 부여하지 않는다.

-- 2) 현재 학습 데이터를 기준으로 13종 발급 조건을 판정하고, 새로 충족한 것을
--    quiz_badges에 기록한 뒤 보유 중인 전체 목록(신규 여부 포함)을 반환한다.
--    "전 문제 정답" 기준은 재응시로 결국 한 번이라도 정답 처리한 문항이면 인정한다
--    (PRD 7절의 잠정 제안을 그대로 따름 — 몇 번까지 재응시를 허용할지는 미확정 오픈 이슈).
-- 반환 컬럼명을 badge_code/earned_at이 아니라 code/earned_ts로 지어, quiz_badges 테이블의
-- 실제 컬럼명과 절대 겹치지 않게 한다 — RETURNS TABLE의 OUT 파라미터는 함수 본문 전체에서
-- 암묵적 변수로 취급되어, 이름이 같은 테이블 컬럼을 한정 없이 쓰면 "ambiguous" 오류가 난다.
-- 반환 타입(컬럼 구성) 자체가 이전 버전과 달라 create or replace만으로는 바꿀 수 없으므로
-- (Postgres 42P13 오류) 먼저 기존 함수를 완전히 지운다.
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
  v_qualifies text[] := '{}';
  v_before text[];
  v_domain text;
  v_diff text;
  v_prefix text;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select history, nickname into v_history, v_nickname
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

  -- unnest(...) as code라고 쓰면 반환 타입의 OUT 파라미터 code와 또 이름이 겹치므로 item으로 별칭한다.
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
