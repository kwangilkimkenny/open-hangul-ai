/**
 * Environment Variables Type Definitions
 * Vite import.meta.env 타입 정의
 *
 * @module env
 * @version 1.0.0
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  // -----------------------------------------------------------------------------
  // OpenAI API Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_API_ENDPOINT: string;
  readonly VITE_OPENAI_MODEL: string;
  readonly VITE_OPENAI_TEMPERATURE: string;
  readonly VITE_OPENAI_MAX_TOKENS: string;
  readonly VITE_OPENAI_TIMEOUT: string;

  // -----------------------------------------------------------------------------
  // Custom API Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_CUSTOM_API_ENABLED: string;
  readonly VITE_CUSTOM_API_ENDPOINT?: string;
  readonly VITE_CUSTOM_API_KEY?: string;

  // -----------------------------------------------------------------------------
  // Application Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_PORT?: string;
  readonly VITE_BASE_URL: string;

  // -----------------------------------------------------------------------------
  // File Upload Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_MAX_FILE_SIZE_MB: string;
  readonly VITE_ALLOWED_FILE_EXTENSIONS: string;

  // -----------------------------------------------------------------------------
  // Logging Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  readonly VITE_ENABLE_CONSOLE_LOG: string;
  readonly VITE_ENABLE_PERFORMANCE_MEASUREMENT: string;

  // -----------------------------------------------------------------------------
  // Feature Flags
  // -----------------------------------------------------------------------------
  readonly VITE_ENABLE_AI_FEATURES: string;
  readonly VITE_ENABLE_TABLE_EDIT: string;
  readonly VITE_ENABLE_IMAGE_EDIT: string;
  readonly VITE_ENABLE_SHAPE_EDIT: string;
  readonly VITE_ENABLE_PDF_EXPORT: string;
  readonly VITE_ENABLE_HWPX_EXPORT: string;
  readonly VITE_ENABLE_AUTO_SAVE: string;
  readonly VITE_AUTO_SAVE_INTERVAL: string;

  // -----------------------------------------------------------------------------
  // UI Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_CHAT_PANEL_DEFAULT_STATE: 'open' | 'closed';
  readonly VITE_ENABLE_DARK_MODE: string;
  readonly VITE_DEFAULT_LANGUAGE: 'ko' | 'en';

  // -----------------------------------------------------------------------------
  // Performance Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_CHUNK_SIZE_WARNING_LIMIT: string;
  readonly VITE_IMAGE_OPTIMIZATION_QUALITY: string;
  readonly VITE_CACHE_EXPIRATION: string;

  // -----------------------------------------------------------------------------
  // Security Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_ENABLE_CSP: string;
  readonly VITE_FORCE_HTTPS: string;
  readonly VITE_ENABLE_API_KEY_ENCRYPTION: string;

  // -----------------------------------------------------------------------------
  // Cost Management
  // -----------------------------------------------------------------------------
  readonly VITE_ENABLE_COST_TRACKING: string;
  readonly VITE_COST_WARNING_THRESHOLD: string;
  readonly VITE_COST_MAX_LIMIT: string;
  readonly VITE_COST_PER_INPUT_TOKEN: string;
  readonly VITE_COST_PER_OUTPUT_TOKEN: string;

  // -----------------------------------------------------------------------------
  // Debug & Development
  // -----------------------------------------------------------------------------
  readonly VITE_DEBUG_MODE: string;
  readonly VITE_LOG_API_REQUESTS: string;
  readonly VITE_LOG_API_RESPONSES: string;
  readonly VITE_ENABLE_SOURCEMAP: string;
  readonly VITE_ENABLE_REACT_DEVTOOLS: string;

  // -----------------------------------------------------------------------------
  // Analytics & Monitoring
  // -----------------------------------------------------------------------------
  readonly VITE_GA_TRACKING_ID?: string;
  readonly VITE_SENTRY_DSN?: string;

  // -----------------------------------------------------------------------------
  // External Services
  // -----------------------------------------------------------------------------
  readonly VITE_CDN_URL?: string;
  readonly VITE_WS_URL?: string;

  // -----------------------------------------------------------------------------
  // Build Configuration
  // -----------------------------------------------------------------------------
  readonly VITE_BUILD_TARGET: string;
  readonly VITE_LEGACY_SUPPORT: string;

  // Vite built-in variables
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Environment Helper Functions
 */
declare module '@/utils/env' {
  /**
   * Get environment variable as string
   */
  export function getEnvString(key: keyof ImportMetaEnv, defaultValue?: string): string;

  /**
   * Get environment variable as number
   */
  export function getEnvNumber(key: keyof ImportMetaEnv, defaultValue?: number): number;

  /**
   * Get environment variable as boolean
   */
  export function getEnvBoolean(key: keyof ImportMetaEnv, defaultValue?: boolean): boolean;

  /**
   * Check if feature is enabled
   */
  export function isFeatureEnabled(feature: string): boolean;

  /**
   * Check if running in development mode
   */
  export function isDevelopment(): boolean;

  /**
   * Check if running in production mode
   */
  export function isProduction(): boolean;
}
