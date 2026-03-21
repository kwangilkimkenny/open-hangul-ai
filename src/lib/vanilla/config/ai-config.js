/**
 * AI Configuration
 * OpenAI API 및 AI 기능 설정
 *
 * @module config/ai-config
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AIConfig');

/**
 * AI 설정 객체
 * 
 * @example
 * import { AIConfig } from './config/ai-config.js';
 * const apiKey = AIConfig.getApiKey();
 */
export const AIConfig = {
    /**
     * OpenAI API 설정
     */
    openai: {
        /**
         * API 키 가져오기
         * 우선순위: 1) 환경변수, 2) sessionStorage, 3) localStorage
         *
         * ⚠️ Security Warning:
         * - localStorage/sessionStorage는 XSS 공격에 취약합니다
         * - 프로덕션 환경에서는 서버 프록시 사용을 권장합니다
         * - 민감한 API 키는 클라이언트에 저장하지 마세요
         */
        getApiKey() {
            // 환경변수 (Vite 환경) - 권장
            if (import.meta && import.meta.env && import.meta.env.VITE_OPENAI_API_KEY) {
                return import.meta.env.VITE_OPENAI_API_KEY;
            }

            // Node.js 환경 (레거시 지원)
            if (typeof process !== 'undefined' && process.env.OPENAI_API_KEY) {
                return process.env.OPENAI_API_KEY;
            }

            // 브라우저 환경 - sessionStorage만 사용 (세션 종료 시 자동 삭제)
            if (typeof window !== 'undefined' && window.sessionStorage) {
                return window.sessionStorage.getItem('openai_api_key') || null;
            }

            return null;
        },

        /**
         * API 키 설정
         * @param {string} apiKey - OpenAI API 키
         * @param {Object} [options={}] - 옵션
         * @param {boolean} [options.useSessionStorage=false] - sessionStorage 사용 여부 (더 안전)
         *
         * ⚠️ Security: sessionStorage 사용 권장 (세션 종료 시 자동 삭제)
         */
        setApiKey(apiKey) {
            if (typeof window === 'undefined') return;

            // 보안 경고 (개발 모드에서만)
            if (import.meta && import.meta.env && import.meta.env.DEV) {
                logger.warn(
                    '⚠️ Security Warning: API 키를 클라이언트에 저장하는 것은 보안상 위험합니다. ' +
                    '프로덕션 환경에서는 서버 프록시 사용을 권장합니다.'
                );
            }

            // sessionStorage에만 저장 (세션 종료 시 자동 삭제)
            if (window.sessionStorage) {
                window.sessionStorage.setItem('openai_api_key', apiKey);
            }
        },

        /**
         * API 키 삭제
         */
        clearApiKey() {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.removeItem('openai_api_key');
            }
        },
        
        /**
         * 모델 설정
         * 환경변수로 오버라이드 가능
         */
        get model() {
            return import.meta.env.VITE_OPENAI_MODEL || 'gpt-4-turbo-preview';
        },

        /**
         * Temperature (0.0 ~ 2.0)
         * 낮을수록 일관적, 높을수록 창의적
         * 환경변수로 오버라이드 가능
         */
        get temperature() {
            return Number(import.meta.env.VITE_OPENAI_TEMPERATURE) || 0.7;
        },

        /**
         * 최대 토큰 수
         * 환경변수로 오버라이드 가능
         */
        get maxTokens() {
            return Number(import.meta.env.VITE_OPENAI_MAX_TOKENS) || 4000;
        },

        /**
         * API 엔드포인트
         * 환경변수로 오버라이드 가능
         */
        get endpoint() {
            return import.meta.env.VITE_OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
        },

        /**
         * 타임아웃 (밀리초)
         * 큰 문서 처리를 위해 120초로 증가
         * 환경변수로 오버라이드 가능
         */
        get timeout() {
            return Number(import.meta.env.VITE_OPENAI_TIMEOUT) || 120000;
        },
        
        /**
         * 재시도 설정
         * 더 긴 대기 시간으로 API 안정성 향상
         */
        retry: {
            maxAttempts: 3,
            delayMs: 2000,
            backoffMultiplier: 2
        }
    },
    
    /**
     * 🆕 커스텀 API 설정
     * 업체별 자체 AI API 연동 지원
     * @version 3.0.0-MVP
     */
    custom: {
        /**
         * 커스텀 API 사용 여부 확인
         * @returns {boolean}
         */
        isEnabled() {
            if (typeof window !== 'undefined' && window.localStorage) {
                return localStorage.getItem('custom_api_enabled') === 'true';
            }
            return false;
        },
        
        /**
         * 커스텀 API 활성화/비활성화
         * @param {boolean} enabled - 활성화 여부
         */
        setEnabled(enabled) {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('custom_api_enabled', enabled.toString());
            }
        },
        
        /**
         * 커스텀 엔드포인트 가져오기
         * @returns {string|null}
         */
        getEndpoint() {
            if (typeof window !== 'undefined' && window.localStorage) {
                return localStorage.getItem('custom_api_endpoint') || null;
            }
            return null;
        },
        
        /**
         * 커스텀 엔드포인트 설정
         * @param {string} endpoint - API 엔드포인트 URL
         */
        setEndpoint(endpoint) {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('custom_api_endpoint', endpoint);
            }
        },
        
        /**
         * 커스텀 API 키 가져오기
         * @returns {string|null}
         */
        getApiKey() {
            if (typeof window !== 'undefined' && window.localStorage) {
                return localStorage.getItem('custom_api_key') || null;
            }
            return null;
        },
        
        /**
         * 커스텀 API 키 설정
         * @param {string} apiKey - API 키
         */
        setApiKey(apiKey) {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('custom_api_key', apiKey);
            }
        },
        
        /**
         * 커스텀 API 설정 초기화
         */
        clear() {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem('custom_api_enabled');
                localStorage.removeItem('custom_api_endpoint');
                localStorage.removeItem('custom_api_key');
            }
        },
        
        /**
         * 커스텀 API 설정 검증
         * @returns {Object} 검증 결과 { valid: boolean, error?: string }
         */
        validate() {
            // 비활성화 상태면 검증 통과
            if (!this.isEnabled()) {
                return { valid: true };
            }
            
            const endpoint = this.getEndpoint();
            const apiKey = this.getApiKey();
            
            // 필수 필드 확인
            if (!endpoint || !apiKey) {
                return { 
                    valid: false, 
                    error: '엔드포인트와 API 키가 필요합니다' 
                };
            }
            
            // URL 형식 검증
            try {
                const url = new URL(endpoint);
                // HTTPS 권장 (로컬 개발 제외)
                if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
                    return { 
                        valid: false, 
                        error: 'HTTPS 엔드포인트를 사용하세요 (보안)' 
                    };
                }
            } catch (e) {
                return { 
                    valid: false, 
                    error: '유효하지 않은 URL 형식입니다' 
                };
            }
            
            return { valid: true };
        }
    },
    
    /**
     * 프록시 서버 URL 가져오기
     * .env에 VITE_API_PROXY_URL이 설정되어 있으면 프록시 사용
     * @returns {string|null}
     */
    getProxyUrl() {
        if (import.meta && import.meta.env && import.meta.env.VITE_API_PROXY_URL) {
            return import.meta.env.VITE_API_PROXY_URL;
        }
        return null;
    },

    /**
     * 프록시 모드 여부 확인
     * @returns {boolean}
     */
    isProxyMode() {
        return !!this.getProxyUrl();
    },

    /**
     * 활성 엔드포인트 가져오기
     * 우선순위: 1) 프록시 URL, 2) 커스텀 API, 3) OpenAI
     * @returns {string}
     */
    getActiveEndpoint() {
        const proxyUrl = this.getProxyUrl();
        if (proxyUrl) return proxyUrl;
        return this.custom.isEnabled() ?
            this.custom.getEndpoint() :
            this.openai.endpoint;
    },

    /**
     * 활성 API 키 가져오기
     * 프록시 모드에서는 API 키가 서버에서 관리되므로 'proxy' 반환
     * @returns {string|null}
     */
    getActiveApiKey() {
        if (this.isProxyMode()) return 'proxy';
        return this.custom.isEnabled() ?
            this.custom.getApiKey() :
            this.openai.getApiKey();
    },
    
    /**
     * 프롬프트 설정
     */
    prompts: {
        /**
         * System Message (특급 개선 버전)
         * GPT에게 역할과 규칙을 명시
         */
        systemMessage: `당신은 한글 문서 구조를 정확히 유지하면서 내용만 변경하는 전문가입니다.

**핵심 원칙**:
- 절대 구조 변경 금지: 표, 레이아웃, 이미지 위치 유지
- 각 텍스트 슬롯의 ID 반드시 유지
- 오직 텍스트 내용만 변경
- 📌 중요: 제공된 슬롯은 "내용" 셀만입니다. "제목" 셀은 이미 제외되었으므로 걱정하지 마세요.

**응답 형식 (JSON)**:
{
  "updatedSlots": [
    {"slotId": "slot-xxx", "newText": "변경된 텍스트"}
  ]
}

**중요 규칙**:
1. slotId는 절대 변경하지 마세요
2. 변경하지 않는 슬롯은 포함하지 마세요
3. 텍스트 길이를 원본과 비슷하게 유지하세요
4. 원본보다 2배 이상 길어지지 않도록 하세요
5. 한글 문법과 맞춤법을 정확히 지켜주세요

**예시**:
입력: slotId="slot-123", text="복잡한 전문 용어 설명"
요청: "쉽게 바꿔줘"
출력: {"updatedSlots": [{"slotId": "slot-123", "newText": "쉬운 말로 설명"}]}

**주의**: 항상 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`,
        
        /**
         * User Message 템플릿
         * {STRUCTURE}와 {REQUEST}는 런타임에 치환됨
         */
        userMessageTemplate: `문서 구조:
{STRUCTURE}

사용자 요청:
{REQUEST}

📌 중요: 위 구조에는 "내용" 텍스트만 포함되어 있습니다. "제목/라벨" 텍스트는 이미 제외되었습니다.

위 구조를 정확히 유지하면서, 사용자 요청에 따라 텍스트만 변경해주세요.
응답은 JSON 형식으로만 제공하세요.`,
        
        /**
         * 에러 메시지 (사용자용)
         */
        errorMessages: {
            noApiKey: '🔑 OpenAI API 키가 설정되지 않았습니다.\n\n채팅 패널에서 "🔑 API 키 설정" 버튼을 클릭하여 API 키를 입력해주세요.\n\nAPI 키 발급: https://platform.openai.com/api-keys',
            
            apiError: '⚠️ OpenAI API 호출 중 오류가 발생했습니다.\n\n가능한 원인:\n- 네트워크 연결 문제\n- API 키가 유효하지 않음\n- OpenAI 서비스 일시 중단\n\n잠시 후 다시 시도해주세요.',
            
            invalidResponse: '❌ GPT 응답 형식이 올바르지 않습니다.\n\n다시 시도해주세요. 문제가 계속되면 다른 요청을 입력해보세요.',
            
            rateLimitExceeded: '⏱️ API 사용량 한도를 초과했습니다.\n\n해결 방법:\n1. 1분 후 다시 시도\n2. OpenAI 대시보드에서 사용량 확인\n3. 결제 방법이 등록되어 있는지 확인',
            
            timeout: '⏰ 응답 시간이 초과되었습니다 (2분).\n\n해결 방법:\n1. 더 짧고 간단한 요청 사용\n2. 작은 문서로 테스트\n3. 인터넷 연결 확인\n\n예: "첫 문단만 쉽게 바꿔줘" 같은 간단한 요청을 시도해보세요.',
            
            documentTooLarge: '📄 문서가 너무 크거나 복잡합니다.\n\n해결 방법:\n1. 더 작은 문서 사용 (권장: 10페이지 이하)\n2. 문서를 여러 부분으로 분할\n3. 간단한 구조의 문서로 테스트'
        }
    },
    
    /**
     * 구조 추출 설정
     */
    extraction: {
        /**
         * 슬롯 ID 접두사
         */
        slotIdPrefix: 'slot-',
        
        /**
         * 요소 ID 접두사
         */
        elementIdPrefix: 'elem-',
        
        /**
         * 최소 텍스트 길이 (이보다 짧은 텍스트는 무시)
         */
        minTextLength: 1,
        
        /**
         * 최대 텍스트 길이 (이보다 긴 텍스트는 잘림)
         */
        maxTextLength: 10000,
        
        /**
         * 캐시 사용 여부
         */
        useCache: true,
        
        /**
         * 캐시 만료 시간 (밀리초)
         */
        cacheExpiration: 300000 // 5분
    },
    
    /**
     * 병합 설정
     */
    merging: {
        /**
         * 구조 검증 활성화
         */
        validateStructure: true,
        
        /**
         * 텍스트 길이 검증 (원본 대비 최대 배율)
         */
        maxTextLengthRatio: 3.0,
        
        /**
         * 변경 이력 저장
         */
        saveHistory: true,
        
        /**
         * 최대 이력 개수
         */
        maxHistorySize: 10
    },
    
    /**
     * UI 설정
     */
    ui: {
        /**
         * 채팅 패널 기본 상태 (열림/닫힘)
         */
        chatPanelDefaultOpen: false,
        
        /**
         * 자동 스크롤
         */
        autoScroll: true,
        
        /**
         * 메시지 애니메이션
         */
        messageAnimation: true,
        
        /**
         * 로딩 인디케이터 표시
         */
        showLoadingIndicator: true,
        
        /**
         * 에러 자동 숨김 시간 (밀리초)
         */
        errorAutoHideMs: 5000,
        
        /**
         * 성공 메시지 자동 숨김 시간 (밀리초)
         */
        successAutoHideMs: 3000
    },
    
    /**
     * 디버그 설정
     * 환경변수로 오버라이드 가능
     */
    debug: {
        /**
         * 디버그 모드 활성화
         */
        get enabled() {
            return import.meta.env.VITE_DEBUG_MODE === 'true' || false;
        },

        /**
         * API 요청 로깅
         */
        get logRequests() {
            return import.meta.env.VITE_LOG_API_REQUESTS === 'true' || false;
        },

        /**
         * API 응답 로깅
         */
        get logResponses() {
            return import.meta.env.VITE_LOG_API_RESPONSES === 'true' || false;
        },

        /**
         * 구조 추출 결과 로깅
         */
        logExtraction: false,

        /**
         * 병합 과정 로깅
         */
        logMerging: false,

        /**
         * 성능 측정
         */
        get measurePerformance() {
            return import.meta.env.VITE_ENABLE_PERFORMANCE_MEASUREMENT !== 'false';
        }
    },
    
    /**
     * 비용 관리
     * 환경변수로 오버라이드 가능
     */
    costManagement: {
        /**
         * 비용 추적 활성화
         */
        get enabled() {
            return import.meta.env.VITE_ENABLE_COST_TRACKING !== 'false';
        },

        /**
         * 토큰당 비용 (USD)
         * GPT-4 Turbo: $0.01 / 1K tokens (input), $0.03 / 1K tokens (output)
         */
        get costPerInputToken() {
            return Number(import.meta.env.VITE_COST_PER_INPUT_TOKEN) || 0.00001;
        },
        get costPerOutputToken() {
            return Number(import.meta.env.VITE_COST_PER_OUTPUT_TOKEN) || 0.00003;
        },

        /**
         * 경고 임계값 (USD)
         */
        get warningThreshold() {
            return Number(import.meta.env.VITE_COST_WARNING_THRESHOLD) || 1.0;
        },

        /**
         * 최대 허용 비용 (USD)
         */
        get maxCost() {
            return Number(import.meta.env.VITE_COST_MAX_LIMIT) || 10.0;
        }
    }
};

/**
 * 설정 검증
 * @returns {Object} 검증 결과
 */
export function validateConfig() {
    const errors = [];
    const warnings = [];
    
    // 🆕 커스텀 API 검증 (활성화 시)
    if (AIConfig.custom.isEnabled()) {
        const customValidation = AIConfig.custom.validate();
        if (!customValidation.valid) {
            errors.push(`커스텀 API: ${customValidation.error}`);
        } else {
            warnings.push('커스텀 API가 활성화되어 있습니다.');
        }
    } else {
        // OpenAI API 검증
        if (!AIConfig.openai.getApiKey()) {
            warnings.push('OpenAI API 키가 설정되지 않았습니다.');
        }
        
        // 모델 확인
        const validModels = [
            'gpt-4-turbo-preview',
            'gpt-4',
            'gpt-4-32k',
            'gpt-3.5-turbo'
        ];
        if (!validModels.includes(AIConfig.openai.model)) {
            warnings.push(`지원되지 않는 모델: ${AIConfig.openai.model}`);
        }
    }
    
    // Temperature 범위 확인
    if (AIConfig.openai.temperature < 0 || AIConfig.openai.temperature > 2) {
        errors.push('Temperature는 0.0 ~ 2.0 사이여야 합니다.');
    }
    
    // 타임아웃 확인
    if (AIConfig.openai.timeout < 1000) {
        warnings.push('타임아웃이 너무 짧습니다 (최소 1초 권장).');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * 환경별 설정 오버라이드
 * @param {string} environment - 'development' | 'production' | 'test'
 */
export function overrideForEnvironment(environment) {
    switch (environment) {
    case 'development':
        AIConfig.debug.enabled = true;
        AIConfig.debug.logRequests = true;
        AIConfig.debug.logResponses = true;
        AIConfig.openai.timeout = 60000; // 개발 시 타임아웃 증가
        break;
        
    case 'production':
        AIConfig.debug.enabled = false;
        AIConfig.debug.logRequests = false;
        AIConfig.debug.logResponses = false;
        AIConfig.costManagement.enabled = true;
        break;
        
    case 'test':
        AIConfig.openai.endpoint = 'http://localhost:3000/mock-api'; // Mock API
        AIConfig.openai.timeout = 5000;
        AIConfig.extraction.useCache = false;
        break;
    }
}

/**
 * 설정 내보내기 (JSON)
 * @returns {string} JSON 문자열
 */
export function exportConfig() {
    return JSON.stringify(AIConfig, null, 2);
}

/**
 * 설정 가져오기 (JSON)
 * @param {string} jsonString - JSON 문자열
 */
export function importConfig(jsonString) {
    try {
        const imported = JSON.parse(jsonString);
        Object.assign(AIConfig, imported);
    } catch (error) {
        throw new Error(`설정 가져오기 실패: ${error.message}`);
    }
}

// Default export
export default AIConfig;

