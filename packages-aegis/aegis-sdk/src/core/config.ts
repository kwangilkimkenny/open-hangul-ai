// ============================================================
// AEGIS Configuration — ported from libs/aegis-core/src/config.rs
// ============================================================

export interface AegisConfig {
  /** Remote AEGIS server URL (for online mode) */
  serverUrl?: string;
  /** API key for remote server */
  apiKey?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Fail policy: 'close' blocks on error, 'open' allows on error */
  failPolicy?: 'close' | 'open';
  /** Enable offline local defense engine */
  offline?: boolean;

  /** Defense layer toggles */
  layers?: LayerConfig;
  /** PII detection config */
  pii?: PiiConfig;
  /** Korean/CJK defense config */
  korean?: KoreanConfig;
  /** Output filtering config */
  output?: OutputConfig;
  /** Provider-specific calibration */
  provider?: string;
  /** Sensitivity multiplier (0.5-2.0) */
  sensitivity?: number;
  /** Block threshold (0-100) */
  blockThreshold?: number;
}

export interface LayerConfig {
  trustBoundary?: boolean;
  intentVerification?: boolean;
  raGuard?: boolean;
  classRag?: boolean;
  circuitBreaker?: boolean;
  behavioralAnalysis?: boolean;
}

export interface PiiConfig {
  enabled?: boolean;
  koreanRrn?: boolean;
  creditCard?: boolean;
  email?: boolean;
  phoneKr?: boolean;
  phoneIntl?: boolean;
  ssn?: boolean;
  passport?: boolean;
  ipAddress?: boolean;
  proxyEnabled?: boolean;
  proxyMode?: 'auto' | 'confirm';
}

export interface KoreanConfig {
  enabled?: boolean;
  chosungDecoder?: boolean;
  jamoNormalizer?: boolean;
  codeSwitching?: boolean;
  homoglyph?: boolean;
  josai?: boolean;
  tokenizerVuln?: boolean;
  keyboardMapping?: boolean;
  archaicHangul?: boolean;
  hanja?: boolean;
  slang?: boolean;
  syllableReversal?: boolean;
  phoneticVariation?: boolean;
}

export interface OutputConfig {
  detectCredentials?: boolean;
  detectPii?: boolean;
  detectHarmfulContent?: boolean;
  detectCodeInjection?: boolean;
  blockOnHarmful?: boolean;
  minConfidence?: number;
}

export const DEFAULT_CONFIG: AegisConfig = {
  timeout: 3000,
  failPolicy: 'close',
  offline: true,
  sensitivity: 1.0,
  blockThreshold: 60,
  layers: {
    trustBoundary: true,
    intentVerification: true,
    raGuard: true,
    classRag: true,
    circuitBreaker: true,
    behavioralAnalysis: true,
  },
  pii: {
    enabled: true,
    koreanRrn: true,
    creditCard: true,
    email: true,
    phoneKr: true,
    phoneIntl: true,
    ssn: true,
    passport: true,
    ipAddress: true,
    proxyEnabled: false,
    proxyMode: 'auto',
  },
  korean: {
    enabled: true,
    chosungDecoder: true,
    jamoNormalizer: true,
    codeSwitching: true,
    homoglyph: true,
    josai: true,
    tokenizerVuln: true,
    keyboardMapping: true,
    archaicHangul: true,
    hanja: true,
    slang: true,
    syllableReversal: true,
    phoneticVariation: true,
  },
  output: {
    detectCredentials: true,
    detectPii: true,
    detectHarmfulContent: true,
    detectCodeInjection: true,
    blockOnHarmful: false,
    minConfidence: 0.7,
  },
};

export function mergeConfig(base: AegisConfig, override: Partial<AegisConfig>): AegisConfig {
  return {
    ...base,
    ...override,
    layers: { ...base.layers, ...override.layers },
    pii: { ...base.pii, ...override.pii },
    korean: { ...base.korean, ...override.korean },
    output: { ...base.output, ...override.output },
  };
}
