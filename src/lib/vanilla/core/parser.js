/**
 * HWPX Parser - High Performance Edition
 * HWPX 파일을 파싱하여 렌더링 가능한 문서 구조로 변환
 *
 * @module parser
 * @version 3.0.0
 *
 * v3.0 Changes:
 * - Single-pass header.xml parsing (5x → 1x DOMParser call)
 * - Full numbering/bullet system
 * - Header/footer parsing
 * - Footnote/endnote support
 * - Hyperlink and bookmark support
 * - Field code support (page numbers, dates)
 * - Named style definitions
 * - Common utility extraction (offset, size, position parsing)
 */

import JSZip from 'jszip';
import { getLogger } from '../utils/logger.js';
import { HWPXConstants } from './constants.js';

const logger = getLogger();

// ============================================================================
// Common Utility Functions
// ============================================================================

/**
 * Namespace-aware element query helper
 * Handles hp:, hh:, hs:, hc: prefixes
 */
function qsa(parent, tagName) {
    return parent.querySelectorAll(`${tagName}, hp\\:${tagName}, hh\\:${tagName}, hc\\:${tagName}, hs\\:${tagName}`);
}

function qs(parent, tagName) {
    return parent.querySelector(`${tagName}, hp\\:${tagName}, hh\\:${tagName}, hc\\:${tagName}, hs\\:${tagName}`);
}

/**
 * Get local tag name without namespace prefix
 */
function localName(elem) {
    return (elem.localName || elem.tagName || '').toLowerCase().replace(/^(hp|hh|hs|hc):/, '');
}

/**
 * Parse 32-bit signed offset value from HWPX
 * Handles unsigned-to-signed conversion and clamping
 */
function parseOffset(value, maxOffset = 50000) {
    if (!value) return undefined;
    let val = parseInt(value);
    if (isNaN(val)) return undefined;
    // Handle 32-bit unsigned integers that represent negative numbers
    if (val > 2147483647) {
        val = val - 4294967296;
    }
    // Clamp to reasonable range
    if (Math.abs(val) > maxOffset) {
        return 0;
    }
    return HWPXConstants.hwpuToPxUnscaled(val);
}

/**
 * Parse size from curSz/orgSz/sz elements
 * Returns {width, height} in pixels (unscaled)
 */
function parseSize(elem) {
    const curSzElem = qs(elem, 'curSz');
    const orgSzElem = qs(elem, 'orgSz');
    const szElem = curSzElem || qs(elem, 'sz');

    let widthHwpu = 0, heightHwpu = 0;

    if (szElem) {
        widthHwpu = parseInt(szElem.getAttribute('width')) || 0;
        heightHwpu = parseInt(szElem.getAttribute('height')) || 0;
    }

    if ((widthHwpu === 0 || heightHwpu === 0) && orgSzElem) {
        widthHwpu = parseInt(orgSzElem.getAttribute('width')) || widthHwpu;
        heightHwpu = parseInt(orgSzElem.getAttribute('height')) || heightHwpu;
    }

    return {
        width: widthHwpu > 0 ? HWPXConstants.hwpuToPxUnscaled(widthHwpu) : 0,
        height: heightHwpu > 0 ? HWPXConstants.hwpuToPxUnscaled(heightHwpu) : 0,
        widthHwpu,
        heightHwpu
    };
}

/**
 * Parse position element (pos)
 * Returns position object with treatAsChar, offsets, alignment
 */
function parsePosition(elem) {
    const posElem = qs(elem, 'pos');
    const position = {
        x: 0,
        y: 0,
        textWrap: 'inline',
        zOrder: 0
    };

    if (posElem) {
        position.treatAsChar = posElem.getAttribute('treatAsChar') === '1';
        position.horzRelTo = posElem.getAttribute('horzRelTo') || 'COLUMN';
        position.horzAlign = posElem.getAttribute('horzAlign') || 'LEFT';
        position.vertRelTo = posElem.getAttribute('vertRelTo') || 'PARA';
        position.vertAlign = posElem.getAttribute('vertAlign') || 'TOP';

        const horzOffset = posElem.getAttribute('horzOffset');
        const vertOffset = posElem.getAttribute('vertOffset');

        if (horzOffset) position.x = parseOffset(horzOffset);
        if (vertOffset) position.y = parseOffset(vertOffset);
    }

    // Fallback: offset element
    const offsetElem = qs(elem, 'offset');
    if (offsetElem) {
        const x = offsetElem.getAttribute('x');
        const y = offsetElem.getAttribute('y');
        if (x && position.x === 0) position.x = parseOffset(x);
        if (y && position.y === 0) position.y = parseOffset(y);
    }

    // Text wrap
    const textWrap = elem.getAttribute('textWrap');
    if (textWrap) {
        position.textWrap = textWrap;
    }

    return position;
}

/**
 * Normalize HWPX color to CSS color
 */
function normalizeColor(color) {
    if (!color || color === 'auto' || color === 'none') return null;
    if (color.startsWith('#')) return color;
    return `#${color}`;
}

/**
 * Map HWPX border type to CSS border-style
 */
function getBorderStyle(type) {
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
 * Parse border width from various formats
 */
function parseBorderWidth(width) {
    if (!width) return 0;
    if (typeof width === 'string' && width.includes('mm')) {
        return parseFloat(width) * 3.7795; // 1mm = 3.7795px at 96dpi
    }
    return parseInt(width) / 7200 * 96; // HWPU to px
}


// ============================================================================
// Main Parser Class
// ============================================================================

/**
 * High-Performance HWPX Parser
 * HWPX 파일(ZIP 형식)을 파싱하여 렌더링 가능한 문서 구조로 변환
 */
export class SimpleHWPXParser {
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
        this.bulletDefs = new Map();
        this.tabDefs = new Map();
        this.namedStyles = new Map();
    }

    /**
     * HWPX 파일 파싱
     * @param {ArrayBuffer} buffer - HWPX 파일의 ArrayBuffer
     * @returns {Promise<Object>} 파싱된 문서 객체
     */
    async parse(buffer) {
        logger.info('📄 Starting HWPX parsing (v3.0 High Performance)...');
        logger.time('HWPX Parse');

        try {
            // 1. Unzip HWPX file
            await this.unzip(buffer);

            // 2. Load binary data (images)
            await this.loadBinData();

            // 3. ★ Single-pass header.xml parsing (v3.0 핵심 최적화)
            await this.loadHeaderDefinitions();

            // 4. Parse content (sections)
            const content = await this.parseContent();

            // 5. Extract raw header.xml for round-trip preservation
            let rawHeaderXml = null;
            try {
                if (this.zip) {
                    const headerFile = this.zip.file('Contents/header.xml');
                    if (headerFile) {
                        rawHeaderXml = await headerFile.async('string');
                    }
                }
            } catch (error) {
                logger.warn('⚠️  Failed to extract raw header.xml:', error);
            }

            // 6. Build document
            const document = {
                sections: content.sections || [],
                images: this.images,
                borderFills: this.borderFills,
                rawHeaderXml,
                metadata: {
                    parsedAt: new Date().toISOString(),
                    sectionsCount: content.sections?.length || 0,
                    imagesCount: this.images.size,
                    borderFillsCount: this.borderFills.size,
                    parserVersion: '3.0.0'
                }
            };

            logger.info('✅ HWPX parsed successfully');
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

    // ========================================================================
    // ZIP Extraction
    // ========================================================================

    async unzip(buffer) {
        logger.debug('📦 Unzipping HWPX file...');
        const zip = new JSZip();
        const zipData = await zip.loadAsync(buffer);
        this.zip = zipData;

        for (const [path, zipEntry] of Object.entries(zipData.files)) {
            if (!zipEntry.dir) {
                const data = await zipEntry.async('uint8array');
                this.entries.set(path, data);
            }
        }

        logger.debug(`✅ Unzipped ${this.entries.size} files`);
    }

    // ========================================================================
    // Binary Data (Images)
    // ========================================================================

    async loadBinData() {
        if (!this.options.parseImages) return;

        logger.debug('🖼️  Loading binary data...');
        let imageCount = 0;

        for (const [path, data] of this.entries) {
            if (path.startsWith('BinData/')) {
                const ext = path.split('.').pop().toLowerCase();
                const mimeTypes = {
                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'png': 'image/png', 'gif': 'image/gif',
                    'bmp': 'image/bmp', 'svg': 'image/svg+xml',
                    'webp': 'image/webp', 'tif': 'image/tiff',
                    'tiff': 'image/tiff', 'emf': 'image/x-emf',
                    'wmf': 'image/x-wmf'
                };

                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                const blob = new Blob([data], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const filename = path.split('/').pop();
                const id = filename.replace(/\.[^.]+$/, '');

                this.images.set(id, { id, url, path, mimeType, size: data.length, filename });
                imageCount++;
            }
        }

        logger.debug(`✅ Loaded ${imageCount} images`);
    }

    // ========================================================================
    // ★ Single-Pass Header Definitions Loading (v3.0 핵심 최적화)
    // ========================================================================

    async loadHeaderDefinitions() {
        logger.debug('📋 Loading all header definitions (single-pass)...');
        logger.time('Header Parse');

        const headData = this.entries.get('Contents/header.xml') ||
            this.entries.get('Contents/head.xml');

        if (!headData) {
            logger.warn('⚠️  No header.xml found');
            return;
        }

        const headXml = new TextDecoder('utf-8').decode(headData);
        const parser = new DOMParser();
        const doc = parser.parseFromString(headXml, 'text/xml');

        // ★ Parse ALL definitions from single DOM in one pass
        this._parseBorderFills(doc);
        this._parseParaProperties(doc);
        this._parseFontFaces(doc);
        this._parseCharProperties(doc);
        this._parseNumberings(doc);
        this._parseBulletDefs(doc);
        this._parseTabDefs(doc);
        this._parseNamedStyles(doc);

        logger.timeEnd('Header Parse');
        logger.debug(`✅ Header definitions loaded: ${this.borderFills.size} borderFills, ${this.paraProperties.size} paraPr, ${this.charProperties.size} charPr, ${this.fontFaces.size} fonts, ${this.numberings.size} numberings, ${this.namedStyles.size} styles`);
    }

    // ---- BorderFill Definitions ----

    _parseBorderFills(doc) {
        const borderFillElems = qsa(doc, 'borderFill');

        borderFillElems.forEach(elem => {
            const id = elem.getAttribute('id') || elem.getAttribute('itemId');
            if (!id) return;

            const borderFill = { id, borders: {}, fill: {} };

            // Parse borders (left, right, top, bottom)
            ['left', 'right', 'top', 'bottom'].forEach(side => {
                const borderElem = elem.querySelector(
                    `${side}Border, hh\\:${side}Border, hp\\:${side}Border, ${side}, hp\\:${side}`
                );
                if (borderElem) {
                    const type = borderElem.getAttribute('type') || 'solid';
                    const width = borderElem.getAttribute('width') || '1';
                    const color = borderElem.getAttribute('color') || '#000000';
                    const isVisible = type.toUpperCase() !== 'NONE';
                    const widthPx = isVisible ? Math.max(0.5, parseBorderWidth(width)) : 0;

                    borderFill.borders[side] = {
                        type, width: widthPx.toFixed(2) + 'px', widthRaw: widthPx,
                        color: normalizeColor(color), visible: isVisible,
                        css: isVisible
                            ? `${widthPx.toFixed(2)}px ${getBorderStyle(type)} ${normalizeColor(color)}`
                            : 'none'
                    };
                }
            });

            // Parse diagonals
            ['slash', 'backSlash'].forEach(diagonal => {
                const diagonalElem = elem.querySelector(
                    `${diagonal}, hh\\:${diagonal}, hp\\:${diagonal}`
                );
                if (diagonalElem) {
                    const type = diagonalElem.getAttribute('type') || 'solid';
                    const width = diagonalElem.getAttribute('width') || '1';
                    const color = diagonalElem.getAttribute('color') || '#000000';
                    const isVisible = type.toUpperCase() !== 'NONE';
                    const widthPx = isVisible ? Math.max(0.5, parseBorderWidth(width)) : 0;

                    borderFill.borders[diagonal] = {
                        type, width: widthPx, color: normalizeColor(color), visible: isVisible
                    };
                }
            });

            // Parse fill
            const fillElem = elem.querySelector('fill, hp\\:fill, fillBrush, hp\\:fillBrush, hh\\:fillBrush, hc\\:fillBrush');
            if (fillElem) {
                this._parseFillElement(fillElem, borderFill.fill);
            }

            this.borderFills.set(id, borderFill);
        });
    }

    _parseFillElement(fillElem, fillObj) {
        // winBrush
        const winBrushElem = fillElem.querySelector('winBrush, hc\\:winBrush');
        let fillAlpha = 1.0;
        let faceColor = null;

        if (winBrushElem) {
            faceColor = winBrushElem.getAttribute('faceColor');
            const alpha = winBrushElem.getAttribute('alpha');
            if (alpha) {
                fillAlpha = 1.0 - (parseInt(alpha) / 255.0);
            }
        }

        // Solid color
        const bgColor = faceColor ||
            fillElem.getAttribute('backgroundColor') ||
            fillElem.getAttribute('color') ||
            fillElem.getAttribute('rgb') ||
            fillElem.getAttribute('bgColor') ||
            fillElem.getAttribute('fillColor');

        if (bgColor && bgColor !== 'none') {
            fillObj.backgroundColor = normalizeColor(bgColor);
            fillObj.opacity = fillAlpha;
        }

        // Pattern fill
        const patternType = fillElem.getAttribute('patternType');
        if (patternType && patternType !== 'none') {
            fillObj.patternType = patternType;
            const fgColor = fillElem.getAttribute('patternColor') || fillElem.getAttribute('foregroundColor');
            if (fgColor) fillObj.patternForeground = normalizeColor(fgColor);
        }

        // Gradient fill
        const gradationElem = fillElem.querySelector('gradation, hp\\:gradation, hc\\:gradation');
        if (gradationElem) {
            const type = gradationElem.getAttribute('type') || 'linear';
            const angle = gradationElem.getAttribute('angle') || '0';
            const colors = gradationElem.getAttribute('colors') || '';
            const colorArray = colors.split(',').map(c => normalizeColor(c.trim()));

            if (type === 'linear') {
                fillObj.gradientCSS = `linear-gradient(${angle}deg, ${colorArray.join(', ')})`;
            } else if (type === 'radial') {
                fillObj.gradientCSS = `radial-gradient(circle, ${colorArray.join(', ')})`;
            }
        }

        // Image fill (imgBrush)
        const imgBrushElem = fillElem.querySelector('imgBrush, hc\\:imgBrush');
        if (imgBrushElem) {
            const imgElem = imgBrushElem.querySelector('img, hc\\:img');
            if (imgElem) {
                const binaryItemIDRef = imgElem.getAttribute('binaryItemIDRef');
                const mode = imgBrushElem.getAttribute('mode') || 'TILE';
                if (binaryItemIDRef) {
                    fillObj.backgroundImage = { binaryItemIDRef, mode };
                }
            }
        }
    }

    // ---- Paragraph Properties ----

    _parseParaProperties(doc) {
        const paraPrElems = qsa(doc, 'paraPr');

        paraPrElems.forEach(elem => {
            const id = elem.getAttribute('id') || elem.getAttribute('itemId');
            if (!id) return;

            const paraProp = { id };

            // Alignment
            const alignElem = qs(elem, 'align');
            if (alignElem) {
                const horizontal = alignElem.getAttribute('horizontal');
                const vertical = alignElem.getAttribute('vertical');

                if (horizontal) {
                    const hAlignMap = { 'LEFT': 'left', 'CENTER': 'center', 'RIGHT': 'right', 'JUSTIFY': 'justify', 'DISTRIBUTE': 'justify' };
                    paraProp.textAlign = hAlignMap[horizontal.toUpperCase()] || 'left';
                }
                if (vertical) {
                    const vAlignMap = { 'TOP': 'top', 'CENTER': 'middle', 'MIDDLE': 'middle', 'BOTTOM': 'bottom', 'BASELINE': 'baseline' };
                    paraProp.verticalAlign = vAlignMap[vertical.toUpperCase()] || 'baseline';
                }
            }

            // Margins
            const marginElem = qs(elem, 'margin');
            if (marginElem) {
                const left = marginElem.getAttribute('left');
                const right = marginElem.getAttribute('right');
                const top = marginElem.getAttribute('top');
                const bottom = marginElem.getAttribute('bottom');
                const indent = marginElem.getAttribute('indent');

                if (left) paraProp.marginLeft = HWPXConstants.hwpuToPx(parseInt(left));
                if (right) paraProp.marginRight = HWPXConstants.hwpuToPx(parseInt(right));
                if (top) paraProp.marginTop = HWPXConstants.hwpuToPx(parseInt(top));
                if (bottom) paraProp.marginBottom = HWPXConstants.hwpuToPx(parseInt(bottom));
                if (indent) paraProp.textIndent = HWPXConstants.hwpuToPx(parseInt(indent));
            }

            // Line spacing
            const lineSpacingElem = qs(elem, 'lineSpacing');
            if (lineSpacingElem) {
                const type = lineSpacingElem.getAttribute('type');
                const value = lineSpacingElem.getAttribute('value');

                if (type && value) {
                    if (type === 'PERCENT' || type === 'RATIO') {
                        paraProp.lineHeight = (parseInt(value) / 100).toFixed(2);
                    } else if (type === 'FIXED') {
                        paraProp.lineHeightPx = HWPXConstants.hwpuToPx(parseInt(value));
                    } else if (type === 'AT_LEAST') {
                        paraProp.minLineHeight = HWPXConstants.hwpuToPx(parseInt(value));
                    }
                }
            }

            // Fallback lineHeight
            const fontLineHeight = elem.getAttribute('fontLineHeight');
            if (fontLineHeight === '0' && !paraProp.lineHeight) {
                paraProp.lineHeight = '1.0';
            }

            // Heading/outline level (for TOC, heading detection)
            const headingType = elem.getAttribute('headingType');
            if (headingType) paraProp.headingType = headingType;
            const outlineLvl = elem.getAttribute('outlineLvl');
            if (outlineLvl) paraProp.outlineLevel = parseInt(outlineLvl);

            // Numbering reference
            const numPrElem = qs(elem, 'numPr');
            if (numPrElem) {
                const numIDRef = numPrElem.getAttribute('numIDRef') || numPrElem.getAttribute('id');
                const levelRef = numPrElem.getAttribute('level') || numPrElem.getAttribute('lvl');
                if (numIDRef) {
                    paraProp.numPr = {
                        numIDRef,
                        level: parseInt(levelRef) || 0
                    };
                }
            }

            this.paraProperties.set(id, paraProp);
        });
    }

    // ---- Font Faces ----

    _parseFontFaces(doc) {
        const fontFaceElems = qsa(doc, 'fontFace');

        fontFaceElems.forEach(ffElem => {
            const id = ffElem.getAttribute('id');
            if (!id) return;

            const fontFace = { id };
            const fontNames = qsa(ffElem, 'font');

            fontNames.forEach(fontElem => {
                const lang = fontElem.getAttribute('lang');
                const name = fontElem.getAttribute('name') || fontElem.getAttribute('face');
                if (name) {
                    if (lang === 'LATIN') fontFace.latin = name;
                    else if (lang === 'HANGUL') fontFace.hangul = name;
                    else if (lang === 'HANJA') fontFace.hanja = name;
                    else if (lang === 'JAPANESE') fontFace.japanese = name;
                    else if (lang === 'OTHER') fontFace.other = name;
                    else if (lang === 'SYMBOL') fontFace.symbol = name;
                }
            });

            fontFace.name = fontFace.hangul || fontFace.latin || fontFace.other || 'Malgun Gothic';
            this.fontFaces.set(id, fontFace);
        });
    }

    // ---- Character Properties ----

    _parseCharProperties(doc) {
        const charProps = doc.querySelectorAll('charPr, hh\\:charPr');

        charProps.forEach(cpElem => {
            const id = cpElem.getAttribute('id');
            if (!id) return;

            const charProp = { id };

            // Font size
            const height = cpElem.getAttribute('height');
            if (height) {
                const ptSize = parseInt(height) / 100;
                charProp.fontSize = `${ptSize}pt`;
                charProp.fontSizePx = `${HWPXConstants.ptToPx(ptSize).toFixed(2)}px`;
            }

            // Font face reference
            const fontId = cpElem.getAttribute('fontRef');
            if (fontId) {
                charProp.fontId = fontId;
                if (this.fontFaces.has(fontId)) {
                    charProp.fontFamily = this.fontFaces.get(fontId).name || 'Malgun Gothic';
                }
            }

            // Text color
            const textColor = cpElem.getAttribute('textColor');
            if (textColor && textColor !== 'auto') {
                charProp.color = normalizeColor(textColor);
            }

            // Bold/Italic/Underline from attributes
            if (cpElem.getAttribute('bold') === '1') charProp.bold = true;
            if (cpElem.getAttribute('italic') === '1') charProp.italic = true;
            if (cpElem.getAttribute('underline') === '1') charProp.underline = true;

            // Bold (child element)
            if (cpElem.querySelector('bold, hh\\:bold')) charProp.bold = true;
            // Italic (child element)
            if (cpElem.querySelector('italic, hh\\:italic')) charProp.italic = true;

            // Underline (child with details)
            const underlineElem = cpElem.querySelector('underline, hh\\:underline');
            if (underlineElem) {
                const underlineType = underlineElem.getAttribute('type');
                if (underlineType && underlineType !== 'NONE') {
                    charProp.underline = true;
                    charProp.underlineType = underlineType;
                    const underlineColor = underlineElem.getAttribute('color');
                    if (underlineColor) charProp.underlineColor = normalizeColor(underlineColor);
                }
            }

            // Strikeout
            const strikeoutElem = cpElem.querySelector('strikeout, hh\\:strikeout');
            if (strikeoutElem) {
                const strikeoutType = strikeoutElem.getAttribute('type');
                if (strikeoutType && strikeoutType !== 'NONE') {
                    charProp.strikethrough = true;
                    const strikeoutColor = strikeoutElem.getAttribute('color');
                    if (strikeoutColor) charProp.strikethroughColor = normalizeColor(strikeoutColor);
                }
            }

            // Outline
            const outlineElem = cpElem.querySelector('outline, hh\\:outline');
            if (outlineElem) {
                const outlineType = outlineElem.getAttribute('type');
                if (outlineType && outlineType !== 'NONE') charProp.outline = true;
            }

            // Shadow
            const shadowElem = cpElem.querySelector('shadow, hh\\:shadow');
            if (shadowElem) {
                const shadowType = shadowElem.getAttribute('type');
                if (shadowType && shadowType !== 'NONE') {
                    charProp.textShadow = true;
                    const shadowColor = shadowElem.getAttribute('color');
                    const offsetX = shadowElem.getAttribute('offsetX');
                    const offsetY = shadowElem.getAttribute('offsetY');
                    if (shadowColor && offsetX && offsetY) {
                        const offsetXPx = parseInt(offsetX) / 7200 * 96;
                        const offsetYPx = parseInt(offsetY) / 7200 * 96;
                        charProp.textShadowValue = `${offsetXPx.toFixed(1)}px ${offsetYPx.toFixed(1)}px 0 ${normalizeColor(shadowColor)}`;
                    }
                }
            }

            // Spacing (자간)
            const spacingElem = cpElem.querySelector('spacing, hh\\:spacing');
            if (spacingElem) {
                const hangulSpacing = spacingElem.getAttribute('hangul');
                if (hangulSpacing && parseInt(hangulSpacing) !== 0) {
                    charProp.letterSpacing = `${(parseInt(hangulSpacing) / 100).toFixed(2)}em`;
                }
            }

            // Ratio (장평)
            const ratioElem = cpElem.querySelector('ratio, hh\\:ratio');
            if (ratioElem) {
                const hangulRatio = ratioElem.getAttribute('hangul');
                if (hangulRatio && parseInt(hangulRatio) !== 100) {
                    charProp.scaleX = parseInt(hangulRatio) / 100;
                }
            }

            // Offset (super/subscript)
            const offsetElem = cpElem.querySelector('offset, hh\\:offset');
            if (offsetElem) {
                const hangulOffset = offsetElem.getAttribute('hangul');
                if (hangulOffset && parseInt(hangulOffset) !== 0) {
                    charProp.verticalAlign = parseInt(hangulOffset) > 0 ? 'super' : 'sub';
                }
            }

            // Background color
            const shadeColor = cpElem.getAttribute('shadeColor');
            if (shadeColor && shadeColor !== 'none' && shadeColor !== 'auto') {
                charProp.backgroundColor = normalizeColor(shadeColor);
            }

            // Superscript/subscript
            const supscript = cpElem.getAttribute('supscript');
            if (supscript === 'SUPERSCRIPT') charProp.verticalAlign = 'super';
            if (supscript === 'SUBSCRIPT') charProp.verticalAlign = 'sub';

            this.charProperties.set(id, charProp);
        });
    }

    // ---- ★ Numbering Definitions (v3.0 신규) ----

    _parseNumberings(doc) {
        const numberingElems = qsa(doc, 'numbering');

        numberingElems.forEach(numElem => {
            const id = numElem.getAttribute('id') || numElem.getAttribute('itemId');
            if (!id) return;

            const numbering = { id, levels: [] };
            const start = numElem.getAttribute('start');
            if (start) numbering.startNum = parseInt(start);

            // Parse each level
            const paraHeadElems = qsa(numElem, 'paraHead');
            paraHeadElems.forEach(phElem => {
                const level = parseInt(phElem.getAttribute('level')) || 0;
                const levelDef = {
                    level,
                    numFormat: phElem.getAttribute('numFormat') || 'DECIMAL',
                    start: parseInt(phElem.getAttribute('start')) || 1,
                    textBeforePrefix: phElem.getAttribute('textBeforePrefix') || '',
                    textAfterPrefix: phElem.getAttribute('textAfterPrefix') || '',
                    suffixType: phElem.getAttribute('suffixType') || 'NONE',
                    charPrIDRef: phElem.getAttribute('charPrIDRef'),
                };

                // Parse format string (e.g., "^1." for "1.")
                const formatStr = phElem.textContent || '';
                if (formatStr) levelDef.formatString = formatStr.trim();

                // Indent
                const indent = phElem.getAttribute('indent');
                if (indent) levelDef.indent = HWPXConstants.hwpuToPx(parseInt(indent));

                numbering.levels[level] = levelDef;
            });

            this.numberings.set(id, numbering);
        });

        logger.debug(`  🔢 Loaded ${this.numberings.size} numbering definitions`);
    }

    // ---- ★ Bullet Definitions (v3.0 신규) ----

    _parseBulletDefs(doc) {
        const bulletElems = qsa(doc, 'bullet');

        bulletElems.forEach(bulletElem => {
            const id = bulletElem.getAttribute('id') || bulletElem.getAttribute('itemId');
            if (!id) return;

            const bullet = {
                id,
                char: bulletElem.getAttribute('char') || '•',
                checkedChar: bulletElem.getAttribute('checkedChar') || '☑',
                useImage: bulletElem.getAttribute('useImage') === '1',
                imgBinaryItemIDRef: null
            };

            // Parse bullet image
            const imgElem = qs(bulletElem, 'img');
            if (imgElem) {
                bullet.imgBinaryItemIDRef = imgElem.getAttribute('binaryItemIDRef');
            }

            // Parse bullet charPr
            const charPrIDRef = bulletElem.getAttribute('charPrIDRef');
            if (charPrIDRef) bullet.charPrIDRef = charPrIDRef;

            this.bulletDefs.set(id, bullet);
        });
    }

    // ---- ★ Tab Definitions (v3.0 신규) ----

    _parseTabDefs(doc) {
        const tabDefElems = qsa(doc, 'tabDef');

        tabDefElems.forEach(tabDefElem => {
            const id = tabDefElem.getAttribute('id') || tabDefElem.getAttribute('itemId');
            if (!id) return;

            const tabDef = { id, autoTabLeft: false, autoTabRight: false, tabs: [] };

            const autoLeft = tabDefElem.getAttribute('autoTabLeft');
            const autoRight = tabDefElem.getAttribute('autoTabRight');
            if (autoLeft === '1') tabDef.autoTabLeft = true;
            if (autoRight === '1') tabDef.autoTabRight = true;

            // Parse tab items
            const tabItems = qsa(tabDefElem, 'tabItem');
            tabItems.forEach(tabItem => {
                tabDef.tabs.push({
                    pos: HWPXConstants.hwpuToPx(parseInt(tabItem.getAttribute('pos')) || 0),
                    type: tabItem.getAttribute('type') || 'LEFT',
                    leader: tabItem.getAttribute('leader') || 'NONE'
                });
            });

            this.tabDefs.set(id, tabDef);
        });
    }

    // ---- ★ Named Styles (v3.0 신규) ----

    _parseNamedStyles(doc) {
        const styleElems = qsa(doc, 'style');

        styleElems.forEach(styleElem => {
            const id = styleElem.getAttribute('id') || styleElem.getAttribute('itemId');
            if (!id) return;

            const style = {
                id,
                name: styleElem.getAttribute('name') || styleElem.getAttribute('engName') || `Style_${id}`,
                type: styleElem.getAttribute('type') || 'PARA',
                paraPrIDRef: styleElem.getAttribute('paraPrIDRef'),
                charPrIDRef: styleElem.getAttribute('charPrIDRef'),
                nextStyleIDRef: styleElem.getAttribute('nextStyleIDRef'),
                parentStyleIDRef: styleElem.getAttribute('parentStyleIDRef') || styleElem.getAttribute('baseStyleIDRef')
            };

            // English name
            const engName = styleElem.getAttribute('engName');
            if (engName) style.engName = engName;

            this.namedStyles.set(id, style);
        });

        logger.debug(`  📝 Loaded ${this.namedStyles.size} named styles`);
    }

    // ========================================================================
    // Content Parsing
    // ========================================================================

    async parseContent() {
        logger.debug('📄 Parsing document content...');

        const sections = [];
        const sectionFiles = Array.from(this.entries.keys())
            .filter(path => path.match(/Contents\/section\d+\.xml/))
            .sort();

        for (const sectionPath of sectionFiles) {
            const sectionData = this.entries.get(sectionPath);
            if (!sectionData) continue;

            const sectionXml = new TextDecoder('utf-8').decode(sectionData);
            const parser = new DOMParser();
            const doc = parser.parseFromString(sectionXml, 'text/xml');

            const section = await this.parseSection(doc);
            if (section) sections.push(section);
        }

        return { sections };
    }

    // ========================================================================
    // Section Parsing
    // ========================================================================

    async parseSection(doc) {
        const section = {
            elements: [],
            pageSettings: {},
            headers: { both: null, odd: null, even: null },
            footers: { both: null, odd: null, even: null },
            footnotes: [],
            endnotes: [],
            pageNum: null,
            colPr: null
        };

        // Parse section properties
        const secPrElem = qs(doc, 'secPr');
        if (secPrElem) {
            this._parseSectionProperties(secPrElem, section);
            this._parseHeaderFooter(secPrElem, section);
        }

        // ★ Parse elements in document order
        let bodyElem = doc.documentElement;
        const possibleBody = bodyElem.querySelector('body, hh\\:body, hp\\:body, hs\\:sec');
        if (possibleBody) bodyElem = possibleBody;

        const children = Array.from(bodyElem.children);
        let parsedCount = 0;

        children.forEach((child) => {
            const tag = localName(child);

            if (tag === 'header' || tag === 'footer' || tag === 'secpr') return;

            if (tag === 'p') {
                if (child.closest('tbl, hp\\:tbl, tc, hp\\:tc, container, hp\\:container')) return;

                const containsTable = child.querySelector('tbl, hp\\:tbl');
                const containsContainer = child.querySelector('container, hp\\:container');
                const hasRuns = child.querySelectorAll('run, hp\\:run').length > 0;
                const containsStandaloneShapes = !hasRuns && child.querySelector('rect, hp\\:rect, ellipse, hp\\:ellipse, polygon, hp\\:polygon');

                if (containsStandaloneShapes && !containsContainer) return;

                if (containsTable) {
                    parsedCount += this._parseTableContainingParagraph(child, section);
                } else {
                    const para = this.parseParagraph(child);
                    if (para) {
                        section.elements.push(para);
                        parsedCount++;
                    }
                }
            }
            else if (tag === 'tbl' && this.options.parseTables) {
                const table = this.parseTable(child);
                if (table) { section.elements.push(table); parsedCount++; }
            }
            else if (tag === 'sublist') {
                const parasInSubList = qsa(child, 'p');
                parasInSubList.forEach(pElem => {
                    const para = this.parseParagraph(pElem);
                    if (para) { section.elements.push(para); parsedCount++; }
                });
            }
        });

        // Parse standalone images
        if (this.options.parseImages) {
            const allImages = qsa(doc, 'pic');
            allImages.forEach(picElem => {
                const parent = picElem.parentElement;
                const parentTag = parent ? localName(parent) : '';
                if (parentTag === 'run' || picElem.closest('p, hp\\:p, tbl, hp\\:tbl')) return;

                const image = this.parseImage(picElem);
                if (image) { section.elements.push(image); }
            });
        }

        // Parse standalone shapes (not inside containers/paragraphs)
        const shapes = doc.querySelectorAll('rect, hp\\:rect, ellipse, hp\\:ellipse, polygon, hp\\:polygon');
        shapes.forEach(shapeElem => {
            if (shapeElem.closest('container, hp\\:container')) return;
            if (shapeElem.closest('run, hp\\:run')) return;
            const shape = this.parseShape(shapeElem);
            if (shape) section.elements.push(shape);
        });

        // Parse textboxes
        const textboxes = qsa(doc, 'textbox');
        textboxes.forEach(textboxElem => {
            const textbox = this.parseTextBox(textboxElem);
            if (textbox) section.elements.push(textbox);
        });

        // Parse top-level containers
        const containers = qsa(doc, 'container');
        containers.forEach(containerElem => {
            const parentContainer = containerElem.parentElement?.closest('container, hp\\:container');
            if (parentContainer && parentContainer !== containerElem) return;
            if (containerElem.closest('run, hp\\:run')) return;
            const container = this.parseContainer(containerElem);
            if (container) section.elements.push(container);
        });

        // ★ Parse footnotes (v3.0 신규)
        this._parseFootnotes(doc, section);

        return section;
    }

    // ---- Section Properties ----

    _parseSectionProperties(secPrElem, section) {
        const pagePrElem = qs(secPrElem, 'pagePr');
        if (pagePrElem) {
            const width = pagePrElem.getAttribute('width');
            const height = pagePrElem.getAttribute('height');
            const landscape = pagePrElem.getAttribute('landscape');

            if (width) {
                const widthPx = Math.round(parseInt(width) / 7200 * 96);
                section.pageSettings.width = `${widthPx}px`;
                section.pageWidth = widthPx;
            }
            if (height) {
                const heightPx = Math.round(parseInt(height) / 7200 * 96);
                section.pageSettings.height = `${heightPx}px`;
                section.pageHeight = heightPx;
            }
            if (landscape) section.pageSettings.landscape = landscape;

            // Page margins
            const marginElem = qs(pagePrElem, 'margin');
            if (marginElem) {
                ['left', 'right', 'top', 'bottom'].forEach(side => {
                    const val = marginElem.getAttribute(side);
                    if (val) {
                        const px = Math.round(parseInt(val) / 7200 * 96);
                        section.pageSettings[`margin${side.charAt(0).toUpperCase() + side.slice(1)}`] = `${px}px`;
                        section[`margin${side.charAt(0).toUpperCase() + side.slice(1)}`] = px;
                    }
                });

                // Header/footer margins
                const headerMargin = marginElem.getAttribute('header');
                const footerMargin = marginElem.getAttribute('footer');
                if (headerMargin) section.headerMargin = Math.round(parseInt(headerMargin) / 7200 * 96);
                if (footerMargin) section.footerMargin = Math.round(parseInt(footerMargin) / 7200 * 96);
            }

            // Gutter
            const gutterElem = qs(pagePrElem, 'gutter');
            if (gutterElem) {
                const gutterType = gutterElem.getAttribute('type');
                const gutterVal = gutterElem.getAttribute('value');
                if (gutterVal) {
                    section.gutter = {
                        type: gutterType || 'LEFT',
                        value: Math.round(parseInt(gutterVal) / 7200 * 96)
                    };
                }
            }
        }

        // Page numbering
        const pageNumElem = qs(secPrElem, 'pageNum');
        if (pageNumElem) {
            section.pageNum = {
                start: parseInt(pageNumElem.getAttribute('start')) || 1,
                format: pageNumElem.getAttribute('format') || 'DECIMAL',
                visible: pageNumElem.getAttribute('visible') !== '0'
            };
        }

        // Multi-column layout
        const colPrElem = qs(secPrElem, 'colPr');
        if (colPrElem) {
            const colCount = parseInt(colPrElem.getAttribute('colCount')) || 1;
            if (colCount > 1) {
                section.colPr = {
                    colCount,
                    colSpacing: parseInt(colPrElem.getAttribute('colSpacing')) || 0,
                    type: colPrElem.getAttribute('type') || 'EQUAL'
                };
            }
        }

        // Page background (pageBorderFill)
        const pageBorderFillElems = secPrElem.querySelectorAll('pageBorderFill, hp\\:pageBorderFill');
        if (pageBorderFillElems.length > 0) {
            section.pageBackground = {};
            pageBorderFillElems.forEach(pbfElem => {
                const type = pbfElem.getAttribute('type') || 'BOTH';
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
                }
            });
        }
    }

    // ---- ★ Header/Footer Parsing (v3.0 신규) ----

    _parseHeaderFooter(secPrElem, section) {
        // Parse headers
        const headerElems = secPrElem.querySelectorAll('header, hp\\:header');
        headerElems.forEach(headerElem => {
            const type = headerElem.getAttribute('type') || 'BOTH'; // BOTH, ODD, EVEN
            const headerContent = this._parseHeaderFooterContent(headerElem);
            if (headerContent) {
                const key = type.toLowerCase();
                section.headers[key] = headerContent;
                if (type === 'BOTH') {
                    section.headers.odd = headerContent;
                    section.headers.even = headerContent;
                }
            }
        });

        // Parse footers
        const footerElems = secPrElem.querySelectorAll('footer, hp\\:footer');
        footerElems.forEach(footerElem => {
            const type = footerElem.getAttribute('type') || 'BOTH';
            const footerContent = this._parseHeaderFooterContent(footerElem);
            if (footerContent) {
                const key = type.toLowerCase();
                section.footers[key] = footerContent;
                if (type === 'BOTH') {
                    section.footers.odd = footerContent;
                    section.footers.even = footerContent;
                }
            }
        });
    }

    _parseHeaderFooterContent(elem) {
        const paragraphs = [];
        const subListElem = qs(elem, 'subList');
        const target = subListElem || elem;

        const paraElems = qsa(target, 'p');
        paraElems.forEach(pElem => {
            // Avoid nested paragraphs inside tables/shapes
            if (pElem.closest('tbl, hp\\:tbl, drawText, hp\\:drawText')) return;
            const para = this.parseParagraph(pElem);
            if (para) paragraphs.push(para);
        });

        return paragraphs.length > 0 ? { paragraphs } : null;
    }

    // ---- ★ Footnotes/Endnotes (v3.0 신규) ----

    _parseFootnotes(doc, section) {
        // Footnotes
        const footnoteElems = qsa(doc, 'footNote');
        footnoteElems.forEach(fnElem => {
            const footnote = this._parseNote(fnElem, 'footnote');
            if (footnote) section.footnotes.push(footnote);
        });

        // Endnotes
        const endnoteElems = qsa(doc, 'endNote');
        endnoteElems.forEach(enElem => {
            const endnote = this._parseNote(enElem, 'endnote');
            if (endnote) section.endnotes.push(endnote);
        });
    }

    _parseNote(noteElem, noteType) {
        const note = {
            type: noteType,
            number: noteElem.getAttribute('number') || noteElem.getAttribute('num'),
            id: noteElem.getAttribute('id'),
            paragraphs: []
        };

        const subListElem = qs(noteElem, 'subList');
        const target = subListElem || noteElem;

        const paraElems = target.querySelectorAll(':scope > p, :scope > hp\\:p');
        paraElems.forEach(pElem => {
            const para = this.parseParagraph(pElem);
            if (para) note.paragraphs.push(para);
        });

        return note.paragraphs.length > 0 ? note : null;
    }

    // ---- Table-containing Paragraph ----

    _parseTableContainingParagraph(child, section) {
        let parsedCount = 0;
        const runs = child.querySelectorAll(':scope > run, :scope > hp\\:run');
        let currentTextRuns = [];

        const flushTextRuns = () => {
            if (currentTextRuns.length > 0) {
                section.elements.push({
                    type: 'paragraph',
                    runs: currentTextRuns,
                    text: currentTextRuns.map(r => r.text).join(' '),
                    style: {}
                });
                parsedCount++;
                currentTextRuns = [];
            }
        };

        runs.forEach((runElem) => {
            const children = Array.from(runElem.children);

            const hasShapeInRun = children.some(c => {
                const ln = localName(c);
                return ['rect', 'ellipse', 'polygon'].includes(ln);
            });

            const hasTableInRun = children.some(c => {
                const ln = localName(c);
                return ln === 'tbl';
            });

            if (hasShapeInRun) {
                flushTextRuns();
                const para = this.parseParagraph(child);
                if (para) { section.elements.push(para); parsedCount++; }
                return;
            }

            if (hasTableInRun && this.options.parseTables) {
                flushTextRuns();
                const tblElems = runElem.querySelectorAll('tbl, hp\\:tbl');
                tblElems.forEach(tblElem => {
                    const table = this.parseTable(tblElem);
                    if (table) { section.elements.push(table); parsedCount++; }
                });
            } else {
                const tElem = runElem.querySelector('t, hp\\:t');
                const text = tElem ? tElem.textContent : '';

                if (text.trim()) {
                    const charPrId = runElem.getAttribute('charPrIDRef');
                    const run = { text };
                    run.style = (charPrId && this.charProperties.has(charPrId))
                        ? { ...this.charProperties.get(charPrId) }
                        : {};
                    currentTextRuns.push(run);
                }
            }
        });

        flushTextRuns();
        return parsedCount;
    }

    // ========================================================================
    // Paragraph Parsing
    // ========================================================================

    parseParagraph(pElem) {
        const para = {
            type: 'paragraph',
            runs: [],
            shapes: [],
            style: {}
        };

        // Apply paragraph properties
        const paraPrIDRef = pElem.getAttribute('paraPrIDRef');
        if (paraPrIDRef && this.paraProperties.has(paraPrIDRef)) {
            const paraProp = this.paraProperties.get(paraPrIDRef);
            if (paraProp.textAlign) para.style.textAlign = paraProp.textAlign;
            if (paraProp.verticalAlign) para.style.verticalAlign = paraProp.verticalAlign;
            if (paraProp.lineHeight) para.style.lineHeight = paraProp.lineHeight;
            if (paraProp.lineHeightPx) para.style.lineHeightPx = paraProp.lineHeightPx;
            if (paraProp.marginLeft) para.style.marginLeft = paraProp.marginLeft;
            if (paraProp.marginRight) para.style.marginRight = paraProp.marginRight;
            if (paraProp.marginTop) para.style.marginTop = paraProp.marginTop;
            if (paraProp.marginBottom) para.style.marginBottom = paraProp.marginBottom;
            if (paraProp.textIndent) para.style.textIndent = paraProp.textIndent;

            // ★ Numbering reference (v3.0)
            if (paraProp.numPr) {
                para.numPr = paraProp.numPr;
                const numDef = this.numberings.get(paraProp.numPr.numIDRef);
                if (numDef) {
                    para.numberingDef = numDef;
                    const levelDef = numDef.levels[paraProp.numPr.level];
                    if (levelDef) {
                        para.numberingLevel = levelDef;
                    }
                }
            }
        }

        // ★ Style reference (v3.0)
        const styleIDRef = pElem.getAttribute('styleIDRef');
        if (styleIDRef && this.namedStyles.has(styleIDRef)) {
            para.styleRef = this.namedStyles.get(styleIDRef);
        }

        // Parse runs
        const runs = pElem.querySelectorAll('run, hp\\:run');

        if (runs.length > 0) {
            let skipRemainingRuns = false;

            runs.forEach(runElem => {
                if (skipRemainingRuns) return;

                const charPrId = runElem.getAttribute('charPrIDRef');
                const hasInlineObject = runElem.querySelector('tbl, hp\\:tbl, pic, hp\\:pic, rect, hp\\:rect, ellipse, hp\\:ellipse');

                const children = Array.from(runElem.children || []);

                children.forEach(child => {
                    const tag = localName(child);

                    if (tag === 'secpr' || tag === 'ctrl') return;

                    // ★ Field codes (v3.0 신규)
                    if (tag === 'fieldbegin' || tag === 'fieldstart') {
                        const fieldType = child.getAttribute('type') || child.getAttribute('fieldType');
                        const fieldDef = this._parseFieldCode(child, fieldType);
                        if (fieldDef) {
                            para.runs.push(fieldDef);
                        }
                        return;
                    }

                    // ★ Hyperlinks (v3.0 신규)
                    if (tag === 'hyperlink') {
                        const href = child.getAttribute('url') || child.getAttribute('href') || child.getAttribute('target');
                        const text = child.textContent || href || '';
                        para.runs.push({
                            text,
                            hyperlink: { url: href, text },
                            style: charPrId && this.charProperties.has(charPrId)
                                ? { ...this.charProperties.get(charPrId) }
                                : {}
                        });
                        return;
                    }

                    // ★ Bookmarks (v3.0 신규)
                    if (tag === 'bookmark' || tag === 'markpenbegin') {
                        const bookmarkName = child.getAttribute('name') || child.getAttribute('id');
                        if (bookmarkName) {
                            para.runs.push({
                                type: 'bookmark',
                                name: bookmarkName,
                                text: ''
                            });
                        }
                        return;
                    }

                    // ★ Footnote/Endnote references (v3.0 신규)
                    if (tag === 'footnote' || tag === 'endnote') {
                        const noteNum = child.getAttribute('number') || child.getAttribute('num');
                        para.runs.push({
                            type: tag,
                            number: noteNum,
                            text: noteNum ? `[${noteNum}]` : '',
                            style: { verticalAlign: 'super', fontSize: '0.7em' }
                        });
                        return;
                    }

                    // Inline images
                    if (tag === 'pic') {
                        const image = this.parseImage(child);
                        if (image) {
                            const hasAbsolutePosition =
                                (image.position?.x !== undefined && image.position?.x !== 0) ||
                                (image.position?.y !== undefined && image.position?.y !== 0);

                            if (!hasAbsolutePosition && !image.position?.treatAsChar) {
                                image.treatAsChar = true;
                            }

                            if (!para.images) para.images = [];
                            para.images.push(image);
                            para.runs.push({
                                text: '', hasImage: true,
                                imageIndex: para.images.length - 1,
                                style: {}, charPrIDRef: charPrId
                            });
                        }
                    }
                    // Inline containers
                    else if (tag === 'container') {
                        const container = this.parseContainer(child);
                        if (container) {
                            container.treatAsChar = true;
                            para.shapes.push(container);
                            para.runs.push({ text: '', hasShape: true, style: {}, charPrIDRef: charPrId });
                        }
                    }
                    // Inline shapes
                    else if (['rect', 'ellipse', 'polygon'].includes(tag)) {
                        const shape = this.parseShape(child);
                        if (shape) {
                            if (shape.isBackground || shape.position?.textWrap === 'BEHIND_TEXT') {
                                if (!para.backgroundShapes) para.backgroundShapes = [];
                                para.backgroundShapes.push(shape);
                            } else {
                                shape.treatAsChar = true;
                                para.shapes.push(shape);
                                para.runs.push({ text: '', hasShape: true, style: {}, charPrIDRef: charPrId });
                            }
                        }
                    }
                    // Inline tables
                    else if (tag === 'tbl') {
                        const table = this.parseTable(child);
                        if (table) {
                            table.treatAsChar = true;
                            if (!para.tables) para.tables = [];
                            para.tables.push(table);
                            para.runs.push({
                                text: '', hasTable: true,
                                tableIndex: para.tables.length - 1,
                                style: {}, charPrIDRef: charPrId
                            });
                        }
                    }
                    // Text
                    else if (tag === 't') {
                        this._parseTextElement(child, charPrId, para);
                    }
                    // Tab
                    else if (tag === 'tab') {
                        para.runs.push(this._parseTabElement(child));
                    }
                    // Line break
                    else if (tag === 'linebreak') {
                        para.runs.push({ type: 'linebreak' });
                    }
                    // Column break
                    else if (tag === 'colbreak') {
                        para.runs.push({ type: 'colbreak' });
                    }
                    // Page break
                    else if (tag === 'pagebreak') {
                        para.runs.push({ type: 'pagebreak' });
                    }
                });

                if (hasInlineObject) {
                    skipRemainingRuns = true;
                }
            });
        } else {
            // Fallback: direct text elements
            const textElems = qsa(pElem, 't');
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

        // Clean up
        if (para.shapes.length === 0) delete para.shapes;
        if (para.images && para.images.length === 0) delete para.images;
        if (para.tables && para.tables.length === 0) delete para.tables;

        para.text = para.runs
            .filter(run => run.text !== undefined && run.type !== 'tab')
            .map(run => run.text)
            .join('');

        return para;
    }

    // ---- Text Element Parsing ----

    _parseTextElement(child, charPrId, para) {
        const childElements = Array.from(child.children || []);
        const hasNestedElements = childElements.some(el => {
            const name = localName(el);
            return name === 'tab' || name === 'linebreak';
        });

        if (hasNestedElements) {
            Array.from(child.childNodes).forEach(node => {
                if (node.nodeType === 3) { // Text node
                    const text = node.textContent || '';
                    if (text.length > 0) {
                        const run = { text, style: {} };
                        if (charPrId) run.charPrIDRef = charPrId;
                        if (charPrId && this.charProperties.has(charPrId)) {
                            run.style = { ...this.charProperties.get(charPrId) };
                        }
                        para.runs.push(run);
                    }
                } else if (node.nodeType === 1) { // Element node
                    const nodeName = localName(node);
                    if (nodeName === 'tab') {
                        para.runs.push(this._parseTabElement(node));
                    } else if (nodeName === 'linebreak') {
                        para.runs.push({ type: 'linebreak' });
                    }
                }
            });
        } else {
            const text = child.textContent || '';
            const run = { text, style: {} };
            if (charPrId) run.charPrIDRef = charPrId;
            if (charPrId && this.charProperties.has(charPrId)) {
                run.style = { ...this.charProperties.get(charPrId) };
            }
            para.runs.push(run);
        }
    }

    _parseTabElement(tabElem) {
        const tab = { type: 'tab', style: {} };
        const width = tabElem.getAttribute('width');
        const leader = tabElem.getAttribute('leader');
        const tabType = tabElem.getAttribute('type');

        if (width) {
            tab.widthHWPU = parseInt(width);
            tab.widthPx = HWPXConstants.hwpuToPx(tab.widthHWPU);
        }
        if (leader) tab.leader = parseInt(leader);
        if (tabType) tab.tabType = parseInt(tabType);

        return tab;
    }

    // ---- ★ Field Code Parsing (v3.0 신규) ----

    _parseFieldCode(fieldElem, fieldType) {
        const field = {
            type: 'field',
            fieldType: fieldType || 'UNKNOWN',
            text: '',
            style: {}
        };

        const upperType = (fieldType || '').toUpperCase();

        // Page number field
        if (upperType === 'PAGENUMBER' || upperType === 'PAGE_NUM' || upperType === 'PAGENUM') {
            field.fieldType = 'PAGE_NUMBER';
            field.text = '{페이지}';
        }
        // Total pages
        else if (upperType === 'PAGECOUNT' || upperType === 'PAGE_COUNT' || upperType === 'NUMPAGES') {
            field.fieldType = 'PAGE_COUNT';
            field.text = '{전체페이지}';
        }
        // Date
        else if (upperType === 'DATE' || upperType === 'CREATEDATE' || upperType === 'SAVEDATE') {
            field.fieldType = 'DATE';
            const format = fieldElem.getAttribute('format') || fieldElem.getAttribute('dateFormat') || 'yyyy-MM-dd';
            field.dateFormat = format;
            field.text = new Date().toLocaleDateString('ko-KR');
        }
        // Filename
        else if (upperType === 'FILENAME') {
            field.fieldType = 'FILENAME';
            field.text = '{파일이름}';
        }
        // Mail merge field
        else if (upperType === 'MAILMERGE') {
            field.fieldType = 'MAILMERGE';
            const fieldName = fieldElem.getAttribute('name') || fieldElem.getAttribute('fieldName') || '';
            field.text = `«${fieldName}»`;
            field.fieldName = fieldName;
        }
        // Cross-reference
        else if (upperType === 'CROSSREF') {
            field.fieldType = 'CROSSREF';
            field.text = fieldElem.textContent || '{참조}';
        }
        // Hyperlink field
        else if (upperType === 'HYPERLINK') {
            field.fieldType = 'HYPERLINK';
            const url = fieldElem.getAttribute('url') || fieldElem.getAttribute('target') || '';
            field.hyperlink = { url };
            field.text = fieldElem.textContent || url;
        }
        // Summary info
        else if (upperType === 'SUMMARYINFO' || upperType === 'DOCPROPERTY') {
            field.fieldType = 'SUMMARY_INFO';
            const propName = fieldElem.getAttribute('name') || fieldElem.getAttribute('property') || '';
            field.text = `{${propName}}`;
        }
        // Formula
        else if (upperType === 'FORMULA' || upperType === 'EQUATION') {
            field.fieldType = 'FORMULA';
            field.text = fieldElem.textContent || '{수식}';
        }
        // Default: just capture text
        else {
            field.text = fieldElem.textContent || '';
        }

        return field;
    }

    // ========================================================================
    // Table Parsing
    // ========================================================================

    parseTable(tblElem) {
        const table = {
            type: 'table',
            rows: [],
            style: {},
            widthHWPU: null,
            heightHWPU: null,
            repeatHeader: false,
            caption: null
        };

        // Parse table size
        const szElem = qs(tblElem, 'sz');
        if (szElem) {
            const width = szElem.getAttribute('width');
            const height = szElem.getAttribute('height');
            const widthRelTo = szElem.getAttribute('widthRelTo');
            const heightRelTo = szElem.getAttribute('heightRelTo');

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
        }

        // Parse caption
        const captionElem = qs(tblElem, 'caption');
        if (captionElem) {
            const side = captionElem.getAttribute('side');
            const subListElem = qs(captionElem, 'subList');
            if (subListElem) {
                const captionParas = [];
                qsa(subListElem, 'p').forEach(pElem => {
                    const para = this.parseParagraph(pElem);
                    if (para) captionParas.push(para);
                });
                if (captionParas.length > 0) {
                    table.caption = { side: side || 'TOP', paragraphs: captionParas };
                }
            }
        }

        // Border fill reference
        const borderFillId = tblElem.getAttribute('borderFillIDRef') || tblElem.getAttribute('hp:borderFillIDRef');
        if (borderFillId) table.style.borderFillId = borderFillId;

        // Row/column counts
        const rowCnt = tblElem.getAttribute('rowCnt') || tblElem.getAttribute('hp:rowCnt');
        const colCnt = tblElem.getAttribute('colCnt') || tblElem.getAttribute('hp:colCnt');
        if (rowCnt) table.rowCount = parseInt(rowCnt);
        if (colCnt) table.colCount = parseInt(colCnt);

        // Repeat header
        const repeatHeader = tblElem.getAttribute('repeatHeader') || tblElem.getAttribute('hp:repeatHeader');
        if (repeatHeader === '1' || repeatHeader === 'true') table.repeatHeader = true;

        // Parse rows
        const rows = tblElem.querySelectorAll(':scope > tr, :scope > hp\\:tr');
        rows.forEach((trElem, rowIndex) => {
            const row = { cells: [], style: {}, index: rowIndex };

            const cells = trElem.querySelectorAll(':scope > tc, :scope > hp\\:tc');
            cells.forEach((tcElem) => {
                const cell = this._parseTableCell(tcElem, table);
                row.cells.push(cell);
            });

            table.rows.push(row);
        });

        // Calculate column widths
        if (table.rows.length > 0) {
            this._calculateColumnWidths(table, tblElem);
        }

        return table.rows.length > 0 ? table : null;
    }

    _parseTableCell(tcElem, table) {
        const cell = { elements: [], style: {} };

        // Cell address
        const cellAddrElem = qs(tcElem, 'cellAddr');
        if (cellAddrElem) {
            const colAddr = cellAddrElem.getAttribute('colAddr');
            const rowAddr = cellAddrElem.getAttribute('rowAddr');
            if (colAddr !== null) cell.colAddr = parseInt(colAddr);
            if (rowAddr !== null) cell.rowAddr = parseInt(rowAddr);
        }

        // Colspan/rowspan
        const cellSpanElem = qs(tcElem, 'cellSpan');
        if (cellSpanElem) {
            const colSpan = cellSpanElem.getAttribute('colSpan');
            const rowSpan = cellSpanElem.getAttribute('rowSpan');
            if (colSpan && parseInt(colSpan) > 1) cell.colSpan = parseInt(colSpan);
            if (rowSpan && parseInt(rowSpan) > 1) cell.rowSpan = parseInt(rowSpan);
        } else {
            const colspan = tcElem.getAttribute('gridSpan') || tcElem.getAttribute('colspan');
            const rowspan = tcElem.getAttribute('rowSpan') || tcElem.getAttribute('hp:rowSpan');
            if (colspan && parseInt(colspan) > 1) cell.colSpan = parseInt(colspan);
            if (rowspan && parseInt(rowspan) > 1) cell.rowSpan = parseInt(rowspan);
        }

        // Cell border/fill from borderFillIDRef
        const cellBorderFillId = tcElem.getAttribute('borderFillIDRef') || tcElem.getAttribute('hp:borderFillIDRef');
        if (cellBorderFillId && this.borderFills.has(cellBorderFillId)) {
            cell.style.borderFillId = cellBorderFillId;
            const borderFillDef = this.borderFills.get(cellBorderFillId);

            // Apply borders
            ['left', 'right', 'top', 'bottom'].forEach(side => {
                if (borderFillDef.borders[side]) {
                    cell.style[`border${side.charAt(0).toUpperCase() + side.slice(1)}Def`] = borderFillDef.borders[side];
                }
            });

            // Fallback: inherit from table if cell has no visible borders
            const hasVisibleBorder = ['left', 'right', 'top', 'bottom'].some(side =>
                borderFillDef.borders[side] && borderFillDef.borders[side].visible
            );

            if (!hasVisibleBorder && table.style.borderFillId && this.borderFills.has(table.style.borderFillId)) {
                const tableBorderFillDef = this.borderFills.get(table.style.borderFillId);
                ['left', 'right', 'top', 'bottom'].forEach(side => {
                    if (tableBorderFillDef.borders[side] && tableBorderFillDef.borders[side].visible) {
                        cell.style[`border${side.charAt(0).toUpperCase() + side.slice(1)}Def`] = tableBorderFillDef.borders[side];
                    }
                });
            }

            // Diagonals
            if (borderFillDef.borders.slash) cell.style.slashDef = borderFillDef.borders.slash;
            if (borderFillDef.borders.backSlash) cell.style.backSlashDef = borderFillDef.borders.backSlash;

            // Fill
            if (borderFillDef.fill.backgroundColor) {
                cell.style.backgroundColor = borderFillDef.fill.backgroundColor;
                if (borderFillDef.fill.opacity !== undefined) cell.style.opacity = borderFillDef.fill.opacity;
            }
            if (borderFillDef.fill.gradientCSS) cell.style.backgroundGradient = borderFillDef.fill.gradientCSS;
            if (borderFillDef.fill.patternType) {
                cell.style.patternType = borderFillDef.fill.patternType;
                cell.style.patternForeground = borderFillDef.fill.patternForeground;
            }
            if (borderFillDef.fill.backgroundImage) {
                cell.style.backgroundImage = borderFillDef.fill.backgroundImage;
            }
        }

        // Inline fill (fillBrush)
        const cellFillBrushElem = tcElem.querySelector('fillBrush, hp\\:fillBrush, hc\\:fillBrush');
        if (cellFillBrushElem) {
            const winBrushElem = cellFillBrushElem.querySelector('winBrush, hc\\:winBrush');
            if (winBrushElem) {
                const faceColor = winBrushElem.getAttribute('faceColor');
                const alpha = winBrushElem.getAttribute('alpha');
                if (faceColor && faceColor !== 'none') {
                    cell.style.backgroundColor = normalizeColor(faceColor);
                    if (alpha) cell.style.opacity = 1.0 - (parseInt(alpha) / 255.0);
                }
            }
        }

        // Cell size
        const cellSzElem = qs(tcElem, 'cellSz');
        if (cellSzElem) {
            const width = cellSzElem.getAttribute('width');
            const height = cellSzElem.getAttribute('height');
            if (width) {
                cell.widthHWPU = parseInt(width);
                if (table.widthHWPU) {
                    cell.style.widthPercent = (cell.widthHWPU / table.widthHWPU * 100).toFixed(4) + '%';
                }
                cell.style.width = HWPXConstants.hwpuToPxUnscaled(cell.widthHWPU).toFixed(2) + 'px';
                cell.style.widthPrecise = HWPXConstants.hwpuToPxUnscaled(cell.widthHWPU);
            }
            if (height) {
                cell.heightHWPU = parseInt(height);
                cell.style.height = HWPXConstants.hwpuToPxUnscaled(cell.heightHWPU).toFixed(2) + 'px';
                cell.style.heightPrecise = HWPXConstants.hwpuToPxUnscaled(cell.heightHWPU);
            }
        }

        // Cell margin
        const cellMarginElem = qs(tcElem, 'cellMargin');
        if (cellMarginElem) {
            const margins = ['top', 'right', 'bottom', 'left'].map(side => {
                const val = cellMarginElem.getAttribute(side);
                return val ? HWPXConstants.hwpuToPxUnscaled(parseInt(val)).toFixed(2) + 'px' : '0px';
            });
            cell.style.padding = margins.join(' ');
        }

        // Alignment
        const subListElem = qs(tcElem, 'subList');
        if (subListElem) {
            const vertAlign = subListElem.getAttribute('vertAlign');
            if (vertAlign) {
                const vAlignMap = { 'TOP': 'top', 'CENTER': 'middle', 'MIDDLE': 'middle', 'BOTTOM': 'bottom' };
                cell.style.verticalAlign = vAlignMap[vertAlign.toUpperCase()] || 'top';
            }
        }

        const alignElem = qs(tcElem, 'align');
        if (alignElem) {
            const horizontal = alignElem.getAttribute('horizontal') || alignElem.getAttribute('hAlign');
            const vertical = alignElem.getAttribute('vertical') || alignElem.getAttribute('vAlign');
            if (horizontal) {
                const hAlignMap = { 'LEFT': 'left', 'CENTER': 'center', 'RIGHT': 'right', 'JUSTIFY': 'justify' };
                cell.style.textAlign = hAlignMap[horizontal.toUpperCase()] || 'left';
            }
            if (vertical) {
                const vAlignMap = { 'TOP': 'top', 'CENTER': 'middle', 'MIDDLE': 'middle', 'BOTTOM': 'bottom' };
                cell.style.verticalAlign = vAlignMap[vertical.toUpperCase()] || 'top';
            }
        }

        // Nested tables
        const nestedTables = tcElem.querySelectorAll(':scope > subList > tbl, :scope > subList > hp\\:tbl, :scope > tbl, :scope > hp\\:tbl');
        nestedTables.forEach(nestedTbl => {
            const nestedTable = this.parseTable(nestedTbl);
            if (nestedTable) cell.elements.push(nestedTable);
        });

        // Cell paragraphs
        if (subListElem) {
            const allParas = qsa(subListElem, 'p');
            const parasToProcess = Array.from(allParas).filter(pElem => {
                const parentTable = pElem.closest('tbl, hp\\:tbl');
                if (parentTable && nestedTables && Array.from(nestedTables).includes(parentTable)) return false;
                const parentDrawText = pElem.closest('drawText, hp\\:drawText');
                if (parentDrawText && subListElem.contains(parentDrawText)) return false;
                const parentContainer = pElem.closest('container, hp\\:container, rect, hp\\:rect, ellipse, hp\\:ellipse');
                if (parentContainer && subListElem.contains(parentContainer)) return false;
                return true;
            });

            parasToProcess.forEach(pElem => {
                const para = this.parseParagraph(pElem);
                if (para) cell.elements.push(para);
            });
        }

        return cell;
    }

    _calculateColumnWidths(table, tblElem) {
        table.colWidths = [];
        table.colWidthsPercent = [];

        const colCnt = parseInt(tblElem.getAttribute('colCnt')) || table.rows[0].cells.length;
        const colWidthsHWPU = new Array(colCnt).fill(0);

        // Find reference row without colspan
        let referenceRow = null;
        for (const row of table.rows) {
            let hasColspan = false;
            for (const cell of row.cells) {
                if ((cell.colSpan || 1) > 1) { hasColspan = true; break; }
            }
            if (!hasColspan && row.cells.length === colCnt) {
                referenceRow = row;
                break;
            }
        }

        if (referenceRow) {
            for (let i = 0; i < referenceRow.cells.length; i++) {
                colWidthsHWPU[i] = referenceRow.cells[i].widthHWPU || 0;
            }
        } else {
            const firstRow = table.rows[0];
            let colIndex = 0;
            for (const cell of firstRow.cells) {
                const colspan = cell.colSpan || 1;
                const cellWidth = cell.widthHWPU || 0;
                const widthPerCol = cellWidth / colspan;
                for (let span = 0; span < colspan && colIndex < colCnt; span++) {
                    colWidthsHWPU[colIndex++] = widthPerCol;
                }
            }
        }

        const totalWidthHWPU = colWidthsHWPU.reduce((sum, w) => sum + w, 0);

        for (let i = 0; i < colCnt; i++) {
            const widthPx = HWPXConstants.hwpuToPx(colWidthsHWPU[i]);
            const widthPercent = totalWidthHWPU > 0 ? (colWidthsHWPU[i] / totalWidthHWPU * 100) : 0;
            table.colWidths.push(widthPx.toFixed(2) + 'px');
            table.colWidthsPercent.push(widthPercent.toFixed(4) + '%');
        }
    }

    // ========================================================================
    // Image Parsing
    // ========================================================================

    parseImage(picElem) {
        const image = {
            type: 'image',
            src: null,
            width: null,
            height: null,
            style: {},
            position: parsePosition(picElem)
        };

        // Image reference
        const imgElem = picElem.querySelector('img, hp\\:img, hc\\:img');
        if (imgElem) {
            const binaryItemId = imgElem.getAttribute('binaryItemIDRef');
            if (binaryItemId && this.images.has(binaryItemId)) {
                const imageData = this.images.get(binaryItemId);
                image.src = imageData.url;
                image.binaryItemId = binaryItemId;
            } else if (binaryItemId) {
                logger.warn(`⚠️ Image reference not found: ${binaryItemId}`);
            }
        }

        // Size (curSz/sz)
        const size = parseSize(picElem);
        if (size.width > 0) image.width = size.width;
        if (size.height > 0) image.height = size.height;

        // Alt text (접근성)
        const altText = picElem.getAttribute('alt') || picElem.getAttribute('longDesc');
        if (altText) image.alt = altText;

        // Children (containers/shapes inside imgRect)
        image.children = [];
        const imgRectElem = picElem.querySelector('imgRect, hp\\:imgRect, hc\\:imgRect');
        if (imgRectElem) {
            for (let i = 0; i < imgRectElem.children.length; i++) {
                const child = imgRectElem.children[i];
                const tag = localName(child);

                if (tag === 'container') {
                    const container = this.parseContainer(child);
                    if (container) image.children.push(container);
                } else if (tag === 'rect' || tag === 'ellipse' || tag === 'line') {
                    const shape = this.parseShape(child);
                    if (shape) image.children.push(shape);
                }
            }
        }

        return image.src ? image : null;
    }

    // ========================================================================
    // Shape Parsing
    // ========================================================================

    parseShape(shapeElem) {
        const shape = {
            type: 'shape',
            shapeType: 'rectangle',
            style: {},
            position: {},
            drawText: null,
            borderRadius: 0
        };

        // Determine shape type
        const tagName = localName(shapeElem);
        if (tagName === 'rect') shape.shapeType = 'rectangle';
        else if (tagName === 'ellipse') shape.shapeType = 'ellipse';
        else if (tagName === 'line') shape.shapeType = 'line';
        else if (tagName === 'polygon') shape.shapeType = 'polygon';
        else if (tagName === 'curve') shape.shapeType = 'curve';
        else if (tagName === 'arc') shape.shapeType = 'arc';
        else {
            // Search for child shape elements
            const rectElem = qs(shapeElem, 'rect');
            const ellipseElem = qs(shapeElem, 'ellipse');
            const lineElem = qs(shapeElem, 'line');
            if (ellipseElem) shape.shapeType = 'ellipse';
            else if (lineElem) shape.shapeType = 'line';
        }

        // Rounded corners
        const ratio = parseInt(shapeElem.getAttribute('ratio')) || 0;
        if (ratio > 0) shape.borderRadius = ratio;

        // Size
        const size = parseSize(shapeElem);
        if (size.width > 0) shape.width = size.width;
        if (size.height > 0) shape.height = size.height;

        // Position
        shape.position = parsePosition(shapeElem);

        // Background flag
        if (shape.position.textWrap === 'BEHIND_TEXT') {
            shape.isBackground = true;
        }

        // Border (lineShape)
        const lineShapeElem = qs(shapeElem, 'lineShape');
        if (lineShapeElem) {
            const lineColor = lineShapeElem.getAttribute('color');
            const lineWidth = lineShapeElem.getAttribute('width');
            const lineStyle = lineShapeElem.getAttribute('style');

            if (lineWidth && lineStyle !== 'NONE') {
                const widthPx = HWPXConstants.hwpuToPx(parseInt(lineWidth));
                if (widthPx >= 0.5) {
                    if (lineColor) shape.style.borderColor = normalizeColor(lineColor);
                    shape.style.borderWidth = `${widthPx}px`;
                    if (lineStyle === 'SOLID') shape.style.borderStyle = 'solid';
                    else if (lineStyle === 'DASH') shape.style.borderStyle = 'dashed';
                    else if (lineStyle === 'DOT') shape.style.borderStyle = 'dotted';
                    else shape.style.borderStyle = 'solid';
                }
            }
        }

        // Fill
        this._parseShapeFill(shapeElem, shape);

        // DrawText
        this._parseDrawText(shapeElem, shape);

        // ★ Polygon points (v3.0 신규)
        if (shape.shapeType === 'polygon') {
            const ptElems = qsa(shapeElem, 'pt');
            if (ptElems.length > 0) {
                shape.points = Array.from(ptElems).map(pt => ({
                    x: parseInt(pt.getAttribute('x')) || 0,
                    y: parseInt(pt.getAttribute('y')) || 0
                }));
            }
        }

        // ★ Line endpoints (v3.0 신규)
        if (shape.shapeType === 'line') {
            const startPt = qs(shapeElem, 'startPt');
            const endPt = qs(shapeElem, 'endPt');
            if (startPt) {
                shape.startPoint = {
                    x: parseInt(startPt.getAttribute('x')) || 0,
                    y: parseInt(startPt.getAttribute('y')) || 0
                };
            }
            if (endPt) {
                shape.endPoint = {
                    x: parseInt(endPt.getAttribute('x')) || 0,
                    y: parseInt(endPt.getAttribute('y')) || 0
                };
            }
        }

        return shape;
    }

    _parseShapeFill(shapeElem, shape) {
        // 1. Direct fillColor attribute
        let fillColor = shapeElem.getAttribute('fillColor');
        if (fillColor && fillColor !== 'none') {
            shape.style.backgroundColor = normalizeColor(fillColor);
            return;
        }

        // 2. borderFillIDRef
        const borderFillIDRef = shapeElem.getAttribute('borderFillIDRef');
        if (borderFillIDRef && this.borderFills.has(borderFillIDRef)) {
            const borderFillDef = this.borderFills.get(borderFillIDRef);
            if (borderFillDef.fill?.backgroundColor) {
                shape.style.backgroundColor = borderFillDef.fill.backgroundColor;
                if (borderFillDef.fill.opacity !== undefined) {
                    shape.style.opacity = borderFillDef.fill.opacity;
                }
                return;
            }
        }

        // 3. fillBrush child element
        let fillBrushElem = null;
        for (let i = 0; i < shapeElem.children.length; i++) {
            if (localName(shapeElem.children[i]) === 'fillbrush') {
                fillBrushElem = shapeElem.children[i];
                break;
            }
        }

        if (fillBrushElem) {
            let winBrushElem = null;
            for (let i = 0; i < fillBrushElem.children.length; i++) {
                if (localName(fillBrushElem.children[i]) === 'winbrush') {
                    winBrushElem = fillBrushElem.children[i];
                    break;
                }
            }

            if (winBrushElem) {
                const faceColor = winBrushElem.getAttribute('faceColor');
                const alpha = winBrushElem.getAttribute('alpha');
                if (faceColor && faceColor !== 'none') {
                    shape.style.backgroundColor = normalizeColor(faceColor);
                    if (alpha) shape.style.opacity = 1.0 - (parseInt(alpha) / 255.0);
                }
            }
        }
    }

    _parseDrawText(shapeElem, shape) {
        const drawTextElem = qs(shapeElem, 'drawText');
        if (!drawTextElem) return;

        const subListElem = qs(drawTextElem, 'subList');
        if (!subListElem) return;

        const paragraphs = subListElem.querySelectorAll(':scope > p, :scope > hp\\:p');
        if (paragraphs.length === 0) return;

        const vertAlign = subListElem.getAttribute('vertAlign');

        shape.drawText = {
            paragraphs: [],
            vertAlign: vertAlign || 'TOP',
            margin: {}
        };

        paragraphs.forEach(pElem => {
            const para = this.parseParagraph(pElem);
            if (para) shape.drawText.paragraphs.push(para);
        });

        // Text margin
        const textMarginElem = qs(drawTextElem, 'textMargin');
        if (textMarginElem) {
            ['left', 'right', 'top', 'bottom'].forEach(side => {
                const val = textMarginElem.getAttribute(side);
                if (val) shape.drawText.margin[side] = HWPXConstants.hwpuToPx(parseInt(val));
            });
        }
    }

    // ========================================================================
    // TextBox Parsing
    // ========================================================================

    parseTextBox(textboxElem) {
        const textbox = {
            type: 'textbox',
            style: {},
            position: parsePosition(textboxElem),
            paragraphs: []
        };

        // Size
        const size = parseSize(textboxElem);
        if (size.width > 0) textbox.width = size.width;
        if (size.height > 0) textbox.height = size.height;

        // Border and background
        const borderColor = textboxElem.getAttribute('borderColor');
        const fillColor = textboxElem.getAttribute('fillColor');
        if (borderColor) textbox.style.borderColor = normalizeColor(borderColor);
        if (fillColor) textbox.style.backgroundColor = normalizeColor(fillColor);

        // Paragraphs
        qsa(textboxElem, 'p').forEach(pElem => {
            const para = this.parseParagraph(pElem);
            if (para) textbox.paragraphs.push(para);
        });

        return textbox.paragraphs.length > 0 ? textbox : null;
    }

    // ========================================================================
    // Container Parsing
    // ========================================================================

    parseContainer(containerElem) {
        const container = {
            type: 'container',
            style: {},
            position: {},
            children: []
        };

        // Size
        const size = parseSize(containerElem);
        if (size.width > 0) container.width = size.width;
        if (size.height > 0) container.height = size.height;

        // Position
        const posElem = qs(containerElem, 'pos');
        if (posElem) {
            container.position.treatAsChar = posElem.getAttribute('treatAsChar') === '1';
        }

        // Offset
        const offsetElem = qs(containerElem, 'offset');
        if (offsetElem) {
            const x = offsetElem.getAttribute('x');
            const y = offsetElem.getAttribute('y');
            if (x) container.position.x = parseOffset(x);
            if (y) {
                const parentIsImageContainer = containerElem.parentElement?.querySelector('pic, hp\\:pic');
                container.position.y = parentIsImageContainer ? 0 : parseOffset(y);
            }
        }

        // Child images
        qsa(containerElem, 'pic').forEach(picElem => {
            const image = this.parseImage(picElem);
            if (image) container.children.push(image);
        });

        // Nested containers
        const nestedContainers = containerElem.querySelectorAll(':scope > container, :scope > hp\\:container');
        nestedContainers.forEach(nestedContainerElem => {
            const nestedContainer = this.parseContainer(nestedContainerElem);
            if (nestedContainer) container.children.push(nestedContainer);
        });

        // Direct shape children
        const directShapeChildren = [
            ...Array.from(containerElem.querySelectorAll(':scope > rect, :scope > hp\\:rect')),
            ...Array.from(containerElem.querySelectorAll(':scope > ellipse, :scope > hp\\:ellipse')),
            ...Array.from(containerElem.querySelectorAll(':scope > line, :scope > hp\\:line')),
            ...Array.from(containerElem.querySelectorAll(':scope > curve, :scope > hp\\:curve')),
            ...Array.from(containerElem.querySelectorAll(':scope > polygon, :scope > hp\\:polygon'))
        ];

        directShapeChildren.forEach(shapeElem => {
            const shape = this.parseShape(shapeElem);
            if (shape) container.children.push(shape);
        });

        return container.children.length > 0 ? container : null;
    }

    // ========================================================================
    // Utility Methods (exposed for backward compatibility)
    // ========================================================================

    normalizeColor(color) { return normalizeColor(color); }
    getBorderStyle(type) { return getBorderStyle(type); }

    parseBorderStyle(borderStr) {
        if (!borderStr) return {};
        const parts = borderStr.trim().split(/\s+/);
        const result = {};
        if (parts.length >= 1) result.width = parts[0];
        if (parts.length >= 2) result.style = parts[1];
        if (parts.length >= 3) result.color = parts[2];
        return result;
    }

    reset() {
        this.entries.clear();
        this.images.clear();
        this.styles.clear();
        this.borderFills.clear();
        this.paraProperties.clear();
        this.charProperties.clear();
        this.fontFaces.clear();
        this.numberings.clear();
        this.bulletDefs.clear();
        this.tabDefs.clear();
        this.namedStyles.clear();
    }

    cleanup() {
        this.images.forEach(image => {
            if (image.url && image.url.startsWith('blob:')) {
                URL.revokeObjectURL(image.url);
            }
        });
        this.reset();
    }
}

export default SimpleHWPXParser;
