-- 애터미 학습 퀴즈 앱 — 4-1단계(도메인 인프라: 마케팅플랜/ESG REPORT) 마이그레이션
--
-- 전제: supabase-schema.sql, supabase-schema-questions-cms.sql이 이미 실행되어 있어야 합니다.
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.
--
-- 이 마이그레이션은 questions 테이블에 "도메인(과목)" 구분을 위한 컬럼만 추가한다.
-- 실제 ESG 문항 데이터는 4-2단계에서, 3종 랭킹/도메인별 통계 RPC 파라미터화는
-- 4-3단계에서 별도 마이그레이션으로 추가한다(PRD_4-3단계_통계운영고도화.md 참고).

-- 1) domain: 문제가 속한 학습 영역. 기존 행은 모두 마케팅플랜이므로 기본값으로
--    자동 채워진다 (기존 254문항에 대한 별도 UPDATE가 필요 없다).
--    유효한 도메인 목록은 클라이언트(questions.js의 DOMAINS 배열)가 기준이며,
--    여기서는 값 자체를 하드코딩된 CHECK로 제한하지 않는다 — 향후 3번째 이상의
--    도메인이 추가될 때 매번 제약조건 마이그레이션이 필요해지는 것을 피하기 위함.
alter table public.questions
  add column if not exists domain text not null default 'marketing_plan';

-- 2) report_year: ESG처럼 매년 개정되는 콘텐츠의 발행 연도. 마케팅플랜 문항에는
--    해당 사항이 없으므로 nullable로 둔다. (실제 값은 4-2단계에서 ESG 문항 등록 시 채움)
alter table public.questions
  add column if not exists report_year int;

-- 3) is_active: 콘텐츠 개정 시 구 연도 문항을 삭제 대신 비활성 보관하기 위한 플래그.
--    신규 출제 쿼리는 is_active = true만 대상으로 하고, 이력/오답노트/통계 조회는
--    이 조건 없이 조회해 과거 기록이 깨지지 않도록 한다(4-3단계에서 실제 활용).
alter table public.questions
  add column if not exists is_active boolean not null default true;

-- 4) 도메인 필터가 잦을 것으로 예상되므로 인덱스를 추가한다.
create index if not exists idx_questions_domain on public.questions (domain);
