/**
 * Validation 모듈
 *
 * HWP → HWPX 변환 과정에서의 데이터 검증 기능 제공
 */

// ID 참조 검증
export {
    IdValidator,
    createIdValidator,
    type IdValidationResult,
    type IdValidationStats,
    type IdRange
} from './IdValidator';
