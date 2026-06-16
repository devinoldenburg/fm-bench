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
      id: 'interactive-short',
      prompt: 'Answer in one sentence: why should an on-device model benchmark report p95 latency?'
    },
    {
      id: 'structured-json',
      prompt: 'Return compact valid JSON with keys "summary" and "risks" for this text: Local model benchmarks should measure latency, throughput, failures, prompt size, and output size.'
    },
    {
      id: 'medium-generation',
      prompt: 'Write a concise four-bullet checklist for evaluating whether a local AI model is fast enough for an interactive coding assistant.'
    }
  ],
  interactive: [
    {
      id: 'chat-short-1',
      prompt: 'Reply in one sentence: what is time to first token?'
    },
    {
      id: 'chat-short-2',
      prompt: 'Give one practical reason to benchmark with multiple prompt lengths.'
    },
    {
      id: 'chat-short-3',
      prompt: 'In under 20 words, define throughput for text generation.'
    }
  ],
  throughput: [
    {
      id: 'long-explain',
      prompt: 'Write six concise bullets explaining the tradeoff between latency and throughput in local LLM inference.'
    },
    {
      id: 'long-transform',
      prompt: 'Rewrite this note as a polished release note with a title and five bullets: fm-bench now measures TTFT, end-to-end latency, output tokens per second, failures, and repeatability.'
    },
    {
      id: 'long-plan',
      prompt: 'Create a compact test plan for benchmarking a local foundation model across short, medium, and long prompts.'
    }
  ],
  client: [
    {
      id: 'short-chat',
      prompt: 'In one sentence, explain why time to first token matters for an interactive assistant.'
    },
    {
      id: 'content-generation',
      prompt: 'Write a practical 180-word product update for developers explaining a new terminal benchmark feature. Keep it specific and avoid marketing fluff.'
    },
    {
      id: 'structured-extraction',
      prompt: 'Return compact valid JSON with keys "risk", "owner", "deadline", and "next_step" from this note: The benchmark release is blocked by flaky p95 latency on the PCC model. Maya owns the investigation and needs a fix before Friday.'
    },
    {
      id: 'summarization-light',
      prompt: 'Summarize this in three bullets: A serious local LLM benchmark should separate time to first token from total latency, report tail percentiles, include prompt and output token counts, measure throughput at multiple concurrency operating points, and preserve the raw prompt suite so future runs are comparable.'
    },
    {
      id: 'code-analysis',
      prompt: 'Review this JavaScript function for one correctness issue and one readability improvement: function p(v){let s=0;for(let i=0;i<=v.length;i++)s+=v[i];return s/v.length}'
    }
  ],
  stress: [
    {
      id: 'interactive-short',
      prompt: 'Answer in one sentence: why should an on-device model benchmark report p95 latency?'
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
  ],
  reasoning: [
    {
      id: 'math-word',
      prompt: 'A server processes 1,200 requests per minute at peak. Each request uses 0.8 ms of CPU time on average. How many CPU cores are needed to handle peak load at 70% utilization? Show your reasoning step-by-step, then give a single final answer.'
    },
    {
      id: 'logic-sequence',
      prompt: 'Five engineers — Alice, Bob, Carol, Dave, Eve — each deploy one service. Alice deploys before Bob. Carol deploys after Dave but before Eve. Bob deploys before Dave. List the deployment order from first to last.'
    },
    {
      id: 'causal-chain',
      prompt: 'A CI pipeline has: lint (2 min), unit tests (5 min, parallel), integration tests (8 min, depends on unit), build (3 min, depends on integration), deploy (1 min, depends on build). What is the minimum wall-clock time from start to deployed? Explain each step.'
    },
    {
      id: 'estimation',
      prompt: 'Estimate how many tokens per day a popular AI coding assistant might process if it has 500,000 daily active users, each averaging 30 completions of 200 output tokens. Show your calculation and state any assumptions.'
    },
    {
      id: 'debug-logic',
      prompt: 'This function should return the median of a list: def median(lst): lst.sort(); n=len(lst); return lst[n//2] if n%2 else (lst[n//2-1]+lst[n//2])/2. Find all bugs and explain why each is a bug.'
    }
  ],
  coding: [
    {
      id: 'code-review',
      prompt: 'Review this TypeScript for correctness, performance, and readability issues: async function fetchAll(urls: string[]) { const results = []; for (const url of urls) { const r = await fetch(url); results.push(await r.json()); } return results; } Give three specific improvements with brief explanations.'
    },
    {
      id: 'refactor',
      prompt: 'Refactor this JavaScript to be cleaner and handle edge cases: function getUser(id, cb) { db.query("SELECT * FROM users WHERE id=" + id, function(err, rows) { if (err) { cb(null, err); } else { cb(rows[0]); } }); } Return only the improved code and a two-sentence explanation.'
    },
    {
      id: 'algorithm',
      prompt: 'Write a JavaScript function findDuplicates(arr) that returns all duplicate values in O(n) time and O(n) space. Include a brief complexity explanation and two edge-case examples.'
    },
    {
      id: 'explain-code',
      prompt: 'Explain what this code does, why it might be used, and one potential problem: const cache = new WeakMap(); function memoize(fn) { return function(...args) { if (!cache.has(this)) cache.set(this, new Map()); const key = JSON.stringify(args); if (!cache.get(this).has(key)) cache.get(this).set(key, fn.apply(this, args)); return cache.get(this).get(key); }; }'
    },
    {
      id: 'system-design',
      prompt: 'Design a rate limiter in 120 words or fewer: specify the data structure, the algorithm (token bucket, sliding window, or fixed window), and how you handle distributed deployments. Be precise and practical.'
    }
  ],
  creative: [
    {
      id: 'product-announcement',
      prompt: 'Write a 100-word product announcement for a developer tool called "PulseDB" that shows real-time query performance heatmaps in the terminal. Tone: enthusiastic but not hypey. Include one concrete example of what a user would see.'
    },
    {
      id: 'error-message',
      prompt: 'Rewrite this cryptic error into a helpful, actionable message a junior developer could act on: "Error: ECONNREFUSED 127.0.0.1:5432 errno: -111 syscall: connect code: ECONNREFUSED". Include what likely caused it and the first two things to check.'
    },
    {
      id: 'technical-analogy',
      prompt: 'Explain CPU context switching to someone who has never programmed, using a single concrete analogy from everyday life. Keep it under 80 words and make sure the analogy captures the performance cost.'
    },
    {
      id: 'commit-message',
      prompt: 'Write a clear and conventional git commit message for a change that adds retry logic with exponential backoff and jitter to the HTTP client. Include a subject line and a 3-bullet body.'
    },
    {
      id: 'doc-summary',
      prompt: 'Write a one-paragraph README introduction for an open-source CLI tool called "logslice" that extracts time-bounded log windows from large log files without loading them fully into memory. Target audience: backend engineers.'
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
