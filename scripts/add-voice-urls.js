const fs = require("fs");
const path = require("path");

var batchPath = process.argv[2];
if (!batchPath) {
  console.error("usage: add-voice-urls.js <batch-json-path>");
  process.exit(1);
}
var items = JSON.parse(fs.readFileSync(batchPath, "utf8"));

var qPath = path.join(__dirname, "../app/questions.js");
var raw = fs.readFileSync(qPath, "utf8");
var eol = raw.includes("\r\n") ? "\r\n" : "\n";
var lines = raw.split(/\r\n|\n/);

function findIdLine(id) {
  var target = '    id: "' + id + '",';
  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === target) return i;
  }
  return undefined;
}

var sqlLines = [];
var appliedCount = 0;

items.forEach(function (item) {
  var startLine = findIdLine(item.id);
  if (startLine === undefined) {
    console.error("id not found in questions.js:", item.id);
    return;
  }
  // walk forward from the object's opening line to find the matching top-level
  // closing "  }," (2-space indent) — the object literal that contains this id.
  var openLine = startLine;
  while (openLine > 0 && lines[openLine - 1].trim() !== "{") openLine--;
  var depth = 0;
  var closeLine = -1;
  for (var j = openLine - 1; j < lines.length; j++) {
    var opens = (lines[j].match(/\{/g) || []).length;
    var closes = (lines[j].match(/\}/g) || []).length;
    depth += opens - closes;
    if (j >= openLine - 1 && depth === 0) {
      closeLine = j;
      break;
    }
  }
  if (closeLine === -1) {
    console.error("could not find closing brace for", item.id);
    return;
  }
  if (lines.slice(openLine, closeLine).some(function (l) { return l.includes("voiceExplanationUrl"); })) {
    return; // already present
  }
  var lastFieldLine = closeLine - 1;
  var trimmed = lines[lastFieldLine].replace(/,\s*$/, "");
  lines[lastFieldLine] = trimmed + ",";
  lines.splice(closeLine, 0, '    voiceExplanationUrl: "voice/' + item.id + '.mp3"');
  appliedCount++;
  sqlLines.push(
    "update public.questions set voice_explanation_url = 'voice/" + item.id + ".mp3' where id = '" + item.id + "';"
  );
});

fs.writeFileSync(qPath, lines.join(eol));

var sqlPath = path.join(__dirname, "../app/supabase-schema-voice-explanation.sql");
var sqlRaw = fs.readFileSync(sqlPath, "utf8");
var sqlEol = sqlRaw.includes("\r\n") ? "\r\n" : "\n";
fs.appendFileSync(sqlPath, sqlEol + sqlLines.join(sqlEol) + sqlEol);

console.log("applied to questions.js:", appliedCount);
console.log("sql statements appended:", sqlLines.length);
