// ============================================================
// AEGIS Core Types — ported from libs/aegis-core/src/models/
// ============================================================

// --- Decision & Severity ---

export type Decision = 'APPROVE' | 'MODIFY' | 'BLOCK' | 'ESCALATE' | 'REASK' | 'THROTTLE';

export const DecisionPriority: Record<Decision, number> = {
  APPROVE: 0, MODIFY: 1, REASK: 2, THROTTLE: 3, ESCALATE: 4, BLOCK: 5,
};

export function allowsContent(d: Decision): boolean {
  return d === 'APPROVE' || d === 'MODIFY';
}

export function requiresIntervention(d: Decision): boolean {
  return d !== 'APPROVE';
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const SeverityLevel: Record<Severity, number> = {
  low: 1, medium: 2, high: 3, critical: 4,
};

// --- Risk ---

export interface RiskCategory {
  name: string;
  confidence: number;
  subcategories?: string[];
}

export interface Risk {
  label: string;
  severity: Severity;
  description: string;
  score: number;
  categories: RiskCategory[];
}

export const RiskLabels = {
  JAILBREAK: 'jailbreak',
  PROMPT_INJECTION: 'prompt_injection',
  DATA_LEAK: 'data_leak',
  HARMFUL_CONTENT: 'harmful_content',
  POLICY_VIOLATION: 'policy_violation',
  BIAS: 'bias',
  HALLUCINATION: 'hallucination',
  OFF_TOPIC: 'off_topic',
  PII_EXPOSURE: 'pii_exposure',
  TOXIC: 'toxic',
} as const;

// --- User & Tenant ---

export type UserRole = 'super_admin' | 'admin' | 'user' | 'viewer';
export type TenantTier = 'free' | 'trial' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'trial_expired' | 'deleted';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  tier: TenantTier;
  status: TenantStatus;
  dailyApiLimit: number;
  monthlyApiLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  prefix: string;
  keyHash: string;
  name: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
}

// --- Judgment Request/Response ---

export type ModelOutputType = 'text' | 'image' | 'audio' | 'video' | 'multimodal';

export interface ModelOutput {
  type: ModelOutputType;
  content: string | ModelOutput[];
}

export interface RetrievalDocument {
  content: string;
  source: string;
  score: number;
}

export interface UserInfo {
  userId: string;
  role: string;
  tier: string;
}

export interface JudgmentContext {
  retrievalDocs?: RetrievalDocument[];
  userInfo?: UserInfo;
  sessionId?: string;
  metadata?: Record<string, string>;
}

export interface JudgmentRequest {
  requestId: string;
  scenario?: string;
  intent?: string;
  modelOutput: ModelOutput;
  context?: JudgmentContext;
}

export interface JudgmentAction {
  rewrite?: string;
  confidenceScore?: number;
  message?: string;
  suggestions?: string[];
}

export interface Evidence {
  evidenceType: string;
  description: string;
  source: string;
  confidence: number;
  matchedContent?: string;
}

export interface JudgmentResponse {
  requestId: string;
  decision: Decision;
  risk?: Risk;
  confidence: number;
  action?: JudgmentAction;
  evidence?: Evidence[];
  explanation?: string;
  timestamp: string;
  latencyMs: number;
}

// --- Defense Layer ---

export interface DefenseResult {
  layer: string;
  passed: boolean;
  decision?: Decision;
  risk?: Risk;
  confidence: number;
  details?: Record<string, unknown>;
}

export interface LayerResult {
  name: string;
  passed: boolean;
  decision?: Decision;
  risk?: Risk;
  confidence: number;
  latencyMs: number;
}

export interface PaladinResult {
  passed: boolean;
  decision: Decision;
  risk?: Risk;
  confidence: number;
  layers: LayerResult[];
  providerProfile?: string;
}

// --- Pattern Match ---

export interface PatternMatch {
  patternId: string;
  category: string;
  severity: number;
  matchedText: string;
  description?: string;
  startPos?: number;
  endPos?: number;
}

// --- Verdict Explanation (v5.0) ---

export interface LayerExplanation {
  layerName: string;
  layerIndex: number;
  triggered: boolean;
  confidence: number;
  reason?: string;
  signals?: string[];
  latencyUs?: number;
}

export interface CompoundRuleMatch {
  ruleId: string;
  ruleName: string;
  combinedSignals: string[];
  confidence: number;
  explanation: string;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  value: number;
  description: string;
}

export interface ConfidenceBreakdown {
  ruleBased: number;
  mlClassifier: number;
  behavioral: number;
  contextual: number;
  providerAdjustment: number;
  finalConfidence: number;
}

export interface TokenAttribution {
  token: string;
  startPos: number;
  endPos: number;
  attribution: number;
  flagged: boolean;
}

export type DecisionTier = 'tier1_rules' | 'tier2_ml' | 'tier3_llm_judge' | 'paladin_legacy';

export interface KoreanExplanation {
  chosungDetected: boolean;
  jamoSeparationDetected: boolean;
  codeswitchingDetected: boolean;
  homoglyphDetected: boolean;
  josaiDetected: boolean;
  tokenizerVulnDetected: boolean;
  normalizedText?: string;
  details?: string[];
}

export interface TimingBreakdown {
  tier1Us: number;
  tier2Us: number;
  tier3Us: number;
  koreanUs: number;
  outputGuardUs: number;
  totalUs: number;
}

export interface VerdictExplanation {
  triggeredLayers: LayerExplanation[];
  matchedPatterns: PatternMatch[];
  compoundRules: CompoundRuleMatch[];
  riskFactors: RiskFactor[];
  confidenceBreakdown: ConfidenceBreakdown;
  tokenAttributions: TokenAttribution[];
  recommendation?: string;
  decisionTier: DecisionTier;
  koreanAnalysis?: KoreanExplanation;
  timing?: TimingBreakdown;
}

// --- Threat Taxonomy (v5.0) ---

export type ThreatCategory =
  | 'prompt_injection' | 'jailbreak' | 'data_leakage' | 'harmful_content'
  | 'model_manipulation' | 'agent_abuse' | 'privacy_violation' | 'supply_chain';

export type ThreatSubCategory =
  | 'direct_prompt_injection' | 'indirect_prompt_injection' | 'system_prompt_extraction' | 'instruction_override'
  | 'roleplay_jailbreak' | 'encoding_bypass' | 'multi_turn_escalation' | 'genetic_jailbreak' | 'token_smuggling' | 'ascii_art_bypass'
  | 'training_data_extraction' | 'pii_exfiltration' | 'credential_leakage' | 'model_weight_extraction'
  | 'violent_content' | 'hate_speech' | 'illegal_instructions' | 'csam' | 'misinformation' | 'self_harm'
  | 'bias_discrimination' | 'drug_substance_abuse' | 'copyright_infringement' | 'sexual_explicit_content'
  | 'adversarial_input' | 'model_poisoning' | 'backdoor_attack' | 'model_inversion' | 'membership_inference'
  | 'tool_misuse' | 'unauthorized_actions' | 'privilege_escalation' | 'reasoning_hijack' | 'memory_poisoning'
  | 'consent_violation' | 'data_retention' | 'cross_border_transfer' | 'profiling_without_consent'
  | 'malicious_plugin' | 'compromised_model' | 'data_poisoning' | 'dependency_attack' | 'typosquatting';

export interface ThreatClassification {
  category: ThreatCategory;
  subcategory: ThreatSubCategory;
  description: string;
  owaspMapping?: string;
  nistMapping?: string;
  severityLevel: number;
}

// --- PII Types ---

export type PiiType = 'korean_rrn' | 'credit_card' | 'email' | 'phone_kr' | 'phone_intl' | 'ssn' | 'passport' | 'ip_address';

export interface PiiMatch {
  type: PiiType;
  value: string;
  maskedValue: string;
  startPos: number;
  endPos: number;
}

export interface PiiMapping {
  original: string;
  pseudonym: string;
  piiType: PiiType;
  position: number;
}

export interface ProxyResult {
  originalText: string;
  proxiedText: string;
  mappings: PiiMapping[];
  piiCount: number;
}

// --- Risk Level (for scan results) ---

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ScanResult {
  id: string;
  timestamp: number;
  input: string;
  score: number;
  level: RiskLevel;
  categories: string[];
  explanation: string;
  blocked: boolean;
  layers: ScanLayerResult[];
  totalLatencyMs: number;
  piiDetected: PiiMatch[];
  decision: Decision;
}

export interface ScanLayerResult {
  id: number;
  name: string;
  score: number;
  maxScore: number;
  detected: boolean;
  categories: string[];
  latencyMs: number;
}

// --- Classifier ---

export interface ClassificationResult {
  class: string;
  confidence: number;
  probabilities: Array<[string, number]>;
}

// --- Health Check ---

export interface HealthStatus {
  name: string;
  healthy: boolean;
  message?: string;
  latencyMs?: number;
}

// --- Provider ---

export type ProviderType =
  | 'openai' | 'anthropic' | 'google' | 'deepseek' | 'xai'
  | 'qwen' | 'vllm' | 'ollama' | 'custom';

export interface ProviderDefenseProfile {
  provider: ProviderType;
  intentThresholdModifier: number;
  confidenceFloor: number;
  hasStrongSelfDefense: boolean;
  partialResponseProne: boolean;
  enableOutputGuard: boolean;
  enableExtendedPatterns: boolean;
  description: string;
}

// --- Severity Scoring (CVSS-like for AI) ---

export type AttackComplexity = 'low' | 'high';
export type PrivilegesRequired = 'none' | 'low' | 'high';
export type UserInteraction = 'none' | 'required';
export type ImpactLevel = 'none' | 'low' | 'high';
export type SeverityRating = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface AiVulnScore {
  baseScore: number;
  exploitabilityScore: number;
  impactScore: number;
  severityRating: SeverityRating;
  scopeChanged: boolean;
}
