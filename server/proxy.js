/**
 * AI API Proxy Server
 *
 * API 키를 서버 측 .env에서 관리하여 프론트엔드에 노출하지 않는 프록시 서버.
 *
 * 사용법:
 *   1. 프로젝트 루트에 .env 파일 생성
 *   2. OPENAI_API_KEY=sk-... 설정
 *   3. node server/proxy.js 실행
 *   4. 프론트엔드 .env에 VITE_API_PROXY_URL=http://localhost:3001/api/ai/chat 설정
 *
 * @version 1.0.0
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env 파일에서 환경변수 로드 (간단한 파서)
function loadEnv() {
  const envPaths = [
    resolve(__dirname, '..', '.env'),
    resolve(__dirname, '..', '.env.local'),
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      });
    }
  }
}

loadEnv();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const PORT = process.env.PROXY_PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5090,http://localhost:5173').split(',');

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY가 .env 파일에 설정되지 않았습니다.');
  console.error('   프로젝트 루트에 .env 파일을 생성하고 OPENAI_API_KEY=sk-... 를 추가하세요.');
  process.exit(1);
}

console.log(`✅ API Key loaded (${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.slice(-4)})`);
console.log(`✅ Endpoint: ${OPENAI_ENDPOINT}`);

const server = createServer(async (req, res) => {
  // CORS 처리
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hasApiKey: !!OPENAI_API_KEY }));
    return;
  }

  // AI Chat Proxy
  if (req.url === '/api/ai/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const requestData = JSON.parse(body);

        // 허용된 필드만 전달 (보안)
        const proxyBody = {
          model: requestData.model || 'gpt-4-turbo-preview',
          messages: requestData.messages,
          temperature: requestData.temperature ?? 0.7,
          max_tokens: requestData.max_tokens || 4000,
        };

        // response_format이 있으면 전달
        if (requestData.response_format) {
          proxyBody.response_format = requestData.response_format;
        }

        console.log(`📤 Proxy → OpenAI (model: ${proxyBody.model}, messages: ${proxyBody.messages?.length})`);

        const apiResponse = await fetch(OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify(proxyBody),
        });

        const responseData = await apiResponse.text();

        if (!apiResponse.ok) {
          console.error(`❌ OpenAI API error: ${apiResponse.status}`);
          res.writeHead(apiResponse.status, { 'Content-Type': 'application/json' });
          res.end(responseData);
          return;
        }

        console.log(`📥 OpenAI → Client (status: ${apiResponse.status})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(responseData);

      } catch (error) {
        console.error('❌ Proxy error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Proxy error: ${error.message}` } }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 AI API Proxy Server running on http://localhost:${PORT}`);
  console.log(`   POST /api/ai/chat  → OpenAI API proxy`);
  console.log(`   GET  /health       → Health check\n`);
});
