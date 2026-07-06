const fs = require("fs");
const path = require("path");

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL_UNITS = ["", "십", "백", "천"];

function sinoKoreanInt(n) {
  if (n === 0) return "영";
  var groups = [];
  var big = ["", "만", "억"];
  var num = n;
  while (num > 0) {
    groups.push(num % 10000);
    num = Math.floor(num / 10000);
  }
  var parts = [];
  for (var g = groups.length - 1; g >= 0; g--) {
    var chunk = groups[g];
    if (chunk === 0) continue;
    var s = "";
    var digits = String(chunk).split("").reverse();
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = Number(digits[i]);
      if (d === 0) continue;
      var prefix = d === 1 && i > 0 ? "" : DIGITS[d];
      s += prefix + SMALL_UNITS[i];
    }
    parts.push(s + big[g]);
  }
  return parts.join("") || "영";
}

function sinoKoreanNumber(text) {
  var m = text.match(/^(\d+)(\.(\d+))?$/);
  if (!m) return null;
  var intPart = sinoKoreanInt(parseInt(m[1], 10));
  if (!m[3]) return intPart;
  var decDigits = m[3].split("").map(function (d) {
    return DIGITS[Number(d)] || "영";
  });
  return intPart + " 점 " + decDigits.join(" ");
}

function spellOutPercent(text) {
  return text.replace(/(\d+(?:\.\d+)?)\s*%p\b/gi, function (whole, numStr) {
    var reading = sinoKoreanNumber(numStr);
    return reading ? reading + " 퍼센트포인트" : whole;
  }).replace(/(\d+(?:\.\d+)?)\s*%/g, function (whole, numStr) {
    var reading = sinoKoreanNumber(numStr);
    return reading ? reading + " 퍼센트" : whole;
  });
}

function spellOutDates(text) {
  return text
    .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g, function (whole, y, m, d) {
      return sinoKoreanInt(parseInt(y, 10)) + "년 " + sinoKoreanInt(parseInt(m, 10)) + "월 " + sinoKoreanInt(parseInt(d, 10)) + "일";
    })
    .replace(/(\d{1,2})\/(\d{1,2})/g, function (whole, m, d) {
      return m + "월 " + d + "일";
    })
    .replace(/([(,]\s*)(월|화|수|목|금|토|일)\)/g, function (whole, prefix, day) {
      return prefix + day + "요일)";
    })
    .replace(/\s*~\s*/g, "부터 ");
}

var NATIVE_ONES = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉"];
var NATIVE_ONES_ATTR = { 1: "한", 2: "두", 3: "세", 4: "네" };
var NATIVE_TENS = { 10: "열", 20: "스물", 30: "서른", 40: "마흔", 50: "쉰", 60: "예순", 70: "일흔", 80: "여든", 90: "아흔" };
// 명/개/번/배/대처럼 순우리말 수사와 결합하는 단위. 년/월/일/원/회/단계 등은 한자어 수사를 쓰므로 제외한다.
// "대"는 "4대 수당"처럼 한자어 접두 표현(사대)으로도 흔히 쓰여 목록에서 제외했다
// (차량 대수를 세는 "두 대" 같은 용법은 이 앱 문제 데이터에 등장하지 않는다).
var NATIVE_COUNTERS = [
  "명", "개", "번", "살", "마리", "그루", "자루", "병", "잔", "채", "켤레", "벌",
  "장", "군데", "곳", "배", "줄", "팀", "쌍", "포기", "다발", "컵", "차례", "가지", "달", "주", "시간"
];

function nativeKoreanInt(n) {
  if (n === 0) return "영";
  if (n > 99) return null;
  var tens = Math.floor(n / 10) * 10;
  var ones = n % 10;
  var s = "";
  if (tens > 0) {
    if (tens === 20 && ones === 0) s += "스무";
    else s += NATIVE_TENS[tens];
  }
  if (ones > 0) {
    s += NATIVE_ONES_ATTR[ones] || NATIVE_ONES[ones];
  }
  return s;
}

function spellOutGeneralNumbers(text) {
  return text.replace(/(\d+(?:,\d{3})*(?:\.\d+)?)([가-힣]*)/g, function (whole, numStr, tail) {
    var clean = numStr.replace(/,/g, "");
    var isNativeCounter = NATIVE_COUNTERS.some(function (c) {
      return tail.indexOf(c) === 0;
    });
    if (isNativeCounter && /^\d+$/.test(clean)) {
      var native = nativeKoreanInt(parseInt(clean, 10));
      if (native) return native + tail;
    }
    var reading = sinoKoreanNumber(clean);
    return reading ? reading + tail : whole;
  });
}

// 자동 변환 결과가 부자연스러운 특정 문항은 여기서 TTS 낭독용 문구를 직접 지정한다
// (화면에 보이는 explanation 텍스트 자체는 건드리지 않는다).
var TTS_OVERRIDES = {
  q043: "예시에 따르면 삼월삼일부터 삼월구일 정산분은 삼월십육일 화요일에 일괄 지급된다.",
  q221: "일일부터 십오일, 십육일부터 말일 기준 두 라인 각각의 산하 판매실적이 이백오십만 피브이 이상이어야 한다."
};

// 영문 알파벳/약어는 TTS가 못 읽으므로 한글 음가로 바꾼다.
function spellOutLetterVars(text) {
  return text.replace(/\bN가/g, "앤가").replace(/PV/g, "피브이");
}

// ×/÷/=/+는 이 문제 데이터에서 항상 산술 기호로만 쓰인다. "-"는 영문 합성어
// (Inside-out, 비스페놀-A 등)에도 쓰이므로, 숫자(+선택적 단위 1~3글자) 바로
// 뒤에 오는 경우로만 좁혀서 뺄셈으로 바꾼다.
function spellOutMathSymbols(text) {
  return text
    .replace(/1\+1/g, "원플러스원")
    .replace(/×/g, " 곱하기 ")
    .replace(/÷/g, " 나누기 ")
    .replace(/=/g, " 는 ")
    .replace(/\+/g, " 더하기 ")
    .replace(/([\d,.]+[가-힣]{0,3})\s*-\s*(?=\d)/g, "$1 빼기 ")
    .replace(/\s*→\s*/g, ", ");
}

function toTtsText(explanation, id) {
  if (id && TTS_OVERRIDES[id]) return TTS_OVERRIDES[id];
  var result = spellOutGeneralNumbers(spellOutDates(spellOutPercent(spellOutMathSymbols(spellOutLetterVars(explanation)))));
  return result.replace(/\s+/g, " ").trim();
}

module.exports = { toTtsText, spellOutPercent, spellOutDates, spellOutGeneralNumbers, sinoKoreanNumber, nativeKoreanInt, TTS_OVERRIDES };

if (require.main === module) {
  var code = fs.readFileSync(path.join(__dirname, "../app/questions.js"), "utf8");
  var g = {};
  new Function("window", code + "; window.QUESTIONS = QUESTIONS;")(g);

  var remaining = g.QUESTIONS.filter(function (q) {
    return !q.voiceExplanationUrl;
  }).map(function (q) {
    return { id: q.id, ttsText: toTtsText(q.explanation, q.id) };
  });

  var BATCH_COUNT = Number(process.argv[2] || 10);
  var START_STAGE = Number(process.argv[3] || 1);
  var batchSize = Math.ceil(remaining.length / BATCH_COUNT);
  var outDir = path.join(__dirname, "_voice_batches");
  fs.mkdirSync(outDir, { recursive: true });

  for (var b = 0; b < BATCH_COUNT; b++) {
    var slice = remaining.slice(b * batchSize, (b + 1) * batchSize);
    if (slice.length === 0) continue;
    var num = String(START_STAGE + b).padStart(2, "0");
    fs.writeFileSync(path.join(outDir, "batch" + num + ".json"), JSON.stringify(slice, null, 2));
    console.log("batch" + num + ": " + slice.length + " questions");
  }
  console.log("total remaining:", remaining.length);
}
