const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'questions.js'), 'utf8');
const fn = new Function(src + '\nreturn {CATEGORIES, QUESTIONS};');
const { QUESTIONS } = fn();

function payloadFor(q) {
  if (q.type === 'mc') return { choices: q.choices, answerIndex: q.answerIndex };
  if (q.type === 'ox') return { answer: q.answer };
  if (q.type === 'fill') return { answer: q.answer, acceptableAnswers: q.acceptableAnswers || [] };
  if (q.type === 'calc') return { answer: q.answer, unit: q.unit || '' };
  if (q.type === 'order') return { items: q.items };
  if (q.type === 'match') return { pairs: q.pairs };
  throw new Error('unknown type ' + q.type);
}

function sqlStr(jsValue) {
  // dollar-quote a JSON string literal for use as ::text before ::jsonb cast
  const json = JSON.stringify(jsValue);
  return '$q$' + json + '$q$';
}

function sqlText(str) {
  return '$q$' + str + '$q$';
}

const NEW_ID_START = 157;
const newQuestions = QUESTIONS.filter(q => {
  const n = parseInt(q.id.slice(1), 10);
  return n >= NEW_ID_START;
});

const REWORDED_IDS = ['q033', 'q037', 'q040', 'q137', 'q138', 'q139', 'q140', 'q141', 'q142', 'q147'];
const reworded = QUESTIONS.filter(q => REWORDED_IDS.includes(q.id));

let out = [];
out.push('-- 애터미 수당체계 학습 퀴즈 — 3단계 문제 확장 마이그레이션 (100문항 추가 + 기존 N가 표현 정리)');
out.push('-- 전제: supabase-schema-questions-cms.sql이 이미 실행되어 있어야 합니다.');
out.push('-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 전체를 붙여넣고 실행하세요.');
out.push('');
out.push('-- 1) N가는 변동값이므로 "현재 N가는 얼마인가?" 식의 암기형 문제 2개를 삭제합니다.');
out.push("delete from public.questions where id in ('q032', 'q122');");
out.push('');
out.push('-- 2) 기존 계산 문제의 "현재 N가(3,502원)" 표현을 "N가를 3,502원이라고 가정할 때"로 정리합니다.');
reworded.forEach(q => {
  out.push(
    `update public.questions set question = ${sqlText(q.question)}, explanation = ${sqlText(q.explanation)}, updated_at = now() where id = '${q.id}';`
  );
});
out.push('');
out.push('-- 3) 신규 문제 100개(q157~q256)를 추가합니다.');
out.push('insert into public.questions (id, category, type, difficulty, tags, question, explanation, payload) values');

const rows = newQuestions.map(q => {
  const payload = payloadFor(q);
  return `  ('${q.id}', ${sqlText(q.category)}, '${q.type}', '${q.difficulty}', ${sqlStr(q.tags)}::jsonb, ${sqlText(q.question)}, ${sqlText(q.explanation)}, ${sqlStr(payload)}::jsonb)`;
});
out.push(rows.join(',\n') + '\non conflict (id) do nothing;');
out.push('');

fs.writeFileSync(path.join(__dirname, '..', 'app', 'supabase-schema-questions-batch2.sql'), out.join('\n'));
console.log('wrote', newQuestions.length, 'new questions,', reworded.length, 'reworded, sql file created');
