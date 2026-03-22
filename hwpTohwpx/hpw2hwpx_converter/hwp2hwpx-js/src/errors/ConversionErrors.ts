/**
 * HWP → HWPX 변환 오류 클래스
 *
 * 변환 과정에서 발생하는 다양한 오류 유형을 정의
 */

/**
 * 기본 변환 오류 클래스
 */
export class ConversionError extends Error {
    public readonly code: string;
    public readonly location?: string;
    public readonly details?: Record<string, unknown>;

    constructor(
        code: string,
        message: string,
        location?: string,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ConversionError';
        this.code = code;
        this.location = location;
        this.details = details;

        // ES5 호환성을 위한 프로토타입 체인 복원
        Object.setPrototypeOf(this, ConversionError.prototype);
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            location: this.location,
            details: this.details
        };
    }
}

/**
 * 버퍼 언더플로우 오류 - 읽기 위치가 버퍼 범위를 초과
 */
export class BufferUnderflowError extends ConversionError {
    public readonly offset: number;
    public readonly bufferLength: number;
    public readonly requestedBytes: number;

    constructor(
        offset: number,
        bufferLength: number,
        requestedBytes: number,
        location?: string
    ) {
        super(
            'BUFFER_UNDERFLOW',
            `버퍼 언더플로우: offset=${offset}, 요청=${requestedBytes}바이트, 버퍼크기=${bufferLength}`,
            location,
            { offset, bufferLength, requestedBytes }
        );
        this.name = 'BufferUnderflowError';
        this.offset = offset;
        this.bufferLength = bufferLength;
        this.requestedBytes = requestedBytes;

        Object.setPrototypeOf(this, BufferUnderflowError.prototype);
    }
}

/**
 * 잘못된 레코드 오류 - HWP 레코드 구조가 잘못됨
 */
export class InvalidRecordError extends ConversionError {
    public readonly tagId: number;
    public readonly recordOffset: number;

    constructor(
        tagId: number,
        recordOffset: number,
        message: string,
        location?: string
    ) {
        super(
            'INVALID_RECORD',
            `잘못된 레코드(TagID=${tagId}): ${message}`,
            location,
            { tagId, recordOffset }
        );
        this.name = 'InvalidRecordError';
        this.tagId = tagId;
        this.recordOffset = recordOffset;

        Object.setPrototypeOf(this, InvalidRecordError.prototype);
    }
}

/**
 * ID 참조 오류 - 참조하는 ID가 존재하지 않음
 */
export class InvalidIdReferenceError extends ConversionError {
    public readonly idType: string;
    public readonly invalidId: number;
    public readonly validRange?: { min: number; max: number };

    constructor(
        idType: string,
        invalidId: number,
        validRange?: { min: number; max: number },
        location?: string
    ) {
        const rangeStr = validRange ? ` (유효 범위: ${validRange.min}-${validRange.max})` : '';
        super(
            'INVALID_ID_REFERENCE',
            `유효하지 않은 ${idType} ID: ${invalidId}${rangeStr}`,
            location,
            { idType, invalidId, validRange }
        );
        this.name = 'InvalidIdReferenceError';
        this.idType = idType;
        this.invalidId = invalidId;
        this.validRange = validRange;

        Object.setPrototypeOf(this, InvalidIdReferenceError.prototype);
    }
}

/**
 * 지원되지 않는 기능 오류
 */
export class UnsupportedFeatureError extends ConversionError {
    public readonly feature: string;
    public readonly hwpVersion?: string;

    constructor(
        feature: string,
        hwpVersion?: string,
        location?: string
    ) {
        super(
            'UNSUPPORTED_FEATURE',
            `지원되지 않는 기능: ${feature}${hwpVersion ? ` (HWP ${hwpVersion})` : ''}`,
            location,
            { feature, hwpVersion }
        );
        this.name = 'UnsupportedFeatureError';
        this.feature = feature;
        this.hwpVersion = hwpVersion;

        Object.setPrototypeOf(this, UnsupportedFeatureError.prototype);
    }
}

/**
 * 데이터 손실 경고 수준
 */
export type DataLossLevel = 'none' | 'minimal' | 'partial' | 'significant' | 'complete';

/**
 * 변환 경고
 */
export interface ConversionWarning {
    code: string;
    message: string;
    location?: string;
    dataLoss: DataLossLevel;
    details?: Record<string, unknown>;
    timestamp: number;
}

/**
 * 변환 통계
 */
export interface ConversionStatistics {
    // 구조 통계
    sectionCount: number;
    paragraphCount: number;
    tableCount: number;
    imageCount: number;
    shapeCount: number;
    equationCount: number;
    chartCount: number;

    // 처리 통계
    recordsParsed: number;
    recordsSkipped: number;
    bytesProcessed: number;

    // 품질 지표
    warningCount: number;
    errorCount: number;
    dataLossInstances: number;

    // 시간
    startTime: number;
    endTime?: number;
    durationMs?: number;
}

/**
 * 변환 결과
 */
export interface ConversionResult {
    success: boolean;
    hwpxBuffer: Uint8Array | null;
    warnings: ConversionWarning[];
    errors: ConversionError[];
    statistics: ConversionStatistics;
}

/**
 * 변환 컨텍스트 - 변환 중 상태 및 경고/오류 수집
 */
export class ConversionContext {
    private _warnings: ConversionWarning[] = [];
    private _errors: ConversionError[] = [];
    private _statistics: ConversionStatistics;
    private _locationStack: string[] = [];

    constructor() {
        this._statistics = {
            sectionCount: 0,
            paragraphCount: 0,
            tableCount: 0,
            imageCount: 0,
            shapeCount: 0,
            equationCount: 0,
            chartCount: 0,
            recordsParsed: 0,
            recordsSkipped: 0,
            bytesProcessed: 0,
            warningCount: 0,
            errorCount: 0,
            dataLossInstances: 0,
            startTime: Date.now()
        };
    }

    /**
     * 현재 위치 문자열
     */
    get currentLocation(): string {
        return this._locationStack.join('/') || 'document';
    }

    /**
     * 위치 스택에 추가
     */
    pushLocation(location: string): void {
        this._locationStack.push(location);
    }

    /**
     * 위치 스택에서 제거
     */
    popLocation(): void {
        this._locationStack.pop();
    }

    /**
     * 위치 컨텍스트 내에서 작업 실행
     */
    withLocation<T>(location: string, fn: () => T): T {
        this.pushLocation(location);
        try {
            return fn();
        } finally {
            this.popLocation();
        }
    }

    /**
     * 경고 추가
     */
    addWarning(
        code: string,
        message: string,
        dataLoss: DataLossLevel = 'none',
        details?: Record<string, unknown>
    ): void {
        this._warnings.push({
            code,
            message,
            location: this.currentLocation,
            dataLoss,
            details,
            timestamp: Date.now()
        });
        this._statistics.warningCount++;

        if (dataLoss !== 'none') {
            this._statistics.dataLossInstances++;
        }
    }

    /**
     * 오류 추가
     */
    addError(error: ConversionError): void {
        this._errors.push(error);
        this._statistics.errorCount++;
    }

    /**
     * 통계 증가
     */
    incrementStat(
        stat: 'sectionCount' | 'paragraphCount' | 'tableCount' |
              'imageCount' | 'shapeCount' | 'equationCount' | 'chartCount' |
              'recordsParsed' | 'recordsSkipped',
        amount: number = 1
    ): void {
        this._statistics[stat] += amount;
    }

    /**
     * 바이트 처리량 추가
     */
    addBytesProcessed(bytes: number): void {
        this._statistics.bytesProcessed += bytes;
    }

    /**
     * 경고 목록
     */
    get warnings(): ConversionWarning[] {
        return [...this._warnings];
    }

    /**
     * 오류 목록
     */
    get errors(): ConversionError[] {
        return [...this._errors];
    }

    /**
     * 통계
     */
    get statistics(): ConversionStatistics {
        return { ...this._statistics };
    }

    /**
     * 심각한 오류가 있는지 확인
     */
    get hasCriticalErrors(): boolean {
        return this._errors.length > 0;
    }

    /**
     * 데이터 손실이 있는지 확인
     */
    get hasDataLoss(): boolean {
        return this._warnings.some(w =>
            w.dataLoss === 'significant' || w.dataLoss === 'complete'
        );
    }

    /**
     * 변환 완료 및 결과 생성
     */
    finalize(hwpxBuffer: Uint8Array | null): ConversionResult {
        this._statistics.endTime = Date.now();
        this._statistics.durationMs = this._statistics.endTime - this._statistics.startTime;

        return {
            success: hwpxBuffer !== null && !this.hasCriticalErrors,
            hwpxBuffer,
            warnings: this.warnings,
            errors: this.errors,
            statistics: this.statistics
        };
    }

    /**
     * 품질 리포트 생성
     */
    generateQualityReport(): string {
        const stats = this._statistics;
        const lines: string[] = [
            '='.repeat(60),
            '  HWP → HWPX 변환 품질 리포트',
            '='.repeat(60),
            '',
            '[ 문서 구조 ]',
            `  섹션: ${stats.sectionCount}`,
            `  문단: ${stats.paragraphCount}`,
            `  표: ${stats.tableCount}`,
            `  이미지: ${stats.imageCount}`,
            `  도형: ${stats.shapeCount}`,
            `  수식: ${stats.equationCount}`,
            `  차트: ${stats.chartCount}`,
            '',
            '[ 처리 통계 ]',
            `  파싱된 레코드: ${stats.recordsParsed}`,
            `  스킵된 레코드: ${stats.recordsSkipped}`,
            `  처리된 바이트: ${(stats.bytesProcessed / 1024).toFixed(2)} KB`,
            `  처리 시간: ${stats.durationMs ?? 0} ms`,
            '',
            '[ 품질 지표 ]',
            `  경고: ${stats.warningCount}개`,
            `  오류: ${stats.errorCount}개`,
            `  데이터 손실 항목: ${stats.dataLossInstances}개`,
        ];

        if (this._warnings.length > 0) {
            lines.push('', '[ 경고 상세 ]');
            const grouped = this.groupWarningsByCode();
            for (const [code, warnings] of Object.entries(grouped)) {
                lines.push(`  ${code}: ${warnings.length}건`);
                if (warnings.length <= 3) {
                    warnings.forEach(w => lines.push(`    - ${w.message}`));
                } else {
                    warnings.slice(0, 2).forEach(w => lines.push(`    - ${w.message}`));
                    lines.push(`    ... 외 ${warnings.length - 2}건`);
                }
            }
        }

        if (this._errors.length > 0) {
            lines.push('', '[ 오류 상세 ]');
            this._errors.forEach(e => {
                lines.push(`  [${e.code}] ${e.message}`);
                if (e.location) lines.push(`    위치: ${e.location}`);
            });
        }

        lines.push('', '='.repeat(60));
        return lines.join('\n');
    }

    private groupWarningsByCode(): Record<string, ConversionWarning[]> {
        const grouped: Record<string, ConversionWarning[]> = {};
        for (const warning of this._warnings) {
            if (!grouped[warning.code]) {
                grouped[warning.code] = [];
            }
            grouped[warning.code].push(warning);
        }
        return grouped;
    }
}

/**
 * 전역 컨텍스트 (선택적 사용)
 */
let globalContext: ConversionContext | null = null;

export function getGlobalContext(): ConversionContext | null {
    return globalContext;
}

export function setGlobalContext(ctx: ConversionContext | null): void {
    globalContext = ctx;
}

export function createContext(): ConversionContext {
    return new ConversionContext();
}
