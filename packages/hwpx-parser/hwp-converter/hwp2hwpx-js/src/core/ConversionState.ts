/**
 * ConversionState - 변환 세션 상태 관리
 *
 * 변환 과정에서 필요한 전역 상태를 관리합니다:
 * - ConversionContext: 경고/에러 수집
 * - IdValidator: ID 참조 검증
 * - 변환 설정
 */

import type { DocInfo } from '../adapters/IHwpParser';
import { ConversionContext, type DataLossLevel } from '../errors/ConversionErrors';
import { IdValidator, createIdValidator } from '../validation';
import { Logger } from '../util/Logger';

/**
 * 변환 세션 상태
 */
export interface ConversionSessionState {
    /** 변환 컨텍스트 (경고/에러 수집) */
    context: ConversionContext;
    /** ID 검증기 */
    idValidator: IdValidator | null;
    /** strict 모드 (ID 검증 실패 시 예외 발생) */
    strictMode: boolean;
    /** 상세 로깅 활성화 */
    verbose: boolean;
}

/**
 * 현재 세션 상태 (싱글톤)
 */
let currentSession: ConversionSessionState | null = null;

/**
 * 새 변환 세션 시작
 *
 * @param docInfo - 문서 정보 (ID 검증기 초기화용)
 * @param options - 세션 옵션
 * @returns 세션 상태
 *
 * @example
 * ```typescript
 * // 변환 시작 시
 * const session = startConversionSession(parsed.docInfo, { verbose: true });
 *
 * // 변환 중 ID 검증
 * const validCharShapeId = session.idValidator.validateCharShapeId(someId);
 *
 * // 변환 완료 후
 * const result = endConversionSession(hwpxBuffer);
 * console.log(result.statistics);
 * ```
 */
export function startConversionSession(
    docInfo?: DocInfo,
    options: { strictMode?: boolean; verbose?: boolean } = {}
): ConversionSessionState {
    const context = new ConversionContext();
    const idValidator = docInfo ? createIdValidator(docInfo) : null;

    currentSession = {
        context,
        idValidator,
        strictMode: options.strictMode ?? false,
        verbose: options.verbose ?? false
    };

    if (options.verbose) {
        Logger.debug('새 변환 세션 시작');
        if (idValidator) {
            const fontRange = idValidator.getRange('font');
            const charShapeRange = idValidator.getRange('charShape');
            const paraShapeRange = idValidator.getRange('paraShape');
            Logger.debug(`  - 폰트 ID: ${fontRange?.count ?? 0}개 (${fontRange?.min ?? 0}-${fontRange?.max ?? 0})`);
            Logger.debug(`  - 글자 모양 ID: ${charShapeRange?.count ?? 0}개`);
            Logger.debug(`  - 문단 모양 ID: ${paraShapeRange?.count ?? 0}개`);
        }
    }

    return currentSession;
}

/**
 * 변환 세션 종료 및 결과 반환
 */
export function endConversionSession(hwpxBuffer: Uint8Array | null): {
    success: boolean;
    buffer: Uint8Array | null;
    report: string;
    idValidationReport?: string;
} {
    if (!currentSession) {
        return {
            success: hwpxBuffer !== null,
            buffer: hwpxBuffer,
            report: '변환 세션이 시작되지 않았습니다.'
        };
    }

    const result = currentSession.context.finalize(hwpxBuffer);
    const report = currentSession.context.generateQualityReport();
    const idValidationReport = currentSession.idValidator?.generateReport();

    if (currentSession.verbose) {
        Logger.debug('\n' + report);
        if (idValidationReport) {
            Logger.debug('\n' + idValidationReport);
        }
    }

    currentSession = null;

    return {
        success: result.success,
        buffer: hwpxBuffer,
        report,
        idValidationReport
    };
}

/**
 * 현재 세션 가져오기
 */
export function getCurrentSession(): ConversionSessionState | null {
    return currentSession;
}

/**
 * 현재 컨텍스트 가져오기 (없으면 새로 생성)
 */
export function getContext(): ConversionContext {
    if (!currentSession) {
        // 세션 없이도 동작하도록 임시 컨텍스트 생성
        return new ConversionContext();
    }
    return currentSession.context;
}

/**
 * 현재 ID 검증기 가져오기
 */
export function getIdValidator(): IdValidator | null {
    return currentSession?.idValidator ?? null;
}

// ============================================
// 편의 함수들 - 직접 ID 검증
// ============================================

/**
 * CharShape ID 검증 (세션 컨텍스트 사용)
 */
export function validateCharShapeId(id: number, defaultId: number = 0): number {
    if (!currentSession?.idValidator) return id;

    return currentSession.idValidator.validateWithContext(
        currentSession.context,
        'charShape',
        id,
        defaultId,
        'minimal'
    );
}

/**
 * ParaShape ID 검증 (세션 컨텍스트 사용)
 */
export function validateParaShapeId(id: number, defaultId: number = 0): number {
    if (!currentSession?.idValidator) return id;

    return currentSession.idValidator.validateWithContext(
        currentSession.context,
        'paraShape',
        id,
        defaultId,
        'minimal'
    );
}

/**
 * Style ID 검증 (세션 컨텍스트 사용)
 */
export function validateStyleId(id: number, defaultId: number = 0): number {
    if (!currentSession?.idValidator) return id;

    return currentSession.idValidator.validateWithContext(
        currentSession.context,
        'style',
        id,
        defaultId,
        'minimal'
    );
}

/**
 * Font ID 검증 (세션 컨텍스트 사용)
 */
export function validateFontId(id: number, defaultId: number = 0): number {
    if (!currentSession?.idValidator) return id;

    return currentSession.idValidator.validateWithContext(
        currentSession.context,
        'font',
        id,
        defaultId,
        'minimal'
    );
}

/**
 * BorderFill ID 검증 (세션 컨텍스트 사용)
 */
export function validateBorderFillId(id: number, defaultId: number = 1): number {
    if (!currentSession?.idValidator) return id;

    return currentSession.idValidator.validateWithContext(
        currentSession.context,
        'borderFill',
        id,
        defaultId,
        'minimal'
    );
}

/**
 * TabDef ID 검증 (세션 컨텍스트 사용)
 */
export function validateTabDefId(id: number, defaultId: number = 0): number {
    if (!currentSession?.idValidator) return id;

    return currentSession.idValidator.validateWithContext(
        currentSession.context,
        'tabDef',
        id,
        defaultId,
        'none'
    );
}

// ============================================
// 경고/에러 추가 편의 함수
// ============================================

/**
 * 경고 추가
 */
export function addWarning(
    code: string,
    message: string,
    dataLoss: DataLossLevel = 'none',
    details?: Record<string, unknown>
): void {
    if (!currentSession) return;
    currentSession.context.addWarning(code, message, dataLoss, details);
}

/**
 * 위치 컨텍스트 설정
 */
export function pushLocation(location: string): void {
    currentSession?.context.pushLocation(location);
}

/**
 * 위치 컨텍스트 해제
 */
export function popLocation(): void {
    currentSession?.context.popLocation();
}

/**
 * 위치 컨텍스트 내에서 작업 실행
 */
export function withLocation<T>(location: string, fn: () => T): T {
    if (!currentSession) return fn();
    return currentSession.context.withLocation(location, fn);
}

/**
 * 통계 증가
 */
export function incrementStat(
    stat: 'sectionCount' | 'paragraphCount' | 'tableCount' |
          'imageCount' | 'shapeCount' | 'equationCount' | 'chartCount' |
          'recordsParsed' | 'recordsSkipped',
    amount: number = 1
): void {
    currentSession?.context.incrementStat(stat, amount);
}
