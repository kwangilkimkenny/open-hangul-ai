/**
 * HwpUnit.ts - HWP 단위 정밀도 보존
 *
 * Phase 4.3: 숫자 정밀도 보존
 * - 반올림 없이 원본 값 유지
 * - 단위 변환 유틸리티
 * - 정밀 계산 지원
 *
 * HWP에서 사용하는 단위 체계:
 * - HWPUNIT: 1/7200 inch (기본 단위)
 * - 1 inch = 7200 HWPUNIT
 * - 1 mm = 283.46 HWPUNIT (7200 / 25.4)
 * - 1 pt = 100 HWPUNIT (1 point = 1/72 inch)
 *
 * @module Util
 * @category Unit
 */

/**
 * 단위 변환 상수
 */
export const HWPUNIT_CONSTANTS = {
    /** 1 inch = 7200 HWPUNIT */
    PER_INCH: 7200,
    /** 1 mm = 7200 / 25.4 HWPUNIT */
    PER_MM: 7200 / 25.4,
    /** 1 cm = 7200 / 2.54 HWPUNIT */
    PER_CM: 7200 / 2.54,
    /** 1 pt = 100 HWPUNIT */
    PER_PT: 100,
    /** 1 pc (pica) = 1200 HWPUNIT (1 pica = 12 points) */
    PER_PC: 1200,
    /** 1 emu (English Metric Unit) ≈ 0.079 HWPUNIT (914400 EMU = 1 inch) */
    EMU_PER_HWPUNIT: 914400 / 7200,
} as const;

/**
 * HwpUnit 클래스
 * HWP 단위 값을 정밀하게 저장하고 변환
 */
export class HwpUnit {
    /** 원본 HWPUNIT 값 (정밀도 보존) */
    private readonly _value: number;

    /**
     * HwpUnit 생성자
     * @param hwpunit HWPUNIT 값
     */
    constructor(hwpunit: number) {
        this._value = hwpunit;
    }

    /**
     * 원본 값 반환 (정밀도 유지)
     */
    get value(): number {
        return this._value;
    }

    /**
     * 문자열 변환 (반올림 없이)
     */
    toString(): string {
        return this._value.toString();
    }

    /**
     * 정수 변환 (반올림)
     */
    toInt(): number {
        return Math.round(this._value);
    }

    /**
     * 내림 정수 변환
     */
    toIntFloor(): number {
        return Math.floor(this._value);
    }

    /**
     * 올림 정수 변환
     */
    toIntCeil(): number {
        return Math.ceil(this._value);
    }

    /**
     * mm 변환 (정밀)
     */
    toMm(): number {
        return this._value / HWPUNIT_CONSTANTS.PER_MM;
    }

    /**
     * cm 변환 (정밀)
     */
    toCm(): number {
        return this._value / HWPUNIT_CONSTANTS.PER_CM;
    }

    /**
     * inch 변환 (정밀)
     */
    toInch(): number {
        return this._value / HWPUNIT_CONSTANTS.PER_INCH;
    }

    /**
     * pt (point) 변환 (정밀)
     */
    toPt(): number {
        return this._value / HWPUNIT_CONSTANTS.PER_PT;
    }

    /**
     * EMU (English Metric Unit) 변환
     */
    toEmu(): number {
        return this._value * HWPUNIT_CONSTANTS.EMU_PER_HWPUNIT;
    }

    /**
     * 스케일 적용 (새 HwpUnit 반환)
     * @param factor 스케일 팩터
     */
    scale(factor: number): HwpUnit {
        return new HwpUnit(this._value * factor);
    }

    /**
     * 덧셈
     * @param other 더할 값 또는 HwpUnit
     */
    add(other: HwpUnit | number): HwpUnit {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return new HwpUnit(this._value + otherValue);
    }

    /**
     * 뺄셈
     * @param other 뺄 값 또는 HwpUnit
     */
    subtract(other: HwpUnit | number): HwpUnit {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return new HwpUnit(this._value - otherValue);
    }

    /**
     * 곱셈
     * @param factor 곱할 값
     */
    multiply(factor: number): HwpUnit {
        return new HwpUnit(this._value * factor);
    }

    /**
     * 나눗셈
     * @param divisor 나눌 값
     */
    divide(divisor: number): HwpUnit {
        if (divisor === 0) {
            throw new Error('Division by zero');
        }
        return new HwpUnit(this._value / divisor);
    }

    /**
     * 절대값
     */
    abs(): HwpUnit {
        return new HwpUnit(Math.abs(this._value));
    }

    /**
     * 0인지 확인
     */
    isZero(): boolean {
        return this._value === 0;
    }

    /**
     * 양수인지 확인
     */
    isPositive(): boolean {
        return this._value > 0;
    }

    /**
     * 음수인지 확인
     */
    isNegative(): boolean {
        return this._value < 0;
    }

    /**
     * 비교 (같음)
     * @param other 비교할 값
     * @param tolerance 허용 오차 (기본: 0.001)
     */
    equals(other: HwpUnit | number, tolerance: number = 0.001): boolean {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return Math.abs(this._value - otherValue) <= tolerance;
    }

    /**
     * 비교 (보다 큼)
     * @param other 비교할 값
     */
    greaterThan(other: HwpUnit | number): boolean {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return this._value > otherValue;
    }

    /**
     * 비교 (보다 작음)
     * @param other 비교할 값
     */
    lessThan(other: HwpUnit | number): boolean {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return this._value < otherValue;
    }

    /**
     * 최솟값
     * @param other 비교할 값
     */
    min(other: HwpUnit | number): HwpUnit {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return new HwpUnit(Math.min(this._value, otherValue));
    }

    /**
     * 최댓값
     * @param other 비교할 값
     */
    max(other: HwpUnit | number): HwpUnit {
        const otherValue = other instanceof HwpUnit ? other._value : other;
        return new HwpUnit(Math.max(this._value, otherValue));
    }

    /**
     * 범위 제한 (clamp)
     * @param min 최솟값
     * @param max 최댓값
     */
    clamp(min: HwpUnit | number, max: HwpUnit | number): HwpUnit {
        const minValue = min instanceof HwpUnit ? min._value : min;
        const maxValue = max instanceof HwpUnit ? max._value : max;
        return new HwpUnit(Math.max(minValue, Math.min(maxValue, this._value)));
    }

    // === 정적 팩토리 메서드 ===

    /**
     * mm 값으로부터 생성
     * @param mm 밀리미터 값
     */
    static fromMm(mm: number): HwpUnit {
        return new HwpUnit(mm * HWPUNIT_CONSTANTS.PER_MM);
    }

    /**
     * cm 값으로부터 생성
     * @param cm 센티미터 값
     */
    static fromCm(cm: number): HwpUnit {
        return new HwpUnit(cm * HWPUNIT_CONSTANTS.PER_CM);
    }

    /**
     * inch 값으로부터 생성
     * @param inch 인치 값
     */
    static fromInch(inch: number): HwpUnit {
        return new HwpUnit(inch * HWPUNIT_CONSTANTS.PER_INCH);
    }

    /**
     * pt (point) 값으로부터 생성
     * @param pt 포인트 값
     */
    static fromPt(pt: number): HwpUnit {
        return new HwpUnit(pt * HWPUNIT_CONSTANTS.PER_PT);
    }

    /**
     * EMU 값으로부터 생성
     * @param emu EMU 값
     */
    static fromEmu(emu: number): HwpUnit {
        return new HwpUnit(emu / HWPUNIT_CONSTANTS.EMU_PER_HWPUNIT);
    }

    /**
     * 0 HWPUNIT
     */
    static zero(): HwpUnit {
        return new HwpUnit(0);
    }

    /**
     * 여러 HwpUnit의 합계
     * @param units HwpUnit 배열
     */
    static sum(...units: (HwpUnit | number)[]): HwpUnit {
        let total = 0;
        for (const unit of units) {
            total += unit instanceof HwpUnit ? unit._value : unit;
        }
        return new HwpUnit(total);
    }

    /**
     * 여러 HwpUnit의 평균
     * @param units HwpUnit 배열
     */
    static average(...units: (HwpUnit | number)[]): HwpUnit {
        if (units.length === 0) return HwpUnit.zero();
        return HwpUnit.sum(...units).divide(units.length);
    }
}

/**
 * HWPUNIT 값을 정밀하게 문자열로 변환
 * @param value HWPUNIT 값
 * @param precision 소수점 자릿수 (기본: undefined - 정밀도 유지)
 */
export function hwpunitToString(value: number, precision?: number): string {
    if (precision !== undefined) {
        return value.toFixed(precision);
    }
    return value.toString();
}

/**
 * HWPUNIT 값을 mm로 변환
 * @param hwpunit HWPUNIT 값
 */
export function hwpunitToMm(hwpunit: number): number {
    return hwpunit / HWPUNIT_CONSTANTS.PER_MM;
}

/**
 * mm 값을 HWPUNIT으로 변환
 * @param mm mm 값
 */
export function mmToHwpunit(mm: number): number {
    return mm * HWPUNIT_CONSTANTS.PER_MM;
}

/**
 * HWPUNIT 값을 pt로 변환
 * @param hwpunit HWPUNIT 값
 */
export function hwpunitToPt(hwpunit: number): number {
    return hwpunit / HWPUNIT_CONSTANTS.PER_PT;
}

/**
 * pt 값을 HWPUNIT으로 변환
 * @param pt pt 값
 */
export function ptToHwpunit(pt: number): number {
    return pt * HWPUNIT_CONSTANTS.PER_PT;
}

/**
 * 정밀도를 유지하면서 스케일 적용
 * @param value 원본 값
 * @param scale 스케일 팩터
 */
export function scaleWithPrecision(value: number, scale: number): number {
    return value * scale;
}

/**
 * 정밀도를 유지하면서 정수로 변환 (필요시에만)
 * XML 출력 등에서 정수가 필요한 경우에만 사용
 * @param value 원본 값
 */
export function toIntIfNeeded(value: number): number | string {
    if (Number.isInteger(value)) {
        return value;
    }
    // 소수점 이하가 매우 작으면 반올림
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 0.0001) {
        return rounded;
    }
    // 아니면 문자열로 정밀도 유지
    return value.toString();
}

/**
 * 폰트 크기 단위 변환 (HWPUNIT -> pt)
 * 폰트 크기는 1000 HWPUNIT = 10pt
 * @param hwpunit HWPUNIT 폰트 크기
 */
export function hwpunitToFontPt(hwpunit: number): number {
    return hwpunit / 100;
}

/**
 * pt -> HWPUNIT 폰트 크기 변환
 * @param pt pt 폰트 크기
 */
export function fontPtToHwpunit(pt: number): number {
    return pt * 100;
}

export default HwpUnit;
