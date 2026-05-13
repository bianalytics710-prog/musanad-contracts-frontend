// Unit-3 R-OPS1/R-FT1/R-CES1 — fix C3 i18n root cause.
// M15 (CR-G) added 4 new persona dashboard keys (operations / financeTreasury /
// complianceEsg / procurement) as a SECOND top-level "dashboards" block. JSON.parse
// keeps the last value for duplicate keys, so the original block (common, admin,
// drafter, executive, legalCounsel, recipient, et al.) was being silently wiped at
// runtime. This script reads the file as text, captures both blocks, merges the
// second's child keys INTO the first, then re-emits a single-`dashboards` JSON.
//
// Runs against both en.json and ar.json. Idempotent.

const fs = require("fs");
const path = require("path");

const I18N_DIR = path.join(__dirname, "..", "src", "i18n");

function mergeDuplicateDashboards(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  // Parse the file as a sequence of (`"dashboards":` block start, contents, end).
  // Use a brace counter to find each block's matching close.
  const keyRe = /\n  "dashboards": \{/g;
  const matches = [];
  let m;
  while ((m = keyRe.exec(raw)) !== null) {
    const start = m.index + 1; // skip the leading \n
    const openBrace = raw.indexOf("{", start);
    let depth = 1;
    let i = openBrace + 1;
    while (i < raw.length && depth > 0) {
      const ch = raw[i];
      if (ch === '"') {
        // Skip strings (handle escapes)
        i++;
        while (i < raw.length && raw[i] !== '"') {
          if (raw[i] === "\\") i++;
          i++;
        }
      } else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    matches.push({ start, end: i, openBrace });
  }
  if (matches.length < 2) {
    console.log(`${path.basename(filePath)}: only ${matches.length} dashboards block — no merge needed.`);
    return;
  }
  if (matches.length > 2) {
    throw new Error(`${path.basename(filePath)}: ${matches.length} dashboards blocks — manual fix needed.`);
  }
  // Reconstruct: take everything before the second block (minus trailing comma),
  // splice the second block's CONTENTS into the first block (before its closing brace),
  // then continue after the second block.
  const [first, second] = matches;
  // First block body: from openBrace+1 to first.end-1 (the "}")
  const firstBody = raw.slice(first.openBrace + 1, first.end - 1).trimEnd();
  const secondBody = raw.slice(second.openBrace + 1, second.end - 1).trimEnd();
  // Determine if firstBody ends with "," or needs one
  const firstBodyNeedsComma = !firstBody.trimEnd().endsWith(",");
  const merged =
    "\n  \"dashboards\": {" +
    firstBody +
    (firstBodyNeedsComma ? "," : "") +
    secondBody +
    "\n  }";
  // Pre-first chunk
  const pre = raw.slice(0, first.start - 1); // -1 to drop the \n we added
  // Between first and second: need to drop the trailing comma + newline + second block.
  // Actually: from first.end to second.start-1 is the gap (other top-level keys).
  // The second block must be REMOVED entirely (its trailing comma too if any).
  const gap = raw.slice(first.end, second.start - 1);
  // After second block: from second.end onward. If second block was followed by ","
  // (because it was not the last key), preserve that as-is. If it was the last key,
  // the gap before it would have ended in "," that we now need to strip.
  let post = raw.slice(second.end);
  // Determine whether second was the LAST top-level key (post starts with "\n}" possibly)
  // by looking for non-whitespace
  const postTrimmed = post.replace(/^\s*/, "");
  const secondWasLast = postTrimmed.startsWith("}");
  // The character before second.start (after gap) is either ',' (second was not last)
  // or some other key's close. If second was LAST and the key BEFORE it (in gap)
  // ended with ",", we need to convert that "," to "" since the second block is gone.
  let finalGap = gap;
  if (secondWasLast) {
    // Trim trailing whitespace and a comma if present
    finalGap = gap.replace(/,(\s*)$/, "$1");
  }
  // If second was NOT last, the "," after it should remain since we replaced second
  // with nothing — but actually post.startsWith(",") needs to be dropped if second was
  // moved into first (no longer a top-level key here).
  if (!secondWasLast && post.startsWith(",")) {
    post = post.slice(1);
  }
  const out = pre + merged + finalGap + post;
  // Validate JSON
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch (e) {
    fs.writeFileSync(filePath + ".debug.bad", out);
    throw new Error(`${path.basename(filePath)}: merged output is invalid JSON: ${e.message}. Wrote debug to ${filePath}.debug.bad`);
  }
  if (!parsed.dashboards || typeof parsed.dashboards !== "object") {
    throw new Error("Merged JSON has no .dashboards");
  }
  const childKeys = Object.keys(parsed.dashboards);
  console.log(
    `${path.basename(filePath)}: merged. Dashboards now has ${childKeys.length} children: ${childKeys.join(", ")}`,
  );
  // Verify the common.timeRangeLabel survives
  if (!parsed.dashboards.common || !parsed.dashboards.common.timeRangeLabel) {
    throw new Error(`${path.basename(filePath)}: dashboards.common.timeRangeLabel missing after merge.`);
  }
  if (!parsed.dashboards.operations || !parsed.dashboards.operations.title) {
    throw new Error(`${path.basename(filePath)}: dashboards.operations.title missing after merge.`);
  }
  fs.writeFileSync(filePath, out, "utf8");
}

mergeDuplicateDashboards(path.join(I18N_DIR, "en.json"));
mergeDuplicateDashboards(path.join(I18N_DIR, "ar.json"));

console.log("OK");
