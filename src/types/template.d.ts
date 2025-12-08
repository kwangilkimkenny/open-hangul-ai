/**
 * Template Type Definitions
 * HWPX 템플릿 생성 및 관리를 위한 타입 정의
 * 
 * @module types/template
 * @version 1.0.0
 */

import type { HWPXDocument, HWPXSection, HWPXPageSettings, HWPXTextStyle } from './hwpx';

// =============================================
// Document Structure Analysis
// =============================================

/**
 * 문서 구조 분석 결과
 */
export interface DocumentStructure {
  // 문서 메타데이터
  pageCount: number;
  sectionCount: number;
  
  // 표 정보
  hasTables: boolean;
  tableCount: number;
  tableLayouts: TableLayout[];
  
  // 제목 정보
  hasTitles: boolean;
  titleCount: number;
  titles: TitleInfo[];
  
  // 이미지/도형
  hasImages: boolean;
  imageCount: number;
  imagePositions: ElementPosition[];
  
  hasShapes: boolean;
  shapeCount: number;
  shapePositions: ElementPosition[];
  
  // 텍스트 통계
  paragraphCount: number;
  totalTextLength: number;
  avgParagraphLength: number;
  
  // 페이지 설정
  pageSettings: HWPXPageSettings[];
}

/**
 * 표 레이아웃 정보
 */
export interface TableLayout {
  // 위치 정보
  sectionIndex: number;
  elementIndex: number;
  
  // 구조 정보
  rowCount: number;
  colCount: number;
  cellCount: number;
  
  // 헤더 정보
  hasHeaders: boolean;
  headerRowCount: number;
  headerColCount: number;
  
  // 셀 타입 매트릭스
  cellTypes: CellType[][];
  
  // 병합 셀 정보
  mergedCells: MergedCellInfo[];
  
  // 스타일 정보
  hasBorders: boolean;
  hasBackgroundColors: boolean;
}

/**
 * 셀 타입
 */
export type CellType = 
  | 'header'      // 헤더 셀
  | 'data'        // 데이터 셀
  | 'merged'      // 병합된 셀 (콘텐츠 없음)
  | 'empty'       // 빈 셀
  | 'calculated'; // 계산식 포함 셀

/**
 * 병합 셀 정보
 */
export interface MergedCellInfo {
  startRow: number;
  startCol: number;
  rowSpan: number;
  colSpan: number;
}

/**
 * 제목 정보
 */
export interface TitleInfo {
  // 위치 정보
  sectionIndex: number;
  elementIndex: number;
  
  // 제목 특성
  level: number;              // 제목 수준 (1-9, 휴리스틱 기반)
  confidence: number;         // 제목일 확률 (0-100)
  
  // 스타일
  style: HWPXTextStyle;
  alignment: 'left' | 'center' | 'right' | 'justify';
  
  // 내용
  originalText: string;
  textLength: number;
  
  // 템플릿 변환
  placeholder: string;        // 템플릿에서 사용할 플레이스홀더
}

/**
 * 요소 위치 정보
 */
export interface ElementPosition {
  sectionIndex: number;
  elementIndex: number;
  type: 'image' | 'shape' | 'table' | 'paragraph';
}

// =============================================
// Template Generation
// =============================================

/**
 * 템플릿 생성 옵션
 */
export interface TemplateOptions {
  // 제목 처리
  keepTitles: boolean;              // 제목 유지 여부
  titlePlaceholder: string;         // 제목 플레이스홀더 템플릿
  
  // 표 처리
  keepTableHeaders: boolean;        // 표 헤더 유지
  keepTableStructure: boolean;      // 표 구조 유지 (빈 셀)
  clearDataCells: boolean;          // 데이터 셀 비우기
  
  // 이미지/도형
  keepImages: boolean;              // 이미지 유지
  keepShapes: boolean;              // 도형 유지
  
  // 페이지 설정
  keepPageSettings: boolean;        // 페이지 설정 유지
  keepHeaderFooter: boolean;        // 머리글/바닥글 유지
  
  // 기타
  cellPlaceholder: string;          // 빈 셀 플레이스홀더
  preserveFormatting: boolean;      // 서식 보존 (폰트, 정렬 등)
  
  // 고급 옵션
  minTitleConfidence: number;       // 제목 감지 최소 신뢰도 (0-100)
  detectFormulas: boolean;          // 수식 감지 및 유지
}

/**
 * 템플릿 생성 결과
 */
export interface TemplateGenerationResult {
  success: boolean;
  template: HWPXDocument | null;
  metadata: TemplateMetadata | null;
  structure: DocumentStructure;
  
  // 통계
  statistics: TemplateStatistics;
  
  // 에러
  errors: TemplateError[];
  warnings: TemplateWarning[];
}

/**
 * 템플릿 통계
 */
export interface TemplateStatistics {
  // 처리된 요소
  processedElements: number;
  preservedElements: number;
  removedElements: number;
  
  // 텍스트 통계
  originalTextLength: number;
  templateTextLength: number;
  reductionRate: number;          // 감소율 (%)
  
  // 구조 통계
  preservedTables: number;
  preservedImages: number;
  preservedShapes: number;
  
  // 처리 시간
  analysisTimeMs: number;
  generationTimeMs: number;
  totalTimeMs: number;
}

/**
 * 템플릿 에러
 */
export interface TemplateError {
  code: string;
  message: string;
  sectionIndex?: number;
  elementIndex?: number;
  severity: 'error' | 'warning';
}

/**
 * 템플릿 경고
 */
export interface TemplateWarning {
  message: string;
  type: 'structure' | 'content' | 'formatting';
  affectedElements: number;
}

// =============================================
// Template Management
// =============================================

/**
 * 템플릿 메타데이터
 */
export interface TemplateMetadata {
  // 식별 정보
  id: string;
  name: string;
  description?: string;
  
  // 원본 정보
  originalFileName: string;
  originalFileSize?: number;
  
  // 생성 정보
  createdAt: Date;
  createdBy?: string;
  version: string;
  
  // 문서 특성
  structure: DocumentStructure;
  options: TemplateOptions;
  
  // 미리보기
  thumbnail?: string;             // Base64 인코딩 이미지
  preview?: TemplatePreview;
  
  // 태그 및 분류
  tags?: string[];
  category?: string;
}

/**
 * 템플릿 미리보기 정보
 */
export interface TemplatePreview {
  pageCount: number;
  firstPageThumbnail?: string;
  sampleText?: string;
  features: string[];              // ["표 2개", "제목 3개", "이미지 1개"]
}

/**
 * 템플릿 필터 옵션
 */
export interface TemplateFilter {
  searchQuery?: string;
  tags?: string[];
  category?: string;
  hasTable?: boolean;
  hasImage?: boolean;
  sortBy?: 'name' | 'date' | 'usage';
  sortOrder?: 'asc' | 'desc';
}

// =============================================
// Title Detection
// =============================================

/**
 * 제목 감지 설정
 */
export interface TitleDetectionConfig {
  // 폰트 크기 기준
  minFontSize: number;              // 최소 폰트 크기 (pt)
  titleFontSizeThreshold: number;   // 제목 판단 기준 (pt)
  
  // 스타일 가중치
  boldWeight: number;               // 볼드 가중치
  centerAlignWeight: number;        // 중앙 정렬 가중치
  positionWeight: number;           // 위치 가중치
  lengthWeight: number;             // 길이 가중치
  
  // 제목 조건
  maxTitleLength: number;           // 최대 제목 길이
  minConfidence: number;            // 최소 신뢰도
}

/**
 * 제목 후보
 */
export interface TitleCandidate extends TitleInfo {
  score: number;                    // 종합 점수
  scoreBreakdown: {
    fontSize: number;
    bold: number;
    alignment: number;
    position: number;
    length: number;
  };
}

// =============================================
// Export
// =============================================

export type {
  CellType,
  DocumentStructure,
  ElementPosition,
  MergedCellInfo,
  TableLayout,
  TemplateError,
  TemplateFilter,
  TemplateGenerationResult,
  TemplateMetadata,
  TemplateOptions,
  TemplatePreview,
  TemplateStatistics,
  TemplateWarning,
  TitleCandidate,
  TitleDetectionConfig,
  TitleInfo,
};

