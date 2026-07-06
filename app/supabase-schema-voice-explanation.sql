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



update public.questions set voice_explanation_url = 'voice/q006.mp3' where id = 'q006';
update public.questions set voice_explanation_url = 'voice/q008.mp3' where id = 'q008';
update public.questions set voice_explanation_url = 'voice/q009.mp3' where id = 'q009';
update public.questions set voice_explanation_url = 'voice/q010.mp3' where id = 'q010';
update public.questions set voice_explanation_url = 'voice/q011.mp3' where id = 'q011';
update public.questions set voice_explanation_url = 'voice/q012.mp3' where id = 'q012';
update public.questions set voice_explanation_url = 'voice/q013.mp3' where id = 'q013';
update public.questions set voice_explanation_url = 'voice/q014.mp3' where id = 'q014';
update public.questions set voice_explanation_url = 'voice/q015.mp3' where id = 'q015';
update public.questions set voice_explanation_url = 'voice/q016.mp3' where id = 'q016';
update public.questions set voice_explanation_url = 'voice/q017.mp3' where id = 'q017';
update public.questions set voice_explanation_url = 'voice/q018.mp3' where id = 'q018';
update public.questions set voice_explanation_url = 'voice/q019.mp3' where id = 'q019';
update public.questions set voice_explanation_url = 'voice/q020.mp3' where id = 'q020';
update public.questions set voice_explanation_url = 'voice/q021.mp3' where id = 'q021';
update public.questions set voice_explanation_url = 'voice/q022.mp3' where id = 'q022';
update public.questions set voice_explanation_url = 'voice/q023.mp3' where id = 'q023';
update public.questions set voice_explanation_url = 'voice/q024.mp3' where id = 'q024';
update public.questions set voice_explanation_url = 'voice/q025.mp3' where id = 'q025';
update public.questions set voice_explanation_url = 'voice/q026.mp3' where id = 'q026';
update public.questions set voice_explanation_url = 'voice/q027.mp3' where id = 'q027';
update public.questions set voice_explanation_url = 'voice/q028.mp3' where id = 'q028';
update public.questions set voice_explanation_url = 'voice/q029.mp3' where id = 'q029';
update public.questions set voice_explanation_url = 'voice/q030.mp3' where id = 'q030';
update public.questions set voice_explanation_url = 'voice/q031.mp3' where id = 'q031';
update public.questions set voice_explanation_url = 'voice/q033.mp3' where id = 'q033';
update public.questions set voice_explanation_url = 'voice/q034.mp3' where id = 'q034';
update public.questions set voice_explanation_url = 'voice/q035.mp3' where id = 'q035';
update public.questions set voice_explanation_url = 'voice/q036.mp3' where id = 'q036';
update public.questions set voice_explanation_url = 'voice/q037.mp3' where id = 'q037';
update public.questions set voice_explanation_url = 'voice/q038.mp3' where id = 'q038';
update public.questions set voice_explanation_url = 'voice/q039.mp3' where id = 'q039';
update public.questions set voice_explanation_url = 'voice/q040.mp3' where id = 'q040';
update public.questions set voice_explanation_url = 'voice/q041.mp3' where id = 'q041';
update public.questions set voice_explanation_url = 'voice/q042.mp3' where id = 'q042';
update public.questions set voice_explanation_url = 'voice/q043.mp3' where id = 'q043';
update public.questions set voice_explanation_url = 'voice/q044.mp3' where id = 'q044';
update public.questions set voice_explanation_url = 'voice/q045.mp3' where id = 'q045';
update public.questions set voice_explanation_url = 'voice/q046.mp3' where id = 'q046';
update public.questions set voice_explanation_url = 'voice/q047.mp3' where id = 'q047';
update public.questions set voice_explanation_url = 'voice/q048.mp3' where id = 'q048';
update public.questions set voice_explanation_url = 'voice/q050.mp3' where id = 'q050';
update public.questions set voice_explanation_url = 'voice/q051.mp3' where id = 'q051';
update public.questions set voice_explanation_url = 'voice/q052.mp3' where id = 'q052';
update public.questions set voice_explanation_url = 'voice/q053.mp3' where id = 'q053';
