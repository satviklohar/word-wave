// Zero-dependency server: serves the site and streams /api/chat from Groq (see lib/chat.js).
// Run: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}

const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'ai.html', 'style.css', 'ai.css', 'script.js', 'ai.js', 'logo.svg']);

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const { chat } = require('./lib/chat');

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
