/**
 * 다국어 라벨 카탈로그
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 한국어가 기본(default) locale 이며, 다른 locale (영문 등) 은 키가 누락되면
 * 한국어 카탈로그로 자동 폴백한다.
 *
 * 라벨 키 명명 규칙
 *   <module>.<group>.<name>
 *
 *   예) macro.permission.file-io, ole.save.button, common.close
 *
 * 키 추가 시 주의
 *   1) `ko` 카탈로그가 진리원천(source of truth). 새 키는 반드시 `ko` 먼저 추가.
 *   2) 영문(en) 스켈레톤은 동일한 키 집합을 유지하도록 노력하되, 누락 시
 *      `t()` 가 자동으로 `ko` 로 폴백하므로 점진적으로 추가해도 안전.
 *   3) `{placeholder}` 형태로 변수 자리를 표시한다 — `t(key, { placeholder: 'x' })`.
 *
 * @module vanilla/i18n/labels
 */

/**
 * @typedef {Record<string, string>} LabelDict
 */

/**
 * locale 별 라벨 사전.
 *
 * @type {Record<string, LabelDict>}
 */
export const LABELS = {
  ko: {
    // ───── macro-sandbox: 권한 카테고리 라벨 ─────
    'macro.permission.file-io': '파일 입출력',
    'macro.permission.network': '네트워크',
    'macro.permission.shell': '셸 명령 실행',
    'macro.permission.registry': '레지스트리 접근',
    'macro.permission.wscript': 'Windows Script Host',
    'macro.permission.activex': 'ActiveX / COM 객체',
    'macro.permission.obfuscation': '난독화 패턴',
    'macro.permission.dynamic-eval': '동적 코드 실행',
    'macro.permission.hancom-api': '한컴 자동화 API',
    'macro.permission.dom': '브라우저 DOM',

    // ───── macro-sandbox: 심각도 라벨 ─────
    // 기존 RISK_LABEL 호환을 위해 medium 은 '보통' 유지.
    // 별도 형태(`중간`)가 필요하면 `macro.severity.medium-alt` 키 추가 권장.
    'macro.severity.low': '낮음',
    'macro.severity.medium': '보통',
    'macro.severity.high': '높음',
    'macro.severity.critical': '치명적',

    // ───── macro-sandbox: 위험도 배지 텍스트 ─────
    'macro.badge.low': '안전',
    'macro.badge.medium': '주의',
    'macro.badge.high': '위험',
    'macro.badge.critical': '치명적',

    // ───── macro-sandbox: 보고서 본문 ─────
    'macro.report.title': '매크로 시뮬레이션 보고서',
    'macro.report.disclaimer':
      '이 보고서는 매크로 코드를 실행하지 않고 정적으로 분석한 결과입니다.',
    'macro.report.disclaimer.subtitle': '"만약 실행된다면 어떤 일이 일어날지" 를 기술합니다.',
    'macro.report.risk-level': '위험 등급',
    'macro.report.language': '언어',
    'macro.report.detected-count': '감지된 권한 카테고리',
    'macro.report.summary.heading': '요약',
    'macro.report.actions.heading': '시도되는 동작',
    'macro.report.warnings.heading': '추가 경고',
    'macro.report.errors.heading': '파싱 오류',
    'macro.report.security-note':
      '*보안 보장*: 이 분석기는 `eval` / `Function` / `setTimeout(string)` 을 사용하지 않습니다.',
    'macro.report.summary.empty':
      '이 매크로({language})는 분석 시점에서 위험한 시스템 호출을 발견하지 못했습니다. 위험도: {riskLabel}.',
    'macro.report.summary.found':
      '이 매크로({language})가 실행되면 {count}개 카테고리의 시스템 접근이 시도됩니다. 위험도: {riskLabel}.',

    // ───── macro-sandbox: 다이얼로그 ─────
    'macro.dialog.aria-label': '매크로 샌드박스 분석',
    'macro.dialog.title': '매크로 샌드박스 분석',
    'macro.dialog.subtitle':
      '언어: {language} — 이 매크로는 실행되지 않았습니다. 정적 분석 결과만 표시됩니다.',
    'macro.dialog.risk-prefix': '위험 등급',
    'macro.dialog.permissions.heading': '요청 권한 (정적 분석)',
    'macro.dialog.permissions.empty': '감지된 위험 권한 호출이 없습니다.',
    'macro.dialog.simulation.heading': '시뮬레이션 보고서',
    'macro.dialog.simulation.empty': '(보고서 없음)',
    'macro.dialog.code.heading': '매크로 원본 코드 (실행되지 않음)',
    'macro.dialog.line-prefix': '라인 {line}: {identifier}',
    'macro.dialog.more-count': '... 그 외 {count}건',

    // ───── ole-editor ─────
    'ole.default.title': 'OLE 객체',
    'ole.unsupported.message': '이 OLE 객체는 브라우저 인플레이스 편집을 지원하지 않습니다.',
    'ole.unsupported.format': '미지원 타입: {type}',
    'ole.save.button': '저장',
    'ole.cancel.button': '취소',
    'ole.saving.indicator': '저장 중…',
    'ole.save.error': '저장 실패: {message}',

    // ───── cmyk-pdf (대체로 ASCII 인쇄 마크지만 메타정보 i18n 키만 정의) ─────
    'pdf.pageInfo.label': '페이지 정보',

    // ───── font-metrics ─────
    'font.fallback.notice': '시스템 폰트로 폴백',

    // ───── 공통 ─────
    'common.close': '닫기',
    'common.confirm': '확인',
    'common.cancel': '취소',
  },

  en: {
    // ───── macro-sandbox: permissions ─────
    'macro.permission.file-io': 'File I/O',
    'macro.permission.network': 'Network',
    'macro.permission.shell': 'Shell Command Execution',
    'macro.permission.registry': 'Registry Access',
    'macro.permission.wscript': 'Windows Script Host',
    'macro.permission.activex': 'ActiveX / COM Object',
    'macro.permission.obfuscation': 'Obfuscation Pattern',
    'macro.permission.dynamic-eval': 'Dynamic Code Execution',
    'macro.permission.hancom-api': 'Hancom Automation API',
    'macro.permission.dom': 'Browser DOM',

    // ───── macro-sandbox: severity ─────
    'macro.severity.low': 'Low',
    'macro.severity.medium': 'Medium',
    'macro.severity.high': 'High',
    'macro.severity.critical': 'Critical',

    // ───── macro-sandbox: badge ─────
    'macro.badge.low': 'Safe',
    'macro.badge.medium': 'Caution',
    'macro.badge.high': 'Dangerous',
    'macro.badge.critical': 'Critical',

    // ───── macro-sandbox: report ─────
    'macro.report.title': 'Macro Simulation Report',
    'macro.report.disclaimer':
      'This report is the result of static analysis without executing the macro code.',
    'macro.report.disclaimer.subtitle': 'It describes "what would happen if it ran".',
    'macro.report.risk-level': 'Risk Level',
    'macro.report.language': 'Language',
    'macro.report.detected-count': 'Detected Permission Categories',
    'macro.report.summary.heading': 'Summary',
    'macro.report.actions.heading': 'Attempted Actions',
    'macro.report.warnings.heading': 'Additional Warnings',
    'macro.report.errors.heading': 'Parse Errors',
    'macro.report.security-note':
      '*Security guarantee*: this analyzer does not use `eval` / `Function` / `setTimeout(string)`.',
    'macro.report.summary.empty':
      'This macro ({language}) shows no dangerous system calls at analysis time. Risk: {riskLabel}.',
    'macro.report.summary.found':
      'If this macro ({language}) runs, it will attempt access in {count} permission categories. Risk: {riskLabel}.',

    // ───── macro-sandbox: dialog ─────
    'macro.dialog.aria-label': 'Macro Sandbox Analysis',
    'macro.dialog.title': 'Macro Sandbox Analysis',
    'macro.dialog.subtitle':
      'Language: {language} — this macro was not executed. Showing static analysis results only.',
    'macro.dialog.risk-prefix': 'Risk',
    'macro.dialog.permissions.heading': 'Requested Permissions (Static Analysis)',
    'macro.dialog.permissions.empty': 'No dangerous permission calls detected.',
    'macro.dialog.simulation.heading': 'Simulation Report',
    'macro.dialog.simulation.empty': '(no report)',
    'macro.dialog.code.heading': 'Macro Source Code (Not Executed)',
    'macro.dialog.line-prefix': 'Line {line}: {identifier}',
    'macro.dialog.more-count': '... and {count} more',

    // ───── ole-editor ─────
    'ole.default.title': 'OLE Object',
    'ole.unsupported.message':
      'This OLE object does not support browser in-place editing.',
    'ole.unsupported.format': 'Unsupported type: {type}',
    'ole.save.button': 'Save',
    'ole.cancel.button': 'Cancel',
    'ole.saving.indicator': 'Saving…',
    'ole.save.error': 'Save failed: {message}',

    // ───── cmyk-pdf ─────
    'pdf.pageInfo.label': 'Page Info',

    // ───── font-metrics ─────
    'font.fallback.notice': 'Falling back to system font',

    // ───── common ─────
    'common.close': 'Close',
    'common.confirm': 'OK',
    'common.cancel': 'Cancel',
  },
};

/**
 * 지원 locale 목록 — i18n.setLocale() 검증용.
 */
export const SUPPORTED_LOCALES = Object.freeze(Object.keys(LABELS));

/**
 * 기본 locale — 한국어.
 */
export const DEFAULT_LOCALE = 'ko';

export default LABELS;
