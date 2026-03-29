/**
 * EU AI Act Compliance Rules
 * Regulation (EU) 2024/1689
 */

import type { FrameworkMeta } from '../../../types/compliance';

export const EU_AI_ACT: FrameworkMeta = {
  id: 'eu-ai-act',
  name: 'EU AI Act',
  subtitle: 'European Union Artificial Intelligence Act compliance',
  description: 'Regulation (EU) 2024/1689',
  version: 'Regulation (EU) 2024/1689',
  icon: 'globe',
  tags: ['Transparency', 'Risk Management', 'Data Governance', 'Human Oversight', 'Technical Robustness'],
  categories: [
    {
      name: 'Transparency',
      checks: [
        { id: 'EU-T1', description: 'AI 생성 콘텐츠가 명확히 표시되어 있는가', article: 'Article 50(2)' },
        { id: 'EU-T2', description: '사용된 AI 모델 정보가 기록되어 있는가', article: 'Article 13' },
        { id: 'EU-T3', description: 'AI 생성 비율이 문서에 표시되는가' },
        { id: 'EU-T4', description: '사용자에게 AI 사용 사실이 고지되었는가', article: 'Article 52' },
      ],
    },
    {
      name: 'Risk Management',
      checks: [
        { id: 'EU-R1', description: 'AI 시스템 위험도가 분류되어 있는가', article: 'Article 6' },
        { id: 'EU-R2', description: '할루시네이션 검증이 수행되었는가' },
        { id: 'EU-R3', description: '검증 점수가 임계값 이상인가 (≥0.8)', article: 'Article 9' },
      ],
    },
    {
      name: 'Data Governance',
      checks: [
        { id: 'EU-D1', description: '입력 데이터에 개인정보가 포함되지 않았는가', article: 'Article 10' },
        { id: 'EU-D2', description: 'API 호출 로그가 보존되고 있는가', article: 'Article 12' },
        { id: 'EU-D3', description: '토큰 사용량이 기록되고 있는가' },
      ],
    },
    {
      name: 'Human Oversight',
      checks: [
        { id: 'EU-H1', description: '모든 AI 생성물을 사용자가 검토했는가', article: 'Article 14' },
        { id: 'EU-H2', description: 'AI 결과를 사용자가 수정할 수 있는가', article: 'Article 14(4)' },
        { id: 'EU-H3', description: 'AI 기능을 비활성화할 수 있는가' },
      ],
    },
    {
      name: 'Technical Robustness',
      checks: [
        { id: 'EU-TR1', description: 'Prompt Injection 방어가 적용되어 있는가', article: 'Article 15' },
        { id: 'EU-TR2', description: 'AI 출력이 새니타이징 되는가' },
        { id: 'EU-TR3', description: '오류 시 폴백 메커니즘이 있는가', article: 'Article 15(3)' },
        { id: 'EU-TR4', description: 'API 타임아웃/재시도 정책이 설정되어 있는가' },
      ],
    },
  ],
};
