/**
 * TokenBudgetBar — 현재 예산 대비 사용량을 시각적으로 표시
 */

import type { TokenBudget } from '../types/ai-draft';

interface Props {
  budget: TokenBudget | null;
  promptTokens?: number;  // 실시간 프롬프트 추정치 (budget 미갱신 상태)
  referenceTokens?: number;
}

export default function TokenBudgetBar({ budget, promptTokens, referenceTokens }: Props) {
  const limit = budget?.contextLimit ?? 2_000_000;
  const prompt = budget?.promptTokens ?? promptTokens ?? 0;
  const refs = budget?.referenceTokens ?? referenceTokens ?? 0;
  const reserved = budget?.reservedForOutput ?? 8192;
  const used = prompt + refs + reserved;
  const pct = Math.min(100, (used / limit) * 100);
  const overflow = budget?.overflow ?? used > limit;
  const color = overflow ? '#ef4444' : pct > 85 ? '#f59e0b' : '#3b82f6';

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#6b7280' }}>
        <span>
          예산: {used.toLocaleString()} / {limit.toLocaleString()} ({pct.toFixed(1)}%)
        </span>
        <span style={{ color: overflow ? '#ef4444' : '#6b7280' }}>
          {overflow ? '⚠️ 초과' : `남음 ${(limit - used).toLocaleString()}`}
        </span>
      </div>
      <div style={{ background: '#f3f4f6', height: 6, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
        <span>📝 프롬프트 {prompt.toLocaleString()}</span>
        <span>📎 참조 {refs.toLocaleString()}</span>
        <span>🎯 출력 예약 {reserved.toLocaleString()}</span>
      </div>
    </div>
  );
}
