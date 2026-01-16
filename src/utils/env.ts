/**
 * Environment Variable Helper Utilities
 * 환경 변수를 타입 안전하게 접근하는 유틸리티
 *
 * @module utils/env
 * @version 1.0.0
 */

/**
 * 환경 변수를 문자열로 가져오기
 * @param key - 환경 변수 키
 * @param defaultValue - 기본값
 * @returns 환경 변수 값 또는 기본값
 */
export function getEnvString(
  key: keyof ImportMetaEnv,
  defaultValue: string = ''
): string {
  const value = import.meta.env[key];
  return value !== undefined ? String(value) : defaultValue;
}

/**
 * 환경 변수를 숫자로 가져오기
 * @param key - 환경 변수 키
 * @param defaultValue - 기본값
 * @returns 환경 변수 값 또는 기본값
 */
export function getEnvNumber(
  key: keyof ImportMetaEnv,
  defaultValue: number = 0
): number {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;

  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 환경 변수를 boolean으로 가져오기
 * @param key - 환경 변수 키
 * @param defaultValue - 기본값
 * @returns 환경 변수 값 또는 기본값
 */
export function getEnvBoolean(
  key: keyof ImportMetaEnv,
  defaultValue: boolean = false
): boolean {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;

  const str = String(value).toLowerCase();
  return str === 'true' || str === '1' || str === 'yes';
}

/**
 * 기능 활성화 여부 확인
 * @param feature - 기능 이름 (VITE_ENABLE_ 접두사 없이)
 * @returns 기능 활성화 여부
 *
 * @example
 * isFeatureEnabled('AI_FEATURES') // VITE_ENABLE_AI_FEATURES 확인
 */
export function isFeatureEnabled(feature: string): boolean {
  const key = `VITE_ENABLE_${feature}` as keyof ImportMetaEnv;
  return getEnvBoolean(key, true);
}

/**
 * 개발 모드 확인
 * @returns 개발 모드 여부
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * 프로덕션 모드 확인
 * @returns 프로덕션 모드 여부
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * 환경 변수 검증
 * @returns 검증 결과
 */
export function validateEnv(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // OpenAI API 키 확인 (개발 환경에서만 경고)
  if (isDevelopment() && !import.meta.env.VITE_OPENAI_API_KEY) {
    warnings.push(
      'VITE_OPENAI_API_KEY가 설정되지 않았습니다. ' +
      'AI 기능을 사용하려면 .env.local에서 설정하거나 UI에서 입력하세요.'
    );
  }

  // Temperature 범위 확인
  const temperature = getEnvNumber('VITE_OPENAI_TEMPERATURE', 0.7);
  if (temperature < 0 || temperature > 2) {
    errors.push('VITE_OPENAI_TEMPERATURE는 0.0 ~ 2.0 사이여야 합니다.');
  }

  // Max tokens 확인
  const maxTokens = getEnvNumber('VITE_OPENAI_MAX_TOKENS', 4000);
  if (maxTokens < 1 || maxTokens > 128000) {
    errors.push('VITE_OPENAI_MAX_TOKENS는 1 ~ 128000 사이여야 합니다.');
  }

  // Timeout 확인
  const timeout = getEnvNumber('VITE_OPENAI_TIMEOUT', 120000);
  if (timeout < 1000) {
    warnings.push('VITE_OPENAI_TIMEOUT이 너무 짧습니다 (최소 1초 권장).');
  }

  // File size 확인
  const maxFileSize = getEnvNumber('VITE_MAX_FILE_SIZE_MB', 50);
  if (maxFileSize < 1) {
    errors.push('VITE_MAX_FILE_SIZE_MB는 1 이상이어야 합니다.');
  }

  // Auto save interval 확인
  const autoSaveInterval = getEnvNumber('VITE_AUTO_SAVE_INTERVAL', 30000);
  if (autoSaveInterval < 5000) {
    warnings.push(
      'VITE_AUTO_SAVE_INTERVAL이 너무 짧습니다 (최소 5초 권장).'
    );
  }

  // CSP 확인 (프로덕션)
  if (isProduction() && !getEnvBoolean('VITE_ENABLE_CSP', true)) {
    warnings.push(
      '프로덕션 환경에서 CSP를 비활성화하면 보안 위험이 있습니다.'
    );
  }

  // HTTPS 확인 (프로덕션)
  if (isProduction() && !getEnvBoolean('VITE_FORCE_HTTPS', true)) {
    warnings.push(
      '프로덕션 환경에서 HTTPS를 강제하지 않으면 보안 위험이 있습니다.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 환경 정보 출력 (개발 모드에서만)
 */
export function printEnvInfo(): void {
  if (!isDevelopment()) return;

  console.group('🔧 Environment Configuration');
  console.log('Mode:', import.meta.env.MODE);
  console.log('Base URL:', import.meta.env.BASE_URL);
  console.log('App Name:', getEnvString('VITE_APP_NAME', 'HAN-View React App'));
  console.log('Log Level:', getEnvString('VITE_LOG_LEVEL', 'info'));
  console.log('Debug Mode:', getEnvBoolean('VITE_DEBUG_MODE', false));
  console.log('AI Features:', isFeatureEnabled('AI_FEATURES'));
  console.log('Console Log:', getEnvBoolean('VITE_ENABLE_CONSOLE_LOG', true));
  console.groupEnd();

  // 검증 결과 출력
  const validation = validateEnv();

  if (validation.errors.length > 0) {
    console.group('❌ Environment Errors');
    validation.errors.forEach(error => console.error(error));
    console.groupEnd();
  }

  if (validation.warnings.length > 0) {
    console.group('⚠️ Environment Warnings');
    validation.warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }
}

/**
 * 환경 설정 객체 생성
 * @returns 환경 설정 객체
 */
export function createEnvConfig() {
  return {
    // OpenAI
    openai: {
      apiKey: getEnvString('VITE_OPENAI_API_KEY'),
      endpoint: getEnvString(
        'VITE_OPENAI_API_ENDPOINT',
        'https://api.openai.com/v1/chat/completions'
      ),
      model: getEnvString('VITE_OPENAI_MODEL', 'gpt-4-turbo-preview'),
      temperature: getEnvNumber('VITE_OPENAI_TEMPERATURE', 0.7),
      maxTokens: getEnvNumber('VITE_OPENAI_MAX_TOKENS', 4000),
      timeout: getEnvNumber('VITE_OPENAI_TIMEOUT', 120000),
    },

    // Custom API
    customApi: {
      enabled: getEnvBoolean('VITE_CUSTOM_API_ENABLED', false),
      endpoint: getEnvString('VITE_CUSTOM_API_ENDPOINT'),
      apiKey: getEnvString('VITE_CUSTOM_API_KEY'),
    },

    // App
    app: {
      name: getEnvString('VITE_APP_NAME', 'HAN-View React App'),
      version: getEnvString('VITE_APP_VERSION', '3.0.0'),
      baseUrl: getEnvString('VITE_BASE_URL', '/'),
    },

    // File Upload
    fileUpload: {
      maxSizeMB: getEnvNumber('VITE_MAX_FILE_SIZE_MB', 50),
      allowedExtensions: getEnvString('VITE_ALLOWED_FILE_EXTENSIONS', '.hwpx')
        .split(',')
        .map(ext => ext.trim()),
    },

    // Logging
    logging: {
      level: getEnvString('VITE_LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
      consoleEnabled: getEnvBoolean('VITE_ENABLE_CONSOLE_LOG', isDevelopment()),
      performanceMeasurement: getEnvBoolean(
        'VITE_ENABLE_PERFORMANCE_MEASUREMENT',
        true
      ),
    },

    // Features
    features: {
      ai: isFeatureEnabled('AI_FEATURES'),
      tableEdit: isFeatureEnabled('TABLE_EDIT'),
      imageEdit: isFeatureEnabled('IMAGE_EDIT'),
      shapeEdit: isFeatureEnabled('SHAPE_EDIT'),
      pdfExport: isFeatureEnabled('PDF_EXPORT'),
      hwpxExport: isFeatureEnabled('HWPX_EXPORT'),
      autoSave: isFeatureEnabled('AUTO_SAVE'),
      autoSaveInterval: getEnvNumber('VITE_AUTO_SAVE_INTERVAL', 30000),
    },

    // UI
    ui: {
      chatPanelDefaultOpen:
        getEnvString('VITE_CHAT_PANEL_DEFAULT_STATE', 'closed') === 'open',
      darkMode: getEnvBoolean('VITE_ENABLE_DARK_MODE', false),
      language: getEnvString('VITE_DEFAULT_LANGUAGE', 'ko') as 'ko' | 'en',
    },

    // Performance
    performance: {
      chunkSizeWarningLimit: getEnvNumber('VITE_CHUNK_SIZE_WARNING_LIMIT', 500),
      imageQuality: getEnvNumber('VITE_IMAGE_OPTIMIZATION_QUALITY', 80),
      cacheExpiration: getEnvNumber('VITE_CACHE_EXPIRATION', 300000),
    },

    // Security
    security: {
      cspEnabled: getEnvBoolean('VITE_ENABLE_CSP', isProduction()),
      forceHttps: getEnvBoolean('VITE_FORCE_HTTPS', isProduction()),
      apiKeyEncryption: getEnvBoolean('VITE_ENABLE_API_KEY_ENCRYPTION', true),
    },

    // Cost Management
    costManagement: {
      enabled: getEnvBoolean('VITE_ENABLE_COST_TRACKING', true),
      warningThreshold: getEnvNumber('VITE_COST_WARNING_THRESHOLD', 1.0),
      maxLimit: getEnvNumber('VITE_COST_MAX_LIMIT', 10.0),
      costPerInputToken: getEnvNumber('VITE_COST_PER_INPUT_TOKEN', 0.00001),
      costPerOutputToken: getEnvNumber('VITE_COST_PER_OUTPUT_TOKEN', 0.00003),
    },

    // Debug
    debug: {
      enabled: getEnvBoolean('VITE_DEBUG_MODE', false),
      logRequests: getEnvBoolean('VITE_LOG_API_REQUESTS', false),
      logResponses: getEnvBoolean('VITE_LOG_API_RESPONSES', false),
      sourcemap: getEnvBoolean('VITE_ENABLE_SOURCEMAP', isDevelopment()),
      reactDevTools: getEnvBoolean('VITE_ENABLE_REACT_DEVTOOLS', isDevelopment()),
    },

    // External Services
    external: {
      gaTrackingId: getEnvString('VITE_GA_TRACKING_ID'),
      sentryDsn: getEnvString('VITE_SENTRY_DSN'),
      cdnUrl: getEnvString('VITE_CDN_URL'),
      wsUrl: getEnvString('VITE_WS_URL'),
    },
  };
}

// Export type
export type EnvConfig = ReturnType<typeof createEnvConfig>;
