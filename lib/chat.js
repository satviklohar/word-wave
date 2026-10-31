// Shared chat logic: used by server.js (local / Node hosts) and api/chat.js (Vercel).
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OK_IMG = ['image/png', 'image/jpeg', 'image/webp'];
// Multi-turn chat with streaming: client sends the whole conversation, we stream plain text back.
async function chat(res, b) {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.startsWith('your-')) return send(res, 500, { error: 'GROQ_API_KEY is not set in .env' });
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-30);
  if (!msgs.length || msgs.at(-1).role !== 'user') return send(res, 400, { error: 'Send a user message' });

  const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
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
        model: hasImage ? (process.env.GROQ_VISION_MODEL || model) : model,
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


module.exports = { chat };
