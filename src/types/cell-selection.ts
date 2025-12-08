/**
 * Cell Selection Types
 * 셀 선택 및 레이아웃 추출을 위한 타입 정의
 * 
 * @module types/cell-selection
 * @version 1.0.0
 */

/**
 * 셀 역할
 * - keep: 유지할 셀 (제목, 헤더 등)
 * - generate: AI가 생성할 셀
 * - unselected: 선택되지 않음
 */
export type CellRole = 'keep' | 'generate' | 'unselected';

/**
 * 셀 선택 정보
 */
export interface CellSelection {
  // 셀 위치 (고유 식별자)
  section: number;
  table: number;
  row: number;
  col: number;
  
  // 셀 정보
  content: string;
  isHeader: boolean;  // 헤더로 감지되었는지
  
  // 셀 역할 (사용자 지정)
  role: CellRole;
  
  // 메타데이터
  timestamp?: number;
  
  // UI 관련
  displayName?: string;  // 표시용 이름
}

/**
 * 선택 모드 상태
 */
export interface SelectionMode {
  isActive: boolean;
  selections: Map<string, CellSelection>;
  defaultRole: CellRole;
  
  // UI 설정
  showTooltips: boolean;
  highlightRelated: boolean;  // 관련 셀 하이라이트
}

/**
 * 셀 선택 맥락 정보
 */
export interface SelectionContext {
  // 유지된 헤더들
  headers: CellSelection[];
  
  // 행별 헤더
  rowHeaders: Map<number, CellSelection[]>;
  
  // 열별 헤더
  colHeaders: Map<number, CellSelection[]>;
  
  // 패턴 감지
  pattern: 'row-header-content' | 'col-header-content' | 'matrix' | 'free-form';
}

/**
 * 생성 타겟 분석
 */
export interface TargetAnalysis {
  // 생성할 셀
  target: CellSelection;
  
  // 맥락 정보
  rowContext: CellSelection[];  // 같은 행의 유지된 셀들
  colContext: CellSelection[];  // 같은 열의 유지된 셀들
  
  // 추정 정보
  expectedLength: number;
  expectedStyle: 'detailed' | 'brief' | 'list';
  
  // 생성 힌트
  contextHint: string;  // "활동명의 세부 내용"
}

/**
 * 레이아웃 추출 옵션
 */
export interface LayoutExtractionOptions {
  // 자동 감지 옵션
  autoDetect: boolean;
  autoDetectHeaders: boolean;
  
  // 처리 옵션
  clearUnselectedCells: boolean;  // 선택 안 된 셀 삭제 여부
  preserveEmptyStructure: boolean;  // 빈 구조 유지
  
  // 최소 요구사항
  minKeepCells: number;  // 최소 유지 셀 개수
  minGenerateCells: number;  // 최소 생성 셀 개수
}

/**
 * 레이아웃 추출 결과
 */
export interface LayoutExtractionResult {
  // 결과 문서
  layoutDocument: any;  // HWPXDocument
  
  // 통계
  stats: {
    totalCells: number;
    keepCells: number;
    generateCells: number;
    clearedCells: number;
  };
  
  // 맥락 정보
  context: SelectionContext;
  
  // 타임스탬프
  timestamp: number;
}

/**
 * 셀 키 생성 유틸리티
 */
export function makeCellKey(
  section: number,
  table: number,
  row: number,
  col: number
): string {
  return `${section}-${table}-${row}-${col}`;
}

/**
 * 셀 키 파싱 유틸리티
 */
export function parseCellKey(key: string): {
  section: number;
  table: number;
  row: number;
  col: number;
} | null {
  const parts = key.split('-').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return null;
  }
  return {
    section: parts[0],
    table: parts[1],
    row: parts[2],
    col: parts[3]
  };
}

