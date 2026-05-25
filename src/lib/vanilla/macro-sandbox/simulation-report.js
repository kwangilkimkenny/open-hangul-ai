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
import { Permission, SEVERITY_ORDER } from './permission-types.js';
import { t } from '../i18n/index.js';

/**
 * 위험도 → i18n 키 매핑.
 * `medium` 은 기존 호환을 위해 `보통` 라벨을 유지한다 (catalog 의 macro.severity.medium = '보통').
 */
const RISK_LABEL_KEYS = Object.freeze({
  low: 'macro.severity.low',
  medium: 'macro.severity.medium',
  high: 'macro.severity.high',
  critical: 'macro.severity.critical',
});

const RISK_BADGE_KEYS = Object.freeze({
  low: 'macro.badge.low',
  medium: 'macro.badge.medium',
  high: 'macro.badge.high',
  critical: 'macro.badge.critical',
});

const RISK_BADGE_COLOR = Object.freeze({
  low: '#16a34a',
  medium: '#ca8a04',
  high: '#ea580c',
  critical: '#dc2626',
});

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
    case Permission.FILE_IO:
      return `로컬 파일 시스템 접근을 ${count}회 시도합니다 (파일 읽기/쓰기 가능). 호출 위치: ${firstLines}.`;
    case Permission.NETWORK:
      return `외부 네트워크 통신을 ${count}회 시도합니다 (데이터 유출 또는 추가 페이로드 다운로드 가능). 호출 위치: ${firstLines}.`;
    case Permission.SHELL:
      return `운영체제 명령(셸)을 ${count}회 실행하려 합니다 (랜섬웨어/드로퍼 패턴). 호출 위치: ${firstLines}.`;
    case Permission.REGISTRY:
      return `Windows 레지스트리에 ${count}회 접근합니다 (영구 변경 또는 자동 실행 등록 가능). 호출 위치: ${firstLines}.`;
    case Permission.WSCRIPT:
      return `Windows Script Host 를 ${count}회 호출합니다. 호출 위치: ${firstLines}.`;
    case Permission.ACTIVEX:
      return `ActiveX / COM 객체를 ${count}회 생성합니다 (외부 모듈 로딩). 호출 위치: ${firstLines}.`;
    case Permission.DOM:
      return `브라우저 DOM API 를 ${count}회 호출합니다. 호출 위치: ${firstLines}.`;
    case Permission.HANCOM_API:
      return `한컴 자동화 API 를 ${count}회 호출합니다 (문서 자동 조작). 호출 위치: ${firstLines}.`;
    case Permission.DYNAMIC_EVAL:
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
  const riskLabelKey = RISK_LABEL_KEYS[riskLevel];
  const riskLabel = riskLabelKey ? t(riskLabelKey) : riskLevel;
  const groups = groupDetailsByType(details);

  // 권한을 severity 순으로 정렬 (critical → high → medium → low).
  // SEVERITY_ORDER 는 (low=0 … critical=3) 이므로 critical 이 먼저 오려면
  // 역순 정렬 — 즉 큰 값이 앞으로 와야 합니다.
  const sortedPerms = Array.from(permissionsSet).sort((a, b) => {
    const sa = SEVERITY_ORDER[PERMISSION_CATALOG[a]?.severity] ?? -1;
    const sb = SEVERITY_ORDER[PERMISSION_CATALOG[b]?.severity] ?? -1;
    if (sa !== sb) return sb - sa;
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
      ? t('macro.report.summary.empty', { language, riskLabel })
      : t('macro.report.summary.found', {
          language,
          count: permissionsSet.size,
          riskLabel,
        });

  const lines = [];
  lines.push(`# ${t('macro.report.title')}`);
  lines.push('');
  lines.push(`> ${t('macro.report.disclaimer')}`);
  lines.push(`> ${t('macro.report.disclaimer.subtitle')}`);
  lines.push('');
  lines.push(`**${t('macro.report.risk-level')}**: ${riskLabel} (\`${riskLevel}\`)`);
  lines.push(`**${t('macro.report.language')}**: ${language}`);
  lines.push(`**${t('macro.report.detected-count')}**: ${permissionsSet.size}개`);
  lines.push('');
  lines.push(`## ${t('macro.report.summary.heading')}`);
  lines.push(summary);
  lines.push('');
  if (actions.length > 0) {
    lines.push(`## ${t('macro.report.actions.heading')}`);
    lines.push('');
    actions.forEach((a, i) => {
      lines.push(`${i + 1}. **${a.label}** (\`${a.permission}\`, severity: ${a.severity})`);
      lines.push(`   - ${a.description}`);
    });
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`## ${t('macro.report.warnings.heading')}`);
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }
  if (errors.length > 0) {
    lines.push(`## ${t('macro.report.errors.heading')}`);
    for (const e of errors.slice(0, 5)) {
      lines.push(`- 라인 ${e.line || '?'}: ${e.message}`);
    }
    lines.push('');
  }
  lines.push(`---`);
  lines.push(t('macro.report.security-note'));

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
 * 위험 등급 → 시각화 배지 정보. 현재 locale 로 text/emoji 해석.
 *
 * @param {string} riskLevel
 * @returns {{color: string, text: string, emoji: string}}
 */
export function getRiskBadge(riskLevel) {
  const key = RISK_BADGE_KEYS[riskLevel] || RISK_BADGE_KEYS.low;
  const text = t(key);
  const color = RISK_BADGE_COLOR[riskLevel] || RISK_BADGE_COLOR.low;
  return { color, emoji: text, text };
}

export default {
  generateReport,
  getRiskBadge,
};
