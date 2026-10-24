import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';

// Inspect tracked content only. Never log matching credentials.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const safeEnv = new Set(['apps/web/.env.development', 'apps/web/.env.production']);
const rules = [
  ['private key', new RegExp('-----BEGIN (?:RSA |EC |OPENSSH |DSA )?' + 'PRIVATE KEY-----')],
  ['GitHub token', new RegExp('(?:gh[pousr]_' + '[A-Za-z0-9_]{20,}|github_pat_' + '[A-Za-z0-9_]{20,})')],
  ['model API key', new RegExp('\\bsk-' + '[A-Za-z0-9_-]{24,}')],
  ['cloud access key', new RegExp('\\b(?:AKIA' + '[A-Z0-9]{16}|LTAI' + '[A-Za-z0-9]{12,})')],
  ['developer filesystem path', new RegExp('(?:/Users/|/home/)[A-Za-z][A-Za-z0-9_.-]+/')],
];
const failures = [];
for (const file of files) {
  if (lstatSync(file).isSymbolicLink()) { failures.push(`${file}: symlink requires manual review`); continue; }
  if (/(^|\/)(backups|uploads|node_modules|\.git|dist)\//.test(file) || /\.(pem|key|p12|pfx|dump|backup|sqlite3?|db|log|zip|tgz)$/.test(file)) failures.push(`${file}: private or generated file`);
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example') && !safeEnv.has(file)) failures.push(`${file}: runtime environment file`);
  if (/(^|\/)runtime\.env$/.test(file)) failures.push(`${file}: runtime environment file`);
  const bytes = readFileSync(file);
  // Also inspect printable substrings of binary resources for credential patterns.
  const text = bytes.toString('utf8');
  for (const [label, pattern] of rules) if (pattern.test(text)) failures.push(`${file}: ${label}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Public-file checks passed (${files.length} tracked files). This guard is not a substitute for secret scanning and review.`);
}
