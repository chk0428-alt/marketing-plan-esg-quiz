-- "현재 지급률(35.9%)" 관련 문제 4개 삭제 (2026-07-06, 사용자 요청)
-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.

delete from public.questions where id in ('q006', 'q010', 'q096', 'q164');
