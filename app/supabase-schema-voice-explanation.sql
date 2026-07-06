-- 오답 시 "회장님 음성으로 듣기" 기능 — questions 테이블에 음성 URL 컬럼 추가
-- 전제: supabase-schema-questions-cms.sql이 이미 실행되어 있어야 합니다.
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.

alter table public.questions
  add column if not exists voice_explanation_url text;

-- 파일럿: 문제 5개(q001~q005)에만 음성 파일 연결. 경로는 앱의 app/voice/ 폴더 기준
-- 상대경로이며, questions.js의 voiceExplanationUrl과 동일한 값이어야 한다.
update public.questions set voice_explanation_url = 'voice/q001.mp3' where id = 'q001';
update public.questions set voice_explanation_url = 'voice/q002.mp3' where id = 'q002';
update public.questions set voice_explanation_url = 'voice/q003.mp3' where id = 'q003';
update public.questions set voice_explanation_url = 'voice/q004.mp3' where id = 'q004';
update public.questions set voice_explanation_url = 'voice/q005.mp3' where id = 'q005';
