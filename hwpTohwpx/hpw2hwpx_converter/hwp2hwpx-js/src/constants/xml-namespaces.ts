/**
 * HWPX XML 네임스페이스 정의
 * OWPML (Open Word Processor Markup Language) 표준 기반
 *
 * 모든 HWPX 생성 모듈에서 공통으로 사용되는 네임스페이스 문자열
 *
 * @module Constants
 * @category Constants
 */

/**
 * HWPX XML 문서에서 사용되는 전체 네임스페이스 선언
 *
 * 포함된 네임스페이스:
 * - ha: Hancom Application (2011)
 * - hp: Paragraph (2011)
 * - hp10: Paragraph (2016)
 * - hs: Section (2011)
 * - hc: Core (2011)
 * - hh: Head (2011)
 * - hhs: History (2011)
 * - hm: Master Page (2011)
 * - hpf: HPF Schema (2011)
 * - dc: Dublin Core Elements
 * - opf: OPF (IDPF 2007)
 * - ooxmlchart: OOXML Chart (2016)
 * - hwpunitchar: HWP Unit Character (2016)
 * - epub: EPUB (IDPF 2007)
 * - config: OpenDocument Config
 */
export const NAMESPACES = `xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"`;

/**
 * 개별 네임스페이스 URI 정의
 * 필요시 개별 네임스페이스 참조용
 */
export const NS = {
    HA: 'http://www.hancom.co.kr/hwpml/2011/app',
    HP: 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    HP10: 'http://www.hancom.co.kr/hwpml/2016/paragraph',
    HS: 'http://www.hancom.co.kr/hwpml/2011/section',
    HC: 'http://www.hancom.co.kr/hwpml/2011/core',
    HH: 'http://www.hancom.co.kr/hwpml/2011/head',
    HHS: 'http://www.hancom.co.kr/hwpml/2011/history',
    HM: 'http://www.hancom.co.kr/hwpml/2011/master-page',
    HPF: 'http://www.hancom.co.kr/schema/2011/hpf',
    DC: 'http://purl.org/dc/elements/1.1/',
    OPF: 'http://www.idpf.org/2007/opf/',
    OOXMLCHART: 'http://www.hancom.co.kr/hwpml/2016/ooxmlchart',
    HWPUNITCHAR: 'http://www.hancom.co.kr/hwpml/2016/HwpUnitChar',
    EPUB: 'http://www.idpf.org/2007/ops',
    CONFIG: 'urn:oasis:names:tc:opendocument:xmlns:config:1.0',
} as const;
