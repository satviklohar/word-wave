const $ = (s) => document.querySelector(s);
const thread = $('#thread'), msgsEl = $('#msgs'), welcome = $('#welcome'), input = $('#input');
const sendBtn = $('#send'), fileIn = $('#file'), attachPrev = $('#attachPrev'), prevImg = $('#prevImg');
const side = $('#side'), scrim = $('#scrim'), historyEl = $('#history');

const SEND_ICON = sendBtn.innerHTML;
const STOP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
const MAX_IMG = 10 * 1024 * 1024;

// ---- state ----
// message: { role: 'user'|'assistant', text, image?: {mimeType,data}, imgUrl? (in-memory only), hadImage? }
let chats = load();
let current = null;     // chat object
let attached = null;    // { mimeType, data, url }
let busy = false, abortCtl = null;

function load() { try { return JSON.parse(localStorage.getItem('ww_chats')) || []; } catch { return []; } }
function save() {
  // never persist image bytes
  const slim = chats.slice(0, 30).map((c) => ({ ...c, messages: c.messages.map(({ image, imgUrl, ...m }) => m) }));
  try { localStorage.setItem('ww_chats', JSON.stringify(slim)); } catch {}
}

// ---- sidebar ----
function renderHistory() {
  historyEl.innerHTML = '';
  if (!chats.length) { historyEl.innerHTML = '<li class="empty-hist">No chats yet</li>'; return; }
  chats.forEach((c) => {
    const li = document.createElement('li');
    if (c === current) li.className = 'on';
    const t = document.createElement('button'); t.className = 't'; t.textContent = c.title; t.onclick = () => { openChat(c); closeMenu(); };
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Delete chat');
    x.onclick = () => { if (busy) return; chats = chats.filter((k) => k !== c); if (c === current) newChat(); save(); renderHistory(); };
    li.append(t, x); historyEl.append(li);
  });
}
const openMenu = () => { side.classList.add('open'); scrim.classList.add('show'); };
const closeMenu = () => { side.classList.remove('open'); scrim.classList.remove('show'); };
$('#menu').onclick = openMenu; scrim.onclick = closeMenu;

// ---- rendering ----
function userNode(m) {
  const row = document.createElement('div'); row.className = 'msg user';
  const b = document.createElement('div'); b.className = 'bubble';
  if (m.imgUrl) { const im = document.createElement('img'); im.src = m.imgUrl; im.alt = 'Attached image'; b.append(im); }
  else if (m.hadImage) { const n = document.createElement('div'); n.textContent = '🖼 (image attached)'; n.style.opacity = .6; b.append(n); }
  b.append(document.createTextNode(m.text));
  row.append(b); return row;
}
function botNode(text) {
  const row = document.createElement('div'); row.className = 'msg';
  const av = document.createElement('div'); av.className = 'avatar'; av.innerHTML = '<img src="logo.svg" alt="">';
  const bot = document.createElement('div'); bot.className = 'bot';
  const body = document.createElement('div'); body.className = 'body'; body.textContent = text;
  const acts = document.createElement('div'); acts.className = 'acts';
  bot.append(body, acts); row.append(av, bot);
  return { row, body, acts };
}
function addActions(acts, body, isLast) {
  acts.innerHTML = '';
  const copy = document.createElement('button'); copy.className = 'act'; copy.textContent = 'Copy';
  copy.onclick = async () => { await navigator.clipboard.writeText(body.textContent); copy.textContent = 'Copied ✓'; setTimeout(() => (copy.textContent = 'Copy'), 1400); };
  const dl = document.createElement('button'); dl.className = 'act'; dl.textContent = 'Download';
  dl.onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body.textContent], { type: 'text/plain' }));
    a.download = 'script.txt'; a.click(); URL.revokeObjectURL(a.href);
  };
  acts.append(copy, dl);
  if (isLast) {
    const rg = document.createElement('button'); rg.className = 'act'; rg.textContent = '↻ Regenerate'; rg.onclick = regen;
    acts.append(rg);
  }
}
function regen() {
  if (busy || !current) return;
  if (current.messages.at(-1)?.role === 'assistant') current.messages.pop();
  render(); generate();
}
function render() {
  msgsEl.innerHTML = '';
  welcome.classList.toggle('hide', !!current && current.messages.length > 0);
  const list = current?.messages || [];
  list.forEach((m, i) => {
    if (m.role === 'user') msgsEl.append(userNode(m));
    else { const n = botNode(m.text); addActions(n.acts, n.body, i === list.length - 1); msgsEl.append(n.row); }
  });
  thread.scrollTop = thread.scrollHeight;
}
function newChat() { current = null; render(); renderHistory(); input.focus(); }
function openChat(c) { if (busy) return; current = c; render(); renderHistory(); }
$('#newChat').onclick = () => { if (!busy) { newChat(); closeMenu(); } };

// ---- composer ----
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 200) + 'px'; }
function refreshSend() { sendBtn.disabled = !busy && !input.value.trim() && !attached; }
input.addEventListener('input', () => { autosize(); refreshSend(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); }
});

$('#attach').onclick = () => fileIn.click();
fileIn.onchange = () => setImage(fileIn.files[0]);
$('#rmImg').onclick = clearImage;
// paste / drop images anywhere in the chat
document.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/')); if (f) setImage(f); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => { e.preventDefault(); setImage(e.dataTransfer.files[0]); });

// Shrink to <=1280px JPEG before upload: keeps the request small (Vercel caps bodies at ~4.5 MB) and replies fast.
function setImage(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return alert('Please choose a PNG, JPEG or WebP image.');
  if (file.size > MAX_IMG) return alert('Image is too large (max 10 MB).');
  const src = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // flatten transparency
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(src);
    const url = c.toDataURL('image/jpeg', 0.85);
    attached = { mimeType: 'image/jpeg', data: url.split(',')[1], url };
    prevImg.src = url; attachPrev.hidden = false; refreshSend(); input.focus();
  };
  img.onerror = () => { URL.revokeObjectURL(src); alert('Could not read that image.'); };
  img.src = src;
}
function clearImage() { attached = null; fileIn.value = ''; attachPrev.hidden = true; refreshSend(); }

sendBtn.addEventListener('click', (e) => { if (busy) { e.preventDefault(); abortCtl?.abort(); } });
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) return;
  const text = input.value.trim() || (attached ? 'Write a script inspired by this image.' : '');
  if (!text) return;
  send(text);
});
document.querySelectorAll('.chip').forEach((c) => (c.onclick = () => { if (!busy) send(c.textContent.replace(/^[^\p{L}\p{N}]+/u, '').trim()); }));

async function send(text) {
  if (!current) {
    current = { id: Date.now(), title: text.slice(0, 40), messages: [] };
    chats.unshift(current);
  }
  const msg = { role: 'user', text };
  if (attached) { msg.image = { mimeType: attached.mimeType, data: attached.data }; msg.imgUrl = attached.url; msg.hadImage = true; }
  current.messages.push(msg);
  input.value = ''; autosize(); clearImage();
  welcome.classList.add('hide');
  msgsEl.append(userNode(msg));
  renderHistory();
  await generate();
}

// ---- talking to the model ----
// 1) Normal: our own backend (/api/chat) keeps the Groq key on the server.
// 2) Static hosts (GitHub Pages etc.) have no backend -> the visitor adds their own Groq key,
//    stored only in their browser, and the page calls Groq directly.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';
let directMode = false;

async function* readStream(body) {
  const reader = body.getReader(), dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield dec.decode(value, { stream: true });
  }
}

async function* streamReply(payload, options, signal) {
  if (!directMode) {
    let r = null;
    try {
      r = await fetch('api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ messages: payload, options }),
      });
    } catch (e) { if (e.name === 'AbortError') throw e; }
    if (r && ![404, 405, 501].includes(r.status)) {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`);
      yield* readStream(r.body);
      return;
    }
    directMode = true;               // no backend here -> go direct
    $('#keyBtn').hidden = false;
  }
  yield* directGroq(await getKey(), payload, options, signal);
}

function systemPrompt(o) {
  return 'You are Word Wave, a friendly professional scriptwriting assistant. ' +
    'Help with screenplays, TV, YouTube, podcast, Reel/Short, stage and ad scripts, plus story ideas, beats, characters and rewrites. ' +
    'When asked for a script, write it in proper plain-text script format (scene headings, action, character names, dialogue) with no markdown. ' +
    `Defaults unless the user says otherwise: format = ${o.format}, genre = ${o.genre}, length = ${o.length}. ` +
    'If an image is attached, use it as inspiration. Keep non-script replies brief.';
}

async function* directGroq(key, payload, options, signal) {
  const messages = payload.slice(-30).map((m) => {
    if (m.role === 'assistant' || !m.image) return { role: m.role, content: m.text || ' ' };
    return { role: 'user', content: [
      { type: 'text', text: m.text || ' ' },
      { type: 'image_url', image_url: { url: `data:${m.image.mimeType};base64,${m.image.data}` } },
    ] };
  });
  const r = await fetch(GROQ_URL, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: GROQ_MODEL, stream: true, messages: [{ role: 'system', content: systemPrompt(options) }, ...messages] }),
  });
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).error?.message || `Groq error ${r.status}`;
    if (r.status === 401) { try { localStorage.removeItem('ww_groq_key'); } catch {} throw new Error('Groq rejected that key. Click "API key" in the sidebar and enter a valid one.'); }
    throw new Error(msg);
  }
  let buf = '';
  for await (const chunk of readStream(r.body)) {
    buf += chunk;
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim();
      if (!d || d === '[DONE]') continue;
      try { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) yield t; } catch {}
    }
  }
}

// ---- API key dialog (direct mode only) ----
const keyModal = $('#keyModal'), keyInput = $('#keyInput');
function storedKey() { try { return localStorage.getItem('ww_groq_key') || ''; } catch { return ''; } }
function getKey(force) {
  const have = storedKey();
  if (have && !force) return Promise.resolve(have);
  return new Promise((resolve, reject) => {
    keyInput.value = ''; keyModal.hidden = false; keyInput.focus();
    const done = (fn) => { keyModal.hidden = true; $('#keyForm').onsubmit = null; $('#keyCancel').onclick = null; fn(); };
    $('#keyForm').onsubmit = (e) => {
      e.preventDefault();
      const k = keyInput.value.trim();
      if (!k) return;
      try { localStorage.setItem('ww_groq_key', k); } catch {}
      done(() => resolve(k));
    };
    $('#keyCancel').onclick = () => done(() => reject(new Error('Add a free Groq API key to chat on this site (console.groq.com/keys).')));
  });
}
$('#keyBtn').onclick = () => getKey(true).catch(() => {});

async function generate() {
  msgsEl.querySelectorAll('.act').forEach((b) => { if (b.textContent.includes('Regenerate')) b.remove(); });
  const bot = botNode('');
  bot.body.classList.add('live');
  bot.body.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
  msgsEl.append(bot.row);
  thread.scrollTop = thread.scrollHeight;

  busy = true; abortCtl = new AbortController();
  sendBtn.innerHTML = STOP_ICON; sendBtn.classList.add('stop'); sendBtn.disabled = false;

  // only the latest user turn carries image bytes
  const last = current.messages.length - 1;
  const payload = current.messages.map((m, i) => ({
    role: m.role,
    text: m.hadImage && i !== last ? m.text + ' [an image was attached here earlier]' : m.text,
    ...(m.image && i === last ? { image: m.image } : {}),
  }));

  let out = '', ok = true, stopped = false;
  try {
    const options = { format: $('#format').value, genre: $('#genre').value, length: $('#length').value };
    for await (const piece of streamReply(payload, options, abortCtl.signal)) {
      out += piece;
      bot.body.textContent = out;
      const near = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 160;
      if (near) thread.scrollTop = thread.scrollHeight;
    }
  } catch (err) {
    if (err.name === 'AbortError') { stopped = true; }
    else {
      ok = false;
      out = out || '⚠ ' + err.message;
      bot.body.classList.add('err');
    }
  }
  bot.body.classList.remove('live');
  bot.body.textContent = out;
  if (stopped && !out) bot.row.remove();           // stopped before any text: leave no empty reply
  else if (ok) { current.messages.push({ role: 'assistant', text: out }); addActions(bot.acts, bot.body, true); }
  else {
    const retry = document.createElement('button'); retry.className = 'act'; retry.textContent = '↻ Retry';
    retry.onclick = () => { if (!busy) { bot.row.remove(); generate(); } };
    bot.acts.append(retry);
  }
  save(); renderHistory();
  busy = false; abortCtl = null;
  sendBtn.innerHTML = SEND_ICON; sendBtn.classList.remove('stop'); refreshSend();
  thread.scrollTop = thread.scrollHeight;
}

// ---- scroll-to-latest button ----
const toBottom = $('#toBottom');
thread.addEventListener('scroll', () => {
  toBottom.hidden = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 200;
}, { passive: true });
toBottom.onclick = () => thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });

// ---- click an image to enlarge ----
function lightbox(src) {
  const box = document.createElement('div'); box.className = 'lightbox';
  const im = document.createElement('img'); im.src = src; im.alt = 'Image';
  box.append(im);
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.onclick = close; document.addEventListener('keydown', onKey);
  document.body.append(box);
}
document.addEventListener('click', (e) => {
  const im = e.target.closest('.bubble img, #prevImg');
  if (im && im.src) lightbox(im.src);
});

// ---- start ----
renderHistory(); render(); refreshSend();
// Arriving from the landing page: ai.html?idea=...&genre=...
const q = new URLSearchParams(location.search);
if (q.get('idea')) {
  const g = (q.get('genre') || '').toLowerCase();
  if ([...$('#genre').options].some((o) => o.value === g)) $('#genre').value = g;
  history.replaceState(null, '', location.pathname);
  send(q.get('idea'));
}
