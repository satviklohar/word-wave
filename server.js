// Zero-dependency server: serves the site and streams /api/chat from Groq.
// Run: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || MODEL;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OK_IMG = ['image/png', 'image/jpeg', 'image/webp'];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'ai.html', 'style.css', 'ai.css', 'script.js', 'ai.js', 'logo.svg']);

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

// Multi-turn chat with streaming: client sends the whole conversation, we stream plain text back.
async function chat(res, b) {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.startsWith('your-')) return send(res, 500, { error: 'GROQ_API_KEY is not set in .env' });
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-30);
  if (!msgs.length || msgs.at(-1).role !== 'user') return send(res, 400, { error: 'Send a user message' });

  let hasImage = false;
  let messages;
  try {
    messages = msgs.map((m) => {
      const text = String(m.text || '').slice(0, 8000) || ' ';
      if (m.role === 'assistant') return { role: 'assistant', content: text };
      if (!m.image) return { role: 'user', content: text };
      if (!OK_IMG.includes(m.image.mimeType) || typeof m.image.data !== 'string') throw new Error('Image must be PNG, JPEG or WebP');
      hasImage = true;
      return {
        role: 'user',
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: `data:${m.image.mimeType};base64,${m.image.data}` } },
        ],
      };
    });
  } catch (e) { return send(res, 400, { error: e.message }); }

  const o = b.options || {};
  const system =
    `You are Word Wave, a friendly professional scriptwriting assistant. ` +
    `Help with screenplays, TV, YouTube, podcast, Reel/Short, stage and ad scripts, plus story ideas, beats, characters and rewrites. ` +
    `When asked for a script, write it in proper plain-text script format (scene headings, action, character names, dialogue) with no markdown. ` +
    `Defaults unless the user says otherwise: format = ${String(o.format || 'screenplay').slice(0, 40)}, ` +
    `genre = ${String(o.genre || 'drama').slice(0, 40)}, length = ${String(o.length || 'short').slice(0, 40)}. ` +
    `If an image is attached, use it as inspiration. Keep non-script replies brief.`;

  let r;
  try {
    r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: hasImage ? VISION_MODEL : MODEL,
        stream: true,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });
  } catch (e) { return send(res, 502, { error: 'Could not reach Groq: ' + e.message }); }
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    return send(res, r.status === 429 ? 429 : 500, { error: d.error?.message || `Groq error ${r.status}` });
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  const dec = new TextDecoder();
  let buf = '', any = false;
  const handle = (line) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const t = JSON.parse(data).choices?.[0]?.delta?.content;
      if (t) { any = true; res.write(t); }
    } catch {}
  };
  try {
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(handle);
    }
    handle(buf.trim());
    if (!any) res.write('(No response. The request may have been blocked. Try rewording it.)');
  } catch (e) { res.write('\n\n⚠ ' + e.message); }
  res.end();
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    let raw = '';
    for await (const c of req) { raw += c; if (raw.length > 12_000_000) return send(res, 413, { error: 'Too large' }); }
    let b;
    try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'Bad JSON' }); }
    return chat(res, b);
  }
  let name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  let file = path.join(__dirname, name);
  if (name === 'lumina') { res.writeHead(301, { Location: '/lumina/' }); return res.end(); }
  if (name.startsWith('lumina/')) {
    // Built Lumina template (run `npm run build` inside lumina/)
    const rel = name.slice(7) || 'index.html';
    file = path.join(__dirname, 'lumina', 'dist', rel);
    if (!file.startsWith(path.join(__dirname, 'lumina', 'dist') + path.sep)) return send(res, 404, 'Not found', 'text/plain');
    name = rel;
  } else if (!PUBLIC.has(name)) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(file, (err, buf) =>
    err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, buf, TYPES[path.extname(name)]));
}).listen(PORT, () => console.log(`Word Wave running at http://localhost:${PORT}`));
