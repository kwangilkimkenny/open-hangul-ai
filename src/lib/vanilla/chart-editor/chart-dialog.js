/**
 * Chart Editor Dialog (Modal)
 * ─────────────────────────────────────────────────────────────────────────────
 * 한컴 한글의 "차트 삽입" 다이얼로그와 동일한 3패널 레이아웃을 제공한다.
 *   - 좌(40%): 데이터 시트
 *   - 중(40%): 미리보기 (SVG, 트랙 K 의 renderChart 사용)
 *   - 우(20%): 옵션 패널
 *
 * 모달 자체는 표준 DOM <div role="dialog"> 로 구현한다. (외부 모달 라이브러리 X)
 * "삽입" 버튼 클릭 시 트랙 K 호환 ChartData 를 onInsert(data) 콜백으로 전달한다.
 *
 * @module vanilla/chart-editor/chart-dialog
 * @version 1.0.0
 */

import { createDataSheet } from './data-sheet.js';
import { createOptionsPanel, defaultChartOptions } from './options-panel.js';
import { createPreviewPane, buildChartData } from './preview-pane.js';
import { serializeChart } from '../chart/chart-parser.js';

/**
 * @typedef {Object} ChartDialogConfig
 * @property {Object} [initialSheet]
 * @property {Object} [initialOptions]
 * @property {(data: Object) => void} [onInsert]
 * @property {() => void} [onCancel]
 * @property {number} [debounceMs]
 */

/**
 * 모달 차트 편집기를 연다.
 * @param {ChartDialogConfig} [config]
 * @returns {{
 *   root: HTMLElement,
 *   close: () => void,
 *   getData: () => Object,
 *   getSerializedXml: () => string,
 *   insert: () => void,
 *   dataSheet: ReturnType<typeof createDataSheet>,
 *   optionsPanel: ReturnType<typeof createOptionsPanel>,
 *   previewPane: ReturnType<typeof createPreviewPane>
 * }}
 */
export function openChartDialog(config = {}) {
    const onInsert = typeof config.onInsert === 'function' ? config.onInsert : () => {};
    const onCancel = typeof config.onCancel === 'function' ? config.onCancel : () => {};
    const debounceMs = Number.isFinite(config.debounceMs) ? config.debounceMs : 100;

    // ───── DOM 구축 ─────
    const backdrop = document.createElement('div');
    backdrop.className = 'hwp-chart-dialog-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'hwp-chart-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '차트 편집기');
    backdrop.appendChild(dialog);

    // 헤더
    const header = document.createElement('div');
    header.className = 'hwp-chart-dialog-header';
    const titleEl = document.createElement('h3');
    titleEl.textContent = '차트 편집';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'hwp-chart-dialog-close';
    closeBtn.dataset.action = 'cancel';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '×';
    header.append(titleEl, closeBtn);
    dialog.appendChild(header);

    // 본문 3분할
    const body = document.createElement('div');
    body.className = 'hwp-chart-dialog-body';
    const leftCol = document.createElement('div');
    leftCol.className = 'hwp-chart-dialog-col hwp-chart-dialog-col-data';
    const midCol = document.createElement('div');
    midCol.className = 'hwp-chart-dialog-col hwp-chart-dialog-col-preview';
    const rightCol = document.createElement('div');
    rightCol.className = 'hwp-chart-dialog-col hwp-chart-dialog-col-options';
    body.append(leftCol, midCol, rightCol);
    dialog.appendChild(body);

    // 푸터
    const footer = document.createElement('div');
    footer.className = 'hwp-chart-dialog-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.dataset.action = 'cancel';
    cancelBtn.textContent = '취소';
    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.dataset.action = 'insert';
    insertBtn.className = 'primary';
    insertBtn.textContent = '삽입';
    footer.append(cancelBtn, insertBtn);
    dialog.appendChild(footer);

    // ───── 컨트롤러 구성 ─────
    let currentSheet = null;
    let currentOptions = { ...defaultChartOptions(), ...(config.initialOptions || {}) };

    const previewPane = createPreviewPane(midCol, {
        debounceMs,
        size: { width: 480, height: 320 }
    });

    const dataSheet = createDataSheet(leftCol, {
        initial: config.initialSheet,
        onChange(sheetState) {
            currentSheet = sheetState;
            previewPane.update(currentSheet, currentOptions);
        }
    });
    currentSheet = dataSheet.getState();

    const optionsPanel = createOptionsPanel(rightCol, {
        initial: currentOptions,
        onChange(opts) {
            currentOptions = opts;
            previewPane.update(currentSheet, currentOptions);
        }
    });
    currentOptions = optionsPanel.getOptions();

    // 첫 렌더 — 디바운스 없이 즉시 실행
    previewPane.update(currentSheet, currentOptions);
    previewPane.flush();

    // ───── 액션 핸들러 ─────
    function getData() {
        return buildChartData(currentSheet, currentOptions);
    }

    function getSerializedXml() {
        return serializeChart(getData());
    }

    function close() {
        backdrop.removeEventListener('click', onBackdropClick);
        dialog.removeEventListener('click', onDialogClick);
        document.removeEventListener('keydown', onKeyDown);
        try { dataSheet.destroy(); } catch { /* noop */ }
        try { optionsPanel.destroy(); } catch { /* noop */ }
        try { previewPane.destroy(); } catch { /* noop */ }
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    function insert() {
        previewPane.flush();
        const data = getData();
        onInsert(data);
        close();
    }

    function cancel() {
        onCancel();
        close();
    }

    function onDialogClick(e) {
        const action = e.target && e.target.dataset && e.target.dataset.action;
        if (action === 'insert') insert();
        else if (action === 'cancel') cancel();
    }

    function onBackdropClick(e) {
        if (e.target === backdrop) cancel();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            cancel();
        }
    }

    dialog.addEventListener('click', onDialogClick);
    backdrop.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onKeyDown);

    // 자동 마운트
    const mountTarget = config.mountTarget || document.body;
    mountTarget.appendChild(backdrop);

    return {
        root: backdrop,
        close,
        getData,
        getSerializedXml,
        insert,
        dataSheet,
        optionsPanel,
        previewPane
    };
}

/**
 * 본문 paragraph 에 삽입할 수 있는 chart run 의 HWPX XML 조각을 생성한다.
 * 호출자는 이 문자열을 paragraph 의 자식으로 추가하기만 하면 된다.
 *
 * @param {Object} data - buildChartData / openChartDialog().getData() 결과
 * @returns {string} <hp:run> ... <hp:chart .../> </hp:run> XML
 */
export function buildChartRunXml(data) {
    if (!data) return '';
    const chartXml = serializeChart(data);
    // 본문 run wrapper. (트랙 K parseChart 가 받을 수 있는 형태)
    return [
        '<hp:run>',
        chartXml.split('\n').map(l => '  ' + l).join('\n'),
        '</hp:run>'
    ].join('\n');
}

export default { openChartDialog, buildChartRunXml };
