import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_LINES = Number.parseInt(process.env.MAX_FILE_LINES ?? '1000', 10);

const INCLUDED_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.ts',
  '.tsx',
  '.yml',
  '.yaml',
]);

const EXCLUDED_PATHS = new Set([
  'package-lock.json',
]);

const EXCLUDED_PREFIXES = [
  '.git/',
  'dist/',
  'node_modules/',
];

const EXCLUDED_EXTENSIONS = new Set([
  '.svg',
]);

function getExtension(path) {
  const dotIndex = path.lastIndexOf('.');
  return dotIndex >= 0 ? path.slice(dotIndex) : '';
}

function shouldCheck(path) {
  const normalized = path.replaceAll('\\', '/');
  if (EXCLUDED_PATHS.has(normalized)) return false;
  if (EXCLUDED_PREFIXES.some(prefix => normalized.startsWith(prefix))) return false;

  const extension = getExtension(normalized);
  if (EXCLUDED_EXTENSIONS.has(extension)) return false;
  return INCLUDED_EXTENSIONS.has(extension);
}

function countLines(path) {
  const text = readFileSync(path, 'utf8');
  if (text.length === 0) return 0;
  const lineBreaks = text.match(/\r\n|\r|\n/g)?.length ?? 0;
  return lineBreaks + (text.endsWith('\n') || text.endsWith('\r') ? 0 : 1);
}

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(shouldCheck);

const violations = files
  .map(path => ({ path, lines: countLines(path) }))
  .filter(file => file.lines > MAX_LINES)
  .sort((a, b) => b.lines - a.lines);

if (violations.length > 0) {
  console.error(`Files must stay at or below ${MAX_LINES} lines. Split large files before merging:`);
  for (const violation of violations) {
    console.error(`- ${violation.path}: ${violation.lines} lines`);
  }
  process.exit(1);
}

console.log(`Checked ${files.length} files. All are <= ${MAX_LINES} lines.`);
