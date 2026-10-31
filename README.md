# Word Wave

A script-writing studio: scroll-animated landing page plus a ChatGPT-style AI chat (text + image input) powered by Groq.

## Run

```bash
cp .env.example .env   # then add your GROQ_API_KEY
node server.js         # Node 20.6+; no dependencies
```

Open http://localhost:3000 (landing) and http://localhost:3000/ai.html (AI chat).

## Layout

- `index.html`, `style.css`, `script.js` — landing page
- `ai.html`, `ai.css`, `ai.js` — AI chat UI
- `server.js` — static server + streaming `/api/chat` proxy to Groq (keeps the key server-side)
- `lumina/` — React + Tailwind v4 template page, served at `/lumina/` (`cd lumina && npm i && npm run build` to rebuild `dist/`)
