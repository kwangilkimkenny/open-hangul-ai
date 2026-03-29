/**
 * Compliance Report PDF Printer
 * 인쇄 전용 윈도우 — Conservative Monotone 기술문서 스타일
 *
 * @module lib/ai/compliance-pdf
 * @version 2.0.0
 */

import type { ComplianceReport, ComplianceCategory, ComplianceCheck, FrameworkMeta } from '../../types/compliance';

const CHECK_SYMBOLS: Record<string, string> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  'n/a': 'N/A',
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    compliant: 'COMPLIANT',
    partial: 'PARTIAL',
    'non-compliant': 'NON-COMPLIANT',
  };
  return map[status] ?? status;
}

function buildCheckRow(check: ComplianceCheck): string {
  const icon = CHECK_SYMBOLS[check.result] || '';
  const iconStyle = check.result === 'pass'
    ? 'color:#222;font-weight:700;'
    : check.result === 'fail'
      ? 'color:#999;font-weight:700;'
      : 'color:#aaa;font-weight:700;';
  const descStyle = check.result === 'fail' ? 'color:#555;' : 'color:#333;';
  const articleTag = check.article
    ? `<span style="font-size:9px;padding:1px 5px;border:1px solid #ccc;border-radius:2px;margin-left:6px;color:#555;font-family:'SF Mono','Consolas',monospace;">${check.article}</span>`
    : '';
  const remediation = check.remediation
    ? `<div style="font-size:10px;color:#555;margin-top:3px;padding:3px 6px;border-left:2px solid #bbb;background:#f9f9f9;">${check.remediation}</div>`
    : '';

  return `
    <tr>
      <td style="width:36px;text-align:center;vertical-align:top;padding:6px 4px;font-size:9px;font-family:'SF Mono','Consolas',monospace;letter-spacing:0.3px;${iconStyle}">${icon}</td>
      <td style="padding:6px 8px;vertical-align:top;">
        <div style="font-size:11.5px;${descStyle}line-height:1.5;">${check.description}${articleTag}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">${check.evidence}</div>
        ${remediation}
      </td>
    </tr>`;
}

function buildCategorySection(category: ComplianceCategory): string {
  const scoreColor = category.score >= 80 ? '#222' : category.score >= 50 ? '#777' : '#aaa';
  const rows = category.checks.map(buildCheckRow).join('');

  return `
    <div style="margin-bottom:12px;border:1px solid #ddd;overflow:hidden;break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:#f5f5f5;border-bottom:1px solid #ddd;">
        <strong style="font-size:11px;color:#222;text-transform:uppercase;letter-spacing:0.5px;">${category.name}</strong>
        <span style="font-size:11px;font-weight:700;color:${scoreColor};font-family:'SF Mono','Consolas',monospace;">${category.score}%</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>`;
}

function buildScoreRing(score: number): string {
  const color = score >= 80 ? '#222' : score >= 50 ? '#777' : '#aaa';
  const r = 36;
  const stroke = 4;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const size = (r + stroke) * 2;
  const c = r + stroke;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="vertical-align:middle;">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#e0e0e0" stroke-width="${stroke}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="butt"
        transform="rotate(-90 ${c} ${c})"/>
      <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central"
        font-size="20" font-weight="800" fill="${color}" font-family="'SF Mono','Consolas',monospace">${score}</text>
    </svg>`;
}

/**
 * 컴플라이언스 리포트를 인쇄 전용 윈도우로 열어 PDF 인쇄/저장
 */
export function printComplianceReport(report: ComplianceReport, framework: FrameworkMeta): void {
  const dateStr = new Date(report.generatedAt).toLocaleString('ko-KR');
  const categories = report.categories.map(buildCategorySection).join('');
  const scoreRing = buildScoreRing(report.overallScore);

  const recommendations = report.recommendations
    .map(
      (r) =>
        `<li style="padding:5px 10px;margin-bottom:3px;border-left:2px solid #bbb;font-size:11px;color:#555;line-height:1.5;background:#f9f9f9;">${r}</li>`
    )
    .join('');

  const aiSummary = report.aiUsageSummary;
  const avgHallu =
    aiSummary.avgHallucinationScore !== null
      ? `${(aiSummary.avgHallucinationScore * 100).toFixed(1)}%`
      : 'N/A';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${framework.name} Compliance Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
      color: #222;
      background: white;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 24px 28px;
    }

    @media print {
      .page { padding: 14mm 16mm; max-width: none; }
      .no-print { display: none !important; }
    }

    @page {
      size: A4;
      margin: 12mm 14mm;
    }

    /* ---- Print bar ---- */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #222;
      color: #e5e5e5;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .print-bar button {
      padding: 6px 20px;
      border: 1px solid #666;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      transition: all 0.12s;
      font-family: inherit;
    }

    .print-bar .btn-print {
      background: #fff;
      color: #222;
      border-color: #fff;
    }
    .print-bar .btn-print:hover { background: #e0e0e0; }

    .print-bar .btn-close {
      background: transparent;
      color: #aaa;
      border-color: #555;
    }
    .print-bar .btn-close:hover { color: #fff; border-color: #999; }

    .spacer { height: 48px; }

    /* ---- Header ---- */
    .report-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #111;
    }
    .report-meta { font-size: 11px; color: #888; margin-bottom: 18px; }

    /* ---- Score area ---- */
    .score-area {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 18px;
      padding: 14px 18px;
      background: #fafafa;
      border: 1px solid #ddd;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border: 1px solid #bbb;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #333;
    }
    .summary-text { font-size: 12px; color: #555; margin-top: 6px; }
    .summary-text strong { color: #111; }

    /* ---- AI Summary grid ---- */
    .ai-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 12px 16px;
      background: #fafafa;
      border: 1px solid #ddd;
      margin-bottom: 20px;
    }
    .ai-summary-title {
      grid-column: 1 / -1;
      font-size: 9.5px;
      font-weight: 700;
      color: #888;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .ai-item-label {
      font-size: 9px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ai-item-value {
      font-size: 13px;
      font-weight: 700;
      color: #222;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    /* ---- Recommendations ---- */
    .rec-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #888;
      margin: 18px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .rec-list { list-style: none; padding: 0; }

    /* ---- Footer ---- */
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 9px;
      color: #aaa;
      text-align: center;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <!-- Print action bar -->
  <div class="print-bar no-print">
    <span>${framework.name} Compliance Report</span>
    <div style="display:flex;gap:8px;">
      <button class="btn-print" onclick="window.print()">PDF / PRINT</button>
      <button class="btn-close" onclick="window.close()">CLOSE</button>
    </div>
  </div>
  <div class="spacer no-print"></div>

  <div class="page">
    <h1 class="report-title">${framework.name} Compliance Report</h1>
    <p class="report-meta">${framework.subtitle} &middot; ${dateStr}</p>

    <!-- Overall Score -->
    <div class="score-area">
      ${scoreRing}
      <div>
        <span class="status-badge">
          ${statusLabel(report.overallStatus)}
        </span>
        <p class="summary-text">
          ${report.summary.totalChecks}개 항목 중
          <strong>${report.summary.passed}</strong>개 통과,
          ${report.summary.warned}개 경고,
          ${report.summary.failed}개 미충족
        </p>
      </div>
    </div>

    <!-- AI Usage Summary -->
    <div class="ai-summary">
      <div class="ai-summary-title">AI Usage Summary</div>
      <div>
        <div class="ai-item-label">AI 활동</div>
        <div class="ai-item-value">${aiSummary.totalActions}건</div>
      </div>
      <div>
        <div class="ai-item-label">모델</div>
        <div class="ai-item-value">${aiSummary.model}</div>
      </div>
      <div>
        <div class="ai-item-label">승인율</div>
        <div class="ai-item-value">${(aiSummary.approvalRate * 100).toFixed(0)}%</div>
      </div>
      <div>
        <div class="ai-item-label">검증 점수</div>
        <div class="ai-item-value">${avgHallu}</div>
      </div>
      <div>
        <div class="ai-item-label">총 토큰</div>
        <div class="ai-item-value">${(aiSummary.totalInputTokens + aiSummary.totalOutputTokens).toLocaleString()}</div>
      </div>
      <div>
        <div class="ai-item-label">전체 검토</div>
        <div class="ai-item-value">${aiSummary.allReviewed ? 'Yes' : 'No'}</div>
      </div>
    </div>

    <!-- Categories -->
    ${categories}

    <!-- Recommendations -->
    ${
      report.recommendations.length > 0
        ? `<h4 class="rec-title">Recommendations</h4>
           <ul class="rec-list">${recommendations}</ul>`
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      Generated by OpenHangul AI &middot; ${framework.version} &middot; ${dateStr}
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('팝업이 차단되었습니다. 팝업 차단을 해제한 후 다시 시도하세요.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
