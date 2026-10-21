import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env if present (without external dependencies)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

/** Extract first JSON object from text (handles markdown fences) */
function extractJSON(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) {} }
  return null;
}

async function handleGeminiBriefing(reqBody) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('[AI] No API key found — using fallback template plan.');
    return { fallback: true, reason: 'no_key' };
  }
  console.log(`[AI] Key detected (${apiKey.slice(0, 8)}...). Calling Gemini API...`);

  const prompt = `
You are an Emergency Operations Center (EOC) Disaster Action Officer.
Generate an actionable emergency response briefing for the simulated disaster scenario.

District Context:
${JSON.stringify(reqBody, null, 2)}

CRITICAL RESPONSE RULES:
1. Return ONLY valid JSON matching this exact structure:
{
  "immediate": [
    { "communityId": "c1", "action": "Priority #1: Dispatch {{c1.food}} food packets, {{c1.water}} water units, and {{c1.medical}} medical kits to support {{c1.vulnerable}} vulnerable residents." }
  ],
  "routeAlerts": [
    { "roadId": "r1", "advice": "Route severed. Reroute logistics via secondary corridors." }
  ],
  "watchpoints": [
    "District medical shortfall requires second-tier reserve mobilization."
  ]
}
2. The "immediate" array MUST contain the top 3 or 4 ranked communities in STRICT DESCENDING RANK ORDER (Rank #1 first, then Rank #2, etc.).
3. NEVER write raw inventory numbers or counts for resources! You MUST ONLY refer to quantities using placeholders of the exact form {{communityId.food}}, {{communityId.water}}, {{communityId.medical}}, {{communityId.vulnerable}}.
4. Return raw JSON only, no markdown backticks, no code blocks.
`;

  // gemini-3.1-flash-lite: confirmed to support responseMimeType + fast responses
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Retry on overload/rate-limit
      if (response.status === 503 || response.status === 429) {
        console.warn(`[AI] Attempt ${attempt}/${MAX_RETRIES} — HTTP ${response.status} (overloaded). Retrying in 4s...`);
        if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 4000)); continue; }
        return { fallback: true, reason: 'api_error' };
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.warn(`[AI] Gemini API HTTP ${response.status}: ${errBody.slice(0, 300)}`);
        return { fallback: true, reason: 'api_error' };
      }

      console.log('[AI] Gemini responded OK — parsing response...');
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) { return { fallback: true, reason: 'empty_response' }; }

      const parsed = extractJSON(rawText);
      if (!parsed) {
        console.warn('[AI] Could not extract JSON from response:', rawText.slice(0, 200));
        return { fallback: true, reason: 'parse_error' };
      }
      return { success: true, data: parsed };

    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[AI] Gemini proxy call error/timeout:', err.message);
      if (attempt < MAX_RETRIES && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, 3000)); continue;
      }
      return { fallback: true, reason: err.name === 'AbortError' ? 'timeout' : 'api_error' };
    }
  }
  return { fallback: true, reason: 'api_error' };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // POST /api/brief Proxy with Demo Failure Test Hooks
  if (pathname === '/api/brief' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const hook = payload.testHook || parsedUrl.searchParams.get('ai');

        // Test Hook 1: Force AI Unavailable fallback
        if (hook === 'off') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ fallback: true, reason: 'ai_off_hook' }));
          return;
        }

        // Test Hook 2: Force AI Output Failed Validation (injects unallowlisted invented digit and rank violation)
        if (hook === 'bad') {
          const badMock = {
            immediate: [
              { communityId: 'c8', action: 'Priority dispatch with 99999 invented emergency crates to c8.' },
              { communityId: 'c1', action: 'Secondary dispatch out of rank order.' }
            ],
            routeAlerts: [
              { roadId: 'r1', advice: 'Route r1 is completely submerged.' }
            ],
            watchpoints: [
              'Invented watchpoint with ungrounded 8888 figure.'
            ]
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: badMock }));
          return;
        }

        // Standard live execution via Gemini API
        const result = await handleGeminiBriefing(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ fallback: true, reason: 'request_error' }));
      }
    });
    return;
  }

  // Static file serving
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(__dirname, pathname));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`RescueGrid EOC Console running at http://localhost:${PORT}`);
});

export default server;
