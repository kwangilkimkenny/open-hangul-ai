/**
 * LLM Selector - 빠른 LLM Provider 선택 컴포넌트
 */

import React, { useState } from 'react';
import { useActiveProvider, useActiveConfig, useLLMConfigStore, useUsageStats } from '../stores/llmConfigStore';
import { PROVIDER_MODELS } from '../types/universal-llm';
import LLMConfigModal from './LLMConfigModal';

interface Props {
  onConfigOpen?: () => void;
  compact?: boolean;
  showHealth?: boolean;
}

const PROVIDER_INFO = {
  openai: { icon: '🤖', name: 'OpenAI', color: '#10b981' },
  claude: { icon: '🎭', name: 'Claude', color: '#8b5cf6' },
  vertex: { icon: '🟡', name: 'Gemini', color: '#f59e0b' },
  grok: { icon: '❌', name: 'Grok', color: '#6b7280' },
  'azure-openai': { icon: '☁️', name: 'Azure', color: '#3b82f6' },
  cohere: { icon: '🌐', name: 'Cohere', color: '#06b6d4' },
  local: { icon: '🏠', name: 'Local', color: '#84cc16' },
};

export default function LLMSelector({ onConfigOpen, compact = false, showHealth = false }: Props) {
  const activeProvider = useActiveProvider();
  const activeConfig = useActiveConfig();
  const usageStats = useUsageStats();
  const { setActiveProvider, updateConfig } = useLLMConfigStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [health, setHealth] = useState<Record<string, any>>({});

  const currentProvider = PROVIDER_INFO[activeProvider];
  const currentModel = PROVIDER_MODELS[activeProvider]?.find(m => m.id === activeConfig.model);

  const handleProviderChange = (provider: any) => {
    setActiveProvider(provider);
    setIsDropdownOpen(false);
  };

  const openConfig = () => {
    setIsConfigOpen(true);
    onConfigOpen?.();
  };

  const handleConfigSave = (config: any) => {
    updateConfig(config.provider, config);
    if (config.provider !== activeProvider) {
      setActiveProvider(config.provider);
    }
  };

  React.useEffect(() => {
    if (showHealth) {
      import('../stores/llmConfigStore').then(({ checkProviderHealth }) => {
        checkProviderHealth().then(setHealth).catch(() => {});
      });
    }
  }, [showHealth]);

  const getProviderStatus = (provider: string) => {
    const stats = usageStats[provider];
    if (!stats) return null;

    const successRate = stats.totalRequests > 0
      ? Math.round((stats.successfulRequests / stats.totalRequests) * 100)
      : null;

    return {
      requests: stats.totalRequests,
      success: successRate,
      lastUsed: stats.lastUsed,
      cost: stats.totalCost,
    };
  };

  if (compact) {
    return (
      <>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              color: '#374151',
            }}
          >
            <span>{currentProvider.icon}</span>
            <span>{currentProvider.name}</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>▼</span>
          </button>

          {isDropdownOpen && (
            <>
              <div
                onClick={() => setIsDropdownOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 10,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  zIndex: 20,
                  minWidth: 200,
                }}
              >
                {Object.entries(PROVIDER_INFO).map(([provider, info]) => (
                  <button
                    key={provider}
                    onClick={() => handleProviderChange(provider)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: activeProvider === provider ? '#f0f9ff' : 'transparent',
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span>{info.icon}</span>
                    <span>{info.name}</span>
                    {activeProvider === provider && (
                      <span style={{ marginLeft: 'auto', color: '#3b82f6' }}>✓</span>
                    )}
                  </button>
                ))}
                <div style={{ padding: 8, borderTop: '1px solid #e5e7eb' }}>
                  <button
                    onClick={openConfig}
                    style={{
                      width: '100%',
                      padding: 6,
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    ⚙️ 설정
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <LLMConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          onConfigSave={handleConfigSave}
          initialConfig={activeConfig}
        />
      </>
    );
  }

  // Full UI
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
      }}>
        {/* Current Provider Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: currentProvider.color,
            }}
          />
          <span style={{ fontSize: 16 }}>{currentProvider.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
              {currentProvider.name}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {currentModel?.name || activeConfig.model}
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        {(() => {
          const stats = getProviderStatus(activeProvider);
          if (stats && stats.requests > 0) {
            return (
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                <div>{stats.requests}회 사용</div>
                <div>성공률 {stats.success}%</div>
              </div>
            );
          }
          return null;
        })()}

        {/* Actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            변경 ▼
          </button>
          <button
            onClick={openConfig}
            style={{
              padding: '4px 8px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ⚙️
          </button>
        </div>

        {/* Dropdown */}
        {isDropdownOpen && (
          <>
            <div
              onClick={() => setIsDropdownOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                zIndex: 20,
                width: '100%',
                minWidth: 300,
              }}
            >
              {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
                const stats = getProviderStatus(provider);
                const healthStatus = health[provider];

                return (
                  <button
                    key={provider}
                    onClick={() => handleProviderChange(provider)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background: activeProvider === provider ? '#f0f9ff' : 'transparent',
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 14,
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: healthStatus?.status === 'ok' ? '#10b981' : '#ef4444',
                        }}
                      />
                      <span style={{ fontSize: 16 }}>{info.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{info.name}</div>
                        {stats && (
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {stats.requests}회 사용, 성공률 {stats.success}%
                          </div>
                        )}
                      </div>
                    </div>

                    {activeProvider === provider && (
                      <span style={{ marginLeft: 'auto', color: '#3b82f6' }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <LLMConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigSave={handleConfigSave}
        initialConfig={activeConfig}
      />
    </>
  );
}