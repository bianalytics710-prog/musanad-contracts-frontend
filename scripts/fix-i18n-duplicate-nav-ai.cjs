// Post-Unit-3 / M15 retro QA Stage 4 — fix CR-G-8 i18n root cause.
// M15 / CR-G appended NEW `"nav"` and `"ai"` top-level blocks at the bottom of
// en.json + ar.json instead of merging into the existing ones. JSON.parse keeps
// only the LAST occurrence of a duplicate key, so:
//   - original `nav.{insights/contracts/templates/.../admin/...}` was wiped
//   - original `ai.{errors/insights/...}` was wiped
// Mitigated at runtime because t() uses defaultValue fallbacks, but AR users
// see English fallback for every wiped key. This script merges the duplicate
// blocks into one for BOTH `nav` and `ai`, keeping all entries.
//
// Generic merger: reads a key name, finds all top-level blocks for that key,
// merges their CHILD keys into one block, deletes the duplicates. Idempotent.

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'i18n');
const KEYS_TO_MERGE = ['nav', 'ai'];

function mergeDuplicateKey(filePath, keyName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const keyRe = new RegExp(`\\n  "${keyName}": \\{`, 'g');
  const matches = [];
  let m;
  while ((m = keyRe.exec(raw)) !== null) {
    const start = m.index + 1;
    const openBrace = raw.indexOf('{', start);
    let depth = 1;
    let i = openBrace + 1;
    while (i < raw.length && depth > 0) {
      const ch = raw[i];
      if (ch === '"') {
        i++;
        while (i < raw.length && raw[i] !== '"') {
          if (raw[i] === '\\') i++;
          i++;
        }
      } else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    matches.push({ start, end: i, openBrace });
  }
  if (matches.length < 2) {
    console.log(`${path.basename(filePath)} :: "${keyName}" — ${matches.length} block(s), no merge needed.`);
    return raw;
  }
  if (matches.length > 2) {
    throw new Error(`${path.basename(filePath)} :: "${keyName}" has ${matches.length} blocks — manual fix needed.`);
  }
  const [first, second] = matches;
  const firstBody = raw.slice(first.openBrace + 1, first.end - 1).trimEnd();
  const secondBody = raw.slice(second.openBrace + 1, second.end - 1).trimEnd();
  const firstBodyNeedsComma = !firstBody.trimEnd().endsWith(',');
  const merged =
    `\n  "${keyName}": {` + firstBody + (firstBodyNeedsComma ? ',' : '') + secondBody + '\n  }';
  const pre = raw.slice(0, first.start - 1);
  const gap = raw.slice(first.end, second.start - 1);
  let post = raw.slice(second.end);
  const postTrimmed = post.replace(/^\s*/, '');
  const secondWasLast = postTrimmed.startsWith('}');
  let finalGap = gap;
  if (secondWasLast) {
    finalGap = gap.replace(/,(\s*)$/, '$1');
  }
  if (!secondWasLast && post.startsWith(',')) {
    post = post.slice(1);
  }
  const out = pre + merged + finalGap + post;
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch (e) {
    fs.writeFileSync(filePath + `.debug-${keyName}.bad`, out);
    throw new Error(`${path.basename(filePath)} :: "${keyName}" merge produced invalid JSON: ${e.message}`);
  }
  const childKeys = Object.keys(parsed[keyName] ?? {});
  console.log(`${path.basename(filePath)} :: "${keyName}" — merged ${childKeys.length} child keys.`);
  return out;
}

for (const file of ['en.json', 'ar.json']) {
  const filePath = path.join(I18N_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  for (const key of KEYS_TO_MERGE) {
    content = mergeDuplicateKey(filePath, key);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// Final sanity check: parse the files, ensure expected key counts.
for (const file of ['en.json', 'ar.json']) {
  const filePath = path.join(I18N_DIR, file);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(
    `${file} :: nav child keys=${Object.keys(parsed.nav || {}).length}, ai child keys=${Object.keys(parsed.ai || {}).length}`,
  );
  if (!parsed.nav?.insights) throw new Error(`${file}: nav.insights missing post-merge`);
  if (!parsed.nav?.dashboardsOperations) throw new Error(`${file}: nav.dashboardsOperations missing post-merge`);
  if (!parsed.ai?.errors && !parsed.ai?.riskAssistant) throw new Error(`${file}: ai.errors AND ai.riskAssistant both missing post-merge`);
}
console.log('OK');
