const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'questions.js'), 'utf8');
const fn = new Function(src + '\nreturn {ESG_QUESTIONS};');
const { ESG_QUESTIONS } = fn();

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
  const json = JSON.stringify(jsValue);
  return '$q$' + json + '$q$';
}

function sqlText(str) {
  return '$q$' + str + '$q$';
}

let out = [];
out.push('-- 애터미 학습 퀴즈 앱 — 4-2단계(ESG 콘텐츠) 시드 데이터');
out.push('--');
out.push('-- 전제: supabase-schema.sql, supabase-schema-questions-cms.sql, supabase-schema-domain.sql이');
out.push('-- 이미 실행되어 있어야 합니다 (questions 테이블에 domain/report_year/is_active 컬럼 필요).');
out.push('-- report_page 컬럼이 없다면 먼저 아래를 실행하세요:');
out.push('--   alter table public.questions add column if not exists report_page int;');
out.push('-- 사용 방법: Supabase 대시보드 > SQL Editor > New query 에 아래 전체를 붙여넣고 실행하세요.');
out.push('--');
out.push('-- 2025_ATOMY_ESG_REPORT_v1.pdf 원문을 근거로 작성한 ESG REPORT 도메인 문항 200개(e001~e200) 중');
out.push('-- 저품질/중복 4개(e030, e031, e103, e171)를 제외한 ' + ESG_QUESTIONS.length + '문항을 questions 테이블에 등록한다.');
out.push('-- 이미 존재하는 id는 내용을 덮어써 항상 questions.js 스냅샷과');
out.push('-- 동일하게 맞춘다(questions.js가 오프라인 폴백 기준 원본).');
out.push('');
out.push('insert into public.questions (id, domain, category, report_year, report_page, is_active, type, difficulty, tags, question, explanation, payload)');
out.push('values');

const rows = ESG_QUESTIONS.map(q => {
  const payload = payloadFor(q);
  return `('${q.id}', 'esg', ${sqlText(q.category)}, ${q.reportYear}, ${q.reportPage}, ${q.active}, '${q.type}', '${q.difficulty}', ${sqlStr(q.tags)}::jsonb, ${sqlText(q.question)}, ${sqlText(q.explanation)}, ${sqlStr(payload)}::jsonb)`;
});
out.push(rows.join(',\n'));
out.push('on conflict (id) do update set');
out.push('  domain = excluded.domain,');
out.push('  category = excluded.category,');
out.push('  report_year = excluded.report_year,');
out.push('  report_page = excluded.report_page,');
out.push('  is_active = excluded.is_active,');
out.push('  type = excluded.type,');
out.push('  difficulty = excluded.difficulty,');
out.push('  tags = excluded.tags,');
out.push('  question = excluded.question,');
out.push('  explanation = excluded.explanation,');
out.push('  payload = excluded.payload,');
out.push('  updated_at = now();');
out.push('');

fs.writeFileSync(path.join(__dirname, '..', 'app', 'supabase-schema-questions-esg.sql'), out.join('\n'));
console.log('wrote', ESG_QUESTIONS.length, 'esg questions to supabase-schema-questions-esg.sql');
