/**
 * Vercel Serverless Function: POST /api/brief
 * Proxies calls to Google Gemini with exponential backoff and demo failure hooks.
 */

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
    return { fallback: true, reason: 'no_key' };
  }

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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

      if (response.status === 503 || response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        return { fallback: true, reason: 'api_error' };
      }

      if (!response.ok) {
        return { fallback: true, reason: 'api_error' };
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { fallback: true, reason: 'empty_response' };

      const parsed = extractJSON(rawText);
      if (!parsed) return { fallback: true, reason: 'parse_error' };

      return { success: true, data: parsed };

    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < MAX_RETRIES && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return { fallback: true, reason: err.name === 'AbortError' ? 'timeout' : 'api_error' };
    }
  }

  return { fallback: true, reason: 'api_error' };
}

export default async function handler(req, res) {
  // Set CORS headers for security and flexibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) {}
    }
    payload = payload || {};

    const hook = payload.testHook || req.query?.ai;

    // Test Hook 1: Force AI Unavailable fallback
    if (hook === 'off') {
      return res.status(200).json({ fallback: true, reason: 'ai_off_hook' });
    }

    // Test Hook 2: Force AI Output Failed Validation
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
      return res.status(200).json({ success: true, data: badMock });
    }

    const result = await handleGeminiBriefing(payload);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: 'request_error' });
  }
}
