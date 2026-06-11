import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CODE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const INCLUDED_PREFIXES = ['src/', 'tests/'];

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function shouldCheck(filePath) {
  const normalized = normalizePath(filePath);
  return INCLUDED_PREFIXES.some(prefix => normalized.startsWith(prefix))
    && CODE_EXTENSIONS.has(path.extname(normalized));
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function getImportSpecifiers(source) {
  const specifiers = [];
  const text = stripComments(source);
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function resolveRelativeImport(fromFile, specifier, knownFiles) {
  if (!specifier.startsWith('.')) return null;

  const fromDir = path.dirname(fromFile);
  const basePath = normalizePath(path.normalize(path.join(fromDir, specifier)));
  const extension = path.extname(basePath);

  const candidates = [];
  if (extension) {
    candidates.push(basePath);
  } else {
    for (const ext of RESOLUTION_EXTENSIONS) {
      candidates.push(`${basePath}${ext}`);
    }
    for (const ext of RESOLUTION_EXTENSIONS) {
      candidates.push(`${basePath}/index${ext}`);
    }
  }

  return candidates.find(candidate => knownFiles.has(candidate) || existsSync(candidate)) ?? null;
}

function findCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  const cycleKeys = new Set();

  function visit(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node];
      const key = cycle.join(' -> ');
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        cycles.push(cycle);
      }
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      visit(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return cycles;
}

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map(normalizePath)
  .filter(shouldCheck);

const knownFiles = new Set(files);
const graph = new Map(files.map(file => [file, []]));

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const imports = getImportSpecifiers(source);
  const resolved = imports
    .map(specifier => resolveRelativeImport(file, specifier, knownFiles))
    .filter(Boolean)
    .filter(target => knownFiles.has(target));
  graph.set(file, [...new Set(resolved)]);
}

const cycles = findCycles(graph);

if (cycles.length > 0) {
  console.error('Import graph must be a DAG. Circular imports found:');
  for (const cycle of cycles) {
    console.error(`- ${cycle.join(' -> ')}`);
  }
  process.exit(1);
}

console.log(`Checked ${files.length} files. Import graph is acyclic.`);
