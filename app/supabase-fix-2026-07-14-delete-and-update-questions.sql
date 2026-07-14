-- 2026-07-14: 사용자 요청 문제 데이터 일괄 수정 (questions.js 반영분을 Supabase questions 테이블에도 동기화)
-- Supabase SQL Editor에서 관리자 계정으로 실행하세요.
-- (RLS: questions 테이블의 DELETE/UPDATE는 is_admin()만 허용됨)

-- 1) 문항 품질/중복 이유로 삭제하기로 한 29문항
delete from public.questions
where id in ('q013', 'q015', 'q019', 'q027', 'q035', 'q036', 'q037', 'q043', 'q044', 'q046', 'q050', 'q055', 'q056', 'q057', 'q058', 'q059', 'q064', 'q065', 'q066', 'q067', 'q068', 'q081', 'q086', 'q088', 'q091', 'q092', 'q093', 'q094', 'q104');

-- 2) N가 예시값을 3,502원 -> 4,000원으로 변경 (계산 문제 18개, 정답/보기/해설 재계산)
update public.questions set question = $q$N가를 4,000원이라고 가정할 때, 15점을 취득했다면 후원수당 금액은 얼마인가?$q$, explanation = $q$15점 × 4,000원 = 60,000원이다.$q$, payload = $q${"choices":["40,000원","45,000원","60,000원","80,000원"],"answerIndex":2}$q$::jsonb, updated_at = now() where id = 'q033';
update public.questions set question = $q$N가를 4,000원이라고 가정할 때, 30점을 취득했다면 후원수당 금액은 얼마인가?$q$, explanation = $q$30점 × 4,000원 = 120,000원이다.$q$, payload = $q${"choices":["80,000원","100,000원","120,000원","140,000원"],"answerIndex":2}$q$::jsonb, updated_at = now() where id = 'q040';
update public.questions set question = $q$본인 등급이 '회원'인 사람이 8급 점수(5점)를 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (단위: 원, 콤마 없이 숫자만 입력)$q$, explanation = $q$5점 × 4,000원 = 20,000원$q$, payload = $q${"answer":"20000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q137';
update public.questions set question = $q$5급(60점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$60점 × 4,000원 = 240,000원$q$, payload = $q${"answer":"240000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q138';
update public.questions set question = $q$4급(90점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$90점 × 4,000원 = 360,000원$q$, payload = $q${"answer":"360000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q139';
update public.questions set question = $q$3급(150점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$150점 × 4,000원 = 600,000원$q$, payload = $q${"answer":"600000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q140';
update public.questions set question = $q$2급(250점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$250점 × 4,000원 = 1,000,000원$q$, payload = $q${"answer":"1000000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q141';
update public.questions set question = $q$1급(300점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$300점 × 4,000원 = 1,200,000원$q$, payload = $q${"answer":"1200000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q142';
update public.questions set question = $q$본인 등급이 '회원'인 사람이 소실적 30만 PV 달성으로 5점을 두 차례 취득했다. 합산 점수 기준, N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$5점 + 5점 = 10점, 10점 × 4,000원 = 40,000원$q$, payload = $q${"answer":"40000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q147';
update public.questions set question = $q$7급(15점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$15점 × 4,000원 = 60,000원$q$, payload = $q${"answer":"60000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q183';
update public.questions set question = $q$6급(30점)을 취득했다. N가를 4,000원이라고 가정할 때 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$30점 × 4,000원 = 120,000원$q$, payload = $q${"answer":"120000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q184';
update public.questions set question = $q$6급(30점)과 7급(15점)을 함께 취득했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$30점 + 15점 = 45점, 45점 × 4,000원 = 180,000원$q$, payload = $q${"answer":"180000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q185';
update public.questions set question = $q$4급(90점)을 두 차례 취득했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$90점 + 90점 = 180점, 180점 × 4,000원 = 720,000원$q$, payload = $q${"answer":"720000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q186';
update public.questions set question = $q$5급(60점)과 4급(90점)을 함께 취득했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$60점 + 90점 = 150점, 150점 × 4,000원 = 600,000원$q$, payload = $q${"answer":"600000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q187';
update public.questions set question = $q$3급(150점)에 해당하는 실적과 2급(250점)에 해당하는 실적을 함께 취득했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$150점 + 250점 = 400점, 400점 × 4,000원 = 1,600,000원$q$, payload = $q${"answer":"1600000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q188';
update public.questions set question = $q$1급(300점)에 이어 다음날 8급(5점)이 추가로 발생했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$300점 + 5점 = 305점, 305점 × 4,000원 = 1,220,000원$q$, payload = $q${"answer":"1220000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q189';
update public.questions set question = $q$2급(250점)과 8급(5점)을 함께 취득했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$250점 + 5점 = 255점, 255점 × 4,000원 = 1,020,000원$q$, payload = $q${"answer":"1020000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q191';
update public.questions set question = $q$6급(30점)을 네 차례 취득했다. N가를 4,000원이라고 가정할 때, 합산 점수 기준 후원수당 금액은 얼마인가? (숫자만 입력)$q$, explanation = $q$30점 × 4 = 120점, 120점 × 4,000원 = 480,000원$q$, payload = $q${"answer":"480000","unit":"원"}$q$::jsonb, updated_at = now() where id = 'q192';

-- 3) '승급 프로모션' 표현을 '승급시 현금 지급액'으로 변경 (7문항, 보기/정답은 변경 없음)
update public.questions set question = $q$세일즈마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$세일즈마스터 승급시 현금 지급액은 50만원이다.$q$, updated_at = now() where id = 'q071';
update public.questions set question = $q$다이아몬드마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$다이아몬드마스터 승급시 현금 지급액은 150만원이다.$q$, updated_at = now() where id = 'q072';
update public.questions set question = $q$샤론로즈마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$샤론로즈마스터 승급시 현금 지급액은 200만원이다.$q$, updated_at = now() where id = 'q073';
update public.questions set question = $q$스타마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$스타마스터 승급시 현금 지급액은 1,000만원이다.$q$, updated_at = now() where id = 'q074';
update public.questions set question = $q$로열마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$로열마스터 승급시 현금 지급액은 5,000만원이다.$q$, updated_at = now() where id = 'q075';
update public.questions set question = $q$크라운마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$크라운마스터 승급시 현금 지급액은 3억원이다.$q$, updated_at = now() where id = 'q076';
update public.questions set question = $q$임페리얼마스터 승급시 현금 지급액 금액은?$q$, explanation = $q$임페리얼마스터 승급시 현금 지급액은 10억원이다.$q$, updated_at = now() where id = 'q077';

-- 확인용 조회
select count(*) as remaining_deleted_count from public.questions
where id in ('q013', 'q015', 'q019', 'q027', 'q035', 'q036', 'q037', 'q043', 'q044', 'q046', 'q050', 'q055', 'q056', 'q057', 'q058', 'q059', 'q064', 'q065', 'q066', 'q067', 'q068', 'q081', 'q086', 'q088', 'q091', 'q092', 'q093', 'q094', 'q104');
-- ↑ 정상적으로 삭제됐다면 0이 나와야 합니다.

select id, question, explanation, payload from public.questions
where id in ('q033', 'q040', 'q137', 'q138', 'q139', 'q140', 'q141', 'q142', 'q147', 'q183', 'q184', 'q185', 'q186', 'q187', 'q188', 'q189', 'q191', 'q192', 'q071', 'q072', 'q073', 'q074', 'q075', 'q076', 'q077')
order by id;
