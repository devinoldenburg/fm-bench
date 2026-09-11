// Pure parsers for `fm` help and status text.
//
// These functions take raw text and return plain data so they can be unit
// tested without spawning a process, and so the capability layer, the model
// discovery path, and the availability path agree on how `fm` output is read.

import { stripAnsi } from './ansi.js';

const SECTION_HEADER = /^\s*[A-Z][A-Z0-9 /-]+\s*$/;

/**
 * Extract models from the MODELS section of `fm --help`, falling back to a
 * `--model` option list such as `Model to use (system, pcc)`.
 * @param {string} helpText
 * @returns {{ name: string, description: string }[]}
 */
export function parseModelsFromHelp(helpText = '') {
  const lines = stripAnsi(helpText).split(/\r?\n/);
  const models = new Map();
  let inModels = false;

  for (const line of lines) {
    if (/^\s*MODELS\s*$/.test(line)) {
      inModels = true;
      continue;
    }

    if (inModels && SECTION_HEADER.test(line)) {
      inModels = false;
    }

    if (inModels) {
      const match = line.match(/^\s*([A-Za-z0-9._:-]+)\s{2,}(.+?)\s*$/);
      if (match) {
        const name = match[1];
        const description = match[2].replace(/\s*\(default\)\s*$/, '').trim();
        const existing = models.get(name);
        // The MODELS section is authoritative over a bare option list.
        if (existing) {
          if (!existing.description) existing.description = description;
        } else {
          models.set(name, { name, description });
        }
      }
    }

    if (/(^|\s)--model\b/.test(line)) {
      const optionMatch = line.match(/\(([^)]*)\)/);
      if (optionMatch) {
        for (const raw of optionMatch[1].split(',')) {
          const name = raw.trim();
          if (/^[A-Za-z0-9._:-]+$/.test(name) && !models.has(name)) {
            models.set(name, { name, description: '' });
          }
        }
      }
    }
  }

  return [...models.values()];
}

/**
 * Read model names and availability out of `fm available` (no model filter).
 * @param {string} output
 * @returns {{ name: string, available: boolean }[]}
 */
export function parseAvailabilityList(output = '') {
  const models = new Map();
  for (const line of stripAnsi(output).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9._-]*)(?:\s+model)?\s+(?:is\s+)?(available|unavailable|not available)\b/i);
    if (!match) continue;
    const name = match[1].toLowerCase();
    models.set(name, { name, available: /^available$/i.test(match[2]) });
  }
  return [...models.values()];
}

/**
 * Interpret `fm available --model <model>` output.
 *
 * `fm` reports the model plus the word "available" on success. Anything with
 * an explicit error/unavailable marker, or a non-zero exit code, counts as
 * unavailable so a partially supported host is never reported as working.
 *
 * @param {string} model
 * @param {string} output combined stdout+stderr
 * @param {number|null} code process exit code
 */
export function parseAvailabilityOutput(model, output = '', code = null) {
  const clean = stripAnsi(output).trim();
  const lower = clean.toLowerCase();
  const modelLower = String(model).toLowerCase();
  const hasError = /\berror:|\bunavailable\b|\bnot available\b|\bnot supported\b|\bis invalid for\b/.test(lower);
  const modelPattern = escapeRegExp(modelLower);
  const hasAvailable = new RegExp(`\\b${modelPattern}\\b[\\s\\S]{0,80}\\bavailable\\b`).test(lower)
    || new RegExp(`\\bavailable\\b[\\s\\S]{0,80}\\b${modelPattern}\\b`).test(lower);

  return {
    model,
    available: code === 0 && hasAvailable && !hasError,
    raw: clean,
    reason: hasError ? firstLine(clean) : ''
  };
}

/**
 * Collapse `fm` diagnostics into one actionable line. `fm` writes multi-line
 * usage blocks for argument errors; benchmark output only needs the cause.
 * @param {string} text
 */
export function firstLine(text = '') {
  const clean = stripAnsi(text).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=\.)\s+(?=[A-Z])/);
  const head = sentences.find((part) => /error|invalid|unavailable|not supported|failed/i.test(part)) || sentences[0];
  return head.replace(/^Error:\s*/i, '').trim();
}

/**
 * True when an `fm` diagnostic means "this build does not have that model"
 * rather than "the model exists but is currently unusable".
 * @param {string} text
 */
export function isUnsupportedModelError(text = '') {
  return /is invalid for '--model|unknown model|no such model|unrecognized model/i.test(stripAnsi(text));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
