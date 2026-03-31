#!/usr/bin/env node
/**
 * HWP → HWPX 변환 + 시맨틱 테이블 진단
 * hwp2hwpx-js 라이브러리를 직접 사용
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const HWP_PATH = resolve(process.argv[2] || 'temp/[개발 분야 신청서(HWP)] 2026년 오픈소스 AI·SW 개발·활용 지원사업_수정(2p, 3p).hwp');
const HWPX_OUT = resolve('temp/test_diagnostic.hwpx');

console.log('═'.repeat(70));
console.log('  HWP → HWPX 변환 + 시맨틱 진단');
console.log('═'.repeat(70));

try {
  // 동적 import (ESM)
  const { Hwp2Hwpx } = await import('../packages/hwpx-parser/hwp-converter/hwp2hwpx-js/dist/core/Hwp2Hwpx.js');

  const buffer = readFileSync(HWP_PATH);
  console.log(`\n입력: ${HWP_PATH} (${(buffer.length / 1024).toFixed(1)} KB)`);

  console.log('\n[1/2] HWP → HWPX 변환...');
  const hwpxBinary = await Hwp2Hwpx.convert(buffer, {
    onProgress: (p) => {
      if (p.percent % 20 === 0) console.log(`  ${p.percent}% — ${p.stage || ''}`);
    }
  });

  writeFileSync(HWPX_OUT, hwpxBinary);
  console.log(`  변환 완료: ${HWPX_OUT} (${(hwpxBinary.length / 1024).toFixed(1)} KB)`);

  console.log('\n[2/2] HWPX 시맨틱 진단 실행...');
  // diagnostic-test.mjs의 로직을 HWPX에 대해 실행
  const { execSync } = await import('child_process');
  execSync(`node scripts/diagnostic-test.mjs "${HWPX_OUT}"`, { stdio: 'inherit' });

} catch (err) {
  console.error('오류:', err.message);

  // hwplib-js를 못 찾으면 안내
  if (err.message?.includes('hwplib-js')) {
    console.log('\n💡 hwplib-js 모듈 링크가 필요합니다:');
    console.log('  cd packages/hwpx-parser/hwp-converter/hwp2hwpx-js');
    console.log('  npm link ../hwplib-js');
  }

  process.exit(1);
}
