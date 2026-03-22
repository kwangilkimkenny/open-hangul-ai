/**
 * IdValidator - HWP ID 참조 검증 시스템
 *
 * DocInfo의 ID 목록을 기반으로 문서 내 ID 참조의 유효성을 검증합니다.
 * 유효하지 않은 ID를 발견하면 경고를 기록하고 안전한 기본값을 반환합니다.
 */

import type {
    DocInfo,
    FontFace,
    BorderFill,
    CharShape,
    ParaShape,
    Style,
    TabDef,
    Numbering,
    Bullet
} from '../adapters/IHwpParser';
import { ConversionContext, type DataLossLevel } from '../errors/ConversionErrors';

/**
 * ID 검증 결과
 */
export interface IdValidationResult {
    /** 검증된 ID (유효하면 원본, 무효하면 기본값) */
    id: number;
    /** 원본 ID가 유효했는지 */
    valid: boolean;
    /** 원본 ID (검증 전) */
    originalId: number;
}

/**
 * ID 유형별 검증 통계
 */
export interface IdValidationStats {
    totalChecks: number;
    validCount: number;
    invalidCount: number;
    fixedToDefault: number;
    byType: Record<string, { valid: number; invalid: number }>;
}

/**
 * ID 유효 범위 정보
 */
export interface IdRange {
    min: number;
    max: number;
    count: number;
}

/**
 * HWP ID 참조 검증기
 *
 * DocInfo에서 추출한 ID 목록을 기반으로 문서 내 모든 ID 참조를 검증합니다.
 *
 * @example
 * ```typescript
 * const validator = new IdValidator(docInfo);
 * const charShapeId = validator.validateCharShapeId(someId); // 유효한 ID 반환
 * const paraShapeId = validator.validateWithContext(ctx, 'paraShape', someId); // 경고 수집
 * ```
 */
export class IdValidator {
    /** 한글 폰트 ID 집합 */
    private hanFontIds: Set<number> = new Set();
    /** 영문 폰트 ID 집합 */
    private enFontIds: Set<number> = new Set();
    /** 한자 폰트 ID 집합 */
    private hanjaFontIds: Set<number> = new Set();
    /** 일본어 폰트 ID 집합 */
    private japaneseFontIds: Set<number> = new Set();
    /** 기타 폰트 ID 집합 */
    private etcFontIds: Set<number> = new Set();
    /** 기호 폰트 ID 집합 */
    private symbolFontIds: Set<number> = new Set();
    /** 사용자 폰트 ID 집합 */
    private userFontIds: Set<number> = new Set();
    /** 모든 폰트 ID 집합 (합집합) */
    private allFontIds: Set<number> = new Set();

    /** BorderFill ID 집합 */
    private borderFillIds: Set<number> = new Set();
    /** CharShape ID 집합 */
    private charShapeIds: Set<number> = new Set();
    /** ParaShape ID 집합 */
    private paraShapeIds: Set<number> = new Set();
    /** Style ID 집합 */
    private styleIds: Set<number> = new Set();
    /** TabDef ID 집합 */
    private tabDefIds: Set<number> = new Set();
    /** Numbering ID 집합 */
    private numberingIds: Set<number> = new Set();
    /** Bullet ID 집합 */
    private bulletIds: Set<number> = new Set();

    /** 검증 통계 */
    private _stats: IdValidationStats = {
        totalChecks: 0,
        validCount: 0,
        invalidCount: 0,
        fixedToDefault: 0,
        byType: {}
    };

    /** ID 범위 캐시 */
    private _ranges: Map<string, IdRange> = new Map();

    /**
     * IdValidator 생성
     * @param docInfo 문서 정보 (DocInfo 스트림)
     */
    constructor(docInfo: DocInfo) {
        this.buildIdSets(docInfo);
    }

    /**
     * DocInfo에서 ID 집합 구축
     */
    private buildIdSets(docInfo: DocInfo): void {
        // 폰트 ID 수집 (각 언어별)
        this.collectFontIds(docInfo.hanFontFaceList, this.hanFontIds);
        this.collectFontIds(docInfo.enFontFaceList, this.enFontIds);
        this.collectFontIds(docInfo.hanjaFontFaceList, this.hanjaFontIds);
        this.collectFontIds(docInfo.japaneseFontFaceList, this.japaneseFontIds);
        this.collectFontIds(docInfo.etcFontFaceList, this.etcFontIds);
        this.collectFontIds(docInfo.symbolFontFaceList, this.symbolFontIds);
        this.collectFontIds(docInfo.userFontFaceList, this.userFontIds);

        // 모든 폰트 ID 합집합
        [
            this.hanFontIds, this.enFontIds, this.hanjaFontIds,
            this.japaneseFontIds, this.etcFontIds, this.symbolFontIds, this.userFontIds
        ].forEach(set => {
            set.forEach(id => this.allFontIds.add(id));
        });

        // BorderFill ID 수집
        if (docInfo.borderFillList) {
            docInfo.borderFillList.forEach((bf: BorderFill, index: number) => {
                // ID가 있으면 사용, 없으면 인덱스+1 (1-based ID)
                this.borderFillIds.add(bf.id ?? index + 1);
            });
        }

        // CharShape ID 수집
        if (docInfo.charShapeList) {
            docInfo.charShapeList.forEach((cs: CharShape, index: number) => {
                this.charShapeIds.add(cs.id ?? index);
            });
        }

        // ParaShape ID 수집
        if (docInfo.paraShapeList) {
            docInfo.paraShapeList.forEach((ps: ParaShape, index: number) => {
                this.paraShapeIds.add(ps.id ?? index);
            });
        }

        // Style ID 수집
        if (docInfo.styleList) {
            docInfo.styleList.forEach((s: Style, index: number) => {
                this.styleIds.add(s.id ?? index);
            });
        }

        // TabDef ID 수집
        if (docInfo.tabDefList) {
            docInfo.tabDefList.forEach((t: TabDef, index: number) => {
                this.tabDefIds.add(t.id ?? index);
            });
        }

        // Numbering ID 수집
        if (docInfo.numberingList) {
            docInfo.numberingList.forEach((n: Numbering, index: number) => {
                this.numberingIds.add(n.id ?? index);
            });
        }

        // Bullet ID 수집
        if (docInfo.bulletList) {
            docInfo.bulletList.forEach((b: Bullet, index: number) => {
                this.bulletIds.add(b.id ?? index);
            });
        }

        // 범위 캐시 구축
        this.buildRangeCache();
    }

    /**
     * 폰트 ID 수집 헬퍼
     */
    private collectFontIds(fontList: FontFace[] | undefined, targetSet: Set<number>): void {
        if (!fontList) return;
        fontList.forEach((_, index) => {
            // HWP 폰트 ID는 0-based index
            targetSet.add(index);
        });
    }

    /**
     * ID 범위 캐시 구축
     */
    private buildRangeCache(): void {
        const buildRange = (name: string, set: Set<number>): void => {
            if (set.size === 0) {
                this._ranges.set(name, { min: 0, max: 0, count: 0 });
                return;
            }
            const ids = Array.from(set);
            this._ranges.set(name, {
                min: Math.min(...ids),
                max: Math.max(...ids),
                count: set.size
            });
        };

        buildRange('font', this.allFontIds);
        buildRange('hanFont', this.hanFontIds);
        buildRange('enFont', this.enFontIds);
        buildRange('borderFill', this.borderFillIds);
        buildRange('charShape', this.charShapeIds);
        buildRange('paraShape', this.paraShapeIds);
        buildRange('style', this.styleIds);
        buildRange('tabDef', this.tabDefIds);
        buildRange('numbering', this.numberingIds);
        buildRange('bullet', this.bulletIds);
    }

    // ========== 개별 ID 유형 검증 메서드 ==========

    /**
     * 폰트 ID 검증 (언어 무관)
     * @param id 검증할 폰트 ID
     * @param defaultId 무효 시 반환할 기본값 (기본: 0)
     */
    validateFontId(id: number, defaultId: number = 0): number {
        return this.validate('font', id, this.allFontIds, defaultId);
    }

    /**
     * 한글 폰트 ID 검증
     */
    validateHanFontId(id: number, defaultId: number = 0): number {
        return this.validate('hanFont', id, this.hanFontIds, defaultId);
    }

    /**
     * 영문 폰트 ID 검증
     */
    validateEnFontId(id: number, defaultId: number = 0): number {
        return this.validate('enFont', id, this.enFontIds, defaultId);
    }

    /**
     * BorderFill ID 검증
     * @param id 검증할 BorderFill ID
     * @param defaultId 무효 시 반환할 기본값 (기본: 1, BorderFill은 1-based)
     */
    validateBorderFillId(id: number, defaultId: number = 1): number {
        // ID가 0이면 "테두리 없음"을 의미할 수 있음
        if (id === 0) return 0;
        return this.validate('borderFill', id, this.borderFillIds, defaultId);
    }

    /**
     * CharShape ID 검증
     */
    validateCharShapeId(id: number, defaultId: number = 0): number {
        return this.validate('charShape', id, this.charShapeIds, defaultId);
    }

    /**
     * ParaShape ID 검증
     */
    validateParaShapeId(id: number, defaultId: number = 0): number {
        return this.validate('paraShape', id, this.paraShapeIds, defaultId);
    }

    /**
     * Style ID 검증
     */
    validateStyleId(id: number, defaultId: number = 0): number {
        return this.validate('style', id, this.styleIds, defaultId);
    }

    /**
     * TabDef ID 검증
     */
    validateTabDefId(id: number, defaultId: number = 0): number {
        // ID가 0이면 기본 탭을 의미할 수 있음
        if (id === 0) return 0;
        return this.validate('tabDef', id, this.tabDefIds, defaultId);
    }

    /**
     * Numbering ID 검증
     */
    validateNumberingId(id: number, defaultId: number = 0): number {
        if (id === 0) return 0; // 0은 번호 없음
        return this.validate('numbering', id, this.numberingIds, defaultId);
    }

    /**
     * Bullet ID 검증
     */
    validateBulletId(id: number, defaultId: number = 0): number {
        if (id === 0) return 0; // 0은 글머리표 없음
        return this.validate('bullet', id, this.bulletIds, defaultId);
    }

    // ========== 범용 검증 메서드 ==========

    /**
     * 범용 ID 검증
     */
    private validate(type: string, id: number, validIds: Set<number>, defaultId: number): number {
        this._stats.totalChecks++;

        if (!this._stats.byType[type]) {
            this._stats.byType[type] = { valid: 0, invalid: 0 };
        }

        if (validIds.has(id)) {
            this._stats.validCount++;
            this._stats.byType[type].valid++;
            return id;
        }

        this._stats.invalidCount++;
        this._stats.byType[type].invalid++;
        this._stats.fixedToDefault++;
        return defaultId;
    }

    /**
     * ConversionContext와 함께 검증 (경고 자동 수집)
     */
    validateWithContext(
        ctx: ConversionContext,
        type: string,
        id: number,
        defaultId: number = 0,
        dataLoss: DataLossLevel = 'minimal'
    ): number {
        let validIds: Set<number>;
        let typeName: string;

        switch (type) {
            case 'font':
            case 'fontId':
                validIds = this.allFontIds;
                typeName = '폰트';
                break;
            case 'hanFont':
                validIds = this.hanFontIds;
                typeName = '한글 폰트';
                break;
            case 'enFont':
                validIds = this.enFontIds;
                typeName = '영문 폰트';
                break;
            case 'borderFill':
            case 'borderFillId':
                validIds = this.borderFillIds;
                typeName = '테두리/배경';
                if (id === 0) return 0; // 0은 유효
                break;
            case 'charShape':
            case 'charShapeId':
                validIds = this.charShapeIds;
                typeName = '글자 모양';
                break;
            case 'paraShape':
            case 'paraShapeId':
                validIds = this.paraShapeIds;
                typeName = '문단 모양';
                break;
            case 'style':
            case 'styleId':
                validIds = this.styleIds;
                typeName = '스타일';
                break;
            case 'tabDef':
            case 'tabDefId':
                validIds = this.tabDefIds;
                typeName = '탭 정의';
                if (id === 0) return 0;
                break;
            case 'numbering':
            case 'numberingId':
                validIds = this.numberingIds;
                typeName = '번호 매기기';
                if (id === 0) return 0;
                break;
            case 'bullet':
            case 'bulletId':
                validIds = this.bulletIds;
                typeName = '글머리표';
                if (id === 0) return 0;
                break;
            default:
                console.warn(`[IdValidator] 알 수 없는 ID 유형: ${type}`);
                return id;
        }

        const result = this.validate(type, id, validIds, defaultId);

        if (result !== id) {
            const range = this._ranges.get(type);
            const rangeStr = range && range.count > 0
                ? ` (유효 범위: ${range.min}-${range.max})`
                : ' (목록 없음)';

            ctx.addWarning(
                'INVALID_ID_REFERENCE',
                `유효하지 않은 ${typeName} ID: ${id}${rangeStr} → 기본값 ${defaultId} 사용`,
                dataLoss,
                {
                    idType: type,
                    originalId: id,
                    fixedId: defaultId,
                    validRange: range
                }
            );
        }

        return result;
    }

    /**
     * 상세 검증 결과 반환
     */
    validateDetailed(type: string, id: number, defaultId: number = 0): IdValidationResult {
        let validIds: Set<number>;

        switch (type) {
            case 'font': validIds = this.allFontIds; break;
            case 'borderFill': validIds = this.borderFillIds; break;
            case 'charShape': validIds = this.charShapeIds; break;
            case 'paraShape': validIds = this.paraShapeIds; break;
            case 'style': validIds = this.styleIds; break;
            case 'tabDef': validIds = this.tabDefIds; break;
            case 'numbering': validIds = this.numberingIds; break;
            case 'bullet': validIds = this.bulletIds; break;
            default:
                return { id, valid: true, originalId: id };
        }

        const valid = validIds.has(id);
        return {
            id: valid ? id : defaultId,
            valid,
            originalId: id
        };
    }

    // ========== 유틸리티 메서드 ==========

    /**
     * 특정 유형의 ID가 유효한지 확인 (수정 없이)
     */
    isValid(type: string, id: number): boolean {
        switch (type) {
            case 'font': return this.allFontIds.has(id);
            case 'hanFont': return this.hanFontIds.has(id);
            case 'enFont': return this.enFontIds.has(id);
            case 'borderFill': return id === 0 || this.borderFillIds.has(id);
            case 'charShape': return this.charShapeIds.has(id);
            case 'paraShape': return this.paraShapeIds.has(id);
            case 'style': return this.styleIds.has(id);
            case 'tabDef': return id === 0 || this.tabDefIds.has(id);
            case 'numbering': return id === 0 || this.numberingIds.has(id);
            case 'bullet': return id === 0 || this.bulletIds.has(id);
            default: return true;
        }
    }

    /**
     * ID 범위 정보 조회
     */
    getRange(type: string): IdRange | undefined {
        return this._ranges.get(type);
    }

    /**
     * 모든 유효 ID 조회
     */
    getValidIds(type: string): Set<number> {
        switch (type) {
            case 'font': return new Set(this.allFontIds);
            case 'hanFont': return new Set(this.hanFontIds);
            case 'enFont': return new Set(this.enFontIds);
            case 'borderFill': return new Set(this.borderFillIds);
            case 'charShape': return new Set(this.charShapeIds);
            case 'paraShape': return new Set(this.paraShapeIds);
            case 'style': return new Set(this.styleIds);
            case 'tabDef': return new Set(this.tabDefIds);
            case 'numbering': return new Set(this.numberingIds);
            case 'bullet': return new Set(this.bulletIds);
            default: return new Set();
        }
    }

    /**
     * 검증 통계 조회
     */
    get stats(): IdValidationStats {
        return { ...this._stats };
    }

    /**
     * 통계 리셋
     */
    resetStats(): void {
        this._stats = {
            totalChecks: 0,
            validCount: 0,
            invalidCount: 0,
            fixedToDefault: 0,
            byType: {}
        };
    }

    /**
     * 검증 리포트 생성
     */
    generateReport(): string {
        const lines: string[] = [
            '=' .repeat(50),
            '  ID 참조 검증 리포트',
            '='.repeat(50),
            '',
            '[ 요약 ]',
            `  총 검증 횟수: ${this._stats.totalChecks}`,
            `  유효: ${this._stats.validCount} (${this.percentage(this._stats.validCount)}%)`,
            `  무효: ${this._stats.invalidCount} (${this.percentage(this._stats.invalidCount)}%)`,
            `  기본값으로 수정: ${this._stats.fixedToDefault}`,
            '',
            '[ ID 유형별 현황 ]'
        ];

        // 유형별 통계
        for (const [type, stat] of Object.entries(this._stats.byType)) {
            const range = this._ranges.get(type);
            const rangeStr = range ? `(범위: ${range.min}-${range.max}, 개수: ${range.count})` : '';
            const total = stat.valid + stat.invalid;
            const validPct = total > 0 ? ((stat.valid / total) * 100).toFixed(1) : '0.0';
            lines.push(`  ${type}: 유효 ${stat.valid}/${total} (${validPct}%) ${rangeStr}`);
        }

        lines.push('', '='.repeat(50));
        return lines.join('\n');
    }

    private percentage(count: number): string {
        if (this._stats.totalChecks === 0) return '0.0';
        return ((count / this._stats.totalChecks) * 100).toFixed(1);
    }
}

/**
 * IdValidator 팩토리 함수
 */
export function createIdValidator(docInfo: DocInfo): IdValidator {
    return new IdValidator(docInfo);
}
