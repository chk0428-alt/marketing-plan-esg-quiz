const fs = require("fs");
const path = require("path");

var idsToDelete = process.argv.slice(2);
if (idsToDelete.length === 0) {
  console.error("usage: delete-questions.js <id> [id...]");
  process.exit(1);
}

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

idsToDelete.forEach(function (id) {
  var idLine = findIdLine(id);
  if (idLine === undefined) {
    console.error("id not found:", id);
    return;
  }
  var openLine = idLine;
  while (openLine > 0 && lines[openLine - 1].trim() !== "{") openLine--;
  openLine--; // include the "{" line itself
  var depth = 0;
  var closeLine = -1;
  for (var j = openLine; j < lines.length; j++) {
    var opens = (lines[j].match(/\{/g) || []).length;
    var closes = (lines[j].match(/\}/g) || []).length;
    depth += opens - closes;
    if (depth === 0) {
      closeLine = j;
      break;
    }
  }
  if (closeLine === -1) {
    console.error("could not find closing brace for", id);
    return;
  }
  // also remove a trailing blank line right after, if present (keeps spacing tidy)
  var end = closeLine + 1;
  var removed = lines.splice(openLine, end - openLine);
  console.log("deleted", id, "(" + removed.length + " lines)");
});

fs.writeFileSync(qPath, lines.join(eol));
