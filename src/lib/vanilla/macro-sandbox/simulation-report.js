/**
 * 시뮬레이션 보고서 생성기
 *
 * 권한 분석 결과 → 자연어 한국어 보고서.
 *
 * **중요**: 이 모듈은 매크로 코드를 실행하지 않습니다.
 * "만약 실행된다면 어떤 일이 일어날까" 를 *기술하는* 보고서만 생성합니다.
 *
 * @module macro-sandbox/simulation-report
 */

import {
  PERMISSION_CATALOG,
  computeRiskLevel,
  groupDetailsByType,
  getPermissionMeta,
} from './permission-analyzer.js';

const RISK_LABEL = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '치명적',
};

const RISK_BADGE = {
  low: { color: '#16a34a', emoji: '안전', text: '안전' },
  medium: { color: '#ca8a04', emoji: '주의', text: '주의' },
  high: { color: '#ea580c', emoji: '위험', text: '위험' },
  critical: { color: '#dc2626', emoji: '치명적', text: '치명적' },
};

/**
 * 권한별 자연어 설명 템플릿.
 *
 * @param {string} permId
 * @param {Array} entries - 해당 권한에 매칭된 detail 항목들
 * @returns {string}
 */
function describePermission(permId, entries) {
  const count = entries.length;
  const firstLines = entries
    .slice(0, 3)
    .map(e => `라인 ${e.line || '?'}: \`${e.identifier}\``)
    .join(', ');

  switch (permId) {
    case 'file-io':
      return `로컬 파일 시스템 접근을 ${count}회 시도합니다 (파일 읽기/쓰기 가능). 호출 위치: ${firstLines}.`;
    case 'network':
      return `외부 네트워크 통신을 ${count}회 시도합니다 (데이터 유출 또는 추가 페이로드 다운로드 가능). 호출 위치: ${firstLines}.`;
    case 'shell':
      return `운영체제 명령(셸)을 ${count}회 실행하려 합니다 (랜섬웨어/드로퍼 패턴). 호출 위치: ${firstLines}.`;
    case 'registry':
      return `Windows 레지스트리에 ${count}회 접근합니다 (영구 변경 또는 자동 실행 등록 가능). 호출 위치: ${firstLines}.`;
    case 'wscript':
      return `Windows Script Host 를 ${count}회 호출합니다. 호출 위치: ${firstLines}.`;
    case 'activex':
      return `ActiveX / COM 객체를 ${count}회 생성합니다 (외부 모듈 로딩). 호출 위치: ${firstLines}.`;
    case 'dom':
      return `브라우저 DOM API 를 ${count}회 호출합니다. 호출 위치: ${firstLines}.`;
    case 'hancom-api':
      return `한컴 자동화 API 를 ${count}회 호출합니다 (문서 자동 조작). 호출 위치: ${firstLines}.`;
    case 'dynamic-eval':
      return `동적 코드 실행(eval/Function 등)을 ${count}회 시도합니다 (난독화/우회 패턴). 호출 위치: ${firstLines}.`;
    default: {
      const meta = getPermissionMeta(permId);
      const label = meta ? meta.label : permId;
      return `${label} 관련 호출이 ${count}회 발생합니다. 호출 위치: ${firstLines}.`;
    }
  }
}

/**
 * 시뮬레이션 보고서 생성.
 *
 * @param {Object} input
 * @param {Set<string> | string[]} input.permissions
 * @param {Array} input.details
 * @param {Array} [input.errors]
 * @param {string} [input.language]
 * @returns {{
 *   riskLevel: 'low'|'medium'|'high'|'critical',
 *   riskLabel: string,
 *   summary: string,
 *   actions: Array<{permission: string, label: string, severity: string, description: string, count: number}>,
 *   warnings: string[],
 *   markdown: string,
 *   text: string,
 * }}
 */
export function generateReport(input) {
  const permissionsSet =
    input.permissions instanceof Set ? input.permissions : new Set(input.permissions || []);
  const details = Array.isArray(input.details) ? input.details : [];
  const language = input.language || 'jscript';
  const errors = Array.isArray(input.errors) ? input.errors : [];

  const riskLevel = computeRiskLevel(permissionsSet);
  const riskLabel = RISK_LABEL[riskLevel] || riskLevel;
  const groups = groupDetailsByType(details);

  // 권한을 severity 순으로 정렬 (critical → high → medium → low)
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedPerms = Array.from(permissionsSet).sort((a, b) => {
    const sa = sevOrder[PERMISSION_CATALOG[a]?.severity] ?? 9;
    const sb = sevOrder[PERMISSION_CATALOG[b]?.severity] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  const actions = sortedPerms.map(permId => {
    const meta = getPermissionMeta(permId) || { label: permId, severity: 'low' };
    const entries = groups[permId] || [];
    return {
      permission: permId,
      label: meta.label,
      severity: meta.severity,
      description: describePermission(permId, entries),
      count: entries.length,
    };
  });

  const warnings = [];
  if (permissionsSet.has('shell') && permissionsSet.has('network')) {
    warnings.push(
      '셸 실행 + 네트워크 통신 조합은 원격 페이로드를 다운받아 실행하는 전형적인 드로퍼 패턴입니다.'
    );
  }
  if (permissionsSet.has('shell') && permissionsSet.has('file-io')) {
    warnings.push('셸 실행 + 파일 입출력 조합은 랜섬웨어/와이퍼 패턴과 유사합니다.');
  }
  if (permissionsSet.has('dynamic-eval')) {
    warnings.push('동적 코드 실행은 정적 분석을 우회하기 위한 난독화 신호입니다.');
  }
  if (permissionsSet.has('activex') && permissionsSet.has('registry')) {
    warnings.push('ActiveX + 레지스트리 접근은 시스템 영구 변경 가능성을 의미합니다.');
  }
  if (errors.length > 0) {
    warnings.push(
      `매크로 파싱 중 ${errors.length}개의 구문 오류가 발생했습니다. 분석 결과는 부분적일 수 있습니다.`
    );
  }

  const summary =
    permissionsSet.size === 0
      ? `이 매크로(${language})는 분석 시점에서 위험한 시스템 호출을 발견하지 못했습니다. 위험도: ${riskLabel}.`
      : `이 매크로(${language})가 실행되면 ${permissionsSet.size}개 카테고리의 시스템 접근이 시도됩니다. 위험도: ${riskLabel}.`;

  const lines = [];
  lines.push(`# 매크로 시뮬레이션 보고서`);
  lines.push('');
  lines.push(`> 이 보고서는 매크로 코드를 **실행하지 않고** 정적으로 분석한 결과입니다.`);
  lines.push(`> "만약 실행된다면 어떤 일이 일어날지" 를 기술합니다.`);
  lines.push('');
  lines.push(`**위험 등급**: ${riskLabel} (\`${riskLevel}\`)`);
  lines.push(`**언어**: ${language}`);
  lines.push(`**감지된 권한 카테고리**: ${permissionsSet.size}개`);
  lines.push('');
  lines.push(`## 요약`);
  lines.push(summary);
  lines.push('');
  if (actions.length > 0) {
    lines.push(`## 시도되는 동작`);
    lines.push('');
    actions.forEach((a, i) => {
      lines.push(`${i + 1}. **${a.label}** (\`${a.permission}\`, severity: ${a.severity})`);
      lines.push(`   - ${a.description}`);
    });
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`## 추가 경고`);
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }
  if (errors.length > 0) {
    lines.push(`## 파싱 오류`);
    for (const e of errors.slice(0, 5)) {
      lines.push(`- 라인 ${e.line || '?'}: ${e.message}`);
    }
    lines.push('');
  }
  lines.push(`---`);
  lines.push(`*보안 보장*: 이 분석기는 \`eval\` / \`Function\` / \`setTimeout(string)\` 을 사용하지 않습니다.`);

  const markdown = lines.join('\n');
  // markdown 의 마크다운 마커를 제거한 plain text
  const text = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*-\s+/gm, '• ');

  return {
    riskLevel,
    riskLabel,
    summary,
    actions,
    warnings,
    markdown,
    text,
  };
}

/**
 * 위험 등급 → 시각화 배지 정보.
 *
 * @param {string} riskLevel
 * @returns {{color: string, text: string, emoji: string}}
 */
export function getRiskBadge(riskLevel) {
  return RISK_BADGE[riskLevel] || RISK_BADGE.low;
}

export default {
  generateReport,
  getRiskBadge,
};
