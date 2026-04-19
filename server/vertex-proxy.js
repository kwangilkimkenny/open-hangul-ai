/**
 * Vertex AI SSE Proxy Server
 *
 * 역할:
 *   1. 프론트엔드의 SSE 요청을 Vertex AI `streamGenerateContent` 로 릴레이
 *   2. GCP 서비스 계정 인증(access token) 을 서버 측에서 관리
 *   3. 응답 chunk 를 text/event-stream 포맷으로 전달
 *
 * 환경 변수 (.env):
 *   GCP_PROJECT_ID          Vertex AI 프로젝트 ID
 *   GCP_LOCATION            us-central1 (기본값)
 *   GCP_SERVICE_ACCOUNT     Base64 인코딩된 서비스 계정 JSON (권장, Cloud Run 친화)
 *   GCP_SA_KEY_FILE         로컬 개발용 — 서비스 계정 JSON 파일 경로
 *   VERTEX_DEFAULT_MODEL    gemini-2.5-pro (기본값)
 *   VERTEX_PORT             3002 (기본값)
 *
 * @version 1.0.0
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── .env 로드 ──────────────────────────────────────────────────────────
function loadEnv() {
  for (const p of [resolve(__dirname, '..', '.env'), resolve(__dirname, '..', '.env.local')]) {
    if (!existsSync(p)) continue;
    readFileSync(p, 'utf-8').split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const eq = t.indexOf('=');
      if (eq === -1) return;
      const k = t.substring(0, eq).trim();
      const v = t.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    });
  }
}
loadEnv();

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const DEFAULT_MODEL = process.env.VERTEX_DEFAULT_MODEL || 'gemini-2.5-pro';
const PORT = Number(process.env.VERTEX_PORT) || 3002;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5090,http://localhost:5173').split(',');

if (!PROJECT_ID) {
  console.error('❌ GCP_PROJECT_ID 가 설정되지 않았습니다. .env 에 추가하세요.');
  process.exit(1);
}

// ─── 서비스 계정 로드 ───────────────────────────────────────────────────
function loadServiceAccount() {
  if (process.env.GCP_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT, 'base64').toString('utf-8'));
    } catch (e) {
      throw new Error('GCP_SERVICE_ACCOUNT base64 디코딩 실패: ' + e.message);
    }
  }
  if (process.env.GCP_SA_KEY_FILE) {
    const p = resolve(process.env.GCP_SA_KEY_FILE);
    if (!existsSync(p)) throw new Error(`서비스 계정 파일 없음: ${p}`);
    return JSON.parse(readFileSync(p, 'utf-8'));
  }
  throw new Error('GCP_SERVICE_ACCOUNT 또는 GCP_SA_KEY_FILE 중 하나 필요');
}

const sa = loadServiceAccount();
console.log(`✅ Vertex Proxy — project=${PROJECT_ID} sa=${sa.client_email}`);

// ─── OAuth 액세스 토큰 발급 (자체 JWT → google oauth) ─────────────────
let cachedToken = null;
let cachedTokenExpiresAt = 0;

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) return cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = base64url(signer.sign(sa.private_key));
  const jwt = `${unsigned}.${sig}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`OAuth 실패: ${r.status} ${await r.text()}`);
  const j = await r.json();
  cachedToken = j.access_token;
  cachedTokenExpiresAt = Date.now() + j.expires_in * 1000;
  return cachedToken;
}

// ─── HTTP 서버 ──────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', project: PROJECT_ID, location: LOCATION }));
    return;
  }

  if (req.url === '/api/ai/vertex/stream' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const reqData = JSON.parse(body);
        const model = reqData.model || DEFAULT_MODEL;
        const token = await getAccessToken();
        const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:streamGenerateContent?alt=sse`;

        const upstream = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: reqData.contents,
            systemInstruction: reqData.systemInstruction,
            generationConfig: reqData.generationConfig,
            tools: reqData.tools,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '');
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: upstream.status, message: text } }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              const j = JSON.parse(payload);
              const cand = j.candidates?.[0];
              const parts = cand?.content?.parts ?? [];
              const out = {};
              for (const p of parts) {
                if (p.text) out.text = (out.text ?? '') + p.text;
                if (p.functionCall) out.functionCall = p.functionCall;
              }
              if (j.usageMetadata) out.usageMetadata = j.usageMetadata;
              if (cand?.finishReason) out.finishReason = cand.finishReason;
              res.write(`data: ${JSON.stringify(out)}\n\n`);
            } catch (e) {
              res.write(`data: ${JSON.stringify({ error: { message: e.message } })}\n\n`);
            }
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        console.error('❌ Vertex proxy error:', err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        } else {
          res.end();
        }
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 Vertex AI SSE Proxy running on http://localhost:${PORT}`);
  console.log(`   POST /api/ai/vertex/stream  → Gemini streamGenerateContent`);
  console.log(`   GET  /health                → Health check\n`);
});
