/**
 * Draft Templates — 자주 쓰이는 한국 공공·기업 문서 프리셋
 *
 * 각 템플릿은 프롬프트 스캐폴드와 섹션 아웃라인을 제공해,
 * 빈 프롬프트 대신 즉시 사용 가능한 구조를 사용자에게 노출.
 *
 * @module lib/ai/templates
 */

export interface DraftTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: '공공' | '기업' | '연구' | '범용';
  /** 사용자가 작성할 내용 힌트 — DraftAIModal 의 프롬프트 초기값 */
  promptScaffold: string;
  /** 추천 섹션 구조 — 모델에게 힌트로 추가 전달 */
  outline: string[];
  /** 추천 모델 (선택) */
  preferredModel?: 'gemini-2.5-pro' | 'gemini-2.5-flash';
}

export const DRAFT_TEMPLATES: DraftTemplate[] = [
  {
    id: 'official-letter',
    name: '공문',
    icon: '🏛️',
    description: '기관 간 협조·통보·요청 등 공식 문서',
    category: '공공',
    promptScaffold: `다음 내용의 공문을 작성해 주세요.

- 수신:
- 제목:
- 목적:
- 협조 요청 사항:
- 기한:
- 담당자:`,
    outline: [
      '문서번호·시행일자',
      '수신·참조',
      '제목',
      '본문 (목적 / 내용 / 요청 / 기한)',
      '붙임',
      '발신자 (기관명·직위)',
    ],
  },
  {
    id: 'quarterly-report',
    name: '분기 보고서',
    icon: '📊',
    description: '분기 실적·성과·계획 정리',
    category: '기업',
    promptScaffold: `다음 정보로 분기 보고서를 작성해 주세요.

- 보고 기간:
- 대상 부서/팀:
- 주요 성과:
- KPI 달성 현황:
- 이슈·리스크:
- 다음 분기 계획:`,
    outline: [
      '요약 (Executive Summary)',
      '핵심 지표 대시보드',
      '부문별 성과',
      '이슈 및 리스크',
      '다음 분기 계획',
      '부록 — 상세 수치',
    ],
  },
  {
    id: 'meeting-minutes',
    name: '회의록',
    icon: '📝',
    description: '회의 안건·논의·결정사항·액션아이템',
    category: '범용',
    promptScaffold: `다음 회의를 회의록으로 정리해 주세요.

- 회의명:
- 일시:
- 장소:
- 참석자:
- 안건:
- 주요 논의:
- 결정사항:
- 액션 아이템 (담당자·기한):`,
    outline: [
      '회의 개요',
      '참석자',
      '안건',
      '논의 내용',
      '결정사항',
      '액션 아이템',
      '차기 회의 일정',
    ],
    preferredModel: 'gemini-2.5-flash',
  },
  {
    id: 'proposal',
    name: '사업 제안서',
    icon: '💼',
    description: '신규 사업·프로젝트 제안',
    category: '기업',
    promptScaffold: `다음 주제의 사업 제안서를 작성해 주세요.

- 제안 주제:
- 배경·문제의식:
- 해결 방안:
- 기대 효과:
- 필요 예산 및 일정:
- 이해관계자·협력 구조:`,
    outline: [
      '개요',
      '배경 및 문제 정의',
      '해결 방안·접근법',
      '세부 추진 계획',
      '예산·일정',
      '기대 효과·성과 지표',
      '리스크 관리',
      '결론',
    ],
  },
  {
    id: 'research-report',
    name: '연구 보고서',
    icon: '🔬',
    description: '연구 결과·분석·제언을 정리',
    category: '연구',
    promptScaffold: `다음 연구 내용을 보고서로 작성해 주세요.

- 연구 주제:
- 연구 기간:
- 연구 방법:
- 주요 발견:
- 시사점·제언:
- 참고 문헌:`,
    outline: [
      '요약',
      '연구 배경·목적',
      '선행 연구 검토',
      '연구 방법론',
      '분석 결과',
      '논의',
      '결론·제언',
      '참고 문헌',
    ],
  },
  {
    id: 'press-release',
    name: '보도자료',
    icon: '📰',
    description: '언론 배포용 보도자료',
    category: '범용',
    promptScaffold: `다음 내용의 보도자료를 작성해 주세요.

- 발표 기관:
- 일시:
- 주요 발표 내용:
- 배경·의의:
- 문의처:`,
    outline: [
      '헤드라인',
      '리드 문단 (5W1H)',
      '본문 (배경·세부·의의)',
      '인용문 (관계자 코멘트)',
      '부가 정보·문의처',
    ],
    preferredModel: 'gemini-2.5-flash',
  },
];

export function getTemplate(id: string): DraftTemplate | undefined {
  return DRAFT_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: DraftTemplate['category']): DraftTemplate[] {
  return DRAFT_TEMPLATES.filter(t => t.category === category);
}

/**
 * 템플릿으로부터 AI 프롬프트를 조립.
 * 사용자 입력이 있으면 이어서 붙이고, outline 을 시스템 힌트로 포함.
 */
export function buildPromptFromTemplate(tpl: DraftTemplate, userInput?: string): string {
  const parts: string[] = [];
  parts.push(`## 문서 유형\n${tpl.name} (${tpl.description})`);
  parts.push('');
  parts.push('## 권장 섹션 구조');
  tpl.outline.forEach((o, i) => parts.push(`${i + 1}. ${o}`));
  parts.push('');
  parts.push('## 작성 요청');
  parts.push(userInput?.trim() || tpl.promptScaffold);
  return parts.join('\n');
}
