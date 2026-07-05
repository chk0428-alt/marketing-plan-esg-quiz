-- 2026-07-05: 유치함/학습가치 낮음 문제 삭제 + q159 정답 오류 수정
-- Supabase SQL Editor에서 관리자 계정으로 실행하세요.
-- (RLS: questions 테이블의 DELETE/UPDATE는 is_admin()만 허용됨)

-- 1) 학습 가치가 낮다고 판단해 삭제하기로 한 7문항
--    - q007, q049: 문제 본문에 답에 필요한 정보를 이미 다 제공해 단순 대소비교/날짜세기만 시킴
--    - q206~q210: 직급에 매겨진 임의의 "표기 번호"를 암기시킴 (실제 수당 계산과 무관)
delete from public.questions
where id in ('q007', 'q049', 'q206', 'q207', 'q208', 'q209', 'q210');

-- 2) q159 정답 오류 수정: "한국 다단계판매법"은 실존하지 않는 법률명이며,
--    실제로는 choices[3] "방문판매법"(방문판매 등에 관한 법률)이 맞는 답임.
update public.questions
set
  explanation = '방문판매 등에 관한 법률(약칭 방문판매법)상 총 매출액의 35%까지 수당 지급이 가능하다.',
  payload = jsonb_set(payload, '{answerIndex}', '3'::jsonb)
where id = 'q159';

-- 확인용 조회
select id, question, payload->>'answerIndex' as answer_index, explanation
from public.questions
where id = 'q159';

select count(*) as remaining_count from public.questions
where id in ('q007', 'q049', 'q206', 'q207', 'q208', 'q209', 'q210');
-- ↑ 정상적으로 삭제됐다면 0이 나와야 합니다.
