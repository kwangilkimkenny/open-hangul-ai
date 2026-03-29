/**
 * Compliance Rules Index
 * 모든 프레임워크 규칙을 통합 export
 */

import { EU_AI_ACT } from './eu-ai-act';
import { K_AI_ACT } from './k-ai-act';
import { NIST_AI_RMF } from './nist-ai-rmf';
import { OWASP_LLM_TOP10 } from './owasp-llm-top10';
import type { FrameworkMeta, FrameworkType } from '../../../types/compliance';

export const FRAMEWORKS: Record<FrameworkType, FrameworkMeta> = {
  'eu-ai-act': EU_AI_ACT,
  'k-ai-act': K_AI_ACT,
  'nist-ai-rmf': NIST_AI_RMF,
  'owasp-llm-top10': OWASP_LLM_TOP10,
};

export const FRAMEWORK_LIST: FrameworkMeta[] = [
  EU_AI_ACT,
  K_AI_ACT,
  NIST_AI_RMF,
  OWASP_LLM_TOP10,
];

export { EU_AI_ACT, K_AI_ACT, NIST_AI_RMF, OWASP_LLM_TOP10 };
