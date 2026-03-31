/**
 * AI Table Semantics Diagnostic Tool
 * 시맨틱 그리드 파이프라인 전체를 진단하고 상세 리포트 생성
 *
 * 사용법: 브라우저 콘솔에서
 *   import('/src/lib/ai/diagnostic.ts').then(m => m.runDiagnostic())
 * 또는 window.__runSemanticDiagnostic() 호출
 */

import type { HWPXDocument } from '../../types/hwpx';
import {
  buildSemanticGrid,
  buildSemanticGridsForDocument,
  getFullHeaderLabel,
  getCellAddress,
  type SemanticGrid,
  type SemanticCell,
} from './table-semantics';
import { DocumentStructureExtractor } from './structure-extractor';
import { GPTService } from './gpt-service';

// ─── Types ───────────────────────────────────────────────────────────────

interface DiagnosticReport {
  timestamp: string;
  documentInfo: {
    sections: number;
    totalElements: number;
    totalTables: number;
    metadata?: any;
  };
  semanticGrids: GridDiagnostic[];
  structureExtraction: StructureDiagnostic;
  promptEncoding: PromptDiagnostic;
  issues: DiagnosticIssue[];
  summary: string;
}

interface GridDiagnostic {
  tableIndex: number;
  sectionIndex: number;
  dimensions: string;
  cornerRegion: string;
  columnHeaderLevels: number;
  rowHeaderLevels: number;
  totalCells: number;
  dataCells: number;
  emptyCells: number;
  titleCell: string | null;
  cellRoleDistribution: Record<string, number>;
  headerChainSamples: string[];
  contentTypeDistribution: Record<string, number>;
}

interface StructureDiagnostic {
  pipeline: string;
  documentType: string;
  title: string | null;
  pairsCount: number;
  contextSamples: number;
  relationships: number;
  relationshipTypes: Record<string, number>;
  characteristics: Record<string, any>;
  samplePairs: Array<{ header: string; contentPreview: string; gridAddress?: string }>;
}

interface PromptDiagnostic {
  gridEncodings: Array<{ tableIndex: number; encoded: string; tokenEstimate: number }>;
}

interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  detail?: string;
}

// ─── Main diagnostic function ────────────────────────────────────────────

export function diagnoseDocument(document: HWPXDocument): DiagnosticReport {
  const issues: DiagnosticIssue[] = [];
  const startTime = performance.now();

  // ═══════════════════════════════════════
  // 1. 문서 기본 정보
  // ═══════════════════════════════════════
  console.log('🔍 [진단] 1/4: 문서 기본 정보 수집...');

  let totalTables = 0;
  let totalElements = 0;
  document.sections.forEach(section => {
    section.elements.forEach(elem => {
      totalElements++;
      if (elem.type === 'table') totalTables++;
    });
  });

  const documentInfo = {
    sections: document.sections.length,
    totalElements,
    totalTables,
    metadata: document.metadata,
  };

  console.log(`   섹션: ${documentInfo.sections}, 요소: ${totalElements}, 표: ${totalTables}`);

  if (totalTables === 0) {
    issues.push({
      severity: 'error',
      category: 'document',
      message: '표가 없습니다',
      detail: '이 문서에는 표 요소가 없어 시맨틱 분석이 불가합니다.',
    });
  }

  // ═══════════════════════════════════════
  // 2. 시맨틱 그리드 분석
  // ═══════════════════════════════════════
  console.log('🔍 [진단] 2/4: 시맨틱 그리드 구축...');

  const semanticGrids: GridDiagnostic[] = [];
  const grids = buildSemanticGridsForDocument(document);

  for (const grid of grids) {
    const diagnostic = diagnoseGrid(grid, issues);
    semanticGrids.push(diagnostic);
    console.log(`   표 ${grid.tableIndex}: ${diagnostic.dimensions}, 데이터셀=${diagnostic.dataCells}, 빈셀=${diagnostic.emptyCells}`);
  }

  // ═══════════════════════════════════════
  // 3. 구조 추출 분석
  // ═══════════════════════════════════════
  console.log('🔍 [진단] 3/4: 구조 추출...');

  const extractor = new DocumentStructureExtractor();
  const structure = extractor.extractEnhancedStructure(document);
  const structureDiagnostic = diagnoseStructure(structure, issues);

  console.log(`   파이프라인: ${structureDiagnostic.pipeline}, 타입: ${structureDiagnostic.documentType}`);
  console.log(`   쌍: ${structureDiagnostic.pairsCount}, 관계: ${structureDiagnostic.relationships}`);

  // ═══════════════════════════════════════
  // 4. 프롬프트 인코딩 테스트
  // ═══════════════════════════════════════
  console.log('🔍 [진단] 4/4: 프롬프트 인코딩...');

  const promptDiagnostic = diagnosePromptEncoding(grids, issues);

  // ═══════════════════════════════════════
  // 요약 생성
  // ═══════════════════════════════════════
  const elapsed = Math.round(performance.now() - startTime);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const summary = [
    `📊 진단 완료 (${elapsed}ms)`,
    `문서: ${documentInfo.sections}섹션, ${totalTables}표, ${totalElements}요소`,
    `시맨틱: ${grids.length}그리드, ${grids.reduce((s, g) => s + g.totalDataCells, 0)}데이터셀`,
    `파이프라인: ${structure.pipeline}, 타입: ${structure.documentType}`,
    `이슈: ${errorCount}에러, ${warningCount}경고, ${infoCount}정보`,
  ].join('\n');

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    documentInfo,
    semanticGrids,
    structureExtraction: structureDiagnostic,
    promptEncoding: promptDiagnostic,
    issues,
    summary,
  };

  // 콘솔 출력
  printReport(report);

  return report;
}

// ─── Grid diagnostic ─────────────────────────────────────────────────────

function diagnoseGrid(grid: SemanticGrid, issues: DiagnosticIssue[]): GridDiagnostic {
  // 역할 분포
  const roleDistribution: Record<string, number> = {};
  const contentTypeDistribution: Record<string, number> = {};

  const allCells: SemanticCell[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r]?.[c];
      if (cell) allCells.push(cell);
    }
  }

  for (const cell of allCells) {
    roleDistribution[cell.role] = (roleDistribution[cell.role] || 0) + 1;
    contentTypeDistribution[cell.contentType] = (contentTypeDistribution[cell.contentType] || 0) + 1;
  }

  // 헤더 체인 샘플
  const headerChainSamples: string[] = [];
  for (const dc of grid.dataCells.slice(0, 8)) {
    const label = getFullHeaderLabel(dc);
    const addr = getCellAddress(dc);
    const preview = dc.text.length > 30 ? dc.text.substring(0, 30) + '...' : (dc.text || '(빈 셀)');
    headerChainSamples.push(`[${addr}] ${label} = "${preview}"`);
  }

  // 이슈 체크
  if (grid.dataCells.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'grid',
      message: `표 ${grid.tableIndex}: 데이터 셀이 없습니다`,
      detail: `${grid.rows}×${grid.cols} 그리드에서 데이터 역할 셀을 찾지 못했습니다. 코너 감지가 잘못되었을 수 있습니다.`,
    });
  }

  if (grid.cornerRegion.rowEnd >= grid.rows) {
    issues.push({
      severity: 'warning',
      category: 'grid',
      message: `표 ${grid.tableIndex}: 코너 영역이 전체 행을 차지합니다`,
      detail: `코너 rowEnd=${grid.cornerRegion.rowEnd}, 전체 rows=${grid.rows}. 모든 행이 헤더로 분류됨.`,
    });
  }

  const emptyRate = grid.totalDataCells > 0 ? grid.emptyDataCells / grid.totalDataCells : 0;
  if (emptyRate > 0.8) {
    issues.push({
      severity: 'info',
      category: 'grid',
      message: `표 ${grid.tableIndex}: ${Math.round(emptyRate * 100)}% 빈 셀 — AI 생성에 적합`,
    });
  }

  // 헤더 체인 유효성 검사
  const noChainCells = grid.dataCells.filter(
    dc => dc.columnHeaderChain.length === 0 && dc.rowHeaderChain.length === 0
  );
  if (noChainCells.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'grid',
      message: `표 ${grid.tableIndex}: ${noChainCells.length}개 데이터 셀에 헤더 체인이 없습니다`,
      detail: `주소: ${noChainCells.slice(0, 5).map(c => getCellAddress(c)).join(', ')}`,
    });
  }

  return {
    tableIndex: grid.tableIndex,
    sectionIndex: grid.sectionIndex,
    dimensions: `${grid.rows}×${grid.cols}`,
    cornerRegion: `${grid.cornerRegion.rowEnd}행 × ${grid.cornerRegion.colEnd}열`,
    columnHeaderLevels: grid.columnHeaders.length,
    rowHeaderLevels: grid.rowHeaders.length,
    totalCells: allCells.length,
    dataCells: grid.dataCells.length,
    emptyCells: grid.emptyDataCells,
    titleCell: grid.titleCell?.text || null,
    cellRoleDistribution: roleDistribution,
    contentTypeDistribution,
    headerChainSamples,
  };
}

// ─── Structure diagnostic ────────────────────────────────────────────────

function diagnoseStructure(
  structure: ReturnType<DocumentStructureExtractor['extractEnhancedStructure']>,
  issues: DiagnosticIssue[]
): StructureDiagnostic {
  const relationshipTypes: Record<string, number> = {};
  for (const rel of structure.relationships) {
    relationshipTypes[rel.type] = (relationshipTypes[rel.type] || 0) + 1;
  }

  const samplePairs = structure.pairs.slice(0, 10).map(p => ({
    header: p.header,
    contentPreview: p.content.length > 50 ? p.content.substring(0, 50) + '...' : (p.content || '(빈)'),
    gridAddress: p.gridAddress ? `R${p.gridAddress.gridRow}C${p.gridAddress.gridCol}` : undefined,
  }));

  // 파이프라인 진단
  if (structure.pipeline === 'legacy' && structure.semanticGrids.length > 0) {
    const hasComplexTable = structure.semanticGrids.some(g => g.cols > 2);
    if (hasComplexTable) {
      issues.push({
        severity: 'warning',
        category: 'pipeline',
        message: '레거시 파이프라인 사용 중이나 복잡한 표가 감지됨',
        detail: '시맨틱 파이프라인 선택 로직을 확인하세요.',
      });
    }
  }

  if (structure.pairs.length === 0) {
    issues.push({
      severity: 'error',
      category: 'extraction',
      message: '추출된 헤더-내용 쌍이 0개입니다',
      detail: '표 구조가 인식되지 않았거나 모든 셀이 비어있습니다.',
    });
  }

  return {
    pipeline: structure.pipeline,
    documentType: structure.documentType,
    title: structure.title || null,
    pairsCount: structure.pairs.length,
    contextSamples: structure.contextSamples.length,
    relationships: structure.relationships.length,
    relationshipTypes,
    characteristics: structure.characteristics,
    samplePairs,
  };
}

// ─── Prompt encoding diagnostic ──────────────────────────────────────────

function diagnosePromptEncoding(
  grids: SemanticGrid[],
  issues: DiagnosticIssue[]
): PromptDiagnostic {
  const gptService = new GPTService();
  const gridEncodings: PromptDiagnostic['gridEncodings'] = [];

  for (const grid of grids) {
    const encoded = gptService.encodeSemanticGrid(grid);
    const tokenEstimate = Math.ceil(encoded.length / 4); // ~4 chars per token for Korean

    gridEncodings.push({
      tableIndex: grid.tableIndex,
      encoded,
      tokenEstimate,
    });

    if (tokenEstimate > 3000) {
      issues.push({
        severity: 'warning',
        category: 'prompt',
        message: `표 ${grid.tableIndex}: 인코딩이 ~${tokenEstimate} 토큰 — 멀티패스 필요`,
      });
    }
  }

  return { gridEncodings };
}

// ─── Pretty print report ─────────────────────────────────────────────────

function printReport(report: DiagnosticReport): void {
  console.log('\n' + '═'.repeat(70));
  console.log('  시맨틱 테이블 인텔리전스 진단 리포트 v3.0');
  console.log('═'.repeat(70));

  console.log(`\n${report.summary}`);

  // 시맨틱 그리드 상세
  if (report.semanticGrids.length > 0) {
    console.log('\n' + '─'.repeat(50));
    console.log('📊 시맨틱 그리드 분석');
    console.log('─'.repeat(50));

    for (const grid of report.semanticGrids) {
      console.log(`\n▸ 표 ${grid.tableIndex} (섹션 ${grid.sectionIndex})`);
      console.log(`  크기: ${grid.dimensions}`);
      console.log(`  코너 영역: ${grid.cornerRegion}`);
      console.log(`  컬럼 헤더 레벨: ${grid.columnHeaderLevels}`);
      console.log(`  행 헤더 레벨: ${grid.rowHeaderLevels}`);
      console.log(`  데이터 셀: ${grid.dataCells} (빈 셀: ${grid.emptyCells})`);
      if (grid.titleCell) console.log(`  제목: "${grid.titleCell}"`);

      console.log(`  역할 분포: ${JSON.stringify(grid.cellRoleDistribution)}`);
      console.log(`  내용 타입: ${JSON.stringify(grid.contentTypeDistribution)}`);

      if (grid.headerChainSamples.length > 0) {
        console.log('  헤더 체인 샘플:');
        for (const sample of grid.headerChainSamples) {
          console.log(`    ${sample}`);
        }
      }
    }
  }

  // 구조 추출 상세
  console.log('\n' + '─'.repeat(50));
  console.log('📋 구조 추출 결과');
  console.log('─'.repeat(50));

  const se = report.structureExtraction;
  console.log(`  파이프라인: ${se.pipeline}`);
  console.log(`  문서 타입: ${se.documentType}`);
  console.log(`  제목: ${se.title || '(없음)'}`);
  console.log(`  추출된 쌍: ${se.pairsCount}개`);
  console.log(`  관계: ${se.relationships}개 ${JSON.stringify(se.relationshipTypes)}`);
  console.log(`  특성: ${JSON.stringify(se.characteristics, null, 2)}`);

  if (se.samplePairs.length > 0) {
    console.log('  샘플:');
    for (const pair of se.samplePairs) {
      const addr = pair.gridAddress ? ` [${pair.gridAddress}]` : '';
      console.log(`    "${pair.header}"${addr} → "${pair.contentPreview}"`);
    }
  }

  // 프롬프트 인코딩
  if (report.promptEncoding.gridEncodings.length > 0) {
    console.log('\n' + '─'.repeat(50));
    console.log('💬 프롬프트 인코딩');
    console.log('─'.repeat(50));

    for (const enc of report.promptEncoding.gridEncodings) {
      console.log(`\n▸ 표 ${enc.tableIndex} (~${enc.tokenEstimate} 토큰):`);
      console.log(enc.encoded);
    }
  }

  // 이슈
  if (report.issues.length > 0) {
    console.log('\n' + '─'.repeat(50));
    console.log('⚠️  이슈');
    console.log('─'.repeat(50));

    for (const issue of report.issues) {
      const icon = { error: '❌', warning: '⚠️', info: 'ℹ️' }[issue.severity];
      console.log(`  ${icon} [${issue.category}] ${issue.message}`);
      if (issue.detail) console.log(`     ${issue.detail}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
}

// ─── Global access for browser console ───────────────────────────────────

export function registerGlobalDiagnostic(): void {
  if (typeof window !== 'undefined') {
    (window as any).__diagnoseDocument = diagnoseDocument;
    (window as any).__SemanticGridTools = {
      buildSemanticGrid,
      buildSemanticGridsForDocument,
      getFullHeaderLabel,
      getCellAddress,
    };
    console.log('🔧 진단 도구 등록 완료: window.__diagnoseDocument(document)');
  }
}

/**
 * 현재 열린 문서를 자동으로 진단
 * 브라우저 콘솔에서: window.__runDiagnostic()
 */
export function runDiagnosticOnCurrentDocument(): DiagnosticReport | null {
  if (typeof window === 'undefined') {
    console.error('브라우저 환경에서만 실행 가능합니다.');
    return null;
  }

  const viewer = (window as any).__hwpxViewer;
  if (!viewer) {
    console.error('뷰어 인스턴스를 찾을 수 없습니다. 문서를 먼저 로드하세요.');
    return null;
  }

  const doc = viewer.getDocument?.() || viewer.state?.document;
  if (!doc) {
    console.error('로드된 문서가 없습니다. 문서를 먼저 로드하세요.');
    return null;
  }

  return diagnoseDocument(doc);
}

// 자동 등록
registerGlobalDiagnostic();

if (typeof window !== 'undefined') {
  (window as any).__runDiagnostic = runDiagnosticOnCurrentDocument;
}

export default diagnoseDocument;
