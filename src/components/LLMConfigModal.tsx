/**
 * LLM Configuration Modal - 멀티 LLM Provider 설정 UI
 */

import { useState, useEffect } from 'react';
import { PROVIDER_MODELS, type LLMConfig, type LLMProvider } from '../types/universal-llm';
import { universalLLM } from '../lib/ai/universal-llm-service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfigSave: (config: LLMConfig) => void;
  initialConfig?: Partial<LLMConfig>;
}

interface ProviderInfo {
  id: LLMProvider;
  name: string;
  icon: string;
  description: string;
  needsApiKey: boolean;
  needsEndpoint: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: 'GPT-4o, GPT-3.5 Turbo - 범용 고성능',
    needsApiKey: true,
    needsEndpoint: false,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '🎭',
    description: 'Claude 3.5 Sonnet - 긴 컨텍스트, 분석',
    needsApiKey: true,
    needsEndpoint: false,
  },
  {
    id: 'vertex',
    name: 'Google Gemini',
    icon: '🟡',
    description: 'Gemini Pro - 멀티모달, 대용량',
    needsApiKey: false,
    needsEndpoint: false,
  },
  {
    id: 'grok',
    name: 'Grok (X.AI)',
    icon: '❌',
    description: 'Grok Beta - 창의적, 유머러스',
    needsApiKey: true,
    needsEndpoint: false,
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    icon: '☁️',
    description: '엔터프라이즈 GPT - 보안, 컴플라이언스',
    needsApiKey: true,
    needsEndpoint: true,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    icon: '🌐',
    description: 'Command R+ - 비즈니스 특화',
    needsApiKey: true,
    needsEndpoint: false,
  },
  {
    id: 'local',
    name: '로컬 모델',
    icon: '🏠',
    description: 'Qwen, Llama - 프라이버시, 무료',
    needsApiKey: false,
    needsEndpoint: true,
  },
];

export default function LLMConfigModal({ isOpen, onClose, onConfigSave, initialConfig = {} }: Props) {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    apiKey: '',
    endpoint: '',
    ...initialConfig,
  });

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentProvider = PROVIDERS.find(p => p.id === config.provider)!;
  const models = PROVIDER_MODELS[config.provider] || [];

  // Provider 변경 시 기본 모델 설정
  useEffect(() => {
    const defaultModel = models[0]?.id || '';
    setConfig(prev => ({ ...prev, model: defaultModel }));
    setValidationResult(null);
  }, [config.provider]);

  // 로컬 모델의 경우 동적 모델 조회
  useEffect(() => {
    if (config.provider === 'local' && config.endpoint) {
      const localProvider = universalLLM.getProvider('local');
      if (localProvider) {
        localProvider.getAvailableModels?.(config).then((models: string[]) => {
          setAvailableModels(models);
        }).catch(() => {
          setAvailableModels(PROVIDER_MODELS.local.map(m => m.id));
        });
      }
    }
  }, [config.provider, config.endpoint]);

  const handleProviderChange = (provider: LLMProvider) => {
    setConfig(prev => ({
      ...prev,
      provider,
      model: '',
      apiKey: '',
      endpoint: '',
    }));
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await universalLLM.validateConfig(config);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({ valid: false, error: (error as Error).message });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = () => {
    onConfigSave(config);
    onClose();
  };

  const getRecommendation = () => {
    if (config.maxTokens < 2000) {
      return universalLLM.getRecommendedProvider(1000, 'fast');
    } else if (config.maxTokens > 8000) {
      return universalLLM.getRecommendedProvider(5000, 'best');
    } else {
      return universalLLM.getRecommendedProvider(3000, 'balanced');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LLM 설정"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.5)',
        zIndex: 1600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(900px, 95vw)',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🔧 LLM 모델 설정</h2>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              AI Provider와 모델을 선택하고 설정하세요
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px', overflowY: 'auto', flex: 1 }}>

          {/* Provider Selection */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
              AI Provider 선택
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  style={{
                    padding: 16,
                    border: config.provider === provider.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: config.provider === provider.id ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (config.provider !== provider.id) {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={e => {
                    if (config.provider !== provider.id) {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{provider.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{provider.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                    {provider.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model & Basic Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 20 }}>

            {/* Model Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                모델
              </label>
              <select
                value={config.model}
                onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6 }}
              >
                {(config.provider === 'local' && availableModels.length > 0 ? availableModels : models.map(m => m.id)).map(modelId => {
                  const modelInfo = models.find(m => m.id === modelId);
                  return (
                    <option key={modelId} value={modelId}>
                      {modelInfo?.name || modelId}
                      {modelInfo?.maxTokens && ` (${(modelInfo.maxTokens / 1000).toFixed(0)}K)`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                Temperature ({config.temperature})
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={e => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                <span>정확함</span>
                <span>창의적</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                최대 토큰
              </label>
              <input
                type="number"
                value={config.maxTokens}
                onChange={e => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4000 }))}
                min="100"
                max="100000"
                style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6 }}
              />
            </div>

          </div>

          {/* API Key */}
          {currentProvider.needsApiKey && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                API 키 {config.provider === 'azure-openai' ? '(Azure API Key)' : ''}
              </label>
              <input
                type="password"
                value={config.apiKey || ''}
                onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder={`${currentProvider.name} API 키를 입력하세요`}
                style={{ width: '100%', padding: 10, fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6 }}
              />
            </div>
          )}

          {/* Endpoint */}
          {currentProvider.needsEndpoint && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                {config.provider === 'local' ? '서버 엔드포인트' : 'Azure 엔드포인트'}
              </label>
              <input
                type="url"
                value={config.endpoint || ''}
                onChange={e => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder={
                  config.provider === 'local'
                    ? 'http://localhost:11434 (Ollama) 또는 http://localhost:8000 (vLLM)'
                    : 'https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview'
                }
                style={{ width: '100%', padding: 10, fontSize: 14, border: '1px solid #d1d5db', borderRadius: 6 }}
              />
              {config.provider === 'local' && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  💡 Ollama: <code>ollama serve</code> 실행 후 위 주소 사용
                </div>
              )}
            </div>
          )}

          {/* Advanced Settings */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 13,
                color: '#3b82f6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {showAdvanced ? '▼' : '▶'} 고급 설정
            </button>

            {showAdvanced && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                    Top P
                  </label>
                  <input
                    type="number"
                    value={config.topP || 1.0}
                    onChange={e => setConfig(prev => ({ ...prev, topP: parseFloat(e.target.value) || 1.0 }))}
                    min="0"
                    max="1"
                    step="0.1"
                    style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                    Frequency Penalty
                  </label>
                  <input
                    type="number"
                    value={config.frequencyPenalty || 0}
                    onChange={e => setConfig(prev => ({ ...prev, frequencyPenalty: parseFloat(e.target.value) || 0 }))}
                    min="-2"
                    max="2"
                    step="0.1"
                    style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                    Presence Penalty
                  </label>
                  <input
                    type="number"
                    value={config.presencePenalty || 0}
                    onChange={e => setConfig(prev => ({ ...prev, presencePenalty: parseFloat(e.target.value) || 0 }))}
                    min="-2"
                    max="2"
                    step="0.1"
                    style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>
              💡 추천 설정
            </div>
            {(() => {
              const rec = getRecommendation();
              return (
                <div style={{ fontSize: 12, color: '#1e40af' }}>
                  <strong>{PROVIDERS.find(p => p.id === rec.provider)?.name}</strong> - {rec.model}
                  <br />
                  {rec.reason}
                </div>
              );
            })()}
          </div>

          {/* Validation */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <button
              onClick={handleValidate}
              disabled={validating}
              style={{
                padding: '8px 16px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: validating ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {validating ? '검증 중...' : '설정 검증'}
            </button>

            {validationResult && (
              <div style={{
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 12,
                background: validationResult.valid ? '#dcfce7' : '#fee2e2',
                color: validationResult.valid ? '#166534' : '#991b1b',
                border: `1px solid ${validationResult.valid ? '#bbf7d0' : '#fecaca'}`,
              }}>
                {validationResult.valid ? '✅ 설정 유효' : `❌ ${validationResult.error}`}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!config.model || (currentProvider.needsApiKey && !config.apiKey) || (currentProvider.needsEndpoint && !config.endpoint)}
            style={{
              padding: '8px 20px',
              background: (!config.model || (currentProvider.needsApiKey && !config.apiKey) || (currentProvider.needsEndpoint && !config.endpoint)) ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: (!config.model || (currentProvider.needsApiKey && !config.apiKey) || (currentProvider.needsEndpoint && !config.endpoint)) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}