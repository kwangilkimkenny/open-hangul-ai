/**
 * K-AI Act (한국 인공지능 기본법) Compliance Rules
 * 인공지능산업 육성 및 신뢰 기반 조성에 관한 법률
 */

import type { FrameworkMeta } from '../../../types/compliance';

export const K_AI_ACT: FrameworkMeta = {
  id: 'k-ai-act',
  name: 'K-AI Act',
  subtitle: '한국 인공지능 기본법 준수',
  description: '인공지능산업 육성 및 신뢰 기반 조성에 관한 법률',
  version: '2026년 시행',
  icon: 'zap',
  tags: ['안전성', '투명성', '공정성', '책임성', '프라이버시'],
  categories: [
    {
      name: '안전성',
      checks: [
        { id: 'KR-S1', description: 'AI 생성 콘텐츠의 사실 검증이 수행되었는가', article: '제27조' },
        { id: 'KR-S2', description: '할루시네이션 검증 점수가 기준치 이상인가 (≥0.8)' },
        { id: 'KR-S3', description: '유해 콘텐츠 필터링이 적용되었는가', article: '제22조' },
      ],
    },
    {
      name: '투명성',
      checks: [
        { id: 'KR-T1', description: 'AI로 작성된 부분이 표시되어 있는가', article: '제23조' },
        { id: 'KR-T2', description: '사용된 AI 모델과 버전이 기록되어 있는가', article: '제23조(2)' },
        { id: 'KR-T3', description: 'AI 생성 과정이 추적 가능한가', article: '제24조' },
      ],
    },
    {
      name: '공정성',
      checks: [
        { id: 'KR-F1', description: 'AI 생성물에 차별적 편향이 감지되지 않는가', article: '제25조' },
        { id: 'KR-F2', description: '다양한 관점이 반영되었는가' },
      ],
    },
    {
      name: '책임성',
      checks: [
        { id: 'KR-A1', description: 'AI 사용에 대한 최종 책임자가 명시되어 있는가', article: '제26조' },
        { id: 'KR-A2', description: '사용자 승인 이력이 기록되어 있는가' },
        { id: 'KR-A3', description: '문제 발생 시 롤백이 가능한가 (Undo/Redo)' },
        { id: 'KR-A4', description: 'AI 활동 로그 보존 기간을 충족하는가', article: '제28조' },
      ],
    },
    {
      name: '프라이버시',
      checks: [
        { id: 'KR-P1', description: '개인정보가 AI 모델에 전송되지 않았는가', article: '제29조' },
        { id: 'KR-P2', description: 'API 통신이 암호화되어 있는가 (HTTPS)' },
        { id: 'KR-P3', description: 'API 키가 안전하게 관리되고 있는가' },
      ],
    },
  ],
};
