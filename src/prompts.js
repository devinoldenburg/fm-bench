import fs from 'node:fs/promises';
import path from 'node:path';

const PROFILES = {
  quick: [
    {
      id: 'echo-ok',
      prompt: 'Reply with exactly: ok'
    }
  ],
  standard: [
    {
      id: 'echo-ok',
      prompt: 'Reply with exactly: ok'
    },
    {
      id: 'explain-latency',
      prompt: 'In one concise paragraph, explain why AI model benchmarks should report latency percentiles.'
    },
    {
      id: 'json-transform',
      prompt: 'Convert this list into a valid compact JSON array of strings: alpha, beta, gamma.'
    }
  ],
  stress: [
    {
      id: 'echo-ok',
      prompt: 'Reply with exactly: ok'
    },
    {
      id: 'explain-latency',
      prompt: 'In one concise paragraph, explain why AI model benchmarks should report latency percentiles.'
    },
    {
      id: 'json-transform',
      prompt: 'Convert this list into a valid compact JSON array of strings: alpha, beta, gamma.'
    },
    {
      id: 'reasoning',
      prompt: 'A build starts at 09:12, takes 17 minutes, waits 8 minutes for review, then takes another 11 minutes. What time does it finish? Show only the answer and one short explanation.'
    },
    {
      id: 'summarize',
      prompt: 'Summarize this in two bullets: local model benchmarks should measure first-token latency, total latency, throughput, failures, and the exact prompt suite so results can be compared later.'
    }
  ]
};

export function getPromptProfile(name = 'standard') {
  if (!PROFILES[name]) {
    throw new Error(`Unknown prompt profile "${name}". Use one of: ${Object.keys(PROFILES).join(', ')}`);
  }
  return PROFILES[name].map((prompt) => ({ ...prompt }));
}

export async function loadPrompts(options = {}) {
  const prompts = [];

  if (options.promptFile) {
    prompts.push(...await loadPromptFile(options.promptFile));
  }

  for (const prompt of options.prompts || []) {
    prompts.push({
      id: `custom-${prompts.length + 1}`,
      prompt
    });
  }

  if (prompts.length === 0) {
    prompts.push(...getPromptProfile(options.profile || 'standard'));
  }

  return prompts.map((entry, index) => ({
    id: entry.id || `prompt-${index + 1}`,
    prompt: String(entry.prompt ?? entry.text ?? '').trim()
  })).filter((entry) => entry.prompt.length > 0);
}

async function loadPromptFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf8');
  const trimmed = content.trim();

  if (!trimmed) return [];

  if (absolutePath.endsWith('.json')) {
    const parsed = JSON.parse(trimmed);
    const items = Array.isArray(parsed) ? parsed : parsed.prompts;
    if (!Array.isArray(items)) {
      throw new Error('Prompt JSON must be an array or an object with a prompts array');
    }
    return items.map((item, index) => normalizePromptItem(item, index));
  }

  if (absolutePath.endsWith('.jsonl')) {
    return trimmed.split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => normalizePromptItem(JSON.parse(line), index));
  }

  return trimmed.split(/\n\s*\n/g).map((prompt, index) => ({
    id: `file-${index + 1}`,
    prompt: prompt.trim()
  }));
}

function normalizePromptItem(item, index) {
  if (typeof item === 'string') {
    return {
      id: `file-${index + 1}`,
      prompt: item
    };
  }

  return {
    id: item.id || item.name || `file-${index + 1}`,
    prompt: item.prompt || item.text || ''
  };
}
