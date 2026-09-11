#!/usr/bin/env node
/**
 * Verify the package is publishable.
 *
 * `npm publish --dry-run` refuses to run once the current version is already
 * on the registry, which turned CI red after every release. This checks the
 * tarball unconditionally and only exercises the publish dry run when the
 * version is still unpublished.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8' });
}

// --ignore-scripts: `npm run check` already ran the full suite, so skip the
// nested prepack.
const pack = JSON.parse(run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts']))[0];
const files = pack.files.map((file) => file.path);
console.log(`pack ok — ${files.length} files, ${(pack.size / 1024).toFixed(1)} kB tarball`);

const required = [pkg.bin['fm-bench'], 'package.json', 'README.md', 'LICENSE', 'src/cli.js'];
const missing = required.filter((path) => !files.includes(path));
if (missing.length > 0) {
  console.error(`tarball is missing: ${missing.join(', ')}`);
  process.exit(1);
}

let alreadyPublished = false;
try {
  alreadyPublished = run('npm', ['view', `${pkg.name}@${pkg.version}`, 'version']).trim() === pkg.version;
} catch {
  alreadyPublished = false;
}

if (alreadyPublished) {
  console.log(`${pkg.name}@${pkg.version} is already on the registry — skipping the npm publish dry run.`);
  process.exit(0);
}

console.log(`running npm publish --dry-run for ${pkg.name}@${pkg.version}`);
execFileSync('npm', ['publish', '--dry-run', '--access', 'public'], { cwd: root, stdio: 'inherit' });
