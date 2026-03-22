/**
 * HWP 파서 어댑터 모듈
 *
 * 추상화된 HWP 파싱 인터페이스와 어댑터 구현체 제공
 */

// 인터페이스 및 타입 export
export type {
    IHwpParser,
    ParsedHwp,
    DocInfo,
    RawDocInfo,
    EnhancedSection,
    EnhancedParagraph,
    EnhancedRun,
    CharPosShapeEntry,
    DocumentProperties,
    IdMappings,
    FontFace,
    BorderFill,
    Border,
    FillInfo,
    CharShape,
    TabDef,
    TabItem,
    Numbering,
    Bullet,
    ParaShape,
    Style,
    MemoShape,
    TrackChange,
    TrackChangeAuthor,
    BinDataItem,
    SummaryInfo,
    HwpRecord,
    ParserCapabilities,
    PageBorderFill
} from './IHwpParser';

// 상수 export
export {
    HWP_TAG_ID,
    HWPLIB_CAPABILITIES,
    ENHANCED_CAPABILITIES
} from './IHwpParser';

// 어댑터 구현체 export
export { HwplibAdapter, createHwplibAdapter } from './HwplibAdapter';
export { EnhancedAdapter, createEnhancedAdapterInstance } from './EnhancedAdapter';

// 기본 파서 팩토리
import { HwplibAdapter } from './HwplibAdapter';
import { EnhancedAdapter } from './EnhancedAdapter';
import type { IHwpParser } from './IHwpParser';
import { Logger } from '../util/Logger';

/**
 * 기본 HWP 파서 생성
 *
 * EnhancedAdapter를 기본으로 사용:
 * - CharPosShape 완전 파싱 (문단 내 스타일 변경점)
 * - 모든 테이블/문단 추출
 * - 셀 속성 완전 파싱 (vertAlign, textDirection, margin 등)
 * - 가비지 문자 제거
 *
 * USE_LEGACY_PARSER=true 환경변수로 HwplibAdapter 사용 가능 (폴백)
 */
export function createDefaultParser(): IHwpParser {
    // 환경변수로 레거시 파서 사용 가능 (폴백)
    if (typeof process !== 'undefined' && process.env?.USE_LEGACY_PARSER === 'true') {
        Logger.info('Using HwplibAdapter (legacy fallback)');
        return new HwplibAdapter();
    }
    return new EnhancedAdapter();
}

/**
 * 향상된 파서 생성
 * CharPosShape, 전체 테이블/문단 파싱 지원
 */
export function createEnhancedParser(): IHwpParser {
    return new EnhancedAdapter();
}
