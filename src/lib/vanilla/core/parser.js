/**
 * HWPX Parser
 * HWPX 파일을 파싱하여 렌더링 가능한 문서 구조로 변환
 * 
 * @module parser
 * @version 2.0.0
 */

// ✅ JSZip을 직접 import (패키지에 번들됨)
import JSZip from 'jszip';
import { getLogger } from '../utils/logger.js';
import { HWPXConstants } from './constants.js';

const logger = getLogger();

/**
 * HWPX 파서 클래스
 * HWPX 파일(ZIP 형식)을 파싱하여 렌더링 가능한 문서 구조로 변환
 * 
 * @class SimpleHWPXParser
 * 
 * @example
 * import { SimpleHWPXParser } from './parser.js';
 * 
 * const parser = new SimpleHWPXParser({
 *   parseImages: true,
 *   parseTables: true,
 *   parseStyles: true
 * });
 * 
 * const arrayBuffer = await file.arrayBuffer();
 * const document = await parser.parse(arrayBuffer);
 * 
 * console.log('Sections:', document.sections);
 * console.log('Images:', document.images.size);
 */
export class SimpleHWPXParser {
    /**
     * SimpleHWPXParser 생성자
     * @param {Object} [options={}] - 파서 옵션
     * @param {boolean} [options.parseImages=true] - 이미지 파싱 여부
     * @param {boolean} [options.parseTables=true] - 테이블 파싱 여부
     * @param {boolean} [options.parseStyles=true] - 스타일 파싱 여부
     */
    constructor(options = {}) {
        this.options = {
            parseImages: options.parseImages !== false,
            parseTables: options.parseTables !== false,
            parseStyles: options.parseStyles !== false,
            ...options
        };

        // Internal state
        this.entries = new Map();
        this.images = new Map();
        this.styles = new Map();
        this.borderFills = new Map();
        this.paraProperties = new Map();
        this.charProperties = new Map();
        this.fontFaces = new Map();
        this.numberings = new Map();
    }

    /**
     * HWPX 파일 파싱
     * @param {ArrayBuffer} buffer - HWPX 파일의 ArrayBuffer
     * @returns {Promise<Object>} 파싱된 문서 객체
     * @throws {Error} 파싱 중 오류 발생시
     * 
     * @example
     * const document = await parser.parse(arrayBuffer);
     * // Returns: { sections: [], images: Map, metadata: {} }
     */
    async parse(buffer) {
        logger.info('📄 Starting HWPX parsing...');
        logger.time('HWPX Parse');

        try {
            // 1. Unzip HWPX file (ZIP format)
            await this.unzip(buffer);

            // 2. Load resources
            await this.loadBinData();        // Images
            await this.loadBorderFills();    // Border/Fill definitions
            await this.loadParaProperties(); // Paragraph alignment, margins
            await this.loadFontFaces();      // Font faces (names)
            await this.loadCharProperties(); // Fonts, sizes, styles
            await this.loadNumberings();     // Numbering definitions

            // 3. Parse content
            const content = await this.parseContent();

            // 4. Extract raw header.xml (원본 보존용)
            let rawHeaderXml = null;
            try {
                if (this.zip) {
                    const headerFile = this.zip.file('Contents/header.xml');
                    if (headerFile) {
                        rawHeaderXml = await headerFile.async('string');
                        logger.debug('✅ Raw header.xml extracted');
                    } else {
                        logger.warn('⚠️  Contents/header.xml not found in ZIP');
                    }
                } else {
                    logger.warn('⚠️  JSZip instance not available');
                }
            } catch (error) {
                logger.warn('⚠️  Failed to extract raw header.xml:', error);
            }

            // 5. Build document
            const document = {
                sections: content.sections || [],
                images: this.images,
                borderFills: this.borderFills, // ✅ v2.2.12: borderFill 정의 포함
                rawHeaderXml,  // ✅ 원본 header.xml 보존
                metadata: {
                    parsedAt: new Date().toISOString(),
                    sectionsCount: content.sections?.length || 0,
                    imagesCount: this.images.size,
                    borderFillsCount: this.borderFills.size
                }
            };

            logger.info('✅ HWPX parsed successfully');
            logger.debug('Document structure:', document);
            logger.timeEnd('HWPX Parse');

            return document;

        } catch (error) {
            logger.error('❌ HWPX parsing error:', error);
            logger.timeEnd('HWPX Parse');

            const parseError = new Error(`HWPX 파싱 실패: ${error.message}`);
            parseError.originalError = error;
            parseError.stack = error.stack;
            throw parseError;
        }
    }

    /**
     * ZIP 압축 해제
     * @param {ArrayBuffer} buffer - ZIP 파일 버퍼
     * @returns {Promise<void>}
     * @private
     */
    async unzip(buffer) {
        logger.debug('📦 Unzipping HWPX file...');

        const zip = new JSZip();
        const zipData = await zip.loadAsync(buffer);

        // ✅ JSZip 인스턴스 저장 (rawHeaderXml 추출용)
        this.zip = zipData;

        // Store all entries
        for (const [path, zipEntry] of Object.entries(zipData.files)) {
            if (!zipEntry.dir) {
                const data = await zipEntry.async('uint8array');
                this.entries.set(path, data);
                logger.debug(`  ✓ ${path} (${data.length} bytes)`);
            }
        }

        logger.debug(`✅ Unzipped ${this.entries.size} files`);
    }

    /**
     * 바이너리 데이터 로드 (이미지 등)
     * @returns {Promise<void>}
     * @private
     */
    async loadBinData() {
        if (!this.options.parseImages) {
            return;
        }

        logger.debug('🖼️  Loading binary data (images)...');
        let imageCount = 0;

        for (const [path, data] of this.entries) {
            if (path.startsWith('BinData/')) {
                const ext = path.split('.').pop().toLowerCase();
                const mimeTypes = {
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'bmp': 'image/bmp',
                    'svg': 'image/svg+xml',
                    'webp': 'image/webp'
                };

                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                const blob = new Blob([data], { type: mimeType });
                const url = URL.createObjectURL(blob);

                const filename = path.split('/').pop();
                const id = filename.replace(/\.[^.]+$/, ''); // Remove extension

                this.images.set(id, {
                    id,
                    url,
                    path,
                    mimeType,
                    size: data.length,
                    filename
                });

                imageCount++;
                logger.debug(`  ✓ Image: ${filename} (${mimeType}, ${data.length} bytes)`);
            }
        }

        logger.debug(`✅ Loaded ${imageCount} images`);
    }

    /**
     * Border/Fill 정의 로드
     * @returns {Promise<void>}
     * @private
     */
    /**
     * BorderFill 정의 로드 (테이블 테두리 및 배경)
     * @returns {Promise<void>}
     * @private
     */
    async loadBorderFills() {
        logger.debug('🎨 Loading borderFill definitions...');

        const headData = this.entries.get('Contents/header.xml') ||
            this.entries.get('Contents/head.xml');

        if (!headData) {
            logger.warn('⚠️  No header.xml found, skipping borderFill parsing');
            return;
        }

        const headXml = new TextDecoder().decode(headData);
        const parser = new DOMParser();
        const doc = parser.parseFromString(headXml, 'text/xml');

        // Find all borderFill definitions
        const borderFillElems = doc.querySelectorAll('borderFill, hp\\:borderFill, hh\\:borderFill');
        logger.debug(`  Found ${borderFillElems.length} borderFill definitions`);

        borderFillElems.forEach(elem => {
            const id = elem.getAttribute('id') || elem.getAttribute('itemId');
            if (!id) return;

            const borderFill = {
                id: id,
                borders: {},
                fill: {}
            };

            // Parse individual borders (left, right, top, bottom)
            ['left', 'right', 'top', 'bottom'].forEach(side => {
                const borderElem = elem.querySelector(
                    `${side}Border, hh\\:${side}Border, hp\\:${side}Border, ${side}, hp\\:${side}`
                );

                if (borderElem) {
                    const type = borderElem.getAttribute('type') || 'solid';
                    const width = borderElem.getAttribute('width') || '1';
                    const color = borderElem.getAttribute('color') || '#000000';

                    // Check if border is visible
                    const isVisible = type.toUpperCase() !== 'NONE';

                    // Convert width - handle "mm" format and HWPU
                    let widthValue = width;
                    if (typeof width === 'string' && width.includes('mm')) {
                        widthValue = parseFloat(width) * 3.7795; // 1mm = 3.7795px at 96dpi
                    } else {
                        widthValue = parseInt(width) / 7200 * 96; // HWPU to px
                    }
                    const widthPx = isVisible ? Math.max(0.5, widthValue) : 0;

                    borderFill.borders[side] = {
                        type: type,
                        width: widthPx.toFixed(2) + 'px',
                        widthRaw: widthPx,
                        color: this.normalizeColor(color),
                        visible: isVisible,
                        css: isVisible ?
                            `${widthPx.toFixed(2)}px ${this.getBorderStyle(type)} ${this.normalizeColor(color)}` :
                            'none'
                    };
                }
            });

            // Parse diagonal lines (slash, backSlash)
            ['slash', 'backSlash'].forEach(diagonal => {
                const diagonalElem = elem.querySelector(
                    `${diagonal}, hh\\:${diagonal}, hp\\:${diagonal}`
                );

                if (diagonalElem) {
                    const type = diagonalElem.getAttribute('type') || 'solid';
                    const width = diagonalElem.getAttribute('width') || '1';
                    const color = diagonalElem.getAttribute('color') || '#000000';
                    const isVisible = type.toUpperCase() !== 'NONE';

                    // Convert width
                    let widthValue = width;
                    if (typeof width === 'string' && width.includes('mm')) {
                        widthValue = parseFloat(width) * 3.7795;
                    } else {
                        widthValue = parseInt(width) / 7200 * 96;
                    }
                    const widthPx = isVisible ? Math.max(0.5, widthValue) : 0;

                    borderFill.borders[diagonal] = {
                        type: type,
                        width: widthPx,
                        color: this.normalizeColor(color),
                        visible: isVisible
                    };
                }
            });

            // Parse fill (background)
            const fillElem = elem.querySelector('fill, hp\\:fill, fillBrush, hp\\:fillBrush, hh\\:fillBrush, hc\\:fillBrush');
            if (fillElem) {
                // Parse winBrush for faceColor and alpha (transparency)
                const winBrushElem = fillElem.querySelector('winBrush, hc\\:winBrush');
                let fillAlpha = 1.0;
                let faceColor = null;

                if (winBrushElem) {
                    faceColor = winBrushElem.getAttribute('faceColor');
                    const alpha = winBrushElem.getAttribute('alpha');
                    if (alpha) {
                        // Alpha: 0 (opaque) ~ 255 (transparent) → CSS opacity: 1.0 ~ 0.0
                        fillAlpha = 1.0 - (parseInt(alpha) / 255.0);
                    }
                }

                // Solid color fill - try multiple attribute names
                // Priority: winBrush faceColor > fillElem attributes
                const bgColor = faceColor ||
                    fillElem.getAttribute('backgroundColor') ||
                    fillElem.getAttribute('color') ||
                    fillElem.getAttribute('rgb') ||
                    fillElem.getAttribute('bgColor') ||
                    fillElem.getAttribute('fillColor');

                if (bgColor && bgColor !== 'none') {
                    borderFill.fill.backgroundColor = this.normalizeColor(bgColor);
                    borderFill.fill.opacity = fillAlpha;
                    logger.debug(`  ✓ Fill color: ${bgColor} → ${borderFill.fill.backgroundColor} (opacity: ${fillAlpha})`);
                }

                // Pattern fill
                const patternType = fillElem.getAttribute('patternType');
                if (patternType && patternType !== 'none') {
                    borderFill.fill.patternType = patternType;
                    const fgColor = fillElem.getAttribute('patternColor') ||
                        fillElem.getAttribute('foregroundColor');
                    if (fgColor) {
                        borderFill.fill.patternForeground = this.normalizeColor(fgColor);
                    }
                }

                // Gradient fill
                const gradationElem = fillElem.querySelector('gradation, hp\\:gradation, hc\\:gradation');
                if (gradationElem) {
                    const type = gradationElem.getAttribute('type') || 'linear';
                    const angle = gradationElem.getAttribute('angle') || '0';
                    const colors = gradationElem.getAttribute('colors') || '';

                    // Parse gradient colors
                    const colorArray = colors.split(',').map(c => this.normalizeColor(c.trim()));

                    let gradientCSS = '';
                    if (type === 'linear') {
                        gradientCSS = `linear-gradient(${angle}deg, ${colorArray.join(', ')})`;
                    } else if (type === 'radial') {
                        gradientCSS = `radial-gradient(circle, ${colorArray.join(', ')})`;
                    }

                    if (gradientCSS) {
                        borderFill.fill.gradientCSS = gradientCSS;
                    }
                }

                // 🆕 Image fill (imgBrush)
                const imgBrushElem = fillElem.querySelector('imgBrush, hc\\:imgBrush');
                if (imgBrushElem) {
                    const imgElem = imgBrushElem.querySelector('img, hc\\:img');
                    if (imgElem) {
                        const binaryItemIDRef = imgElem.getAttribute('binaryItemIDRef');
                        const mode = imgBrushElem.getAttribute('mode') || 'TILE';

                        if (binaryItemIDRef) {
                            borderFill.fill.backgroundImage = {
                                binaryItemIDRef: binaryItemIDRef,
                                mode: mode // TOTAL, TILE, CENTER, etc.
                            };
                            logger.debug(`  ✓ Image fill: ${binaryItemIDRef} (mode: ${mode})`);
                        }
                    }
                }
            }

            this.borderFills.set(id, borderFill);
            logger.debug(`  ✓ BorderFill [${id}]: borders=${Object.keys(borderFill.borders).length}, fill=${!!borderFill.fill.backgroundColor}`);
        });

        logger.debug(`✅ Loaded ${this.borderFills.size} borderFill definitions`);
    }

    /**
     * 단락 속성 로드 (정렬, 여백 등)
     * @returns {Promise<void>}
     * @private
     */
    async loadParaProperties() {
        logger.debug('📐 Loading paragraph properties...');

        const headData = this.entries.get('Contents/header.xml') ||
            this.entries.get('Contents/head.xml');

        if (!headData) {
            logger.warn('⚠️  No header.xml found');
            return;
        }

        const headXml = new TextDecoder('utf-8').decode(headData);
        const parser = new DOMParser();
        const doc = parser.parseFromString(headXml, 'text/xml');

        // Find all paraPr definitions
        const paraPrElems = doc.querySelectorAll('paraPr, hp\\:paraPr, hh\\:paraPr');
        logger.debug(`  Found ${paraPrElems.length} paragraph properties`);

        paraPrElems.forEach(elem => {
            const id = elem.getAttribute('id') || elem.getAttribute('itemId');
            if (!id) return;

            const paraProp = { id };

            // Parse align element
            const alignElem = elem.querySelector('align, hp\\:align, hh\\:align');
            if (alignElem) {
                const horizontal = alignElem.getAttribute('horizontal');
                const vertical = alignElem.getAttribute('vertical');

                if (horizontal) {
                    const hAlignMap = {
                        'LEFT': 'left',
                        'CENTER': 'center',
                        'RIGHT': 'right',
                        'JUSTIFY': 'justify',
                        'DISTRIBUTE': 'justify'
                    };
                    paraProp.textAlign = hAlignMap[horizontal.toUpperCase()] || 'left';
                }

                if (vertical) {
                    const vAlignMap = {
                        'TOP': 'top',
                        'CENTER': 'middle',
                        'MIDDLE': 'middle',
                        'BOTTOM': 'bottom',
                        'BASELINE': 'baseline'
                    };
                    paraProp.verticalAlign = vAlignMap[vertical.toUpperCase()] || 'baseline';
                }
            }

            // Parse margins
            const marginElem = elem.querySelector('margin, hp\\:margin, hh\\:margin');
            if (marginElem) {
                const left = marginElem.getAttribute('left');
                const right = marginElem.getAttribute('right');
                const top = marginElem.getAttribute('top');
                const bottom = marginElem.getAttribute('bottom');

                if (left) paraProp.marginLeft = HWPXConstants.hwpuToPx(parseInt(left));
                if (right) paraProp.marginRight = HWPXConstants.hwpuToPx(parseInt(right));
                if (top) paraProp.marginTop = HWPXConstants.hwpuToPx(parseInt(top));
                if (bottom) paraProp.marginBottom = HWPXConstants.hwpuToPx(parseInt(bottom));
            }

            // ✅ Parse lineHeight (행간)
            // Check for lineSpacing element or fontLineHeight attribute
            const lineSpacingElem = elem.querySelector('lineSpacing, hp\\:lineSpacing, hh\\:lineSpacing');
            if (lineSpacingElem) {
                const type = lineSpacingElem.getAttribute('type');
                const value = lineSpacingElem.getAttribute('value');

                if (type && value) {
                    // type: PERCENT, FIXED, AT_LEAST, BETWEEN_LINES
                    if (type === 'PERCENT' || type === 'RATIO') {
                        // value는 100 = 100%, 200 = 200%
                        const percent = parseInt(value);
                        paraProp.lineHeight = (percent / 100).toFixed(2);
                    }
                }
            }

            // Fallback: check fontLineHeight attribute (0=100%, 1=custom)
            const fontLineHeight = elem.getAttribute('fontLineHeight');
            if (fontLineHeight === '0' && !paraProp.lineHeight) {
                paraProp.lineHeight = '1.0'; // 100%
            }

            this.paraProperties.set(id, paraProp);
            logger.debug(`  ✓ ParaProp [${id}]: align=${paraProp.textAlign || 'none'}, lineHeight=${paraProp.lineHeight || 'default'}`);
        });

        logger.debug(`✅ Loaded ${this.paraProperties.size} paragraph properties`);
    }

    /**
     * 문자 속성 로드 (폰트, 크기, 스타일)
     * @returns {Promise<void>}
     * @private
     */
    async loadCharProperties() {
        logger.debug('🔤 Loading character properties...');

        const headData = this.entries.get('Contents/header.xml') ||
            this.entries.get('Contents/head.xml');

        if (!headData) {
            logger.warn('⚠️  No header.xml found');
            return;
        }

        const headXml = new TextDecoder('utf-8').decode(headData);
        const parser = new DOMParser();
        const doc = parser.parseFromString(headXml, 'text/xml');

        // Parse character properties
        const charProps = doc.querySelectorAll('charPr, hh\\:charPr');
        logger.debug(`  Found ${charProps.length} character properties`);

        charProps.forEach(cpElem => {
            const id = cpElem.getAttribute('id');
            if (!id) {
                return;
            }

            const charProp = { id };

            // Font size
            const height = cpElem.getAttribute('height');
            if (height) {
                const ptSize = parseInt(height) / 100;
                const pxSize = HWPXConstants.ptToPx(ptSize);
                charProp.fontSize = `${ptSize}pt`;
                charProp.fontSizePx = `${pxSize.toFixed(2)}px`;
            }

            // Font face
            const fontId = cpElem.getAttribute('fontRef');
            if (fontId) {
                charProp.fontId = fontId;
                // Resolve font name from fontFaces
                if (this.fontFaces.has(fontId)) {
                    const fontFace = this.fontFaces.get(fontId);
                    charProp.fontFamily = fontFace.name || 'Malgun Gothic';
                }
            }

            // Colors
            const textColor = cpElem.getAttribute('textColor');
            if (textColor && textColor !== 'auto') {
                charProp.color = this.normalizeColor(textColor);
            }

            // Styles from attributes
            if (cpElem.getAttribute('bold') === '1') {
                charProp.bold = true;
            }
            if (cpElem.getAttribute('italic') === '1') {
                charProp.italic = true;
            }
            if (cpElem.getAttribute('underline') === '1') {
                charProp.underline = true;
            }

            // Parse child elements for detailed styling

            // Bold (child element)
            const boldElem = cpElem.querySelector('bold, hh\\:bold');
            if (boldElem) {
                charProp.bold = true;
            }

            // Italic (child element)
            const italicElem = cpElem.querySelector('italic, hh\\:italic');
            if (italicElem) {
                charProp.italic = true;
            }

            // Underline (child element with details)
            const underlineElem = cpElem.querySelector('underline, hh\\:underline');
            if (underlineElem) {
                const underlineType = underlineElem.getAttribute('type');
                if (underlineType && underlineType !== 'NONE') {
                    charProp.underline = true;
                    charProp.underlineType = underlineType;
                    const underlineColor = underlineElem.getAttribute('color');
                    if (underlineColor) {
                        charProp.underlineColor = this.normalizeColor(underlineColor);
                    }
                }
            }

            // Strikeout (취소선) - type 속성으로 판단
            const strikeoutElem = cpElem.querySelector('strikeout, hh\\:strikeout');
            if (strikeoutElem) {
                const strikeoutType = strikeoutElem.getAttribute('type');
                // type이 있고 NONE이 아니면 취소선 있음
                if (strikeoutType && strikeoutType !== 'NONE') {
                    charProp.strikethrough = true;
                    const strikeoutColor = strikeoutElem.getAttribute('color');
                    if (strikeoutColor) {
                        charProp.strikethroughColor = this.normalizeColor(strikeoutColor);
                    }
                }
            }

            // Outline (외곽선)
            const outlineElem = cpElem.querySelector('outline, hh\\:outline');
            if (outlineElem) {
                const outlineType = outlineElem.getAttribute('type');
                if (outlineType && outlineType !== 'NONE') {
                    charProp.outline = true;
                }
            }

            // Shadow (그림자)
            const shadowElem = cpElem.querySelector('shadow, hh\\:shadow');
            if (shadowElem) {
                const shadowType = shadowElem.getAttribute('type');
                if (shadowType && shadowType !== 'NONE') {
                    charProp.textShadow = true;
                    const shadowColor = shadowElem.getAttribute('color');
                    const offsetX = shadowElem.getAttribute('offsetX');
                    const offsetY = shadowElem.getAttribute('offsetY');

                    if (shadowColor && offsetX && offsetY) {
                        // Convert HWPU to px
                        const offsetXPx = parseInt(offsetX) / 7200 * 96;
                        const offsetYPx = parseInt(offsetY) / 7200 * 96;
                        charProp.textShadowValue = `${offsetXPx.toFixed(1)}px ${offsetYPx.toFixed(1)}px 0 ${this.normalizeColor(shadowColor)}`;
                    }
                }
            }

            // Spacing (자간)
            const spacingElem = cpElem.querySelector('spacing, hh\\:spacing');
            if (spacingElem) {
                const hangulSpacing = spacingElem.getAttribute('hangul');
                if (hangulSpacing && parseInt(hangulSpacing) !== 0) {
                    // spacing is in % (-50 to 50)
                    const spacingPercent = parseInt(hangulSpacing) / 100;
                    charProp.letterSpacing = `${spacingPercent.toFixed(2)}em`;
                }
            }

            // Ratio (장평 - 글자 폭 비율)
            const ratioElem = cpElem.querySelector('ratio, hh\\:ratio');
            if (ratioElem) {
                const hangulRatio = ratioElem.getAttribute('hangul');
                if (hangulRatio && parseInt(hangulRatio) !== 100) {
                    // ratio is in % (default 100)
                    const ratioPercent = parseInt(hangulRatio);
                    charProp.scaleX = ratioPercent / 100;
                }
            }

            // Offset (위첨자/아래첨자)
            const offsetElem = cpElem.querySelector('offset, hh\\:offset');
            if (offsetElem) {
                const hangulOffset = offsetElem.getAttribute('hangul');
                if (hangulOffset && parseInt(hangulOffset) !== 0) {
                    const offsetValue = parseInt(hangulOffset);
                    if (offsetValue > 0) {
                        charProp.verticalAlign = 'super';
                    } else if (offsetValue < 0) {
                        charProp.verticalAlign = 'sub';
                    }
                }
            }

            // Background color (shadeColor)
            const shadeColor = cpElem.getAttribute('shadeColor');
            if (shadeColor && shadeColor !== 'none' && shadeColor !== 'auto') {
                charProp.backgroundColor = this.normalizeColor(shadeColor);
            }

            this.charProperties.set(id, charProp);
        });

        logger.debug(`✅ Loaded ${this.charProperties.size} character properties`);
    }

    /**
     * 폰트 페이스 로드
     * @returns {Promise<void>}
     * @private
     */
    async loadFontFaces() {
        logger.debug('🔤 Loading font faces...');

        const headData = this.entries.get('Contents/header.xml') ||
            this.entries.get('Contents/head.xml');

        if (!headData) {
            logger.warn('⚠️  No header.xml found');
            return;
        }

        const headXml = new TextDecoder('utf-8').decode(headData);
        const parser = new DOMParser();
        const doc = parser.parseFromString(headXml, 'text/xml');

        // Parse font faces
        const fontFaces = doc.querySelectorAll('fontFace, hh\\:fontFace');
        logger.debug(`  Found ${fontFaces.length} font faces`);

        fontFaces.forEach(ffElem => {
            const id = ffElem.getAttribute('id');
            if (!id) return;

            const fontFace = { id };

            // Font names by language
            const fontNames = ffElem.querySelectorAll('font, hh\\:font');
            fontNames.forEach(fontElem => {
                const lang = fontElem.getAttribute('lang');
                const name = fontElem.getAttribute('name') || fontElem.getAttribute('face');
                if (name) {
                    if (lang === 'LATIN') {
                        fontFace.latin = name;
                    } else if (lang === 'HANGUL') {
                        fontFace.hangul = name;
                    } else if (lang === 'HANJA') {
                        fontFace.hanja = name;
                    } else if (lang === 'JAPANESE') {
                        fontFace.japanese = name;
                    } else if (lang === 'OTHER') {
                        fontFace.other = name;
                    }
                }
            });

            // Default font name (use hangul first, then latin)
            fontFace.name = fontFace.hangul || fontFace.latin || fontFace.other || 'Malgun Gothic';

            this.fontFaces.set(id, fontFace);
            logger.debug(`  ✓ FontFace [${id}]: ${fontFace.name}`);
        });

        logger.debug(`✅ Loaded ${this.fontFaces.size} font faces`);
    }

    /**
     * 번호 매기기 정의 로드
     * @returns {Promise<void>}
     * @private
     */
    async loadNumberings() {
        logger.debug('🔢 Loading numbering definitions...');
        // Implementation details...
    }

    /**
     * 문서 컨텐츠 파싱
     * @returns {Promise<Object>} 파싱된 컨텐츠
     * @private
     */
    async parseContent() {
        logger.debug('📄 Parsing document content...');

        const sections = [];
        const sectionFiles = Array.from(this.entries.keys())
            .filter(path => path.match(/Contents\/section\d+\.xml/))
            .sort();

        logger.debug(`  Found ${sectionFiles.length} sections`);

        for (const sectionPath of sectionFiles) {
            const sectionData = this.entries.get(sectionPath);
            if (!sectionData) {
                continue;
            }

            const sectionXml = new TextDecoder('utf-8').decode(sectionData);
            const parser = new DOMParser();
            const doc = parser.parseFromString(sectionXml, 'text/xml');

            const section = await this.parseSection(doc);
            if (section) {
                sections.push(section);
            }
        }

        return { sections };
    }

    /**
     * 섹션 파싱
     * @param {Document} doc - XML Document
     * @returns {Promise<Object>} 파싱된 섹션
     * @private
     */
    async parseSection(doc) {
        const section = {
            elements: [],
            pageSettings: {},
            headers: { both: null, odd: null, even: null },
            footers: { both: null, odd: null, even: null },
            pageNum: null,
            colPr: null
        };

        // ✅ Parse page settings from secPr
        const secPrElem = doc.querySelector('secPr, hp\\:secPr');
        if (secPrElem) {
            const pagePrElem = secPrElem.querySelector('pagePr, hp\\:pagePr');
            if (pagePrElem) {
                const width = pagePrElem.getAttribute('width');
                const height = pagePrElem.getAttribute('height');
                const landscape = pagePrElem.getAttribute('landscape');

                if (width) {
                    const widthPx = Math.round(parseInt(width) / 7200 * 96);
                    section.pageSettings.width = `${widthPx}px`;
                    section.pageWidth = widthPx; // Direct property for easy access
                }
                if (height) {
                    const heightPx = Math.round(parseInt(height) / 7200 * 96);
                    section.pageSettings.height = `${heightPx}px`;
                    section.pageHeight = heightPx; // Direct property for easy access
                }
                if (landscape) {
                    section.pageSettings.landscape = landscape;
                }

                // Parse margins (CRITICAL!)
                const marginElem = pagePrElem.querySelector('margin, hp\\:margin');
                if (marginElem) {
                    const left = marginElem.getAttribute('left');
                    const right = marginElem.getAttribute('right');
                    const top = marginElem.getAttribute('top');
                    const bottom = marginElem.getAttribute('bottom');

                    const marginLeftPx = left ? Math.round(parseInt(left) / 7200 * 96) : 0;
                    const marginRightPx = right ? Math.round(parseInt(right) / 7200 * 96) : 0;
                    const marginTopPx = top ? Math.round(parseInt(top) / 7200 * 96) : 0;
                    const marginBottomPx = bottom ? Math.round(parseInt(bottom) / 7200 * 96) : 0;

                    section.pageSettings.marginLeft = `${marginLeftPx}px`;
                    section.pageSettings.marginRight = `${marginRightPx}px`;
                    section.pageSettings.marginTop = `${marginTopPx}px`;
                    section.pageSettings.marginBottom = `${marginBottomPx}px`;

                    // Direct properties for easy access
                    section.marginLeft = marginLeftPx;
                    section.marginRight = marginRightPx;
                    section.marginTop = marginTopPx;
                    section.marginBottom = marginBottomPx;

                    logger.debug(`📐 Page margins: T=${section.pageSettings.marginTop} R=${section.pageSettings.marginRight} B=${section.pageSettings.marginBottom} L=${section.pageSettings.marginLeft}`);
                }

                logger.debug(`📄 Page settings: ${section.pageSettings.width} × ${section.pageSettings.height}`);
            }

            // Parse page numbering settings
            const pageNumElem = secPrElem.querySelector('pageNum, hp\\:pageNum');
            if (pageNumElem) {
                section.pageNum = {
                    start: parseInt(pageNumElem.getAttribute('start')) || 1,
                    format: pageNumElem.getAttribute('format') || 'DECIMAL'
                };
            }

            // Parse multi-column layout
            const colPrElem = secPrElem.querySelector('colPr, hp\\:colPr');
            if (colPrElem) {
                const colCount = parseInt(colPrElem.getAttribute('colCount')) || 1;
                if (colCount > 1) {
                    section.colPr = {
                        colCount,
                        colSpacing: parseInt(colPrElem.getAttribute('colSpacing')) || 0
                    };
                    logger.debug(`📰 Multi-column layout: ${colCount} columns`);
                }
            }

            // ✅ v2.2.12: Parse pageBorderFill for page background (image or color)
            const pageBorderFillElems = secPrElem.querySelectorAll('pageBorderFill, hp\\:pageBorderFill');
            if (pageBorderFillElems.length > 0) {
                section.pageBackground = {};
                pageBorderFillElems.forEach(pbfElem => {
                    const type = pbfElem.getAttribute('type') || 'BOTH'; // BOTH, ODD, EVEN
                    const borderFillIDRef = pbfElem.getAttribute('borderFillIDRef');
                    const fillArea = pbfElem.getAttribute('fillArea') || 'PAPER';

                    if (borderFillIDRef && this.borderFills.has(borderFillIDRef)) {
                        const borderFillDef = this.borderFills.get(borderFillIDRef);

                        const bgInfo = {
                            fillArea,
                            backgroundColor: borderFillDef.fill?.backgroundColor,
                            backgroundImage: borderFillDef.fill?.backgroundImage,
                            gradientCSS: borderFillDef.fill?.gradientCSS
                        };

                        if (type === 'BOTH') {
                            section.pageBackground.both = bgInfo;
                            section.pageBackground.odd = bgInfo;
                            section.pageBackground.even = bgInfo;
                        } else if (type === 'ODD') {
                            section.pageBackground.odd = bgInfo;
                        } else if (type === 'EVEN') {
                            section.pageBackground.even = bgInfo;
                        }

                        if (bgInfo.backgroundImage) {
                            logger.debug(`🖼️ Page background image: ${bgInfo.backgroundImage.binaryItemIDRef} (type: ${type})`);
                        } else if (bgInfo.backgroundColor) {
                            logger.debug(`🎨 Page background color: ${bgInfo.backgroundColor} (type: ${type})`);
                        }
                    }
                });
            }
        }

        // ✅ CRITICAL FIX: Parse in XML document order to maintain layout
        // Find the section body element
        let bodyElem = doc.documentElement;
        const possibleBody = bodyElem.querySelector('body, hh\\:body, hp\\:body, hs\\:sec');
        if (possibleBody) {
            bodyElem = possibleBody;
        }

        // Get all direct children of body/section in document order
        const children = Array.from(bodyElem.children);
        logger.debug(`  Found ${children.length} top-level elements`);

        let parsedCount = 0;
        children.forEach((child, idx) => {
            const localName = (child.localName || child.tagName).toLowerCase().replace(/^hp:|^hh:|^hs:/, '');

            // Skip headers, footers (already parsed)
            if (localName === 'header' || localName === 'footer') {
                return;
            }

            // Handle paragraph
            if (localName === 'p') {
                // Skip if inside table/container/etc (defensive, shouldn't happen at top level)
                if (child.closest('tbl, hp\\:tbl, tc, hp\\:tc, container, hp\\:container')) {
                    return;
                }

                const containsTable = child.querySelector('tbl, hp\\:tbl');
                const containsContainer = child.querySelector('container, hp\\:container');
                const hasRuns = child.querySelectorAll('run, hp\\:run').length > 0;
                const containsStandaloneShapes = !hasRuns && child.querySelector('rect, hp\\:rect, ellipse, hp\\:ellipse, polygon, hp\\:polygon');

                // ✅ Don't skip container paragraphs - they should be parsed normally
                // The containers inside will be parsed by parseParagraph
                // Skip only standalone shapes without runs
                if (containsStandaloneShapes && !containsContainer) {
                    return;
                }

                // ✅ CRITICAL: Parse tables INSIDE this paragraph (p > run > tbl)
                // MAINTAIN EXACT RUN ORDER: text runs and tables in original sequence
                if (containsTable) {
                    const runs = child.querySelectorAll(':scope > run, :scope > hp\\:run');
                    let currentTextRuns = [];

                    runs.forEach((runElem, runIdx) => {
                        const children = Array.from(runElem.children);

                        // ✅ v2.2.12: Check for shapes (rect/ellipse/polygon) FIRST
                        // Shapes may contain tables inside their drawText
                        const hasShapeInRun = children.some(c => {
                            const ln = (c.localName || c.tagName).toLowerCase();
                            return ['rect', 'ellipse', 'polygon'].includes(ln) ||
                                   ln.endsWith(':rect') || ln.endsWith(':ellipse') || ln.endsWith(':polygon');
                        });

                        const hasTableInRun = children.some(c => {
                            const ln = (c.localName || c.tagName).toLowerCase();
                            return ln === 'tbl' || ln.endsWith(':tbl');
                        });

                        // ✅ v2.2.12: If run has shape, parse as paragraph to handle shapes properly
                        if (hasShapeInRun) {
                            // Flush accumulated text runs first
                            if (currentTextRuns.length > 0) {
                                const para = {
                                    type: 'paragraph',
                                    runs: currentTextRuns,
                                    text: currentTextRuns.map(r => r.text).join(' '),
                                    style: {}
                                };
                                section.elements.push(para);
                                parsedCount++;
                                currentTextRuns = [];
                            }

                            // Parse the entire paragraph to handle shapes with their drawText content
                            const para = this.parseParagraph(child);
                            if (para) {
                                section.elements.push(para);
                                parsedCount++;
                            }
                            // Skip remaining runs since parseParagraph handles all runs
                            return;
                        }

                        if (hasTableInRun && this.options.parseTables) {
                            // Flush accumulated text runs as a paragraph
                            if (currentTextRuns.length > 0) {
                                const para = {
                                    type: 'paragraph',
                                    runs: currentTextRuns,
                                    text: currentTextRuns.map(r => r.text).join(' '),
                                    style: {}
                                };
                                section.elements.push(para);
                                parsedCount++;
                                currentTextRuns = [];
                            }

                            // Parse and add ALL tables in this run (not just the first one!)
                            const tblElems = runElem.querySelectorAll('tbl, hp\\:tbl');
                            tblElems.forEach(tblElem => {
                                const table = this.parseTable(tblElem);
                                if (table) {
                                    section.elements.push(table);
                                    parsedCount++;
                                }
                            });
                        } else {
                            // Accumulate text runs
                            const tElem = runElem.querySelector('t, hp\\:t');
                            const text = tElem ? tElem.textContent : '';

                            if (text.trim()) {
                                const charPrId = runElem.getAttribute('charPrIDRef');
                                const run = { text: text };  // Keep original text (with spaces)

                                // Apply character properties from reference
                                if (charPrId && this.charProperties.has(charPrId)) {
                                    run.style = { ...this.charProperties.get(charPrId) };
                                } else {
                                    run.style = {};
                                }

                                currentTextRuns.push(run);
                            }
                        }
                    });

                    // Flush any remaining text runs
                    if (currentTextRuns.length > 0) {
                        const para = {
                            type: 'paragraph',
                            runs: currentTextRuns,
                            text: currentTextRuns.map(r => r.text).join(' '),
                            style: {}
                        };
                        section.elements.push(para);
                        parsedCount++;
                    }
                } else {
                    // Normal paragraph
                    const para = this.parseParagraph(child);
                    if (para) {
                        section.elements.push(para);
                        parsedCount++;
                    }
                }
            }
            // Handle standalone table (rare, but possible)
            else if (localName === 'tbl' && this.options.parseTables) {
                const table = this.parseTable(child);
                if (table) {
                    section.elements.push(table);
                    parsedCount++;
                }
            }
            // ✅ v2.2.7i: Handle subList (direct child of section, but contains nested paragraphs)
            else if (localName === 'sublist') {
                // Parse all paragraphs inside this subList
                const parasInSubList = child.querySelectorAll('p, hp\\:p');
                parasInSubList.forEach(pElem => {
                    const para = this.parseParagraph(pElem);
                    if (para) {
                        section.elements.push(para);
                        parsedCount++;
                    }
                });
            }
        });

        logger.debug(`  Parsed ${parsedCount} elements in document order`);

        // ✅ Parse standalone images (not inside paragraphs/tables)
        // Note: Most images are inline in paragraphs and parsed by parseParagraph
        // This only catches top-level images that are direct children of section
        if (this.options.parseImages) {
            const allImages = doc.querySelectorAll('pic, hp\\:pic');
            let standaloneCount = 0;

            allImages.forEach(picElem => {
                // Check if this image is NOT inside a paragraph or table
                const parent = picElem.parentElement;
                const parentTag = parent ? (parent.localName || parent.tagName).toLowerCase().replace('hp:', '') : '';

                // Skip if parent is 'run' (inline in paragraph) or inside table
                if (parentTag === 'run' || picElem.closest('p, hp\\:p, tbl, hp\\:tbl')) {
                    return;
                }

                const image = this.parseImage(picElem);
                if (image) {
                    section.elements.push(image);
                    standaloneCount++;
                }
            });

            if (standaloneCount > 0) {
                logger.debug(`  Found ${standaloneCount} standalone images (${allImages.length - standaloneCount} inline)`);
            }
        }

        // ✅ Parse shapes (including DrawText!)
        // ONLY parse standalone shapes (not inside containers/paragraphs)
        const shapes = doc.querySelectorAll('rect, hp\\:rect, ellipse, hp\\:ellipse, polygon, hp\\:polygon');
        logger.debug(`  Found ${shapes.length} total shapes`);
        let standaloneShapes = 0;
        shapes.forEach(shapeElem => {
            // Skip if inside a container (will be parsed by parseContainer)
            if (shapeElem.closest('container, hp\\:container')) {
                return;
            }
            // Skip if inside a paragraph run (will be parsed by parseParagraph)
            if (shapeElem.closest('run, hp\\:run')) {
                return;
            }

            const shape = this.parseShape(shapeElem);
            if (shape) {
                section.elements.push(shape);
                standaloneShapes++;
            }
        });
        console.log(`[parseSection] Added ${standaloneShapes} standalone shapes (${shapes.length - standaloneShapes} inside containers/paragraphs)`);

        // ✅ Parse text boxes
        const textboxes = doc.querySelectorAll('textbox, hp\\:textbox');
        logger.debug(`  Found ${textboxes.length} textboxes`);
        textboxes.forEach(textboxElem => {
            const textbox = this.parseTextBox(textboxElem);
            if (textbox) {
                section.elements.push(textbox);
            }
        });

        // ✅ Parse containers (group objects)
        // ONLY parse top-level containers (not nested inside other containers/paragraphs)
        const containers = doc.querySelectorAll('container, hp\\:container');
        logger.debug(`  Found ${containers.length} total containers`);
        let topLevelContainers = 0;
        containers.forEach(containerElem => {
            // Skip if inside another container (will be parsed by parent's parseContainer)
            const parentContainer = containerElem.parentElement?.closest('container, hp\\:container');
            if (parentContainer && parentContainer !== containerElem) {
                return;
            }
            // Skip if inside a paragraph run (will be parsed by parseParagraph)
            if (containerElem.closest('run, hp\\:run')) {
                return;
            }

            const container = this.parseContainer(containerElem);
            if (container) {
                section.elements.push(container);
                topLevelContainers++;
            }
        });
        console.log(`[parseSection] Added ${topLevelContainers} top-level containers (${containers.length - topLevelContainers} nested)`);

        logger.debug(`  ✅ Section complete: ${section.elements.length} total elements`);
        return section;
    }

    /**
     * 단락 파싱
     * @param {Element} pElem - 단락 XML 요소
     * @returns {Object|null} 파싱된 단락
     * @private
     */
    parseParagraph(pElem) {
        const para = {
            type: 'paragraph',
            runs: [],
            shapes: [],
            style: {}
        };

        // Parse paragraph properties reference for alignment, lineHeight, etc.
        const paraPrIDRef = pElem.getAttribute('paraPrIDRef');
        if (paraPrIDRef && this.paraProperties.has(paraPrIDRef)) {
            const paraProp = this.paraProperties.get(paraPrIDRef);
            if (paraProp.textAlign) {
                para.style.textAlign = paraProp.textAlign;
            }
            if (paraProp.verticalAlign) {
                para.style.verticalAlign = paraProp.verticalAlign;
            }
            if (paraProp.lineHeight) {
                para.style.lineHeight = paraProp.lineHeight;
            }
        }

        // Parse runs (with potential inline shapes and images)
        const runs = pElem.querySelectorAll('run, hp\\:run');

        if (runs.length > 0) {
            let skipRemainingRuns = false; // Flag to skip runs after inline object

            runs.forEach(runElem => {
                // ✅ Skip runs after an inline table/image (they are duplicates of content inside the object)
                if (skipRemainingRuns) {
                    return;
                }

                const charPrId = runElem.getAttribute('charPrIDRef');
                const ns = 'http://www.hancom.co.kr/hwpml/2011/paragraph';

                // ✅ Check if this run contains inline object (tbl, pic, shape)
                const hasInlineObject = runElem.querySelector('tbl, hp\\:tbl, pic, hp\\:pic, rect, hp\\:rect, ellipse, hp\\:ellipse');

                // ✅ Process ALL children in the run (a run can have multiple elements)
                const children = Array.from(runElem.children || []);

                children.forEach(child => {
                    const localName = child.localName || child.tagName.split(':').pop();

                    // ✅ Skip secPr (section properties) and ctrl (control) - metadata, not content
                    if (localName === 'secPr' || localName === 'ctrl') {
                        return;
                    }

                    // Check for inline images (pic)
                    if (localName === 'pic') {
                        const image = this.parseImage(child);
                        if (image) {
                            // ✅ v2.2.9: 이미지가 절대 위치(horzOffset/vertOffset)를 가진 경우
                            // treatAsChar를 강제로 true로 설정하지 않음
                            const hasAbsolutePosition =
                                (image.position?.x !== undefined && image.position?.x !== 0) ||
                                (image.position?.y !== undefined && image.position?.y !== 0);

                            if (hasAbsolutePosition) {
                                // 절대 위치가 있으면 파싱된 treatAsChar 값 유지 (기본 false)
                                console.log(`[parseParagraph] Image with absolute position: x=${image.position?.x}, y=${image.position?.y}, treatAsChar=${image.position?.treatAsChar}`);
                            } else if (!image.position?.treatAsChar) {
                                // 절대 위치가 없고 treatAsChar가 명시적으로 false가 아니면 inline으로 처리
                                image.treatAsChar = true;
                            }

                            if (!para.images) para.images = [];
                            para.images.push(image);

                            para.runs.push({
                                text: '',
                                hasImage: true,
                                imageIndex: para.images.length - 1,
                                style: {},
                                charPrIDRef: charPrId
                            });
                        }
                    }

                    // Check for inline containers (group objects with images/shapes)
                    else if (localName === 'container') {
                        console.log(`[parseParagraph] Found inline container in run`);
                        const container = this.parseContainer(child);
                        if (container) {
                            container.treatAsChar = true;
                            para.shapes.push(container);
                            console.log(`  → Added container with ${container.children?.length || 0} children to para.shapes`);

                            para.runs.push({
                                text: '',
                                hasShape: true,
                                style: {},
                                charPrIDRef: charPrId
                            });
                        }
                    }
                    // Check for inline shapes
                    else if (['rect', 'ellipse', 'polygon'].includes(localName)) {
                        console.log(`[parseParagraph] Found inline shape (${localName}) in run`);
                        const shape = this.parseShape(child);
                        if (shape) {
                            // ✅ v2.2.10: 배경 도형(BEHIND_TEXT)은 treatAsChar 강제 설정 안 함
                            if (shape.isBackground || shape.position?.textWrap === 'BEHIND_TEXT') {
                                // 배경 도형은 별도 배열에 저장
                                if (!para.backgroundShapes) para.backgroundShapes = [];
                                para.backgroundShapes.push(shape);
                                console.log(`  → Added background shape to para.backgroundShapes`);
                            } else {
                                shape.treatAsChar = true;
                                para.shapes.push(shape);
                                console.log(`  → Added shape with text "${shape.drawText?.paragraphs?.[0]?.text || 'no text'}" to para.shapes`);

                                para.runs.push({
                                    text: '',
                                    hasShape: true,
                                    style: {},
                                    charPrIDRef: charPrId
                                });
                            }
                        }
                    }

                    // Check for inline tables (tbl)
                    else if (localName === 'tbl') {
                        const table = this.parseTable(child);
                        if (table) {
                            table.treatAsChar = true;
                            if (!para.tables) para.tables = [];
                            para.tables.push(table);

                            para.runs.push({
                                text: '',
                                hasTable: true,
                                tableIndex: para.tables.length - 1,
                                style: {},
                                charPrIDRef: charPrId
                            });
                        }
                    }
                    // Parse text
                    else if (localName === 't') {
                        // ✅ v2.2.13: Check if <t> contains <tab> or <lineBreak> elements (nested structure)
                        // Check all child elements for tabs or lineBreaks
                        const childElements = Array.from(child.children || []);
                        const hasNestedElements = childElements.some(el => {
                            const name = (el.localName || el.tagName || '').toLowerCase().replace(/^hp:/, '');
                            return name === 'tab' || name === 'linebreak';
                        });

                        if (hasNestedElements) {
                            // Parse text, tabs, and lineBreaks in order
                            const childNodes = Array.from(child.childNodes);

                            childNodes.forEach(node => {
                                if (node.nodeType === 3) { // Text node
                                    const text = node.textContent || '';
                                    if (text.length > 0) {
                                        const run = { text, style: {} };

                                        if (charPrId) {
                                            run.charPrIDRef = charPrId;
                                        }

                                        if (charPrId && this.charProperties.has(charPrId)) {
                                            const charProp = this.charProperties.get(charPrId);
                                            run.style = { ...charProp };
                                        }

                                        para.runs.push(run);
                                    }
                                } else if (node.nodeType === 1) { // Element node
                                    // Handle namespace prefix (hp:lineBreak -> linebreak)
                                    let nodeName = node.localName || node.tagName || '';
                                    if (nodeName.includes(':')) {
                                        nodeName = nodeName.split(':').pop();
                                    }
                                    nodeName = nodeName.toLowerCase();

                                    if (nodeName === 'tab') {
                                        // Parse nested tab
                                        const tab = {
                                            type: 'tab',
                                            style: {}
                                        };

                                        const width = node.getAttribute('width');
                                        const leader = node.getAttribute('leader');
                                        const tabType = node.getAttribute('type');

                                        if (width) {
                                            tab.widthHWPU = parseInt(width);
                                            tab.widthPx = HWPXConstants.hwpuToPx(tab.widthHWPU);
                                        }

                                        if (leader) {
                                            tab.leader = parseInt(leader);
                                        }

                                        if (tabType) {
                                            tab.tabType = parseInt(tabType);
                                        }

                                        para.runs.push(tab);
                                    } else if (nodeName === 'linebreak') {
                                        // ✅ v2.2.13: Parse lineBreak element
                                        para.runs.push({ type: 'linebreak' });
                                    }
                                }
                            });
                        } else {
                            // No nested tabs/lineBreaks - simple text
                            const text = child.textContent || '';
                            const run = { text, style: {} };

                            if (charPrId) {
                                run.charPrIDRef = charPrId;
                            }

                            // Apply character properties
                            if (charPrId && this.charProperties.has(charPrId)) {
                                const charProp = this.charProperties.get(charPrId);
                                run.style = { ...charProp };
                            }

                            para.runs.push(run);
                        }
                    }
                    // Parse tab (탭 문자)
                    else if (localName === 'tab') {
                        const tab = {
                            type: 'tab',
                            style: {}
                        };

                        // Parse tab attributes
                        const width = child.getAttribute('width');
                        const leader = child.getAttribute('leader');
                        const tabType = child.getAttribute('type');

                        if (width) {
                            tab.widthHWPU = parseInt(width);
                            tab.widthPx = HWPXConstants.hwpuToPx(tab.widthHWPU);
                        }

                        // Leader types: 0=NONE, 1=DOT, 2=HYPHEN, 3=DASH, 4=LINE, 5=MIDDLE_DOT
                        if (leader) {
                            tab.leader = parseInt(leader);
                        }

                        if (tabType) {
                            tab.tabType = parseInt(tabType);
                        }

                        para.runs.push(tab);
                    }
                });

                // ✅ If this run had an inline object, skip all remaining runs (they are duplicates)
                if (hasInlineObject) {
                    skipRemainingRuns = true;
                }
            });
        } else {
            // Fallback: direct text elements (old format)
            const textElems = pElem.querySelectorAll('t, hp\\:t');
            textElems.forEach(tElem => {
                const text = tElem.textContent;
                const charPrId = tElem.getAttribute('charPrIDRef');

                const run = { text };

                if (charPrId && this.charProperties.has(charPrId)) {
                    run.style = { ...this.charProperties.get(charPrId) };
                }

                para.runs.push(run);
            });
        }

        // Clean up empty arrays
        if (para.shapes.length === 0) {
            delete para.shapes;
        }
        if (para.images && para.images.length === 0) {
            delete para.images;
        }
        if (para.tables && para.tables.length === 0) {
            delete para.tables;
        }

        // ✅ Generate text property from runs for easier access
        para.text = para.runs
            .filter(run => run.text !== undefined && run.type !== 'tab')
            .map(run => run.text)
            .join('');

        // ✅ Always return paragraph - even empty ones are important for spacing in Korean documents!
        // Empty paragraphs create vertical spacing between content
        return para;
    }

    /**
     * 테이블 파싱
     * @param {Element} tblElem - 테이블 XML 요소
     * @returns {Object|null} 파싱된 테이블
     * @private
     */
    parseTable(tblElem) {
        logger.debug('🔷 Parsing table...');

        const table = {
            type: 'table',
            rows: [],
            style: {},
            widthHWPU: null,
            heightHWPU: null,
            repeatHeader: false,
            caption: null  // 캡션 추가
        };

        // Parse table-level size from <sz> element
        const szElem = tblElem.querySelector('sz, hp\\:sz');
        if (szElem) {
            const width = szElem.getAttribute('width');
            const height = szElem.getAttribute('height');
            const widthRelTo = szElem.getAttribute('widthRelTo');
            const heightRelTo = szElem.getAttribute('heightRelTo');

            // ✅ v2.2.10: 표 너비/높이 모두 스케일 팩터 없이 원본 크기 사용
            if (width) {
                table.widthHWPU = parseInt(width);
                const widthPx = HWPXConstants.hwpuToPxUnscaled(table.widthHWPU);
                table.style.width = widthPx.toFixed(2) + 'px';
                table.style.widthPrecise = widthPx;
                table.style.widthRelTo = widthRelTo;
            }
            if (height) {
                table.heightHWPU = parseInt(height);
                const heightPx = HWPXConstants.hwpuToPxUnscaled(table.heightHWPU);
                table.style.height = heightPx.toFixed(2) + 'px';
                table.style.heightPrecise = heightPx;
                table.style.heightRelTo = heightRelTo;
            }
            logger.debug(`  Table size: ${width} HWPU (${table.style.width}) x ${height} HWPU (${table.style.height})`);

        }

        // ✅ Parse table caption (제목)
        const captionElem = tblElem.querySelector('caption, hp\\:caption');
        if (captionElem) {
            const side = captionElem.getAttribute('side'); // TOP or BOTTOM
            const subListElem = captionElem.querySelector('subList, hp\\:subList');

            if (subListElem) {
                // Parse paragraphs inside caption
                const captionParas = [];
                const parasInCaption = subListElem.querySelectorAll('p, hp\\:p');

                parasInCaption.forEach(pElem => {
                    const para = this.parseParagraph(pElem);
                    if (para) {
                        captionParas.push(para);
                    }
                });

                if (captionParas.length > 0) {
                    table.caption = {
                        side: side || 'TOP',  // TOP | BOTTOM
                        paragraphs: captionParas
                    };
                    logger.debug(`  ✅ Table caption found (side: ${side}): "${captionParas[0].text}"`);
                }
            }
        }

        // Parse table-level border fill
        const borderFillId = tblElem.getAttribute('borderFillIDRef') || tblElem.getAttribute('hp:borderFillIDRef');
        if (borderFillId) {
            table.style.borderFillId = borderFillId;
            logger.debug(`  Table borderFillIDRef: ${borderFillId}`);
        }

        // Parse row and column counts
        const rowCnt = tblElem.getAttribute('rowCnt') || tblElem.getAttribute('hp:rowCnt');
        const colCnt = tblElem.getAttribute('colCnt') || tblElem.getAttribute('hp:colCnt');
        if (rowCnt) table.rowCount = parseInt(rowCnt);
        if (colCnt) table.colCount = parseInt(colCnt);
        logger.debug(`  Table dimensions: ${rowCnt} rows x ${colCnt} cols`);

        // Parse repeatHeader attribute (표 머리글 반복)
        const repeatHeader = tblElem.getAttribute('repeatHeader') || tblElem.getAttribute('hp:repeatHeader');
        if (repeatHeader === '1' || repeatHeader === 'true') {
            table.repeatHeader = true;
            logger.debug('  🔁 Table has repeatHeader enabled');
        }

        const rows = tblElem.querySelectorAll(':scope > tr, :scope > hp\\:tr');
        rows.forEach((trElem, rowIndex) => {
            const row = { cells: [], style: {}, index: rowIndex };

            const cells = trElem.querySelectorAll(':scope > tc, :scope > hp\\:tc');
            cells.forEach((tcElem, cellIndex) => {
                const cell = {
                    elements: [],
                    style: {}
                };

                // Get cell address (colAddr, rowAddr)
                const cellAddrElem = tcElem.querySelector('cellAddr, hp\\:cellAddr');
                if (cellAddrElem) {
                    const colAddr = cellAddrElem.getAttribute('colAddr');
                    const rowAddr = cellAddrElem.getAttribute('rowAddr');
                    if (colAddr !== null) cell.colAddr = parseInt(colAddr);
                    if (rowAddr !== null) cell.rowAddr = parseInt(rowAddr);
                }

                // Get colspan/rowspan from cellSpan element
                const cellSpanElem = tcElem.querySelector('cellSpan, hp\\:cellSpan');
                if (cellSpanElem) {
                    const colSpan = cellSpanElem.getAttribute('colSpan');
                    const rowSpan = cellSpanElem.getAttribute('rowSpan');
                    if (colSpan && parseInt(colSpan) > 1) cell.colSpan = parseInt(colSpan);
                    if (rowSpan && parseInt(rowSpan) > 1) cell.rowSpan = parseInt(rowSpan);
                } else {
                    // Fallback: try attributes directly
                    const colspan = tcElem.getAttribute('gridSpan') || tcElem.getAttribute('colspan');
                    const rowspan = tcElem.getAttribute('rowSpan') || tcElem.getAttribute('hp:rowSpan');
                    if (colspan && parseInt(colspan) > 1) cell.colSpan = parseInt(colspan);
                    if (rowspan && parseInt(rowspan) > 1) cell.rowSpan = parseInt(rowspan);
                }

                // Parse cell border and fill from borderFillIDRef
                const cellBorderFillId = tcElem.getAttribute('borderFillIDRef') || tcElem.getAttribute('hp:borderFillIDRef');
                if (cellBorderFillId && this.borderFills.has(cellBorderFillId)) {
                    cell.style.borderFillId = cellBorderFillId;
                    const borderFillDef = this.borderFills.get(cellBorderFillId);

                    // Apply border definitions
                    ['left', 'right', 'top', 'bottom'].forEach(side => {
                        if (borderFillDef.borders[side]) {
                            cell.style[`border${side.charAt(0).toUpperCase() + side.slice(1)}Def`] = borderFillDef.borders[side];
                        }
                    });

                    // ✅ Fallback: If cell borders are all invisible/NONE, inherit from table
                    const hasVisibleBorder = ['left', 'right', 'top', 'bottom'].some(side =>
                        borderFillDef.borders[side] && borderFillDef.borders[side].visible
                    );

                    if (!hasVisibleBorder && table.style.borderFillId && this.borderFills.has(table.style.borderFillId)) {
                        const tableBorderFillDef = this.borderFills.get(table.style.borderFillId);

                        // Override with table borders
                        ['left', 'right', 'top', 'bottom'].forEach(side => {
                            if (tableBorderFillDef.borders[side] && tableBorderFillDef.borders[side].visible) {
                                cell.style[`border${side.charAt(0).toUpperCase() + side.slice(1)}Def`] = tableBorderFillDef.borders[side];
                            }
                        });

                        logger.debug(`  ✅ Cell inherited borders from table borderFillID=${table.style.borderFillId}`);
                    }

                    // Apply diagonal line definitions
                    if (borderFillDef.borders.slash) {
                        cell.style.slashDef = borderFillDef.borders.slash;
                    }
                    if (borderFillDef.borders.backSlash) {
                        cell.style.backSlashDef = borderFillDef.borders.backSlash;
                    }

                    // Apply fill definition
                    if (borderFillDef.fill.backgroundColor) {
                        cell.style.backgroundColor = borderFillDef.fill.backgroundColor;
                        // Apply opacity if available
                        if (borderFillDef.fill.opacity !== undefined) {
                            cell.style.opacity = borderFillDef.fill.opacity;
                        }
                    }
                    if (borderFillDef.fill.gradientCSS) {
                        cell.style.backgroundGradient = borderFillDef.fill.gradientCSS;
                    }
                    if (borderFillDef.fill.patternType) {
                        cell.style.patternType = borderFillDef.fill.patternType;
                        cell.style.patternForeground = borderFillDef.fill.patternForeground;
                    }
                    // 🆕 Apply image fill
                    if (borderFillDef.fill.backgroundImage) {
                        cell.style.backgroundImage = borderFillDef.fill.backgroundImage;
                        logger.debug(`  ✅ Cell has backgroundImage: ${borderFillDef.fill.backgroundImage.binaryItemIDRef}`);
                    }
                }

                // ✅ Also check for direct fillBrush element (inline fill definition)
                // This is used when a cell has a custom fill not defined in borderFills
                const cellFillBrushElem = tcElem.querySelector('fillBrush, hp\\:fillBrush, hc\\:fillBrush');
                if (cellFillBrushElem) {
                    const winBrushElem = cellFillBrushElem.querySelector('winBrush, hc\\:winBrush');
                    if (winBrushElem) {
                        const faceColor = winBrushElem.getAttribute('faceColor');
                        const alpha = winBrushElem.getAttribute('alpha');

                        if (faceColor && faceColor !== 'none') {
                            cell.style.backgroundColor = this.normalizeColor(faceColor);

                            // Apply alpha (transparency): 0 = opaque, 255 = transparent
                            if (alpha) {
                                const alphaValue = parseInt(alpha);
                                cell.style.opacity = 1.0 - (alphaValue / 255.0);
                            }

                            logger.debug(`  ✓ Cell fillBrush: ${cell.style.backgroundColor} (alpha: ${alpha || 0})`);
                        }
                    }
                }

                // Parse cell size from cellSz element
                const cellSzElem = tcElem.querySelector('cellSz, hp\\:cellSz');
                if (cellSzElem) {
                    const width = cellSzElem.getAttribute('width');
                    const height = cellSzElem.getAttribute('height');
                    // ✅ v2.2.10: 셀 너비/높이 모두 스케일 팩터 없이 원본 크기 사용
                    if (width) {
                        cell.widthHWPU = parseInt(width);
                        if (table.widthHWPU) {
                            cell.style.widthPercent = (cell.widthHWPU / table.widthHWPU * 100).toFixed(4) + '%';
                        }
                        const widthPx = HWPXConstants.hwpuToPxUnscaled(cell.widthHWPU);
                        cell.style.width = widthPx.toFixed(2) + 'px';
                        cell.style.widthPrecise = widthPx;
                    }
                    if (height) {
                        cell.heightHWPU = parseInt(height);
                        const heightPx = HWPXConstants.hwpuToPxUnscaled(cell.heightHWPU);
                        cell.style.height = heightPx.toFixed(2) + 'px';
                        cell.style.heightPrecise = heightPx;
                    }

                }

                // Parse cell margin from cellMargin element
                const cellMarginElem = tcElem.querySelector('cellMargin, hp\\:cellMargin');
                if (cellMarginElem) {
                    const left = cellMarginElem.getAttribute('left');
                    const right = cellMarginElem.getAttribute('right');
                    const top = cellMarginElem.getAttribute('top');
                    const bottom = cellMarginElem.getAttribute('bottom');

                    // ✅ v2.2.10: 셀 마진도 스케일 팩터 없이 변환
                    if (left || right || top || bottom) {
                        const margins = [];
                        if (top) margins.push(HWPXConstants.hwpuToPxUnscaled(parseInt(top)).toFixed(2) + 'px');
                        else margins.push('0px');
                        if (right) margins.push(HWPXConstants.hwpuToPxUnscaled(parseInt(right)).toFixed(2) + 'px');
                        else margins.push('0px');
                        if (bottom) margins.push(HWPXConstants.hwpuToPxUnscaled(parseInt(bottom)).toFixed(2) + 'px');
                        else margins.push('0px');
                        if (left) margins.push(HWPXConstants.hwpuToPxUnscaled(parseInt(left)).toFixed(2) + 'px');
                        else margins.push('0px');
                        cell.style.padding = margins.join(' ');
                    }
                }

                // Parse cell alignment from subList element
                const subListElem = tcElem.querySelector('subList, hp\\:subList');
                if (subListElem) {
                    // Vertical alignment from subList
                    const vertAlign = subListElem.getAttribute('vertAlign');
                    if (vertAlign) {
                        const vAlignMap = {
                            'TOP': 'top',
                            'CENTER': 'middle',
                            'MIDDLE': 'middle',
                            'BOTTOM': 'bottom'
                        };
                        cell.style.verticalAlign = vAlignMap[vertAlign.toUpperCase()] || 'top';
                    }
                }

                // Also check for standalone align element (alternative format)
                const alignElem = tcElem.querySelector('align, hp\\:align');
                if (alignElem) {
                    const horizontal = alignElem.getAttribute('horizontal') || alignElem.getAttribute('hAlign');
                    const vertical = alignElem.getAttribute('vertical') || alignElem.getAttribute('vAlign');

                    if (horizontal) {
                        const hAlignMap = {
                            'LEFT': 'left',
                            'CENTER': 'center',
                            'RIGHT': 'right',
                            'JUSTIFY': 'justify'
                        };
                        cell.style.textAlign = hAlignMap[horizontal.toUpperCase()] || 'left';
                    }

                    if (vertical) {
                        const vAlignMap = {
                            'TOP': 'top',
                            'CENTER': 'middle',
                            'MIDDLE': 'middle',
                            'BOTTOM': 'bottom'
                        };
                        cell.style.verticalAlign = vAlignMap[vertical.toUpperCase()] || 'top';
                    }
                }

                // ✅ Parse nested tables first (they take precedence)
                const nestedTables = tcElem.querySelectorAll(':scope > subList > tbl, :scope > subList > hp\\:tbl, :scope > tbl, :scope > hp\\:tbl');
                nestedTables.forEach(nestedTbl => {
                    const nestedTable = this.parseTable(nestedTbl);
                    if (nestedTable) {
                        cell.elements.push(nestedTable);
                    }
                });

                // ✅ Parse cell paragraphs - ALL descendants, but exclude nested tables AND shape texts
                // v2.2.7i: Changed from :scope > p to all descendants to capture nested paragraphs
                // ✅ v2.2.8: Also exclude paragraphs inside drawText/container/shapes to prevent text duplication
                // ✅ v2.2.13: Fixed to only check for drawText/shapes WITHIN the cell scope
                if (subListElem) {
                    // Get all paragraphs (including nested ones)
                    const allParas = subListElem.querySelectorAll('p, hp\\:p');

                    // Filter out paragraphs that are inside:
                    // 1. Nested tables (already parsed above)
                    // 2. drawText elements (text inside shapes) - WITHIN this cell only
                    // 3. container/rect/ellipse elements (shapes with embedded text) - WITHIN this cell only
                    const parasToProcess = Array.from(allParas).filter(pElem => {
                        // Check if this paragraph is inside a nested table within this cell
                        const parentTable = pElem.closest('tbl, hp\\:tbl');
                        if (parentTable && nestedTables && Array.from(nestedTables).includes(parentTable)) {
                            return false; // Inside nested table, skip
                        }

                        // ✅ v2.2.13: Check if this paragraph is inside a drawText element (shape text)
                        // WITHIN the current cell's subList scope
                        const parentDrawText = pElem.closest('drawText, hp\\:drawText');
                        if (parentDrawText && subListElem.contains(parentDrawText)) {
                            return false; // Inside shape text within this cell, skip
                        }

                        // ✅ v2.2.13: Check if inside a container or shape (rect, ellipse, etc.)
                        // WITHIN the current cell's subList scope
                        const parentContainer = pElem.closest('container, hp\\:container, rect, hp\\:rect, ellipse, hp\\:ellipse');
                        if (parentContainer && subListElem.contains(parentContainer)) {
                            return false; // Inside container/shape within this cell, skip
                        }

                        return true;
                    });

                    parasToProcess.forEach(pElem => {
                        const para = this.parseParagraph(pElem);
                        if (para) {
                            cell.elements.push(para);
                        }
                    });
                }


                row.cells.push(cell);
            });

            table.rows.push(row);
        });

        // ✅ Calculate column widths considering colspan
        if (table.rows.length > 0) {
            table.colWidths = [];
            table.colWidthsPercent = [];

            // Get actual column count from table attributes
            const colCnt = parseInt(tblElem.getAttribute('colCnt')) || table.rows[0].cells.length;

            // Initialize column widths array
            const colWidthsHWPU = new Array(colCnt).fill(0);

            // Find a row without colspan to get accurate column widths
            let referenceRow = null;
            for (let r = 0; r < table.rows.length; r++) {
                const row = table.rows[r];
                let hasColspan = false;

                for (let c = 0; c < row.cells.length; c++) {
                    if ((row.cells[c].colSpan || 1) > 1) {
                        hasColspan = true;
                        break;
                    }
                }

                if (!hasColspan && row.cells.length === colCnt) {
                    referenceRow = row;
                    break;
                }
            }

            if (referenceRow) {
                // Use reference row without colspan
                for (let i = 0; i < referenceRow.cells.length; i++) {
                    colWidthsHWPU[i] = referenceRow.cells[i].widthHWPU || 0;
                }
                logger.debug(`  ✅ Using row ${referenceRow.index} (no colspan) for column widths`);
            } else {
                // Fallback: use first row and divide colspan widths equally
                const firstRow = table.rows[0];
                let colIndex = 0;

                for (let i = 0; i < firstRow.cells.length; i++) {
                    const cell = firstRow.cells[i];
                    const colspan = cell.colSpan || 1;
                    const cellWidth = cell.widthHWPU || 0;
                    const widthPerCol = cellWidth / colspan;

                    for (let span = 0; span < colspan; span++) {
                        if (colIndex < colCnt) {
                            colWidthsHWPU[colIndex] = widthPerCol;
                            colIndex++;
                        }
                    }
                }
                logger.debug(`  ⚠️ No row without colspan found, using first row with equal division`);
            }

            // Calculate total width
            const totalWidthHWPU = colWidthsHWPU.reduce((sum, w) => sum + w, 0);

            // Convert to pixels and percentages
            for (let i = 0; i < colCnt; i++) {
                const widthPx = HWPXConstants.hwpuToPx(colWidthsHWPU[i]);
                const widthPercent = totalWidthHWPU > 0 ? (colWidthsHWPU[i] / totalWidthHWPU * 100) : 0;

                table.colWidths.push(widthPx.toFixed(2) + 'px');
                table.colWidthsPercent.push(widthPercent.toFixed(4) + '%');
            }

            logger.debug(`  ✅ Column widths: ${table.colWidths.length} columns - ${table.colWidthsPercent.join(', ')}`);
        }

        return table.rows.length > 0 ? table : null;
    }

    /**
     * 이미지 파싱
     * @param {Element} picElem - 이미지 XML 요소
     * @returns {Object|null} 파싱된 이미지
     * @private
     */
    parseImage(picElem) {
        const image = {
            type: 'image',
            src: null,
            width: null,
            height: null,
            style: {},
            position: {
                x: 0,
                y: 0,
                textWrap: 'inline',
                zOrder: 0
            }
        };

        // ✅ Parse image reference - check multiple namespaces
        const imgElem = picElem.querySelector('img, hp\\:img, hc\\:img');
        if (imgElem) {
            const binaryItemId = imgElem.getAttribute('binaryItemIDRef');
            console.log(`[parseImage] Found img element, binaryItemId: ${binaryItemId}`);
            if (binaryItemId && this.images.has(binaryItemId)) {
                const imageData = this.images.get(binaryItemId);
                image.src = imageData.url;
                image.binaryItemId = binaryItemId;
                console.log(`  ✓ Linked to: ${imageData.filename}`);
                logger.debug(`  ✓ Found image reference: ${binaryItemId} -> ${imageData.filename}`);
            } else if (binaryItemId) {
                console.log(`  ⚠️ Image not found in images map. Available: ${Array.from(this.images.keys()).join(', ')}`);
                logger.warn(`  ⚠️ Image reference not found: ${binaryItemId}`);
            }
        } else {
            console.log(`[parseImage] No img element found in pic`);
        }

        // ✅ Parse size - try curSz first (현재 크기), fallback to sz if curSz is 0
        // ✅ v2.2.11: curSz가 0이면 sz 사용, hwpuToPxUnscaled로 정확한 크기 계산
        const curSzElem = picElem.querySelector('curSz, hp\\:curSz');
        const szElem = picElem.querySelector('sz, hp\\:sz');

        let widthHwpu = 0;
        let heightHwpu = 0;

        // curSz 먼저 시도
        if (curSzElem) {
            widthHwpu = parseInt(curSzElem.getAttribute('width')) || 0;
            heightHwpu = parseInt(curSzElem.getAttribute('height')) || 0;
        }

        // curSz가 0이면 sz 사용
        if ((widthHwpu === 0 || heightHwpu === 0) && szElem) {
            widthHwpu = parseInt(szElem.getAttribute('width')) || widthHwpu;
            heightHwpu = parseInt(szElem.getAttribute('height')) || heightHwpu;
        }

        if (widthHwpu > 0) {
            image.width = HWPXConstants.hwpuToPxUnscaled(widthHwpu);
        }
        if (heightHwpu > 0) {
            image.height = HWPXConstants.hwpuToPxUnscaled(heightHwpu);
        }

        console.log(`[parseImage] Size parsed: ${widthHwpu} x ${heightHwpu} HWPU → ${image.width?.toFixed(1)} x ${image.height?.toFixed(1)} px`);

        // Parse position
        const posElem = picElem.querySelector('pos, hp\\:pos');
        if (posElem) {
            image.position.treatAsChar = posElem.getAttribute('treatAsChar') === '1';
            image.position.horzRelTo = posElem.getAttribute('horzRelTo') || 'COLUMN';
            image.position.horzAlign = posElem.getAttribute('horzAlign') || 'LEFT';
            image.position.vertRelTo = posElem.getAttribute('vertRelTo') || 'PARA';
            image.position.vertAlign = posElem.getAttribute('vertAlign') || 'TOP';

            // ✅ v2.2.10: horzOffset과 vertOffset으로 정확한 이미지 위치 계산
            // 이 값들이 이미지의 실제 절대 위치를 결정함 (스케일 없이 정확한 위치)
            const horzOffset = posElem.getAttribute('horzOffset');
            const vertOffset = posElem.getAttribute('vertOffset');

            console.log(`[parseImage] pos element found: treatAsChar=${image.position.treatAsChar}, horzOffset=${horzOffset}, vertOffset=${vertOffset}`);

            if (horzOffset) {
                const horzOffsetVal = parseInt(horzOffset);
                image.position.x = HWPXConstants.hwpuToPxUnscaled(horzOffsetVal);
                console.log(`  → Image horzOffset: ${horzOffset} HWPU = ${image.position.x}px`);
            }
            if (vertOffset) {
                const vertOffsetVal = parseInt(vertOffset);
                image.position.y = HWPXConstants.hwpuToPxUnscaled(vertOffsetVal);
                console.log(`  → Image vertOffset: ${vertOffset} HWPU = ${image.position.y}px`);
            }
        } else {
            console.log(`[parseImage] No pos element found in picElem`);
        }


        // Parse offset (hp:offset) - only if hp:pos horzOffset/vertOffset didn't set position
        // ✅ v2.2.10: hp:pos horzOffset/vertOffset이 이미 설정된 경우 hp:offset으로 덮어쓰지 않음
        const offsetElem = picElem.querySelector('offset, hp\\:offset');
        if (offsetElem) {
            const x = offsetElem.getAttribute('x');
            const y = offsetElem.getAttribute('y');

            // Only apply hp:offset if hp:pos horzOffset didn't set position.x
            if (x && image.position.x === undefined) {
                let xVal = parseInt(x);
                // ✅ Handle 32-bit unsigned integers that represent negative numbers
                // Values > 2^31 are actually negative in two's complement
                if (xVal > 2147483647) {
                    xVal = xVal - 4294967296; // Convert to signed 32-bit
                }
                // ✅ Clamp to reasonable range (prevent extreme positioning)
                const MAX_OFFSET = 50000;
                if (Math.abs(xVal) > MAX_OFFSET) {
                    xVal = 0;
                }
                image.position.x = HWPXConstants.hwpuToPxUnscaled(xVal);
            }

            // Only apply hp:offset if hp:pos vertOffset didn't set position.y
            if (y && image.position.y === undefined) {
                let yVal = parseInt(y);
                // ✅ Handle 32-bit unsigned integers that represent negative numbers
                if (yVal > 2147483647) {
                    yVal = yVal - 4294967296; // Convert to signed 32-bit
                }
                // ✅ Clamp to reasonable range (prevent extreme positioning)
                const MAX_OFFSET = 50000;
                if (Math.abs(yVal) > MAX_OFFSET) {
                    yVal = 0;
                }
                image.position.y = HWPXConstants.hwpuToPxUnscaled(yVal);
            }
        }

        // Parse text wrap
        const textWrap = picElem.getAttribute('textWrap');
        if (textWrap) {
            image.position.textWrap = textWrap.toLowerCase();

        }

        // ✅ Parse children (containers/shapes inside imgRect)
        // Images can contain overlaid shapes/text boxes
        image.children = [];
        const imgRectElem = picElem.querySelector('imgRect, hp\\:imgRect, hc\\:imgRect');
        if (imgRectElem) {
            console.log(`[parseImage] Found imgRect, checking for children...`);

            // ✅ Iterate through direct children instead of querySelectorAll (namespace issues)
            for (let i = 0; i < imgRectElem.children.length; i++) {
                const child = imgRectElem.children[i];
                const tagName = (child.tagName || child.nodeName || '').toLowerCase();
                const localName = tagName.replace(/^.*:/, ''); // Remove namespace prefix

                console.log(`  → Child ${i + 1}: tagName=${tagName}, localName=${localName}`);

                if (localName === 'container') {
                    const container = this.parseContainer(child);
                    if (container) {
                        image.children.push(container);
                        console.log(`    ✓ Added container with ${container.children?.length || 0} children`);
                    }
                } else if (localName === 'rect' || localName === 'ellipse' || localName === 'line') {
                    const shape = this.parseShape(child);
                    if (shape) {
                        image.children.push(shape);
                        console.log(`    ✓ Added shape (${localName})`);
                    }
                }
            }

            console.log(`  → Total children in imgRect: ${image.children.length}`);
        }

        logger.debug(`  📷 Image parsed: ${image.binaryItemId}, ${image.width}x${image.height}, children: ${image.children.length}`);
        return image.src ? image : null;
    }

    /**
     * 도형 파싱
     * @param {Element} shapeElem - 도형 XML 요소
     * @returns {Object|null} 파싱된 도형
     * @private
     */
    parseShape(shapeElem) {
        const shape = {
            type: 'shape',
            shapeType: 'rectangle',
            style: {},
            position: {},
            drawText: null,
            borderRadius: 0 // ✅ 둥근 모서리 비율 (0-100)
        };

        // Check if shapeElem is already a rect/ellipse/line element
        const tagName = (shapeElem.tagName || shapeElem.nodeName).toLowerCase().replace('hp:', '');
        let rectElem, ellipseElem, lineElem;

        if (tagName === 'rect') {
            rectElem = shapeElem;
            shape.shapeType = 'rectangle';
        } else if (tagName === 'ellipse') {
            ellipseElem = shapeElem;
            shape.shapeType = 'ellipse';
        } else if (tagName === 'line') {
            lineElem = shapeElem;
            shape.shapeType = 'line';
        } else {
            // Not a direct shape element, search for children
            rectElem = shapeElem.querySelector('rect, hp\\:rect');
            ellipseElem = shapeElem.querySelector('ellipse, hp\\:ellipse');
            lineElem = shapeElem.querySelector('line, hp\\:line');

            if (ellipseElem) {
                shape.shapeType = 'ellipse';
            } else if (lineElem) {
                shape.shapeType = 'line';
            } else {
                shape.shapeType = 'rectangle';
            }
        }

        // ✅ Parse ratio attribute (둥근 모서리 비율, 0-100)
        const ratio = parseInt(shapeElem.getAttribute('ratio')) || 0;
        if (ratio > 0) {
            shape.borderRadius = ratio;
            logger.debug(`  🔲 Shape ratio: ${ratio}% (rounded corners)`);
        }

        // ✅ Parse size - try curSz first, fallback to orgSz if curSz is 0
        const curSzElem = shapeElem.querySelector('curSz, hp\\:curSz');
        const orgSzElem = shapeElem.querySelector('orgSz, hp\\:orgSz');
        const szElem = curSzElem || shapeElem.querySelector('sz, hp\\:sz');

        let widthParsed = 0;
        let heightParsed = 0;

        if (szElem) {
            widthParsed = parseInt(szElem.getAttribute('width')) || 0;
            heightParsed = parseInt(szElem.getAttribute('height')) || 0;
        }

        // ✅ curSz가 0이면 orgSz 사용 (HWPX 스펙)
        if ((widthParsed === 0 || heightParsed === 0) && orgSzElem) {
            const orgWidth = parseInt(orgSzElem.getAttribute('width')) || 0;
            const orgHeight = parseInt(orgSzElem.getAttribute('height')) || 0;
            if (orgWidth > 0) widthParsed = orgWidth;
            if (orgHeight > 0) heightParsed = orgHeight;
            logger.debug(`  📐 Using orgSz: ${orgWidth}x${orgHeight}`);
        }

        // ✅ v2.2.12: 도형은 스케일 없이 원본 크기 사용 (이미지와 다름)
        if (widthParsed > 0) {
            shape.width = HWPXConstants.hwpuToPxUnscaled(widthParsed);
        }
        if (heightParsed > 0) {
            shape.height = HWPXConstants.hwpuToPxUnscaled(heightParsed);
        }


        // Parse position
        const posElem = shapeElem.querySelector('pos, hp\\:pos');
        if (posElem) {
            shape.position.treatAsChar = posElem.getAttribute('treatAsChar') === '1';
            shape.position.horzRelTo = posElem.getAttribute('horzRelTo') || 'COLUMN';
            shape.position.horzAlign = posElem.getAttribute('horzAlign') || 'LEFT';
            shape.position.vertRelTo = posElem.getAttribute('vertRelTo') || 'PARA';
            shape.position.vertAlign = posElem.getAttribute('vertAlign') || 'TOP';

            // ✅ v2.2.10: horzOffset과 vertOffset으로 정확한 도형 위치 계산
            const horzOffset = posElem.getAttribute('horzOffset');
            const vertOffset = posElem.getAttribute('vertOffset');

            // ✅ v2.2.10: shape 위치도 스케일 팩터 없이 변환
            if (horzOffset) {
                let horzOffsetVal = parseInt(horzOffset);
                // Handle 32-bit unsigned integers that represent negative numbers
                if (horzOffsetVal > 2147483647) {
                    horzOffsetVal = horzOffsetVal - 4294967296;
                }
                shape.position.x = HWPXConstants.hwpuToPxUnscaled(horzOffsetVal);
                console.log(`[parseShape] horzOffset: ${horzOffset} → ${shape.position.x}px`);
            }
            if (vertOffset) {
                let vertOffsetVal = parseInt(vertOffset);
                // Handle 32-bit unsigned integers that represent negative numbers
                if (vertOffsetVal > 2147483647) {
                    vertOffsetVal = vertOffsetVal - 4294967296;
                }
                shape.position.y = HWPXConstants.hwpuToPxUnscaled(vertOffsetVal);
                console.log(`[parseShape] vertOffset: ${vertOffset} → ${shape.position.y}px`);
            }
        }

        // ✅ v2.2.10: textWrap 속성 파싱 - BEHIND_TEXT면 배경 도형
        const textWrap = shapeElem.getAttribute('textWrap');
        if (textWrap) {
            shape.position.textWrap = textWrap;
            // BEHIND_TEXT: 본문 뒤에 배치 (배경)
            // IN_FRONT_OF_TEXT: 본문 앞에 배치
            if (textWrap === 'BEHIND_TEXT') {
                shape.isBackground = true;
                console.log(`[parseShape] BEHIND_TEXT shape detected - treating as background`);
            }
        }


        // Parse offset
        const offsetElem = shapeElem.querySelector('offset, hp\\:offset');
        if (offsetElem) {
            const x = offsetElem.getAttribute('x');
            const y = offsetElem.getAttribute('y');
            // ✅ v2.2.10: shape offset도 스케일 팩터 없이 변환
            if (x) {
                let xVal = parseInt(x);
                // ✅ Handle 32-bit unsigned integers that represent negative numbers
                if (xVal > 2147483647) {
                    xVal = xVal - 4294967296;
                }
                // ✅ Clamp to reasonable range (컨테이너 내 도형은 큰 offset 가질 수 있음)
                const MAX_OFFSET = 50000;
                if (Math.abs(xVal) > MAX_OFFSET) {
                    logger.warn(`  ⚠️ X offset too large: ${xVal}, clamping to 0`);
                    xVal = 0;
                }
                shape.position.x = HWPXConstants.hwpuToPxUnscaled(xVal);
            }
            if (y) {
                let yVal = parseInt(y);
                // ✅ Handle 32-bit unsigned integers that represent negative numbers
                if (yVal > 2147483647) {
                    yVal = yVal - 4294967296;
                }
                // ✅ Clamp to reasonable range (컨테이너 내 도형은 큰 offset 가질 수 있음)
                const MAX_OFFSET = 50000;
                if (Math.abs(yVal) > MAX_OFFSET) {
                    logger.warn(`  ⚠️ Y offset too large: ${yVal}, clamping to 0`);
                    yVal = 0;
                }
                shape.position.y = HWPXConstants.hwpuToPxUnscaled(yVal);
            }
        }

        // Parse border from lineShape element
        const lineShapeElem = shapeElem.querySelector('lineShape, hp\\:lineShape');
        if (lineShapeElem) {
            const lineColor = lineShapeElem.getAttribute('color');
            const lineWidth = lineShapeElem.getAttribute('width');
            const lineStyle = lineShapeElem.getAttribute('style');

            // ✅ Only apply border if:
            // 1. lineWidth > 0
            // 2. lineStyle is not "NONE" (HWPX uses style="NONE" for invisible borders)
            // 3. Width is at least 0.5px
            if (lineWidth && lineStyle !== 'NONE') {
                const widthHWPU = parseInt(lineWidth);
                const widthPx = HWPXConstants.hwpuToPx(widthHWPU);

                // Only render border if width is at least 0.5px
                if (widthPx >= 0.5) {
                    if (lineColor) {
                        shape.style.borderColor = this.normalizeColor(lineColor);
                    }
                    shape.style.borderWidth = `${widthPx}px`;
                    // Map HWPX lineStyle to CSS border-style
                    if (lineStyle === 'SOLID') {
                        shape.style.borderStyle = 'solid';
                    } else if (lineStyle === 'DASH') {
                        shape.style.borderStyle = 'dashed';
                    } else if (lineStyle === 'DOT') {
                        shape.style.borderStyle = 'dotted';
                    } else {
                        shape.style.borderStyle = 'solid'; // default
                    }
                }
            }
        }

        // Parse fill - check multiple locations
        // 1. Try fillColor attribute on shape element
        let fillColor = shapeElem.getAttribute('fillColor');

        // 2. If no fillColor, look inside rect/ellipse element for fillBrush
        let actualShapeElem = rectElem || ellipseElem || shapeElem;

        // 3. Check borderFillIDRef
        let borderFillIDRef = shapeElem.getAttribute('borderFillIDRef');

        // DEBUG: Log for small shapes (disabled in production)
        // if (shape.width && shape.width < 100) {
        //     console.log(`[Shape Fill] Small shape ${shape.width.toFixed(0)}x${shape.height.toFixed(0)}`);
        //     console.log(`  fillColor="${fillColor}"`);
        //     console.log(`  borderFillIDRef="${borderFillIDRef}"`);
        // }

        if (fillColor && fillColor !== 'none') {
            const bgColor = this.normalizeColor(fillColor);
            shape.style.backgroundColor = bgColor;

            if (shape.width && shape.width < 100) {
                console.log(`  ✅ backgroundColor from fillColor: ${bgColor}`);
            }
        } else if (borderFillIDRef && this.borderFills.has(borderFillIDRef)) {
            // Try borderFill definition
            const borderFillDef = this.borderFills.get(borderFillIDRef);

            if (shape.width && shape.width < 100) {
                console.log(`  Checking borderFill[${borderFillIDRef}]...`);
                console.log(`  borderFillDef.fill:`, borderFillDef.fill);
            }

            if (borderFillDef.fill && borderFillDef.fill.backgroundColor) {
                shape.style.backgroundColor = borderFillDef.fill.backgroundColor;

                if (borderFillDef.fill.opacity !== undefined) {
                    shape.style.opacity = borderFillDef.fill.opacity;
                }

                if (shape.width && shape.width < 100) {
                    console.log(`  ✅ backgroundColor from borderFill: ${borderFillDef.fill.backgroundColor}`);
                }
            } else if (shape.width && shape.width < 100) {
                console.log(`  ❌ borderFill found but no fill.backgroundColor`);
            }
        } else {
            // ✅ Try fillBrush (for rect/ellipse with fill) - check all namespaces
            // querySelector 대신 직접 자식 요소 순회 (네임스페이스 문제 회피)
            let fillBrushElem = null;

            // 모든 자식 요소를 순회하면서 fillBrush 찾기
            for (let i = 0; i < actualShapeElem.children.length; i++) {
                const child = actualShapeElem.children[i];
                const tagName = (child.tagName || child.nodeName || '').toLowerCase();
                const localName = tagName.replace(/^.*:/, ''); // 네임스페이스 제거

                if (localName === 'fillbrush') {
                    fillBrushElem = child;
                    break;
                }
            }

            if (fillBrushElem) {
                // winBrush도 동일하게 자식 요소 순회
                let winBrushElem = null;
                for (let i = 0; i < fillBrushElem.children.length; i++) {
                    const child = fillBrushElem.children[i];
                    const localName = (child.tagName || child.nodeName || '').toLowerCase().replace(/^.*:/, '');
                    if (localName === 'winbrush') {
                        winBrushElem = child;
                        break;
                    }
                }

                if (winBrushElem) {
                    const faceColor = winBrushElem.getAttribute('faceColor');
                    const alpha = winBrushElem.getAttribute('alpha');

                    if (faceColor && faceColor !== 'none') {
                        const bgColor = this.normalizeColor(faceColor);
                        shape.style.backgroundColor = bgColor;

                        // ✅ Apply alpha (transparency): 0 = opaque, 255 = transparent
                        if (alpha) {
                            const alphaValue = parseInt(alpha);
                            shape.style.opacity = 1.0 - (alphaValue / 255.0);
                        }
                    }
                }
            }
        }

        // ✅ Parse DrawText (텍스트가 포함된 도형)
        const drawTextElem = shapeElem.querySelector('drawText, hp\\:drawText');

        console.log(`[parseShape] Checking drawText for ${shape.shapeType} (${shape.width?.toFixed(0)}x${shape.height?.toFixed(0)})`);
        console.log(`  drawTextElem found: ${!!drawTextElem}`);

        if (drawTextElem) {
            // Find subList which contains paragraphs
            const subListElem = drawTextElem.querySelector('subList, hp\\:subList');
            console.log(`  subListElem found: ${!!subListElem}`);

            if (subListElem) {
                // ✅ v2.2.13: Only get DIRECT child paragraphs of subList
                // Using :scope > p to avoid getting nested paragraphs inside tables/shapes
                const paragraphs = subListElem.querySelectorAll(':scope > p, :scope > hp\\:p');
                console.log(`  paragraphs found: ${paragraphs.length}`);

                // ✅ Parse vertical alignment
                const vertAlign = subListElem.getAttribute('vertAlign');

                if (paragraphs.length > 0) {
                    shape.drawText = {
                        paragraphs: [],
                        vertAlign: vertAlign || 'TOP', // CENTER, TOP, BOTTOM
                        margin: {}
                    };

                    paragraphs.forEach((pElem, idx) => {
                        const para = this.parseParagraph(pElem);
                        if (para) {
                            shape.drawText.paragraphs.push(para);
                            console.log(`    ✓ Paragraph ${idx + 1}: "${para.text?.substring(0, 20) || 'no text'}"`);
                        }
                    });

                    // ✅ Parse textMargin
                    const textMarginElem = drawTextElem.querySelector('textMargin, hp\\:textMargin');
                    if (textMarginElem) {
                        const left = textMarginElem.getAttribute('left');
                        const right = textMarginElem.getAttribute('right');
                        const top = textMarginElem.getAttribute('top');
                        const bottom = textMarginElem.getAttribute('bottom');

                        if (left) shape.drawText.margin.left = HWPXConstants.hwpuToPx(parseInt(left));
                        if (right) shape.drawText.margin.right = HWPXConstants.hwpuToPx(parseInt(right));
                        if (top) shape.drawText.margin.top = HWPXConstants.hwpuToPx(parseInt(top));
                        if (bottom) shape.drawText.margin.bottom = HWPXConstants.hwpuToPx(parseInt(bottom));

                        console.log(`  ✅ TextMargin: top=${shape.drawText.margin.top}px, vertAlign=${vertAlign}`);
                    }

                    console.log(`  ✅ DrawText parsed: ${shape.drawText.paragraphs.length} paragraphs`);
                    logger.debug(`  📝 DrawText found: ${shape.drawText.paragraphs.length} paragraphs`);
                } else {
                    console.log(`  ✗ No paragraphs in subList`);
                }
            } else {
                console.log(`  ✗ No subList found in drawText`);
            }
        } else {
            console.log(`  ✗ No drawText element`);
        }

        logger.debug(`  🔷 Shape parsed: ${shape.shapeType}, ${shape.width}x${shape.height}`);
        return shape;
    }

    /**
     * 텍스트박스 파싱
     * @param {Element} textboxElem - 텍스트박스 XML 요소
     * @returns {Object|null} 파싱된 텍스트박스
     * @private
     */
    parseTextBox(textboxElem) {
        const textbox = {
            type: 'textbox',
            style: {},
            position: {},
            paragraphs: []
        };

        // ✅ v2.2.10: 텍스트박스도 hwpuToPxUnscaled 사용 (정확한 크기)
        const szElem = textboxElem.querySelector('sz, hp\\:sz');
        if (szElem) {
            const width = szElem.getAttribute('width');
            const height = szElem.getAttribute('height');
            if (width) {
                textbox.width = HWPXConstants.hwpuToPxUnscaled(parseInt(width));
            }
            if (height) {
                textbox.height = HWPXConstants.hwpuToPxUnscaled(parseInt(height));
            }
        }

        // Parse position
        const posElem = textboxElem.querySelector('pos, hp\\:pos');
        if (posElem) {
            textbox.position.treatAsChar = posElem.getAttribute('treatAsChar') === '1';
            textbox.position.horzRelTo = posElem.getAttribute('horzRelTo') || 'COLUMN';
            textbox.position.vertRelTo = posElem.getAttribute('vertRelTo') || 'PARA';
        }

        // Parse border and background
        const borderColor = textboxElem.getAttribute('borderColor');
        const fillColor = textboxElem.getAttribute('fillColor');

        if (borderColor) {
            textbox.style.borderColor = this.normalizeColor(borderColor);
        }
        if (fillColor) {
            textbox.style.backgroundColor = this.normalizeColor(fillColor);
        }

        // Parse paragraphs
        const paragraphs = textboxElem.querySelectorAll('p, hp\\:p');
        paragraphs.forEach(pElem => {
            const para = this.parseParagraph(pElem);
            if (para) {
                textbox.paragraphs.push(para);
            }
        });

        logger.debug(`  📦 TextBox parsed: ${textbox.paragraphs.length} paragraphs`);
        return textbox.paragraphs.length > 0 ? textbox : null;
    }

    /**
     * 컨테이너 파싱 (그룹 객체)
     * @param {Element} containerElem - 컨테이너 XML 요소
     * @returns {Object|null} 파싱된 컨테이너
     * @private
     */
    parseContainer(containerElem) {
        const container = {
            type: 'container',
            style: {},
            position: {},
            children: []
        };

        // ✅ Parse size - try curSz first, fallback to orgSz if curSz is 0 (parseShape와 동일)
        const curSzElem = containerElem.querySelector('curSz, hp\\:curSz');
        const orgSzElem = containerElem.querySelector('orgSz, hp\\:orgSz');
        const szElem = curSzElem || containerElem.querySelector('sz, hp\\:sz');

        let widthParsed = 0;
        let heightParsed = 0;

        if (szElem) {
            widthParsed = parseInt(szElem.getAttribute('width')) || 0;
            heightParsed = parseInt(szElem.getAttribute('height')) || 0;
        }

        // ✅ curSz가 0이면 orgSz 사용 (HWPX 스펙)
        if ((widthParsed === 0 || heightParsed === 0) && orgSzElem) {
            const orgWidth = parseInt(orgSzElem.getAttribute('width')) || 0;
            const orgHeight = parseInt(orgSzElem.getAttribute('height')) || 0;
            if (orgWidth > 0) widthParsed = orgWidth;
            if (orgHeight > 0) heightParsed = orgHeight;
            logger.debug(`  📐 Container using orgSz: ${orgWidth}x${orgHeight}`);
        }

        // ✅ v2.2.10: 컨테이너도 hwpuToPxUnscaled 사용 (정확한 크기)
        if (widthParsed > 0) {
            container.width = HWPXConstants.hwpuToPxUnscaled(widthParsed);
        }
        if (heightParsed > 0) {
            container.height = HWPXConstants.hwpuToPxUnscaled(heightParsed);
        }


        // Parse position (for positioning the container)
        const posElem = containerElem.querySelector('pos, hp\\:pos');
        if (posElem) {
            container.position.treatAsChar = posElem.getAttribute('treatAsChar') === '1';
        }

        // Parse offset (absolute positioning)
        const offsetElem = containerElem.querySelector('offset, hp\\:offset');
        if (offsetElem) {
            const x = offsetElem.getAttribute('x');
            const y = offsetElem.getAttribute('y');

            // ✅ v2.2.10: container 위치도 스케일 팩터 없이 변환
            if (x) {
                let xVal = parseInt(x);
                // ✅ Handle 32-bit unsigned integers that represent negative numbers
                if (xVal > 2147483647) {
                    xVal = xVal - 4294967296;
                }
                // ✅ Clamp to reasonable range (컨테이너는 큰 오프셋을 가질 수 있음)
                const MAX_OFFSET = 50000;
                if (Math.abs(xVal) > MAX_OFFSET) {
                    logger.warn(`  ⚠️ Container X offset too large: ${xVal}, clamping to 0`);
                    xVal = 0;
                }
                container.position.x = HWPXConstants.hwpuToPxUnscaled(xVal);
            }
            if (y) {
                let yVal = parseInt(y);
                // ✅ Handle 32-bit unsigned integers that represent negative numbers
                if (yVal > 2147483647) {
                    yVal = yVal - 4294967296;
                }
                // ✅ Clamp to reasonable range (컨테이너는 큰 오프셋을 가질 수 있음)
                const MAX_OFFSET = 50000;
                if (Math.abs(yVal) > MAX_OFFSET) {
                    logger.warn(`  ⚠️ Container Y offset too large: ${yVal}, clamping to 0`);
                    yVal = 0;
                }

                // ✅ For nested containers inside image containers, reset y to 0
                // Individual shapes will be adjusted in renderer
                const parentIsImageContainer = containerElem.parentElement?.querySelector('pic, hp\\:pic');
                if (parentIsImageContainer) {
                    container.position.y = 0;
                } else {
                    container.position.y = HWPXConstants.hwpuToPxUnscaled(yVal);
                }
            }
        }

        // DEBUG: Check all children
        logger.debug('[Container Parser] Analyzing container...');
        const allChildren = containerElem.children || [];
        logger.debug(`  Total XML children: ${allChildren.length}`);

        // ✅ Parse child images FIRST so they render as background
        const allImages = containerElem.querySelectorAll('pic, hp\\:pic');
        logger.debug(`  Found ${allImages.length} images (all levels)`);

        allImages.forEach((picElem, idx) => {
            const image = this.parseImage(picElem);
            if (image) {
                container.children.push(image);
                logger.debug(`    → Added image: ${image.binaryItemId}`);
            }
        });

        // ✅ Parse nested containers (recursive)
        const nestedContainers = containerElem.querySelectorAll(':scope > container, :scope > hp\\:container');
        logger.debug(`  Found ${nestedContainers.length} nested containers`);
        nestedContainers.forEach(nestedContainerElem => {
            const nestedContainer = this.parseContainer(nestedContainerElem);
            if (nestedContainer) {
                container.children.push(nestedContainer);
            }
        });

        // ✅ Parse all shape-like children LAST so they render on top
        const directShapeChildren = [
            ...Array.from(containerElem.querySelectorAll(':scope > rect, :scope > hp\\:rect')),
            ...Array.from(containerElem.querySelectorAll(':scope > ellipse, :scope > hp\\:ellipse')),
            ...Array.from(containerElem.querySelectorAll(':scope > line, :scope > hp\\:line')),
            ...Array.from(containerElem.querySelectorAll(':scope > curve, :scope > hp\\:curve')),
            ...Array.from(containerElem.querySelectorAll(':scope > polygon, :scope > hp\\:polygon'))
        ];

        logger.debug(`  Found ${directShapeChildren.length} direct shape children`);
        directShapeChildren.forEach(shapeElem => {
            const shape = this.parseShape(shapeElem);
            if (shape) {
                logger.debug(`    → Parsed ${shape.shapeType || 'shape'}: ${shape.width}x${shape.height}`);
                container.children.push(shape);
            }
        });

        logger.debug(`  → Container parsed: ${container.children.length} children total`);
        return container.children.length > 0 ? container : null;
    }

    /**
     * 색상 정규화
     * @param {string} color - HWPX 색상 값
     * @returns {string|null} CSS 색상 값
     * @private
     */
    normalizeColor(color) {
        if (!color || color === 'auto' || color === 'none') {
            return null;
        }
        if (color.startsWith('#')) {
            return color;
        }
        // HWPX color format: RRGGBB (without #)
        return `#${color}`;
    }

    /**
     * 테두리 스타일 변환
     * @param {string} type - HWPX 테두리 타입
     * @returns {string} CSS border-style
     * @private
     */
    getBorderStyle(type) {
        const styles = {
            'SOLID': 'solid',
            'DASH': 'dashed',
            'DOT': 'dotted',
            'DASH_DOT': 'dashed',
            'DASH_DOT_DOT': 'dashed',
            'DOUBLE': 'double',
            'NONE': 'none'
        };
        return styles[type?.toUpperCase()] || 'solid';
    }

    /**
     * 테두리 스타일 문자열 파싱
     * @param {string} borderStr - 테두리 스타일 문자열 (예: "1pt solid #000000")
     * @returns {Object} 파싱된 테두리 속성
     * @private
     */
    parseBorderStyle(borderStr) {
        if (!borderStr) {
            return {};
        }

        const parts = borderStr.trim().split(/\s+/);
        const result = {};

        if (parts.length >= 1) {
            result.width = parts[0];
        }
        if (parts.length >= 2) {
            result.style = parts[1];
        }
        if (parts.length >= 3) {
            result.color = parts[2];
        }

        return result;
    }

    /**
     * 파서 상태 초기화
     */
    reset() {
        this.entries.clear();
        this.images.clear();
        this.styles.clear();
        this.borderFills.clear();
        this.charProperties.clear();
        this.fontFaces.clear();
        this.numberings.clear();

        logger.debug('🔄 Parser state reset');
    }

    /**
     * 리소스 정리 (Blob URLs 해제)
     */
    cleanup() {
        this.images.forEach(image => {
            if (image.url && image.url.startsWith('blob:')) {
                URL.revokeObjectURL(image.url);
            }
        });

        this.reset();
        logger.debug('🧹 Parser cleanup complete');
    }
}

// Default export
export default SimpleHWPXParser;

