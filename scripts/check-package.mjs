#!/usr/bin/env node
/**
 * Verify the packed npm tarball includes every runtime file.
 * Runtime imports outside bin/, src/, and package.json are refused so a
 * missing "files" entry cannot ship a broken release.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// --ignore-scripts: this script runs from `prepack`, so a nested pack that
// ran lifecycle scripts would recurse forever.
const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' }));
const files = new Set(pack[0].files.map((file) => file.path));

const missing = [];
const check = (path, reason) => {
  if (!files.has(path)) missing.push(`${path} (${reason})`);
};

const entry = pkg.bin['fm-bench'];
check(entry, 'bin entry');

const seen = new Set();
const queue = [entry];
const importRe = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
while (queue.length > 0) {
  const current = queue.pop();
  if (seen.has(current)) continue;
  seen.add(current);
  const source = readFileSync(join(root, current), 'utf8');
  for (const match of source.matchAll(importRe)) {
    const resolved = join(current, '..', match[1]).replace(/\\/g, '/');
    queue.push(resolved);
    check(resolved, `imported by ${current}`);
  }
}

if (!files.has('package.json')) missing.push('package.json');

if (missing.length > 0) {
  console.error(`Packed tarball is missing runtime files:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

console.log(`check:pack ok — ${seen.size} runtime module(s) all present in tarball (${files.size} files total).`);
