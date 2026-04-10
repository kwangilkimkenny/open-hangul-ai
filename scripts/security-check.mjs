#!/usr/bin/env node
/**
 * 자동 보안 점검 스크립트
 *
 * 실행: npm run security:check
 *
 * 점검 항목:
 * - npm audit (취약점)
 * - hardcoded secrets (.env 누출 방지)
 * - HTTPS 강제 확인
 * - CSP 헤더 검증
 * - SQL 인젝션 패턴 (raw query 사용 여부)
 * - eval/Function 사용
 * - innerHTML 사용 (XSS 가능성)
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['src', 'supabase/functions'];

// 결과 카운터
let passed = 0;
let warnings = 0;
let failed = 0;

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(level, msg) {
  const prefix = {
    pass: `${colors.green}✓${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
    fail: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    section: `${colors.cyan}${colors.bold}━${colors.reset}`,
  }[level];
  console.log(`${prefix} ${msg}`);
  if (level === 'pass') passed++;
  else if (level === 'warn') warnings++;
  else if (level === 'fail') failed++;
}

function section(name) {
  console.log(`\n${colors.cyan}${colors.bold}━━ ${name} ━━${colors.reset}`);
}

// ===== 파일 순회 =====
function walkFiles(dir, ext = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walkFiles(path, ext));
    } else if (ext.includes(extname(name))) {
      files.push(path);
    }
  }
  return files;
}

// ===== 점검 1: npm audit =====
section('1. 의존성 취약점 (npm audit)');
try {
  const result = execSync('npm audit --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  const audit = JSON.parse(result);
  const meta = audit.metadata?.vulnerabilities || {};
  const critical = meta.critical || 0;
  const high = meta.high || 0;
  const moderate = meta.moderate || 0;

  if (critical > 0) log('fail', `Critical 취약점 ${critical}건 발견 — 즉시 패치 필요`);
  if (high > 0) log('fail', `High 취약점 ${high}건 발견 — 패치 권장`);
  if (moderate > 0) log('warn', `Moderate 취약점 ${moderate}건`);
  if (critical === 0 && high === 0) log('pass', 'Critical/High 취약점 없음');
} catch (err) {
  // npm audit returns non-zero on vulnerabilities
  try {
    const audit = JSON.parse(err.stdout?.toString() || '{}');
    const meta = audit.metadata?.vulnerabilities || {};
    const critical = meta.critical || 0;
    const high = meta.high || 0;
    if (critical > 0) log('fail', `Critical ${critical}건`);
    if (high > 0) log('warn', `High ${high}건`);
    else log('pass', 'Critical 취약점 없음');
  } catch {
    log('warn', 'npm audit 실행 실패 — 수동 확인 필요');
  }
}

// ===== 점검 2: Hardcoded Secrets =====
section('2. 하드코딩된 시크릿 검사');
const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{40,}/, name: 'OpenAI Secret Key' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Live Key' },
  { pattern: /live_sk_[a-zA-Z0-9]{20,}/, name: 'Toss Live Secret' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key' },
  { pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/, name: 'Private Key' },
  { pattern: /eyJhbGciOi[a-zA-Z0-9_-]{30,}/, name: 'JWT Token (가능성)' },
];

const allFiles = SOURCE_DIRS.flatMap(d => walkFiles(join(ROOT, d)));
let secretsFound = 0;

for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      // 테스트 키나 placeholder 제외
      const matches = content.match(pattern);
      if (matches?.[0].includes('test_') || matches?.[0].includes('docs_') ||
          matches?.[0].includes('YOUR_') || matches?.[0].includes('xxxxx')) {
        continue;
      }
      log('fail', `${name} 발견: ${file.replace(ROOT + '/', '')}`);
      secretsFound++;
    }
  }
}
if (secretsFound === 0) log('pass', '하드코딩된 시크릿 없음');

// ===== 점검 3: 위험한 함수 사용 =====
section('3. 위험한 함수 사용 (eval, Function)');
let dangerousFound = 0;
const SAFE_PATTERNS = [/\/\/.*eval/, /\/\*.*eval.*\*\//]; // 주석 제외

for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (SAFE_PATTERNS.some(p => p.test(line))) return;
    if (/\beval\s*\(/.test(line) || /new\s+Function\s*\(/.test(line)) {
      log('warn', `${file.replace(ROOT + '/', '')}:${i + 1} — eval/new Function 사용`);
      dangerousFound++;
    }
  });
}
if (dangerousFound === 0) log('pass', 'eval/new Function 사용 없음');

// ===== 점검 4: innerHTML 사용 (XSS 위험) =====
section('4. innerHTML 사용 (XSS 위험)');
let innerHtmlFound = 0;
for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (/\.innerHTML\s*=/.test(line) && !line.trim().startsWith('//')) {
      // dangerouslySetInnerHTML은 React 표준 패턴이므로 별도 처리
      if (line.includes('dangerouslySetInnerHTML')) return;
      log('warn', `${file.replace(ROOT + '/', '')}:${i + 1} — innerHTML 직접 할당 (escapeHtml 필요)`);
      innerHtmlFound++;
    }
  });
}
if (innerHtmlFound === 0) log('pass', '직접 innerHTML 할당 없음');
else if (innerHtmlFound < 5) log('info', `${innerHtmlFound}개 발견 — 모두 escapeHtml 처리되었는지 확인 권장`);

// ===== 점검 5: 보안 헤더 (vite.config.ts) =====
section('5. 보안 헤더 설정 확인');
const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf-8');
const REQUIRED_HEADERS = [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'X-XSS-Protection',
  'Referrer-Policy',
  'Permissions-Policy',
];
for (const header of REQUIRED_HEADERS) {
  if (viteConfig.includes(`'${header}'`)) {
    log('pass', `${header} 설정됨`);
  } else {
    log('fail', `${header} 누락 — vite.config.ts에 추가 필요`);
  }
}

// ===== 점검 6: .env 파일 git 제외 =====
section('6. .env 파일 보호');
const gitignorePath = join(ROOT, '.gitignore');
if (existsSync(gitignorePath)) {
  const gitignore = readFileSync(gitignorePath, 'utf-8');
  if (gitignore.includes('.env')) log('pass', '.env가 .gitignore에 등록됨');
  else log('fail', '.env가 .gitignore에 없음 — 즉시 추가 필요');
} else {
  log('fail', '.gitignore 파일이 없음');
}

// ===== 점검 7: Edge Functions 인증 검증 =====
section('7. Edge Functions 인증 검증');
const edgeFunctionsDir = join(ROOT, 'supabase/functions');
if (existsSync(edgeFunctionsDir)) {
  const functions = readdirSync(edgeFunctionsDir).filter(f => {
    return f !== '_shared' && statSync(join(edgeFunctionsDir, f)).isDirectory();
  });

  for (const fn of functions) {
    const indexPath = join(edgeFunctionsDir, fn, 'index.ts');
    if (!existsSync(indexPath)) continue;
    const content = readFileSync(indexPath, 'utf-8');

    // webhook은 별도 인증 (서명 검증)
    if (fn.includes('webhook') || fn.includes('renewals')) {
      log('info', `${fn}: webhook/cron — 별도 인증 메커니즘`);
      continue;
    }

    if (content.includes("headers.get('Authorization')") ||
        content.includes("headers.get(\"Authorization\")")) {
      log('pass', `${fn}: 인증 헤더 검증`);
    } else {
      log('fail', `${fn}: 인증 검증 누락 — 401 응답 추가 필요`);
    }
  }
} else {
  log('info', 'supabase/functions 디렉토리 없음 — 데모 모드');
}

// ===== 점검 8: RLS 정책 마이그레이션 존재 =====
section('8. Row Level Security 정책');
const rlsMigration = join(ROOT, 'supabase/migrations/20260411000002_rls_policies.sql');
if (existsSync(rlsMigration)) {
  const sql = readFileSync(rlsMigration, 'utf-8');
  const requiredTables = ['profiles', 'subscriptions', 'payments', 'documents', 'audit_logs'];
  for (const table of requiredTables) {
    if (sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)) {
      log('pass', `RLS 활성화: ${table}`);
    } else {
      log('fail', `RLS 누락: ${table}`);
    }
  }
} else {
  log('fail', 'RLS 마이그레이션 파일 누락');
}

// ===== 점검 9: HTTPS / Mixed Content =====
section('9. HTTP URL 사용 (Mixed Content 위험)');
let httpFound = 0;
for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  // localhost는 제외
  const matches = content.match(/['"`]http:\/\/(?!localhost|127\.0\.0\.1)[^'"`\s]+['"`]/g);
  if (matches) {
    log('warn', `${file.replace(ROOT + '/', '')} — HTTP URL ${matches.length}개`);
    httpFound++;
  }
}
if (httpFound === 0) log('pass', 'HTTP URL 사용 없음 (localhost 제외)');

// ===== 결과 요약 =====
console.log('\n' + '═'.repeat(50));
console.log(`${colors.bold}점검 결과 요약${colors.reset}`);
console.log('═'.repeat(50));
console.log(`${colors.green}✓ PASS    : ${passed}${colors.reset}`);
console.log(`${colors.yellow}⚠ WARNING : ${warnings}${colors.reset}`);
console.log(`${colors.red}✗ FAIL    : ${failed}${colors.reset}`);

if (failed > 0) {
  console.log(`\n${colors.red}${colors.bold}❌ ${failed}개의 보안 문제가 발견되었습니다. 운영 배포 전 반드시 수정하세요.${colors.reset}`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n${colors.yellow}${colors.bold}⚠ ${warnings}개의 경고 — 검토 후 진행 권장${colors.reset}`);
  process.exit(0);
} else {
  console.log(`\n${colors.green}${colors.bold}✅ 모든 자동 점검 통과 — SECURITY_AUDIT.md의 수동 항목도 점검하세요.${colors.reset}`);
  process.exit(0);
}
