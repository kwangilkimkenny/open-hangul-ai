/**
 * AI Configuration
 * OpenAI API 및 AI 기능 설정
 * 
 * @module lib/ai/ai-config
 * @version 2.1.0
 * @reference ref/hwp_hwpx_viewer/src/config/ai-config.js
 */

/**
 * AI 설정 객체
 */
export const AIConfig = {
  /**
   * OpenAI API 설정
   */
  openai: {
    /**
     * API 키 가져오기
     */
    getApiKey(): string | null {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('openai_api_key');
      }
      return null;
    },
    
    /**
     * API 키 설정
     */
    setApiKey(apiKey: string): void {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('openai_api_key', apiKey);
      }
    },
    
    /**
     * API 키 삭제
     */
    clearApiKey(): void {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('openai_api_key');
      }
    },
    
    /**
     * 모델 설정
     */
    model: 'gpt-4o',
    
    /**
     * Temperature (0.0 ~ 2.0)
     */
    temperature: 0.7,
    
    /**
     * 최대 토큰 수 (기본값 — 배치 크기에 따라 동적 조정됨)
     */
    maxTokens: 4000,

    /**
     * API 엔드포인트
     */
    endpoint: 'https://api.openai.com/v1/chat/completions',

    /**
     * 타임아웃 기본값 (밀리초) — 배치 크기에 따라 동적 조정됨
     */
    timeout: 90000, // 1.5분 (기본)

    /**
     * 셀당 추가 타임아웃 (밀리초)
     */
    timeoutPerCell: 3000, // 셀당 3초 추가

    /**
     * 최대 타임아웃 (밀리초)
     */
    maxTimeout: 300000, // 5분 상한
    
    /**
     * 재시도 설정
     */
    retry: {
      maxAttempts: 3,
      delayMs: 2000,
      backoffMultiplier: 2
    }
  },
  
  /**
   * 프롬프트 설정
   */
  prompts: {
    /**
     * System Message
     */
    systemMessage: `당신은 한글 문서 구조를 정확히 유지하면서 내용만 변경하는 전문가입니다.

**핵심 원칙**:
- 절대 구조 변경 금지: 표, 레이아웃, 이미지 위치 유지
- 각 항목의 헤더 이름 반드시 유지
- 오직 내용만 변경
- 헤더는 이미 분리되어 있으므로 헤더는 변경하지 마세요

**응답 형식 (JSON)**:
반드시 JSON 객체로 응답하세요. 각 헤더를 키로, 생성된 내용을 값으로 사용하세요.

**중요 규칙**:
1. 헤더 이름은 절대 변경하지 마세요
2. 내용이 없는 항목은 빈 문자열로 설정하세요
3. 텍스트 길이를 적절하게 유지하세요
4. 한글 문법과 맞춤법을 정확히 지켜주세요
5. 줄바꿈이 필요한 경우 \\n을 사용하세요

**예시**:
입력 헤더: ["활동명", "활동목표", "준비물"]
요청: "가을 소풍 주제로 만들어줘"
출력: {
  "활동명": "가을 낙엽 모으기",
  "활동목표": "자연의 변화를 관찰하고 가을의 특징을 이해한다",
  "준비물": "바구니, 돋보기, 낙엽 채집 도구"
}

**주의**: 항상 JSON 형식으로만 응답하세요.`,
    
    /**
     * 에러 메시지
     */
    errorMessages: {
      noApiKey: '🔑 OpenAI API 키가 설정되지 않았습니다.\n\n채팅 패널에서 "🔑" 버튼을 클릭하여 API 키를 입력해주세요.\n\nAPI 키 발급: https://platform.openai.com/api-keys',
      apiError: '⚠️ OpenAI API 호출 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.',
      invalidResponse: '❌ GPT 응답 형식이 올바르지 않습니다.\n\n다시 시도해주세요.',
      rateLimitExceeded: '⏱️ API 사용량 한도를 초과했습니다.\n\n1분 후 다시 시도해주세요.',
      timeout: '⏰ 응답 시간이 초과되었습니다.\n\n더 간단한 요청을 사용해보세요.',
      documentTooLarge: '📄 문서가 너무 크거나 복잡합니다.\n\n더 작은 문서를 사용해주세요.'
    }
  },
  
  /**
   * 비용 관리
   */
  costManagement: {
    enabled: true,
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00003,
    warningThreshold: 1.0,
    maxCost: 10.0
  }
};

export default AIConfig;

