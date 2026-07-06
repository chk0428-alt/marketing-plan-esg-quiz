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
    .replace(/(\d{1,2})\/(\d{1,2})/g, function (whole, m, d) {
      return m + "월 " + d + "일";
    })
    .replace(/([(,]\s*)(월|화|수|목|금|토|일)\)/g, function (whole, prefix, day) {
      return prefix + day + "요일)";
    });
}

var code = fs.readFileSync(path.join(__dirname, "../app/questions.js"), "utf8");
var g = {};
new Function("window", code + "; window.QUESTIONS = QUESTIONS;")(g);

var remaining = g.QUESTIONS.filter(function (q) {
  return !q.voiceExplanationUrl;
}).map(function (q) {
  return { id: q.id, ttsText: spellOutDates(spellOutPercent(q.explanation)) };
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
