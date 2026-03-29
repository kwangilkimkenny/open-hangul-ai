// ============================================================
// AEGIS Provider Defense Profiles
// ============================================================

import type { ProviderType, ProviderDefenseProfile } from '../core/types';

/**
 * Pre-configured defense profiles per LLM provider.
 * Based on AEGIS red-team benchmarks measuring self-defense rates,
 * partial response tendencies, and bypass susceptibility.
 */
export const PROVIDER_PROFILES: Record<string, ProviderDefenseProfile> = {
  deepseek: {
    provider: 'deepseek',
    intentThresholdModifier: -0.15,
    confidenceFloor: 0.4,
    hasStrongSelfDefense: false,
    partialResponseProne: true,
    enableOutputGuard: true,
    enableExtendedPatterns: true,
    description: '4% self-block, 60% PARTIAL',
  },
  google: {
    provider: 'google',
    intentThresholdModifier: -0.15,
    confidenceFloor: 0.40,
    hasStrongSelfDefense: true,
    partialResponseProne: false,
    enableOutputGuard: true,
    enableExtendedPatterns: false,
    description: '56% self-block, 84% with AEGIS',
  },
  openai: {
    provider: 'openai',
    intentThresholdModifier: -0.05,
    confidenceFloor: 0.5,
    hasStrongSelfDefense: true,
    partialResponseProne: false,
    enableOutputGuard: true,
    enableExtendedPatterns: false,
    description: 'Strong self-defense, TAP/AutoDAN bypass observed',
  },
  anthropic: {
    provider: 'anthropic',
    intentThresholdModifier: 0.0,
    confidenceFloor: 0.5,
    hasStrongSelfDefense: true,
    partialResponseProne: true,
    enableOutputGuard: true,
    enableExtendedPatterns: false,
    description: '72% self-block, 100% with AEGIS, 24% PARTIAL',
  },
  xai: {
    provider: 'xai',
    intentThresholdModifier: -0.10,
    confidenceFloor: 0.45,
    hasStrongSelfDefense: false,
    partialResponseProne: false,
    enableOutputGuard: true,
    enableExtendedPatterns: true,
    description: 'DAN persona compliance',
  },
  qwen: {
    provider: 'qwen',
    intentThresholdModifier: -0.12,
    confidenceFloor: 0.42,
    hasStrongSelfDefense: false,
    partialResponseProne: true,
    enableOutputGuard: true,
    enableExtendedPatterns: true,
    description: '36% self-block, 48% PARTIAL',
  },
  vllm: {
    provider: 'vllm',
    intentThresholdModifier: -0.15,
    confidenceFloor: 0.35,
    hasStrongSelfDefense: false,
    partialResponseProne: false,
    enableOutputGuard: true,
    enableExtendedPatterns: true,
    description: 'Self-hosted, unknown capabilities',
  },
  ollama: {
    provider: 'ollama',
    intentThresholdModifier: -0.15,
    confidenceFloor: 0.35,
    hasStrongSelfDefense: false,
    partialResponseProne: false,
    enableOutputGuard: true,
    enableExtendedPatterns: true,
    description: 'Self-hosted, treated as weak',
  },
  custom: {
    provider: 'custom',
    intentThresholdModifier: 0.0,
    confidenceFloor: 0.5,
    hasStrongSelfDefense: false,
    partialResponseProne: false,
    enableOutputGuard: true,
    enableExtendedPatterns: true,
    description: 'Custom/unknown provider',
  },
};

/**
 * Model name prefix to provider mapping for auto-detection.
 */
const MODEL_PREFIX_MAP: Array<[string, string]> = [
  ['gpt-', 'openai'],
  ['o1-', 'openai'],
  ['o3-', 'openai'],
  ['o4-', 'openai'],
  ['claude-', 'anthropic'],
  ['gemini-', 'google'],
  ['gemma-', 'google'],
  ['deepseek-', 'deepseek'],
  ['grok-', 'xai'],
  ['qwen', 'qwen'],
  ['llama-', 'vllm'],
  ['mistral-', 'vllm'],
  ['mixtral-', 'vllm'],
  ['phi-', 'vllm'],
  ['codellama-', 'ollama'],
  ['vicuna-', 'ollama'],
];

/**
 * Get the defense profile for a given provider name.
 * Falls back to 'custom' if provider is unknown.
 */
export function getProviderProfile(provider: string): ProviderDefenseProfile {
  const key = provider.toLowerCase().trim();
  return PROVIDER_PROFILES[key] ?? PROVIDER_PROFILES['custom'];
}

/**
 * Infer provider from model name and return the appropriate defense profile.
 * Uses prefix matching against known model naming conventions.
 */
export function getProfileForModel(modelName: string): ProviderDefenseProfile {
  const lower = modelName.toLowerCase().trim();

  for (const [prefix, provider] of MODEL_PREFIX_MAP) {
    if (lower.startsWith(prefix)) {
      return PROVIDER_PROFILES[provider] ?? PROVIDER_PROFILES['custom'];
    }
  }

  // Check if model name contains a known provider name
  for (const providerKey of Object.keys(PROVIDER_PROFILES)) {
    if (providerKey !== 'custom' && lower.includes(providerKey)) {
      return PROVIDER_PROFILES[providerKey];
    }
  }

  return PROVIDER_PROFILES['custom'];
}

/**
 * Compute effective intent threshold by applying the provider's modifier.
 * Clamps result to [0.0, 1.0].
 */
export function effectiveIntentThreshold(
  base: number,
  profile: ProviderDefenseProfile,
): number {
  return Math.max(0.0, Math.min(1.0, base + profile.intentThresholdModifier));
}

/**
 * Compute effective confidence by applying the provider's floor.
 * Returns the higher of the base confidence and the provider's floor.
 */
export function effectiveConfidence(
  base: number,
  profile: ProviderDefenseProfile,
): number {
  return Math.max(base, profile.confidenceFloor);
}
