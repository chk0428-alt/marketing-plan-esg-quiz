-- 애터미 수당체계 학습 퀴즈 앱 — 3단계(계정/로그인 + 학습이력 서버 동기화) DB 스키마
--
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
-- (Authentication은 Supabase가 기본 제공하는 이메일/비밀번호 로그인을 그대로 사용합니다.
--  별도 회원 테이블을 만들지 않고, auth.users를 참조합니다.)

-- 사용자별 학습 이력(오답노트 포함)을 1행에 JSON 형태로 저장한다.
-- 2단계 LocalStorage 구조(history, wrongIds)를 그대로 서버로 옮긴 형태다.
create table if not exists public.quiz_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  history jsonb not null default '{}'::jsonb,
  wrong_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 본인 행만 읽고/쓸 수 있도록 Row Level Security를 활성화한다.
alter table public.quiz_progress enable row level security;

drop policy if exists "quiz_progress_select_own" on public.quiz_progress;
create policy "quiz_progress_select_own"
  on public.quiz_progress for select
  using (auth.uid() = user_id);

drop policy if exists "quiz_progress_insert_own" on public.quiz_progress;
create policy "quiz_progress_insert_own"
  on public.quiz_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "quiz_progress_update_own" on public.quiz_progress;
create policy "quiz_progress_update_own"
  on public.quiz_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at을 upsert할 때마다 자동으로 갱신한다.
create or replace function public.set_quiz_progress_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_quiz_progress_updated_at on public.quiz_progress;
create trigger trg_quiz_progress_updated_at
  before update on public.quiz_progress
  for each row execute function public.set_quiz_progress_updated_at();
