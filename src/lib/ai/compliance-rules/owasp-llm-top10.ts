/**
 * OWASP Top 10 for LLM Applications
 * v1.1 (2024)
 */

import type { FrameworkMeta } from '../../../types/compliance';

export const OWASP_LLM_TOP10: FrameworkMeta = {
  id: 'owasp-llm-top10',
  name: 'OWASP LLM Top 10',
  subtitle: 'OWASP Top 10 for LLM Applications',
  description: 'v1.1 (2024)',
  version: 'v1.1 (2024)',
  icon: 'alert-triangle',
  tags: [
    'LLM01: Prompt Injection',
    'LLM02: Insecure Output',
    'LLM03: Training Data Poisoning',
    'LLM04: Model DoS',
    'LLM05: Supply Chain',
    '+5 more',
  ],
  categories: [
    {
      name: 'LLM01: Prompt Injection',
      checks: [
        { id: 'OW-01a', description: '시스템 프롬프트가 사용자 입력과 분리되어 있는가' },
        { id: 'OW-01b', description: '사용자 입력이 새니타이징 되는가' },
        { id: 'OW-01c', description: '프롬프트 주입 탐지 메커니즘이 있는가' },
      ],
    },
    {
      name: 'LLM02: Insecure Output',
      checks: [
        { id: 'OW-02a', description: 'AI 출력이 DOM 삽입 전 이스케이프 되는가' },
        { id: 'OW-02b', description: 'XSS 방지 처리가 적용되어 있는가' },
        { id: 'OW-02c', description: '출력 검증(할루시네이션 체크)이 수행되는가' },
      ],
    },
    {
      name: 'LLM03: Training Data Poisoning',
      checks: [
        { id: 'OW-03a', description: '신뢰할 수 있는 모델 프로바이더를 사용하는가' },
        { id: 'OW-03b', description: '모델 출처와 버전이 기록되어 있는가' },
      ],
    },
    {
      name: 'LLM04: Model DoS',
      checks: [
        { id: 'OW-04a', description: '토큰 제한(maxTokens)이 설정되어 있는가' },
        { id: 'OW-04b', description: 'API 타임아웃이 설정되어 있는가' },
        { id: 'OW-04c', description: '비용 상한이 설정되어 있는가' },
      ],
    },
    {
      name: 'LLM05: Supply Chain',
      checks: [
        { id: 'OW-05a', description: 'API 통신이 HTTPS를 사용하는가' },
        { id: 'OW-05b', description: 'API 키가 서버 사이드에서 관리되는가 (프록시)' },
      ],
    },
    {
      name: 'LLM06: Sensitive Info Disclosure',
      checks: [
        { id: 'OW-06a', description: '개인정보(PII) 감지 메커니즘이 있는가' },
        { id: 'OW-06b', description: '민감 데이터가 AI 입력에서 마스킹 되는가' },
      ],
    },
    {
      name: 'LLM07: Insecure Plugin Design',
      checks: [
        { id: 'OW-07a', description: '외부 플러그인/확장의 권한이 제한되어 있는가' },
      ],
    },
    {
      name: 'LLM08: Excessive Agency',
      checks: [
        { id: 'OW-08a', description: 'AI 자동 실행이 사용자 승인 없이 일어나지 않는가' },
        { id: 'OW-08b', description: 'AI 행동 범위가 문서 편집으로 제한되어 있는가' },
      ],
    },
    {
      name: 'LLM09: Overreliance',
      checks: [
        { id: 'OW-09a', description: 'AI 생성물에 대한 사실 검증 수단이 제공되는가' },
        { id: 'OW-09b', description: '사용자에게 AI 한계에 대한 고지가 있는가' },
      ],
    },
    {
      name: 'LLM10: Model Theft',
      checks: [
        { id: 'OW-10a', description: 'API 키가 클라이언트에 노출되지 않는가' },
        { id: 'OW-10b', description: '접근 제어가 적용되어 있는가' },
      ],
    },
  ],
};
