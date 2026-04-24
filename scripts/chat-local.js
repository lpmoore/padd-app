#!/usr/bin/env node

const BASE_URL = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'http://127.0.0.1:1234/v1';
const API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || 'sk-local-test';
const MODEL = process.env.OPENAI_MODEL || 'openai/gpt-oss-20b';

async function main() {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) {
    console.error('Usage: node scripts/chat-local.js "your question"');
    process.exit(1);
  }

  if (!API_KEY) {
    console.error('Missing OPENAI_API_KEY (or ANTHROPIC_API_KEY).');
    process.exit(1);
  }

  const url = `${BASE_URL.replace(/\/$/, '')}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const choice = data?.choices?.[0]?.message?.content;
    if (!choice) {
      console.error('No completion returned:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log(choice.trim());
  } catch (err) {
    console.error('Request failed:', err.message);
    process.exit(1);
  }
}

main();
