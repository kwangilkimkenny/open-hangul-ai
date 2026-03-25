/**
 * ForHyperlink.ts - 하이퍼링크 보존 및 XML 생성
 *
 * Phase 4.2: 하이퍼링크 완전 보존
 * - URL 추출 및 검증
 * - 표시 텍스트 분리
 * - OWPML 형식 XML 생성
 *
 * @module Writer/Section/Controls
 * @category Hyperlink
 */

import { generateInstanceId } from '../../../util/IdGenerator';
import { DEFAULTS } from '../../../constants/DefaultValues';

/**
 * 하이퍼링크 인터페이스
 */
export interface Hyperlink {
    /** 표시 텍스트 */
    displayText: string;
    /** 링크 URL */
    url: string;
    /** 대상 창 */
    target: HyperlinkTarget;
    /** 툴팁 텍스트 */
    tooltip?: string;
    /** 북마크 참조 (내부 링크용) */
    bookmark?: string;
}

/**
 * 하이퍼링크 대상 타입
 */
export type HyperlinkTarget = '_blank' | '_self' | '_parent' | '_top';

/**
 * 하이퍼링크 파싱 결과
 */
export interface HyperlinkParseResult {
    /** 성공 여부 */
    success: boolean;
    /** 파싱된 하이퍼링크 정보 */
    hyperlink?: Hyperlink;
    /** 오류 메시지 */
    error?: string;
}

/**
 * 필드 데이터에서 하이퍼링크 정보 추출
 */
export interface FieldDataWithHyperlink {
    type?: string;
    value?: string;
    displayText?: string;
    tooltip?: string;
    target?: string;
    bookmark?: string;
}

/**
 * 하이퍼링크 데이터 파싱
 *
 * HWP 하이퍼링크 바이너리 구조:
 * - Offset 0-3: control code ('hlnk')
 * - Offset 4-7: property flags
 * - Offset 8-9: reserved/unknown
 * - Offset 10-11: URL string length (in characters)
 * - Offset 12+: URL string (UTF-16LE encoded)
 * - After URL: optional tooltip, display text
 *
 * @param data 바이너리 데이터
 * @returns 파싱 결과
 */
export function parseHyperlinkData(data: Uint8Array): HyperlinkParseResult {
    if (!data || data.length < 16) {
        return {
            success: false,
            error: 'Insufficient data for hyperlink parsing',
        };
    }

    try {
        // URL 추출 (첫 번째 문자열)
        const firstStringInfo = extractUTF16LEString(data, 10);
        if (!firstStringInfo.success) {
            return {
                success: false,
                error: 'Failed to extract URL string',
            };
        }

        const url = firstStringInfo.value;
        let displayText = '';
        let tooltip: string | undefined;

        // 두 번째 문자열 시도 (있는 경우 - 표시 텍스트 또는 툴팁)
        if (firstStringInfo.nextOffset < data.length - 2) {
            const secondStringInfo = extractUTF16LEString(data, firstStringInfo.nextOffset);
            if (secondStringInfo.success && secondStringInfo.value) {
                // 두 번째 문자열이 있으면 툴팁으로 처리
                tooltip = secondStringInfo.value;

                // 세 번째 문자열 시도 (표시 텍스트)
                if (secondStringInfo.nextOffset < data.length - 2) {
                    const thirdStringInfo = extractUTF16LEString(data, secondStringInfo.nextOffset);
                    if (thirdStringInfo.success && thirdStringInfo.value) {
                        displayText = thirdStringInfo.value;
                    }
                }
            }
        }

        // displayText가 비어있으면 URL 사용
        if (!displayText) {
            displayText = url;
        }

        // 기본 타겟 설정
        const target = DEFAULTS.field.hyperlinkTarget as HyperlinkTarget;

        return {
            success: true,
            hyperlink: {
                url,
                displayText,
                target,
                tooltip,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: `Hyperlink parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * UTF-16LE 인코딩된 문자열 추출
 *
 * @param data 바이너리 데이터
 * @param lengthOffset 문자열 길이 필드 오프셋
 * @returns 추출된 문자열 및 다음 오프셋
 */
function extractUTF16LEString(
    data: Uint8Array,
    lengthOffset: number
): { success: boolean; value: string; nextOffset: number } {
    if (lengthOffset + 2 > data.length) {
        return { success: false, value: '', nextOffset: lengthOffset };
    }

    const strLen = data[lengthOffset] | (data[lengthOffset + 1] << 8);

    // 비정상적인 길이 체크
    if (strLen === 0) {
        return { success: true, value: '', nextOffset: lengthOffset + 2 };
    }

    if (strLen > 2000) {
        return { success: false, value: '', nextOffset: lengthOffset };
    }

    const strStart = lengthOffset + 2;
    const strEnd = strStart + strLen * 2;

    if (strEnd > data.length) {
        return { success: false, value: '', nextOffset: lengthOffset };
    }

    // UTF-16LE 디코딩
    const chars: string[] = [];
    for (let i = strStart; i < strEnd; i += 2) {
        const charCode = data[i] | (data[i + 1] << 8);
        if (charCode === 0) break;
        chars.push(String.fromCharCode(charCode));
    }

    return {
        success: true,
        value: chars.join(''),
        nextOffset: strEnd,
    };
}

/**
 * 필드 데이터에서 하이퍼링크 정보 추출
 *
 * @param fieldData 필드 데이터 객체
 * @returns 하이퍼링크 정보 (없으면 null)
 */
export function extractHyperlinkFromFieldData(
    fieldData: FieldDataWithHyperlink | undefined
): Hyperlink | null {
    if (!fieldData || fieldData.type !== 'HYPERLINK') {
        return null;
    }

    const url = fieldData.value || '';
    if (!url) {
        return null;
    }

    // target 문자열을 HyperlinkTarget 타입으로 변환
    let target: HyperlinkTarget = DEFAULTS.field.hyperlinkTarget as HyperlinkTarget;
    if (fieldData.target) {
        const validTargets: HyperlinkTarget[] = ['_blank', '_self', '_parent', '_top'];
        if (validTargets.includes(fieldData.target as HyperlinkTarget)) {
            target = fieldData.target as HyperlinkTarget;
        }
    }

    return {
        url,
        displayText: fieldData.displayText || url,
        target,
        tooltip: fieldData.tooltip,
        bookmark: fieldData.bookmark,
    };
}

/**
 * 하이퍼링크 시작 XML 생성 (hp:fieldBegin)
 *
 * @param hyperlink 하이퍼링크 정보
 * @param instId 인스턴스 ID
 * @returns XML 문자열
 */
export function hyperlinkBeginToXml(
    hyperlink: Hyperlink | null,
    instId?: number
): string {
    const id = instId ?? generateInstanceId();

    if (!hyperlink) {
        // 하이퍼링크 정보가 없으면 빈 필드
        return `<hp:fieldBegin id="${id}" type="HYPERLINK" name="" autoUpdate="0">
  <hp:fieldData></hp:fieldData>
</hp:fieldBegin>`;
    }

    const urlAttr = escapeXml(hyperlink.url);
    const tooltipAttr = hyperlink.tooltip ? ` tooltip="${escapeXml(hyperlink.tooltip)}"` : '';

    // OWPML 형식의 하이퍼링크 필드 데이터
    // 형식: href;target;tooltip
    const fieldDataParts = [hyperlink.url];
    if (hyperlink.target && hyperlink.target !== '_blank') {
        fieldDataParts.push(hyperlink.target);
    }
    if (hyperlink.tooltip) {
        if (fieldDataParts.length === 1) {
            fieldDataParts.push(''); // target placeholder
        }
        fieldDataParts.push(hyperlink.tooltip);
    }

    const fieldData = fieldDataParts.join(';');

    return `<hp:fieldBegin id="${id}" type="HYPERLINK" name=""${tooltipAttr} autoUpdate="0">
  <hp:fieldData>${escapeXml(fieldData)}</hp:fieldData>
  <hp:param name="href" value="${urlAttr}"/>
  <hp:param name="target" value="${hyperlink.target}"/>
</hp:fieldBegin>`;
}

/**
 * 하이퍼링크 종료 XML 생성 (hp:fieldEnd)
 *
 * @param instId 인스턴스 ID (fieldBegin과 매칭)
 * @returns XML 문자열
 */
export function hyperlinkEndToXml(instId?: number): string {
    const id = instId ?? generateInstanceId();
    return `<hp:fieldEnd id="${id}"/>`;
}

/**
 * 하이퍼링크 전체 런(run) XML 생성
 * 하이퍼링크 텍스트를 포함한 완전한 run 요소 생성
 *
 * @param hyperlink 하이퍼링크 정보
 * @param charShapeId 문자 스타일 ID
 * @returns XML 문자열
 */
export function hyperlinkRunToXml(
    hyperlink: Hyperlink,
    charShapeId: number = 0
): string {
    const instId = generateInstanceId();

    return `<hp:run charPrIDRef="${charShapeId}">
  <hp:ctrl>
    ${hyperlinkBeginToXml(hyperlink, instId)}
  </hp:ctrl>
  <hp:t>${escapeXml(hyperlink.displayText)}</hp:t>
  <hp:ctrl>
    ${hyperlinkEndToXml(instId)}
  </hp:ctrl>
</hp:run>`;
}

/**
 * URL 유효성 검사
 *
 * @param url URL 문자열
 * @returns 유효 여부
 */
export function isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // 빈 문자열 체크
    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) {
        return false;
    }

    // 기본 프로토콜 체크
    const validProtocols = ['http://', 'https://', 'ftp://', 'mailto:', 'file://'];
    const hasValidProtocol = validProtocols.some(p =>
        trimmedUrl.toLowerCase().startsWith(p)
    );

    // 상대 경로 또는 앵커 허용
    const isRelative = trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#');

    return hasValidProtocol || isRelative;
}

/**
 * 내부 링크 (북마크) 여부 확인
 *
 * @param hyperlink 하이퍼링크 정보
 * @returns 내부 링크 여부
 */
export function isInternalLink(hyperlink: Hyperlink): boolean {
    return !!(hyperlink.bookmark || hyperlink.url.startsWith('#'));
}

/**
 * URL 정규화
 * - 공백 제거
 * - 프로토콜 추가 (없는 경우)
 *
 * @param url 원본 URL
 * @returns 정규화된 URL
 */
export function normalizeUrl(url: string): string {
    if (!url) return '';

    const normalized = url.trim();

    // 이미 프로토콜이 있는 경우
    if (normalized.match(/^[a-z]+:\/\//i) || normalized.startsWith('mailto:')) {
        return normalized;
    }

    // 앵커 또는 상대 경로
    if (normalized.startsWith('#') || normalized.startsWith('/')) {
        return normalized;
    }

    // www로 시작하면 http:// 추가
    if (normalized.toLowerCase().startsWith('www.')) {
        return 'http://' + normalized;
    }

    // 이메일 주소 패턴이면 mailto: 추가
    if (normalized.includes('@') && !normalized.includes('/')) {
        return 'mailto:' + normalized;
    }

    return normalized;
}

/**
 * XML 특수 문자 이스케이프
 */
function escapeXml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * HyperlinkProcessor 클래스
 * 하이퍼링크 처리를 위한 유틸리티 클래스
 */
export class HyperlinkProcessor {
    /**
     * 바이너리 데이터에서 하이퍼링크 파싱
     */
    static parse(data: Uint8Array): Hyperlink | null {
        const result = parseHyperlinkData(data);
        return result.success ? result.hyperlink ?? null : null;
    }

    /**
     * 필드 데이터에서 하이퍼링크 추출
     */
    static fromFieldData(fieldData: FieldDataWithHyperlink | undefined): Hyperlink | null {
        return extractHyperlinkFromFieldData(fieldData);
    }

    /**
     * 하이퍼링크 run XML 생성
     */
    static toXml(hyperlink: Hyperlink, charShapeId?: number): string {
        return hyperlinkRunToXml(hyperlink, charShapeId ?? 0);
    }

    /**
     * URL 유효성 검사
     */
    static isValid(url: string): boolean {
        return isValidUrl(url);
    }

    /**
     * URL 정규화
     */
    static normalize(url: string): string {
        return normalizeUrl(url);
    }
}

export default HyperlinkProcessor;
