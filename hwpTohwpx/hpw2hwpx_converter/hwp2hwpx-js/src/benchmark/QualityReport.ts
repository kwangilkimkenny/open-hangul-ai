/**
 * QualityReport.ts - 변환 품질 리포트 생성 시스템
 *
 * Phase 5.3: 품질 리포트 생성
 * - 변환 결과 분석
 * - 데이터 손실 감지
 * - 권장 사항 생성
 * - 리포트 출력
 *
 * @module Benchmark
 * @category Quality
 */

import { ConversionMetrics } from './ConversionMetrics';

/**
 * 품질 리포트 인터페이스
 */
export interface QualityReport {
    /** 입력 파일 */
    inputFile: string;
    /** 출력 파일 */
    outputFile: string;
    /** 생성 시간 */
    timestamp: Date;
    /** 변환 메트릭 */
    metrics: ConversionMetrics;
    /** 경고 목록 */
    warnings: ConversionWarning[];
    /** 오류 목록 */
    errors: ConversionError[];
    /** 데이터 손실 항목 */
    dataLoss: DataLossItem[];
    /** 권장 사항 */
    recommendations: string[];
    /** 품질 등급 */
    grade: QualityGrade;
    /** 요약 */
    summary: string;
}

/**
 * 변환 경고
 */
export interface ConversionWarning {
    /** 경고 코드 */
    code: string;
    /** 경고 메시지 */
    message: string;
    /** 발생 위치 */
    location?: string;
    /** 심각도 */
    severity: 'low' | 'medium' | 'high';
    /** 추가 정보 */
    details?: string;
}

/**
 * 변환 오류
 */
export interface ConversionError {
    /** 오류 코드 */
    code: string;
    /** 오류 메시지 */
    message: string;
    /** 발생 위치 */
    location?: string;
    /** 스택 트레이스 */
    stack?: string;
    /** 복구 가능 여부 */
    recoverable: boolean;
}

/**
 * 데이터 손실 항목
 */
export interface DataLossItem {
    /** 기능/요소 */
    feature: string;
    /** 심각도 */
    severity: 'low' | 'medium' | 'high';
    /** 설명 */
    description: string;
    /** 손실된 개수 */
    count?: number;
    /** 영향 받는 위치 */
    affectedLocations?: string[];
}

/**
 * 품질 등급
 */
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * 등급 기준
 */
export const GRADE_THRESHOLDS = {
    A: 95,
    B: 85,
    C: 70,
    D: 50,
    F: 0,
} as const;

/**
 * 점수에서 등급 계산
 */
export function calculateGrade(score: number): QualityGrade {
    if (score >= GRADE_THRESHOLDS.A) return 'A';
    if (score >= GRADE_THRESHOLDS.B) return 'B';
    if (score >= GRADE_THRESHOLDS.C) return 'C';
    if (score >= GRADE_THRESHOLDS.D) return 'D';
    return 'F';
}

/**
 * 등급 설명
 */
export const GRADE_DESCRIPTIONS: Record<QualityGrade, string> = {
    A: '최고 품질 - 거의 완벽한 변환',
    B: '우수 품질 - 대부분의 요소가 보존됨',
    C: '양호 품질 - 일부 요소에서 손실 발생',
    D: '주의 필요 - 상당한 데이터 손실 가능',
    F: '부적합 - 심각한 변환 문제 발생',
};

/**
 * 리포트 생성 옵션
 */
export interface ReportOptions {
    /** 상세 정보 포함 */
    includeDetails?: boolean;
    /** 권장 사항 생성 */
    generateRecommendations?: boolean;
    /** 데이터 손실 분석 */
    analyzeDataLoss?: boolean;
    /** 출력 형식 */
    format?: 'text' | 'json' | 'html';
}

/**
 * 기본 리포트 옵션
 */
export const DEFAULT_REPORT_OPTIONS: Required<ReportOptions> = {
    includeDetails: true,
    generateRecommendations: true,
    analyzeDataLoss: true,
    format: 'text',
};

/**
 * 품질 리포트 생성
 */
export function generateQualityReport(
    inputFile: string,
    outputFile: string,
    metrics: ConversionMetrics,
    warnings: ConversionWarning[] = [],
    errors: ConversionError[] = [],
    options: ReportOptions = {}
): QualityReport {
    const opts = { ...DEFAULT_REPORT_OPTIONS, ...options };

    // 등급 계산
    const grade = calculateGrade(metrics.overallScore);

    // 데이터 손실 분석
    const dataLoss = opts.analyzeDataLoss ? analyzeDataLoss(metrics) : [];

    // 권장 사항 생성
    const recommendations = opts.generateRecommendations
        ? generateRecommendations(metrics, grade, dataLoss)
        : [];

    // 요약 생성
    const summary = generateSummary(metrics, grade, dataLoss.length);

    return {
        inputFile,
        outputFile,
        timestamp: new Date(),
        metrics,
        warnings,
        errors,
        dataLoss,
        recommendations,
        grade,
        summary,
    };
}

/**
 * 데이터 손실 분석
 */
function analyzeDataLoss(metrics: ConversionMetrics): DataLossItem[] {
    const items: DataLossItem[] = [];

    // 텍스트 손실
    if (metrics.textPreservation < 100) {
        const lossPercent = 100 - metrics.textPreservation;
        items.push({
            feature: '텍스트 콘텐츠',
            severity: lossPercent > 10 ? 'high' : lossPercent > 5 ? 'medium' : 'low',
            description: `텍스트 ${lossPercent.toFixed(1)}% 손실 발생`,
            count: metrics.details.text.missingChars,
        });
    }

    // 테이블 손실
    const tables = metrics.elementCounts.tables;
    if (tables.input > tables.output) {
        items.push({
            feature: '테이블',
            severity: 'high',
            description: `${tables.input - tables.output}개 테이블 누락`,
            count: tables.input - tables.output,
        });
    }

    // 이미지 손실
    const images = metrics.elementCounts.images;
    if (images.input > images.output) {
        items.push({
            feature: '이미지',
            severity: 'high',
            description: `${images.input - images.output}개 이미지 누락`,
            count: images.input - images.output,
        });
    }

    // 수식 손실
    const equations = metrics.elementCounts.equations;
    if (equations.input > equations.output) {
        items.push({
            feature: '수식',
            severity: 'medium',
            description: `${equations.input - equations.output}개 수식 누락`,
            count: equations.input - equations.output,
        });
    }

    // 도형 손실
    const shapes = metrics.elementCounts.shapes;
    if (shapes.input > shapes.output) {
        items.push({
            feature: '도형',
            severity: 'medium',
            description: `${shapes.input - shapes.output}개 도형 누락`,
            count: shapes.input - shapes.output,
        });
    }

    // 차트 손실
    const charts = metrics.elementCounts.charts;
    if (charts.input > charts.output) {
        items.push({
            feature: '차트',
            severity: 'high',
            description: `${charts.input - charts.output}개 차트 누락`,
            count: charts.input - charts.output,
        });
    }

    // 하이퍼링크 손실
    const hyperlinks = metrics.elementCounts.hyperlinks;
    if (hyperlinks.input > hyperlinks.output) {
        items.push({
            feature: '하이퍼링크',
            severity: 'low',
            description: `${hyperlinks.input - hyperlinks.output}개 하이퍼링크 누락`,
            count: hyperlinks.input - hyperlinks.output,
        });
    }

    // 각주/미주 손실
    const footnotes = metrics.elementCounts.footnotes;
    if (footnotes.input > footnotes.output) {
        items.push({
            feature: '각주/미주',
            severity: 'medium',
            description: `${footnotes.input - footnotes.output}개 각주/미주 누락`,
            count: footnotes.input - footnotes.output,
        });
    }

    return items;
}

/**
 * 권장 사항 생성
 */
function generateRecommendations(
    metrics: ConversionMetrics,
    grade: QualityGrade,
    dataLoss: DataLossItem[]
): string[] {
    const recommendations: string[] = [];

    // 등급별 기본 권장 사항
    if (grade === 'F') {
        recommendations.push('변환 결과를 수동으로 검토하십시오.');
        recommendations.push('원본 파일의 손상 여부를 확인하십시오.');
    } else if (grade === 'D') {
        recommendations.push('중요한 콘텐츠가 손실되었을 수 있습니다. 변환 결과를 검토하십시오.');
    } else if (grade === 'C') {
        recommendations.push('일부 서식 또는 요소가 다르게 표시될 수 있습니다.');
    }

    // 텍스트 손실 관련
    if (metrics.textPreservation < 90) {
        recommendations.push('텍스트 보존율이 낮습니다. 특수 문자나 폰트 문제를 확인하십시오.');
    }

    // 테이블 관련
    if (metrics.elementCounts.tables.preservationRate < 100) {
        recommendations.push('일부 테이블이 변환되지 않았습니다. 복잡한 표 구조를 확인하십시오.');
    }

    // 이미지 관련
    if (metrics.elementCounts.images.preservationRate < 100) {
        recommendations.push('일부 이미지가 변환되지 않았습니다. 이미지 파일 형식을 확인하십시오.');
    }

    // 수식 관련
    if (metrics.elementCounts.equations.input > 0 &&
        metrics.elementCounts.equations.preservationRate < 100) {
        recommendations.push('일부 수식이 변환되지 않았습니다. 복잡한 수식은 수동 확인이 필요합니다.');
    }

    // 고심각도 데이터 손실
    const highSeverityLoss = dataLoss.filter(d => d.severity === 'high');
    if (highSeverityLoss.length > 0) {
        recommendations.push(
            `주의: ${highSeverityLoss.length}개의 심각한 데이터 손실이 감지되었습니다.`
        );
    }

    // 성공적인 변환
    if (grade === 'A' && dataLoss.length === 0) {
        recommendations.push('변환이 성공적으로 완료되었습니다. 추가 조치가 필요하지 않습니다.');
    }

    return recommendations;
}

/**
 * 요약 생성
 */
function generateSummary(metrics: ConversionMetrics, grade: QualityGrade, dataLossCount: number): string {
    const gradeDesc = GRADE_DESCRIPTIONS[grade];
    let summary = `품질 등급: ${grade} (${gradeDesc})`;

    summary += `\n전체 점수: ${metrics.overallScore.toFixed(1)}%`;
    summary += `\n텍스트 보존율: ${metrics.textPreservation.toFixed(1)}%`;
    summary += `\n서식 정확도: ${metrics.formattingAccuracy.toFixed(1)}%`;
    summary += `\n구조 무결성: ${metrics.structureIntegrity.toFixed(1)}%`;

    if (dataLossCount > 0) {
        summary += `\n\n${dataLossCount}개의 데이터 손실 항목이 감지되었습니다.`;
    }

    return summary;
}

/**
 * 리포트를 텍스트로 포맷
 */
export function formatReportAsText(report: QualityReport): string {
    const lines: string[] = [
        '╔══════════════════════════════════════════════════════════════╗',
        '║                  변환 품질 리포트                            ║',
        '╠══════════════════════════════════════════════════════════════╣',
        `║ 입력 파일: ${report.inputFile.padEnd(49)}║`,
        `║ 출력 파일: ${report.outputFile.padEnd(49)}║`,
        `║ 생성 시간: ${report.timestamp.toISOString().padEnd(49)}║`,
        '╠══════════════════════════════════════════════════════════════╣',
        `║ 품질 등급: ${report.grade.padEnd(49)}║`,
        `║ 전체 점수: ${(report.metrics.overallScore.toFixed(1) + '%').padEnd(49)}║`,
        '╠══════════════════════════════════════════════════════════════╣',
        '║ 세부 점수:                                                   ║',
        `║   텍스트 보존율: ${(report.metrics.textPreservation.toFixed(1) + '%').padEnd(43)}║`,
        `║   서식 정확도:   ${(report.metrics.formattingAccuracy.toFixed(1) + '%').padEnd(43)}║`,
        `║   구조 무결성:   ${(report.metrics.structureIntegrity.toFixed(1) + '%').padEnd(43)}║`,
    ];

    // 요소 보존율
    lines.push('╠══════════════════════════════════════════════════════════════╣');
    lines.push('║ 요소 보존:                                                   ║');

    const ec = report.metrics.elementCounts;
    lines.push(`║   문단:     ${ec.paragraphs.output}/${ec.paragraphs.input}`.padEnd(64) + '║');
    lines.push(`║   테이블:   ${ec.tables.output}/${ec.tables.input}`.padEnd(64) + '║');
    lines.push(`║   이미지:   ${ec.images.output}/${ec.images.input}`.padEnd(64) + '║');
    lines.push(`║   수식:     ${ec.equations.output}/${ec.equations.input}`.padEnd(64) + '║');

    // 데이터 손실
    if (report.dataLoss.length > 0) {
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ 데이터 손실:                                                 ║');
        for (const loss of report.dataLoss) {
            const severity = loss.severity.toUpperCase().padEnd(6);
            lines.push(`║   [${severity}] ${loss.feature}: ${loss.description}`.padEnd(64) + '║');
        }
    }

    // 경고
    if (report.warnings.length > 0) {
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ 경고:                                                        ║');
        for (const warn of report.warnings.slice(0, 5)) {
            lines.push(`║   - ${warn.message}`.substring(0, 64).padEnd(64) + '║');
        }
        if (report.warnings.length > 5) {
            lines.push(`║   ... 외 ${report.warnings.length - 5}개`.padEnd(64) + '║');
        }
    }

    // 오류
    if (report.errors.length > 0) {
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ 오류:                                                        ║');
        for (const err of report.errors.slice(0, 5)) {
            lines.push(`║   - ${err.message}`.substring(0, 64).padEnd(64) + '║');
        }
    }

    // 권장 사항
    if (report.recommendations.length > 0) {
        lines.push('╠══════════════════════════════════════════════════════════════╣');
        lines.push('║ 권장 사항:                                                   ║');
        for (const rec of report.recommendations) {
            lines.push(`║   - ${rec}`.substring(0, 64).padEnd(64) + '║');
        }
    }

    lines.push('╚══════════════════════════════════════════════════════════════╝');

    return lines.join('\n');
}

/**
 * 리포트를 JSON으로 포맷
 */
export function formatReportAsJson(report: QualityReport): string {
    return JSON.stringify(report, null, 2);
}

/**
 * 리포트를 HTML로 포맷
 */
export function formatReportAsHtml(report: QualityReport): string {
    const gradeColor = getGradeColor(report.grade);

    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>변환 품질 리포트</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .grade { font-size: 72px; color: ${gradeColor}; font-weight: bold; }
        .score { font-size: 24px; color: #666; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .section-title { font-weight: bold; margin-bottom: 10px; color: #333; }
        .metric-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .metric-bar { height: 20px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
        .metric-fill { height: 100%; background: #4CAF50; }
        .warning { color: #ff9800; }
        .error { color: #f44336; }
        .data-loss-high { background: #ffebee; }
        .data-loss-medium { background: #fff3e0; }
        .data-loss-low { background: #e8f5e9; }
    </style>
</head>
<body>
    <div class="header">
        <h1>변환 품질 리포트</h1>
        <div class="grade">${report.grade}</div>
        <div class="score">${report.metrics.overallScore.toFixed(1)}%</div>
    </div>

    <div class="section">
        <div class="section-title">파일 정보</div>
        <div class="metric-row"><span>입력 파일:</span><span>${report.inputFile}</span></div>
        <div class="metric-row"><span>출력 파일:</span><span>${report.outputFile}</span></div>
        <div class="metric-row"><span>생성 시간:</span><span>${report.timestamp.toISOString()}</span></div>
    </div>

    <div class="section">
        <div class="section-title">세부 점수</div>
        <div class="metric-row">
            <span>텍스트 보존율</span>
            <span>${report.metrics.textPreservation.toFixed(1)}%</span>
        </div>
        <div class="metric-bar"><div class="metric-fill" style="width: ${report.metrics.textPreservation}%"></div></div>
        <div class="metric-row">
            <span>서식 정확도</span>
            <span>${report.metrics.formattingAccuracy.toFixed(1)}%</span>
        </div>
        <div class="metric-bar"><div class="metric-fill" style="width: ${report.metrics.formattingAccuracy}%"></div></div>
        <div class="metric-row">
            <span>구조 무결성</span>
            <span>${report.metrics.structureIntegrity.toFixed(1)}%</span>
        </div>
        <div class="metric-bar"><div class="metric-fill" style="width: ${report.metrics.structureIntegrity}%"></div></div>
    </div>

    ${report.dataLoss.length > 0 ? `
    <div class="section">
        <div class="section-title">데이터 손실</div>
        ${report.dataLoss.map(loss => `
        <div class="data-loss-${loss.severity}">
            <strong>${loss.feature}</strong>: ${loss.description}
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${report.recommendations.length > 0 ? `
    <div class="section">
        <div class="section-title">권장 사항</div>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>`;
}

/**
 * 등급별 색상
 */
function getGradeColor(grade: QualityGrade): string {
    switch (grade) {
        case 'A': return '#4CAF50'; // 녹색
        case 'B': return '#8BC34A'; // 연두색
        case 'C': return '#FFC107'; // 노란색
        case 'D': return '#FF9800'; // 주황색
        case 'F': return '#f44336'; // 빨간색
    }
}

/**
 * 빈 리포트 생성
 */
export function createEmptyReport(inputFile: string): QualityReport {
    return {
        inputFile,
        outputFile: '',
        timestamp: new Date(),
        metrics: {
            textPreservation: 0,
            formattingAccuracy: 0,
            structureIntegrity: 0,
            overallScore: 0,
            elementCounts: {
                paragraphs: { input: 0, output: 0, preservationRate: 0 },
                tables: { input: 0, output: 0, preservationRate: 0 },
                images: { input: 0, output: 0, preservationRate: 0 },
                equations: { input: 0, output: 0, preservationRate: 0 },
                shapes: { input: 0, output: 0, preservationRate: 0 },
                charts: { input: 0, output: 0, preservationRate: 0 },
                hyperlinks: { input: 0, output: 0, preservationRate: 0 },
                footnotes: { input: 0, output: 0, preservationRate: 0 },
            },
            details: {
                text: { inputLength: 0, outputLength: 0, matchingChars: 0, missingChars: 0, addedChars: 0 },
                formatting: { fontStyles: 0, paragraphStyles: 0, colors: 0 },
                structure: { sections: 0, tableStructure: 0, listStructure: 0 },
            },
        },
        warnings: [],
        errors: [],
        dataLoss: [],
        recommendations: [],
        grade: 'F',
        summary: '',
    };
}

export default {
    generateQualityReport,
    formatReportAsText,
    formatReportAsJson,
    formatReportAsHtml,
    calculateGrade,
    createEmptyReport,
};
