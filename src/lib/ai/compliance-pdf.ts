/**
 * Compliance Report PDF Printer
 * 인쇄 전용 윈도우를 열어 브라우저의 "PDF로 저장" / 프린터 인쇄를 지원
 *
 * @module lib/ai/compliance-pdf
 * @version 1.0.0
 */

import type { ComplianceReport, ComplianceCategory, ComplianceCheck, FrameworkMeta } from '../../types/compliance';

const CHECK_SYMBOLS: Record<string, string> = {
  pass: '\u2705',
  warn: '\u26A0\uFE0F',
  fail: '\u274C',
  'n/a': '\u2796',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    compliant: 'COMPLIANT',
    partial: 'PARTIAL',
    'non-compliant': 'NON-COMPLIANT',
  };
  return map[status] ?? status;
}

function statusBadgeStyle(status: string): string {
  const styles: Record<string, string> = {
    compliant: 'background:#dcfce7;color:#16a34a;',
    partial: 'background:#fef3c7;color:#d97706;',
    'non-compliant': 'background:#fee2e2;color:#dc2626;',
  };
  return styles[status] ?? '';
}

function buildCheckRow(check: ComplianceCheck): string {
  const icon = CHECK_SYMBOLS[check.result] || '';
  const failClass = check.result === 'fail' ? 'color:#991b1b;' : '';
  const articleTag = check.article
    ? `<span style="font-size:10px;padding:1px 6px;background:#eff6ff;color:#3b82f6;border-radius:3px;margin-left:6px;">${check.article}</span>`
    : '';
  const remediation = check.remediation
    ? `<div style="font-size:11px;color:#d97706;margin-top:3px;padding:3px 6px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:3px;">${check.remediation}</div>`
    : '';

  return `
    <tr>
      <td style="width:28px;text-align:center;vertical-align:top;padding:6px 4px;font-size:13px;">${icon}</td>
      <td style="padding:6px 8px;vertical-align:top;">
        <div style="font-size:12px;${failClass}line-height:1.5;">${check.description}${articleTag}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${check.evidence}</div>
        ${remediation}
      </td>
    </tr>`;
}

function buildCategorySection(category: ComplianceCategory): string {
  const color = scoreColor(category.score);
  const rows = category.checks.map(buildCheckRow).join('');

  return `
    <div style="margin-bottom:16px;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#f1f5f9;border-bottom:1px solid #d1d5db;">
        <strong style="font-size:13px;color:#1e293b;">${category.name}</strong>
        <span style="font-size:13px;font-weight:600;color:${color};">${category.score}%</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>`;
}

function buildScoreRing(score: number): string {
  const color = scoreColor(score);
  const r = 40;
  const stroke = 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const size = (r + stroke) * 2;
  const c = r + stroke;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="vertical-align:middle;">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
        transform="rotate(-90 ${c} ${c})"/>
      <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central"
        font-size="22" font-weight="800" fill="${color}">${score}</text>
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
        `<li style="padding:6px 10px;margin-bottom:4px;background:#fffbeb;border-radius:6px;font-size:12px;color:#92400e;border-left:3px solid #f59e0b;line-height:1.5;">${r}</li>`
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
      color: #1e293b;
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
      .page { padding: 16mm 18mm; max-width: none; }
      .no-print { display: none !important; }
      .category-section { break-inside: avoid; }
    }

    @page {
      size: A4;
      margin: 12mm 14mm;
    }

    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .print-bar button {
      padding: 8px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .print-bar .btn-print {
      background: white;
      color: #2563eb;
    }
    .print-bar .btn-print:hover { background: #f0f4ff; }

    .print-bar .btn-close {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    .print-bar .btn-close:hover { background: rgba(255,255,255,0.3); }

    .spacer { height: 56px; }

    /* Header */
    .report-title { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
    .report-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }

    /* Score area */
    .score-area {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
      padding: 16px 20px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .summary-text { font-size: 13px; color: #475569; margin-top: 6px; }

    /* AI Summary grid */
    .ai-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding: 14px 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    .ai-summary-title {
      grid-column: 1 / -1;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }
    .ai-item-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .ai-item-value { font-size: 14px; font-weight: 600; color: #1e293b; }

    /* Recommendations */
    .rec-title { font-size: 14px; font-weight: 600; margin: 20px 0 10px; }
    .rec-list { list-style: none; padding: 0; }

    /* Footer */
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Print action bar (hidden on print) -->
  <div class="print-bar no-print">
    <span style="font-size:14px;font-weight:600;">
      ${framework.name} Compliance Report
    </span>
    <div style="display:flex;gap:8px;">
      <button class="btn-print" onclick="window.print()">PDF 저장 / 인쇄</button>
      <button class="btn-close" onclick="window.close()">닫기</button>
    </div>
  </div>
  <div class="spacer no-print"></div>

  <div class="page">
    <!-- Title -->
    <h1 class="report-title">${framework.name} Compliance Report</h1>
    <p class="report-meta">${framework.subtitle} &middot; ${dateStr}</p>

    <!-- Overall Score -->
    <div class="score-area">
      ${scoreRing}
      <div>
        <span class="status-badge" style="${statusBadgeStyle(report.overallStatus)}">
          ${statusLabel(report.overallStatus)}
        </span>
        <p class="summary-text">
          ${report.summary.totalChecks}개 항목 중
          <strong>${report.summary.passed}</strong>개 통과,
          <span style="color:#d97706;">${report.summary.warned}</span>개 경고,
          <span style="color:#dc2626;">${report.summary.failed}</span>개 미충족
        </p>
      </div>
    </div>

    <!-- AI Usage Summary -->
    <div class="ai-summary">
      <div class="ai-summary-title">AI 사용 요약</div>
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
        ? `<h4 class="rec-title">개선 권고사항</h4>
           <ul class="rec-list">${recommendations}</ul>`
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      Generated by OpenHangul AI &middot; ${framework.version} &middot; ${dateStr}
    </div>
  </div>

  <script>
    // 자동 인쇄 대화상자는 띄우지 않음 - 사용자가 상단 버튼으로 직접 제어
  </script>
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
