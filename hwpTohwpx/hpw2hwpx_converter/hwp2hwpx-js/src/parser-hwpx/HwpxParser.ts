/**
 * HWPX 파일 파싱 - ZIP 추출 및 XML 파싱
 *
 * HWPX 파일 구조:
 * - mimetype
 * - version.xml
 * - Contents/header.xml (폰트, 스타일, 테두리 등)
 * - Contents/section0.xml, section1.xml... (본문)
 * - Contents/content.hpf
 * - BinData/* (이미지 등)
 * - settings.xml
 *
 * @module ParserHwpx
 */

import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import type {
    HwpxDocument,
    HwpxHeader,
    HwpxSection,
    HwpxFontface,
    HwpxFont,
    HwpxCharShape,
    HwpxParaShape,
    HwpxStyle,
    HwpxBorderFill,
    HwpxParagraph,
    HwpxRun,
    HwpxBinData,
    HwpxBullet,
    HwpxNumbering,
    HwpxTabProperty
} from './types';

/**
 * HWPX 파싱 옵션
 */
export interface HwpxParserOptions {
    /** BinData 추출 여부 (기본값: true) */
    extractBinData?: boolean;
    /** 진행 콜백 */
    onProgress?: (stage: string, percent: number) => void;
}

/**
 * HWPX 파일 파서
 */
export class HwpxParser {
    private zip: JSZip | null = null;
    private options: Required<HwpxParserOptions>;

    constructor(options?: HwpxParserOptions) {
        this.options = {
            extractBinData: options?.extractBinData ?? true,
            onProgress: options?.onProgress ?? (() => {})
        };
    }

    /**
     * HWPX 파일 파싱
     *
     * @param data - HWPX 파일 바이너리
     * @returns 파싱된 HWPX 문서
     */
    async parse(data: Uint8Array): Promise<HwpxDocument> {
        this.options.onProgress('ZIP 추출', 0);

        // ZIP 로드
        this.zip = await JSZip.loadAsync(data);

        this.options.onProgress('ZIP 추출', 100);

        // header.xml 파싱
        this.options.onProgress('헤더 파싱', 0);
        const header = await this.parseHeader();
        this.options.onProgress('헤더 파싱', 100);

        // section*.xml 파싱
        this.options.onProgress('섹션 파싱', 0);
        const sections = await this.parseSections();
        this.options.onProgress('섹션 파싱', 100);

        // BinData 추출
        let binData: HwpxBinData[] = [];
        if (this.options.extractBinData) {
            this.options.onProgress('BinData 추출', 0);
            binData = await this.extractBinData();
            this.options.onProgress('BinData 추출', 100);
        }

        return {
            header,
            sections,
            binData
        };
    }

    /**
     * header.xml 파싱
     */
    private async parseHeader(): Promise<HwpxHeader> {
        const xml = await this.getXmlContent('Contents/header.xml');
        const doc = new DOMParser().parseFromString(xml, 'text/xml');

        const head = doc.documentElement;

        return {
            version: head.getAttribute('version') || '1.0',
            secCnt: parseInt(head.getAttribute('secCnt') || '1', 10),
            fontfaces: this.parseFontfaces(head),
            charShapes: this.parseCharShapes(head),
            paraShapes: this.parseParaShapes(head),
            styles: this.parseStyles(head),
            borderFills: this.parseBorderFills(head),
            bullets: this.parseBullets(head),
            numberings: this.parseNumberings(head),
            tabProperties: this.parseTabProperties(head)
        };
    }

    /**
     * 폰트 정의 파싱
     */
    private parseFontfaces(head: Element): HwpxFontface[] {
        const fontfaces: HwpxFontface[] = [];
        const fontfacesEl = this.getElementByTagName(head, 'fontfaces');

        if (!fontfacesEl) return fontfaces;

        const fontfaceList = this.getElementsByTagName(fontfacesEl, 'fontface');
        for (let i = 0; i < fontfaceList.length; i++) {
            const el = fontfaceList[i];
            const lang = el.getAttribute('lang') || 'HANGUL';
            const fonts: HwpxFont[] = [];

            const fontList = this.getElementsByTagName(el, 'font');
            for (let j = 0; j < fontList.length; j++) {
                const fontEl = fontList[j];
                fonts.push({
                    id: parseInt(fontEl.getAttribute('id') || '0', 10),
                    face: fontEl.getAttribute('face') || '',
                    type: fontEl.getAttribute('type') || 'TTF',
                    isEmbedded: fontEl.getAttribute('isEmbedded') === '1'
                });
            }

            fontfaces.push({ lang, fonts });
        }

        return fontfaces;
    }

    /**
     * 글자 모양 파싱
     */
    private parseCharShapes(head: Element): HwpxCharShape[] {
        const shapes: HwpxCharShape[] = [];
        const charPropsEl = this.getElementByTagName(head, 'charProperties');

        if (!charPropsEl) return shapes;

        const charPropList = this.getElementsByTagName(charPropsEl, 'charPr');
        for (let i = 0; i < charPropList.length; i++) {
            const el = charPropList[i];
            shapes.push(this.parseCharShape(el));
        }

        return shapes;
    }

    /**
     * 개별 글자 모양 파싱
     */
    private parseCharShape(el: Element): HwpxCharShape {
        // fontRef 파싱
        const fontRefEl = this.getElementByTagName(el, 'fontRef');
        const fontRefs: number[] = [];
        if (fontRefEl) {
            fontRefs.push(parseInt(fontRefEl.getAttribute('hangul') || '0', 10));
            fontRefs.push(parseInt(fontRefEl.getAttribute('latin') || '0', 10));
            fontRefs.push(parseInt(fontRefEl.getAttribute('hanja') || '0', 10));
            fontRefs.push(parseInt(fontRefEl.getAttribute('japanese') || '0', 10));
            fontRefs.push(parseInt(fontRefEl.getAttribute('other') || '0', 10));
            fontRefs.push(parseInt(fontRefEl.getAttribute('symbol') || '0', 10));
            fontRefs.push(parseInt(fontRefEl.getAttribute('user') || '0', 10));
        }

        // ratio 파싱
        const ratioEl = this.getElementByTagName(el, 'ratio');
        const ratios: number[] = [];
        if (ratioEl) {
            ratios.push(parseInt(ratioEl.getAttribute('hangul') || '100', 10));
            ratios.push(parseInt(ratioEl.getAttribute('latin') || '100', 10));
            ratios.push(parseInt(ratioEl.getAttribute('hanja') || '100', 10));
            ratios.push(parseInt(ratioEl.getAttribute('japanese') || '100', 10));
            ratios.push(parseInt(ratioEl.getAttribute('other') || '100', 10));
            ratios.push(parseInt(ratioEl.getAttribute('symbol') || '100', 10));
            ratios.push(parseInt(ratioEl.getAttribute('user') || '100', 10));
        }

        // spacing 파싱
        const spacingEl = this.getElementByTagName(el, 'spacing');
        const spacings: number[] = [];
        if (spacingEl) {
            spacings.push(parseInt(spacingEl.getAttribute('hangul') || '0', 10));
            spacings.push(parseInt(spacingEl.getAttribute('latin') || '0', 10));
            spacings.push(parseInt(spacingEl.getAttribute('hanja') || '0', 10));
            spacings.push(parseInt(spacingEl.getAttribute('japanese') || '0', 10));
            spacings.push(parseInt(spacingEl.getAttribute('other') || '0', 10));
            spacings.push(parseInt(spacingEl.getAttribute('symbol') || '0', 10));
            spacings.push(parseInt(spacingEl.getAttribute('user') || '0', 10));
        }

        // relSz 파싱
        const relSzEl = this.getElementByTagName(el, 'relSz');
        const relSizes: number[] = [];
        if (relSzEl) {
            relSizes.push(parseInt(relSzEl.getAttribute('hangul') || '100', 10));
            relSizes.push(parseInt(relSzEl.getAttribute('latin') || '100', 10));
            relSizes.push(parseInt(relSzEl.getAttribute('hanja') || '100', 10));
            relSizes.push(parseInt(relSzEl.getAttribute('japanese') || '100', 10));
            relSizes.push(parseInt(relSzEl.getAttribute('other') || '100', 10));
            relSizes.push(parseInt(relSzEl.getAttribute('symbol') || '100', 10));
            relSizes.push(parseInt(relSzEl.getAttribute('user') || '100', 10));
        }

        // offset 파싱
        const offsetEl = this.getElementByTagName(el, 'offset');
        const offsets: number[] = [];
        if (offsetEl) {
            offsets.push(parseInt(offsetEl.getAttribute('hangul') || '0', 10));
            offsets.push(parseInt(offsetEl.getAttribute('latin') || '0', 10));
            offsets.push(parseInt(offsetEl.getAttribute('hanja') || '0', 10));
            offsets.push(parseInt(offsetEl.getAttribute('japanese') || '0', 10));
            offsets.push(parseInt(offsetEl.getAttribute('other') || '0', 10));
            offsets.push(parseInt(offsetEl.getAttribute('symbol') || '0', 10));
            offsets.push(parseInt(offsetEl.getAttribute('user') || '0', 10));
        }

        return {
            id: parseInt(el.getAttribute('id') || '0', 10),
            height: parseInt(el.getAttribute('height') || '1000', 10),
            textColor: el.getAttribute('textColor') || '#000000',
            shadeColor: el.getAttribute('shadeColor') || 'none',
            useFontSpace: el.getAttribute('useFontSpace') === '1',
            useKerning: el.getAttribute('useKerning') === '1',
            symMark: el.getAttribute('symMark') || 'NONE',
            borderFillIDRef: parseInt(el.getAttribute('borderFillIDRef') || '0', 10),
            fontRefs,
            ratios,
            spacings,
            relSizes,
            offsets
        };
    }

    /**
     * 문단 모양 파싱
     */
    private parseParaShapes(head: Element): HwpxParaShape[] {
        const shapes: HwpxParaShape[] = [];
        const paraPropsEl = this.getElementByTagName(head, 'paraProperties');

        if (!paraPropsEl) return shapes;

        const paraPropList = this.getElementsByTagName(paraPropsEl, 'paraPr');
        for (let i = 0; i < paraPropList.length; i++) {
            const el = paraPropList[i];
            shapes.push(this.parseParaShape(el));
        }

        return shapes;
    }

    /**
     * 개별 문단 모양 파싱
     */
    private parseParaShape(el: Element): HwpxParaShape {
        // align 파싱
        const alignEl = this.getElementByTagName(el, 'align');

        // heading 파싱
        const headingEl = this.getElementByTagName(el, 'heading');

        // margin 파싱
        const marginEl = this.getElementByTagName(el, 'margin');

        // lineSpacing 파싱
        const lineSpacingEl = this.getElementByTagName(el, 'lineSpacing');

        return {
            id: parseInt(el.getAttribute('id') || '0', 10),
            align: alignEl?.getAttribute('horizontal') || 'JUSTIFY',
            vertAlign: alignEl?.getAttribute('vertical') || 'BASELINE',
            headingType: headingEl?.getAttribute('type') || 'NONE',
            headingLevel: parseInt(headingEl?.getAttribute('level') || '0', 10),
            headingIdRef: parseInt(headingEl?.getAttribute('idRef') || '0', 10),
            marginLeft: parseInt(marginEl?.getAttribute('left') || '0', 10),
            marginRight: parseInt(marginEl?.getAttribute('right') || '0', 10),
            indent: parseInt(marginEl?.getAttribute('indent') || '0', 10),
            marginPrev: parseInt(marginEl?.getAttribute('prev') || '0', 10),
            marginNext: parseInt(marginEl?.getAttribute('next') || '0', 10),
            lineSpacingType: lineSpacingEl?.getAttribute('type') || 'PERCENT',
            lineSpacingValue: parseInt(lineSpacingEl?.getAttribute('value') || '160', 10),
            tabDefIDRef: parseInt(el.getAttribute('tabPrIDRef') || '0', 10),
            borderFillIDRef: parseInt(el.getAttribute('borderFillIDRef') || '0', 10)
        };
    }

    /**
     * 스타일 파싱
     */
    private parseStyles(head: Element): HwpxStyle[] {
        const styles: HwpxStyle[] = [];
        const stylesEl = this.getElementByTagName(head, 'styles');

        if (!stylesEl) return styles;

        const styleList = this.getElementsByTagName(stylesEl, 'style');
        for (let i = 0; i < styleList.length; i++) {
            const el = styleList[i];
            styles.push({
                id: parseInt(el.getAttribute('id') || '0', 10),
                type: el.getAttribute('type') || 'PARA',
                name: el.getAttribute('name') || '',
                engName: el.getAttribute('engName') || '',
                paraPrIDRef: parseInt(el.getAttribute('paraPrIDRef') || '0', 10),
                charPrIDRef: parseInt(el.getAttribute('charPrIDRef') || '0', 10),
                nextStyleIDRef: parseInt(el.getAttribute('nextStyleIDRef') || '0', 10),
                langId: parseInt(el.getAttribute('langId') || '0', 10),
                lockForm: el.getAttribute('lockForm') === '1'
            });
        }

        return styles;
    }

    /**
     * 테두리/채우기 파싱
     */
    private parseBorderFills(head: Element): HwpxBorderFill[] {
        const borderFills: HwpxBorderFill[] = [];
        const borderFillsEl = this.getElementByTagName(head, 'borderFills');

        if (!borderFillsEl) return borderFills;

        const borderFillList = this.getElementsByTagName(borderFillsEl, 'borderFill');
        for (let i = 0; i < borderFillList.length; i++) {
            const el = borderFillList[i];
            borderFills.push(this.parseBorderFill(el));
        }

        return borderFills;
    }

    /**
     * 개별 테두리/채우기 파싱
     */
    private parseBorderFill(el: Element): HwpxBorderFill {
        // slash 파싱
        const slashEl = this.getElementByTagName(el, 'slash');

        // border 파싱
        const borderEl = this.getElementByTagName(el, 'border');
        const borders: HwpxBorderFill['borders'] = {
            left: { type: 'NONE', width: '0.1 mm', color: '#000000' },
            right: { type: 'NONE', width: '0.1 mm', color: '#000000' },
            top: { type: 'NONE', width: '0.1 mm', color: '#000000' },
            bottom: { type: 'NONE', width: '0.1 mm', color: '#000000' }
        };

        if (borderEl) {
            for (const side of ['left', 'right', 'top', 'bottom'] as const) {
                const sideEl = this.getElementByTagName(borderEl, side);
                if (sideEl) {
                    borders[side] = {
                        type: sideEl.getAttribute('type') || 'NONE',
                        width: sideEl.getAttribute('width') || '0.1 mm',
                        color: sideEl.getAttribute('color') || '#000000'
                    };
                }
            }
        }

        // fillBrush 파싱
        const fillBrushEl = this.getElementByTagName(el, 'fillBrush');
        let fillColor: string | undefined;
        let fillType: string = 'NONE';

        if (fillBrushEl) {
            const winBrushEl = this.getElementByTagName(fillBrushEl, 'winBrush');
            if (winBrushEl) {
                fillColor = winBrushEl.getAttribute('faceColor') || undefined;
                fillType = 'COLOR';
            }
        }

        return {
            id: parseInt(el.getAttribute('id') || '0', 10),
            threeD: el.getAttribute('threeD') === '1',
            shadow: el.getAttribute('shadow') === '1',
            slash: slashEl?.getAttribute('type') || 'NONE',
            backSlash: slashEl?.getAttribute('crooked') || 'NONE',
            borders,
            fillType,
            fillColor
        };
    }

    /**
     * 글머리표 파싱
     */
    private parseBullets(head: Element): HwpxBullet[] {
        // 간략 구현 - 필요시 확장
        const bulletsEl = this.getElementByTagName(head, 'bullets');
        if (!bulletsEl) return [];

        const bullets: HwpxBullet[] = [];
        const bulletList = this.getElementsByTagName(bulletsEl, 'bullet');
        for (let i = 0; i < bulletList.length; i++) {
            const el = bulletList[i];
            bullets.push({
                id: parseInt(el.getAttribute('id') || '0', 10),
                char: el.getAttribute('char') || ''
            });
        }

        return bullets;
    }

    /**
     * 문단 번호 파싱
     */
    private parseNumberings(head: Element): HwpxNumbering[] {
        // 간략 구현 - 필요시 확장
        const numberingsEl = this.getElementByTagName(head, 'numberings');
        if (!numberingsEl) return [];

        const numberings: HwpxNumbering[] = [];
        const numberingList = this.getElementsByTagName(numberingsEl, 'numbering');
        for (let i = 0; i < numberingList.length; i++) {
            const el = numberingList[i];
            numberings.push({
                id: parseInt(el.getAttribute('id') || '0', 10)
            });
        }

        return numberings;
    }

    /**
     * 탭 속성 파싱
     */
    private parseTabProperties(head: Element): HwpxTabProperty[] {
        // 간략 구현 - 필요시 확장
        const tabPropsEl = this.getElementByTagName(head, 'tabProperties');
        if (!tabPropsEl) return [];

        const tabProps: HwpxTabProperty[] = [];
        const tabPropList = this.getElementsByTagName(tabPropsEl, 'tabPr');
        for (let i = 0; i < tabPropList.length; i++) {
            const el = tabPropList[i];
            tabProps.push({
                id: parseInt(el.getAttribute('id') || '0', 10),
                autoTabLeft: el.getAttribute('autoTabLeft') === '1',
                autoTabRight: el.getAttribute('autoTabRight') === '1'
            });
        }

        return tabProps;
    }

    /**
     * 섹션 파싱
     */
    private async parseSections(): Promise<HwpxSection[]> {
        const sections: HwpxSection[] = [];

        // section 파일 찾기
        const sectionFiles: string[] = [];
        this.zip!.forEach((path) => {
            if (path.match(/Contents\/section\d+\.xml$/)) {
                sectionFiles.push(path);
            }
        });

        // 정렬
        sectionFiles.sort((a, b) => {
            const numA = parseInt(a.match(/section(\d+)\.xml/)![1], 10);
            const numB = parseInt(b.match(/section(\d+)\.xml/)![1], 10);
            return numA - numB;
        });

        // 각 섹션 파싱
        for (let i = 0; i < sectionFiles.length; i++) {
            const xml = await this.getXmlContent(sectionFiles[i]);
            sections.push(this.parseSectionXml(xml, i));

            this.options.onProgress('섹션 파싱', ((i + 1) / sectionFiles.length) * 100);
        }

        return sections;
    }

    /**
     * 개별 섹션 XML 파싱
     *
     * 중요: 직접 자식 <hp:p>만 파싱해야 함.
     * 테이블 셀 등 subList 내의 문단은 해당 컨트롤에서 별도 처리.
     */
    private parseSectionXml(xml: string, index: number): HwpxSection {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const secEl = doc.documentElement;

        // 문단 파싱 - 직접 자식만 (subList 내 문단 제외)
        const paragraphs: HwpxParagraph[] = [];
        const pList = this.getDirectChildrenByTagName(secEl, 'p');

        for (let i = 0; i < pList.length; i++) {
            paragraphs.push(this.parseParagraph(pList[i]));
        }

        return {
            index,
            paragraphs
        };
    }

    /**
     * 문단 파싱
     */
    private parseParagraph(pEl: Element): HwpxParagraph {
        const runs: HwpxRun[] = [];
        const runList = this.getElementsByTagName(pEl, 'run');

        for (let i = 0; i < runList.length; i++) {
            runs.push(this.parseRun(runList[i]));
        }

        return {
            id: pEl.getAttribute('id') || '0',
            paraPrIDRef: parseInt(pEl.getAttribute('paraPrIDRef') || '0', 10),
            styleIDRef: parseInt(pEl.getAttribute('styleIDRef') || '0', 10),
            pageBreak: pEl.getAttribute('pageBreak') === '1',
            columnBreak: pEl.getAttribute('columnBreak') === '1',
            runs
        };
    }

    /**
     * Run 파싱
     */
    private parseRun(runEl: Element): HwpxRun {
        const charPrIDRef = parseInt(runEl.getAttribute('charPrIDRef') || '0', 10);

        // 텍스트 추출
        const tEl = this.getElementByTagName(runEl, 't');
        const text = tEl?.textContent || '';

        // 컨트롤 추출
        const controls: HwpxRun['controls'] = [];
        const addedElements = new Set<Element>();  // 중복 방지용

        const ctrlEl = this.getElementByTagName(runEl, 'ctrl');
        if (ctrlEl) {
            // 다양한 컨트롤 파싱
            for (let i = 0; i < ctrlEl.childNodes.length; i++) {
                const child = ctrlEl.childNodes[i];
                if (child.nodeType === 1) { // ELEMENT_NODE
                    const elem = child as Element;
                    controls.push({
                        type: elem.localName || elem.nodeName,
                        element: elem
                    });
                    addedElements.add(elem);
                }
            }
        }

        // 직접 자식으로 있는 컨트롤들 (재귀 검색 X, ctrl 안에서 이미 추가된 것은 제외)
        const directControls = ['tbl', 'rect', 'line', 'ellipse', 'arc', 'polygon',
            'curve', 'pic', 'ole', 'container', 'connectLine', 'equation'];
        for (const ctrlName of directControls) {
            // 직접 자식만 검색하여 중첩된 요소(테이블 안의 pic 등)가 중복 추가되는 것을 방지
            const el = this.getDirectChildByTagName(runEl, ctrlName);
            if (el && !addedElements.has(el)) {
                controls.push({
                    type: ctrlName,
                    element: el
                });
                addedElements.add(el);
            }
        }

        // secPr (섹션 속성) 파싱
        const secPrEl = this.getElementByTagName(runEl, 'secPr');
        if (secPrEl) {
            controls.push({
                type: 'secPr',
                element: secPrEl
            });
        }

        return {
            charPrIDRef,
            text,
            controls
        };
    }

    /**
     * BinData 추출
     */
    private async extractBinData(): Promise<HwpxBinData[]> {
        const binData: HwpxBinData[] = [];

        const binDataFiles: string[] = [];
        this.zip!.forEach((path) => {
            if (path.startsWith('BinData/')) {
                binDataFiles.push(path);
            }
        });

        for (let i = 0; i < binDataFiles.length; i++) {
            const path = binDataFiles[i];
            const file = this.zip!.file(path);
            if (file) {
                const data = await file.async('uint8array');
                const filename = path.split('/').pop()!;

                // 파일명에서 ID 추출 (예: BIN0001.png → 1)
                const match = filename.match(/BIN(\d+)\./i);
                const id = match ? parseInt(match[1], 10) : i + 1;

                // 확장자 추출
                const extMatch = filename.match(/\.(\w+)$/);
                const extension = extMatch ? extMatch[1].toLowerCase() : 'bin';

                binData.push({
                    id,
                    filename,
                    extension,
                    data
                });
            }

            this.options.onProgress('BinData 추출', ((i + 1) / binDataFiles.length) * 100);
        }

        return binData;
    }

    /**
     * ZIP에서 XML 내용 추출
     */
    private async getXmlContent(path: string): Promise<string> {
        const file = this.zip!.file(path);
        if (!file) {
            throw new Error(`파일을 찾을 수 없음: ${path}`);
        }
        return file.async('string');
    }

    /**
     * 요소에서 특정 태그명의 첫 번째 자식 요소 반환 (재귀 검색)
     */
    private getElementByTagName(parent: Element, tagName: string): Element | null {
        // 네임스페이스 접두사 처리
        const children = parent.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) { // ELEMENT_NODE
                const elem = child as Element;
                const localName = elem.localName || elem.nodeName.split(':').pop();
                if (localName === tagName) {
                    return elem;
                }
            }
        }

        // 재귀 검색
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) {
                const found = this.getElementByTagName(child as Element, tagName);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * 요소에서 특정 태그명의 첫 번째 직접 자식 요소만 반환 (재귀 X)
     */
    private getDirectChildByTagName(parent: Element, tagName: string): Element | null {
        const children = parent.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) { // ELEMENT_NODE
                const elem = child as Element;
                const localName = elem.localName || elem.nodeName.split(':').pop();
                if (localName === tagName) {
                    return elem;
                }
            }
        }
        return null;
    }

    /**
     * 요소에서 특정 태그명의 모든 자식 요소 반환 (재귀 검색)
     */
    private getElementsByTagName(parent: Element, tagName: string): Element[] {
        const results: Element[] = [];

        const traverse = (node: Element) => {
            const children = node.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === 1) { // ELEMENT_NODE
                    const elem = child as Element;
                    const localName = elem.localName || elem.nodeName.split(':').pop();
                    if (localName === tagName) {
                        results.push(elem);
                    }
                    traverse(elem);
                }
            }
        };

        traverse(parent);
        return results;
    }

    /**
     * 요소에서 특정 태그명의 직접 자식 요소만 반환 (재귀 검색하지 않음)
     *
     * getElementsByTagName과 달리 직접 자식만 반환.
     * 예: <hs:sec> 아래의 <hp:p>만 찾고, <hp:subList> 내의 <hp:p>는 무시.
     */
    private getDirectChildrenByTagName(parent: Element, tagName: string): Element[] {
        const results: Element[] = [];

        const children = parent.childNodes;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) { // ELEMENT_NODE
                const elem = child as Element;
                const localName = elem.localName || elem.nodeName.split(':').pop();
                if (localName === tagName) {
                    results.push(elem);
                }
            }
        }

        return results;
    }
}
