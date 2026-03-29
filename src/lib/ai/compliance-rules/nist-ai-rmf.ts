/**
 * NIST AI Risk Management Framework Rules
 * AI RMF 1.0 (January 2023)
 */

import type { FrameworkMeta } from '../../../types/compliance';

export const NIST_AI_RMF: FrameworkMeta = {
  id: 'nist-ai-rmf',
  name: 'NIST AI RMF',
  subtitle: 'NIST AI Risk Management Framework',
  description: 'AI RMF 1.0 (January 2023)',
  version: 'AI RMF 1.0 (January 2023)',
  icon: 'target',
  tags: ['Govern', 'Map', 'Measure', 'Manage'],
  categories: [
    {
      name: 'Govern',
      checks: [
        { id: 'NIST-G1', description: 'AI 사용 정책이 설정되어 있는가', article: 'GOVERN 1.1' },
        { id: 'NIST-G2', description: 'AI 기능 활성화/비활성화 제어가 가능한가', article: 'GOVERN 1.3' },
        { id: 'NIST-G3', description: '비용 한도가 설정되어 있는가', article: 'GOVERN 1.5' },
        { id: 'NIST-G4', description: 'AI 사용에 대한 역할과 책임이 정의되어 있는가', article: 'GOVERN 2.1' },
      ],
    },
    {
      name: 'Map',
      checks: [
        { id: 'NIST-M1', description: 'AI 사용 영역이 식별되어 있는가', article: 'MAP 1.1' },
        { id: 'NIST-M2', description: 'AI 시스템의 영향 범위가 문서화되어 있는가', article: 'MAP 1.5' },
        { id: 'NIST-M3', description: '이해관계자가 식별되어 있는가', article: 'MAP 1.6' },
      ],
    },
    {
      name: 'Measure',
      checks: [
        { id: 'NIST-ME1', description: 'AI 성능 지표가 측정되고 있는가 (할루시네이션 점수)', article: 'MEASURE 1.1' },
        { id: 'NIST-ME2', description: '토큰/비용 사용량이 추적되고 있는가', article: 'MEASURE 2.3' },
        { id: 'NIST-ME3', description: '사용자 승인율이 기록되고 있는가', article: 'MEASURE 2.6' },
        { id: 'NIST-ME4', description: 'AI 출력 품질 평가가 수행되는가', article: 'MEASURE 2.7' },
      ],
    },
    {
      name: 'Manage',
      checks: [
        { id: 'NIST-MA1', description: '위험 완화 조치가 적용되어 있는가', article: 'MANAGE 1.1' },
        { id: 'NIST-MA2', description: '지속적 모니터링 체계가 갖추어져 있는가', article: 'MANAGE 4.1' },
        { id: 'NIST-MA3', description: '인시던트 대응 절차가 있는가', article: 'MANAGE 4.2' },
      ],
    },
  ],
};
