-- 2026-07-07: atomy_business_guide.html 기준 문서 대조 검증 결과 반영
-- Supabase SQL Editor에서 관리자 계정으로 실행하세요.
-- (RLS: questions 테이블의 DELETE/UPDATE는 is_admin()만 허용됨)

-- 1) 내용 판단이 필요해 삭제하기로 한 4문항
--    - q016, q018: 근거 문서에 없는 "2026.04.08 본인 PV 소실적 합산" 규정과 조건이
--      기준 문서(본인 PV 1만 PV 이상 조건)와 달라 삭제
--    - q048: 위 규정을 다시 묻는 문항이라 함께 삭제
--    - q160: 근거 없는 "현재 지급률 35.9%" 주장이 선택지에 남아있어 삭제
--      (동일 사유로 이전에 관련 문항 4개가 이미 삭제된 바 있음: q006/q010/q096/q164)
delete from public.questions
where id in ('q016', 'q018', 'q048', 'q160');

-- 2) "차차주 화요일"로 잘못 표기된 지급 시점을 "차주 화요일"(1주 시차)로 정정
--    기준 문서는 정산 종료 시점을 기준으로 항상 1주 뒤 지급된다고 명시함
--    (q133·q203은 정산 "시작"을 기준으로 2단계 떨어진 시점이라 "차차주"가 맞으므로 그대로 둠)

update public.questions
set
  explanation = '정산 완료 후 차주 화요일에 지급된다.',
  payload = jsonb_set(payload, '{choices}', '["정산 종료 다음날", "정산 종료 주의 금요일", "차주 화요일", "정산 종료 후 1개월 뒤"]'::jsonb)
where id = 'q042';

update public.questions
set
  explanation = '정산 종료 후 1주일 뒤인 차주 화요일에 지급된다.',
  payload = jsonb_set(payload, '{choices}', '["정산 종료 당일 지급", "정산 종료 후 1주일 뒤(차주 화요일) 지급", "정산 종료 후 1개월 뒤 지급", "정산 기간 중간에 지급"]'::jsonb)
where id = 'q046';

update public.questions
set
  explanation = '후원수당은 매일 정산되고 일주일간 합산되어 차주 화요일에 지급된다.',
  payload = jsonb_set(payload, '{choices}', '["매일 정산 후 주 단위 합산하여 차주 화요일 지급", "매일 정산 후 즉시 당일 지급", "월말 일괄 정산 후 익월 초 지급", "분기 정산 후 익분기 초 지급"]'::jsonb)
where id = 'q047';

update public.questions
set
  explanation = '후원수당은 매일 정산 후 일주일간 합산되어 차주 화요일에 지급된다.',
  payload = jsonb_set(payload, '{items}', '["판매일자 기준 매일 정산", "일주일간 정산 금액 합산", "차주 화요일 지급"]'::jsonb)
where id = 'q132';

update public.questions
set explanation = '정산 종료 후 7일 뒤(차주 화요일)에 지급된다.'
where id = 'q146';

update public.questions
set explanation = '정산 종료일로부터 7일 후(차주 화요일)에 지급된다.'
where id = 'q202';

-- 확인용 조회
select count(*) as remaining_count from public.questions
where id in ('q016', 'q018', 'q048', 'q160');
-- ↑ 정상적으로 삭제됐다면 0이 나와야 합니다.

select id, explanation, payload->'choices' as choices, payload->'items' as items
from public.questions
where id in ('q042', 'q046', 'q047', 'q132', 'q146', 'q202')
order by id;
