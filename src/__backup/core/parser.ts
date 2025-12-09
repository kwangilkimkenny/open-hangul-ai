/**
 * HWPX Parser (Complete Rewrite)
 * 참조 프로젝트 로직 100% 포팅
 * 
 * @module parser
 * @version 3.0.0
 */

import JSZip from 'jszip';

// Debug: expose JSZip to window for console debugging
if (typeof window !== 'undefined') {
  (window as any).JSZip = JSZip;
}
import { getLogger } from '../utils/logger';
import { HWPXConstants } from './constants';
import type { 
  HWPXDocument, 
  HWPXSection, 
  HWPXParagraph,
  HWPXTable,
  HWPXTableRow,
  HWPXTableCell,
  HWPXRun,
  HWPXImage,
  HWPXShape,
  HWPXContainer
} from '../../types/hwpx';

const logger = getLogger();

// ============================================
// Types
// ============================================

interface ParserOptions {
  parseImages?: boolean;
  parseTables?: boolean;
  parseStyles?: boolean;
}

interface ImageData {
  id: string;
  url: string;
  path: string;
  mimeType: string;
  size: number;
  filename: string;
}

interface BorderDef {
  type: string;
  width: string;
  widthRaw: number;
  color: string;
  visible: boolean;
  css: string;
}

interface BorderFill {
  id: string;
  borders: Record<string, BorderDef>;
  fill: {
    backgroundColor?: string;
    opacity?: number;
    gradientCSS?: string;
    patternType?: string;
    patternForeground?: string;
    backgroundImage?: {
      binaryItemIDRef: string;
      mode: string;
    };
  };
}

interface CharProperty {
  id: string;
  fontSize?: string;
  fontSizePx?: string;
  fontFamily?: string;
  fontId?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  underlineType?: string;
  underlineColor?: string;
  strikethrough?: boolean;
  strikethroughColor?: string;
  outline?: boolean;
  textShadow?: boolean;
  textShadowValue?: string;
  letterSpacing?: string;
  scaleX?: number;
  verticalAlign?: string;
  color?: string;
  backgroundColor?: string;
}

interface ParaProperty {
  id: string;
  textAlign?: string;
  verticalAlign?: string;
  lineHeight?: string;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
}

interface FontFace {
  id: string;
  name: string;
  hangul?: string;
  latin?: string;
  hanja?: string;
  japanese?: string;
  other?: string;
}

// ============================================
// Parser Class
// ============================================

export class SimpleHWPXParser {
  private options: Required<ParserOptions>;
  private entries: Map<string, Uint8Array>;
  private zip!: JSZip;  // ✅ ZIP 객체 저장 (header.xml 접근용)
  private images: Map<string, ImageData>;
  private borderFills: Map<string, BorderFill>;
  private charProperties: Map<string, CharProperty>;
  private paraProperties: Map<string, ParaProperty>;
  private fontFaces: Map<string, FontFace>;
  private numberings: Map<string, any>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      parseImages: options.parseImages !== false,
      parseTables: options.parseTables !== false,
      parseStyles: options.parseStyles !== false,
    };
    
    this.entries = new Map();
    this.images = new Map();
    this.borderFills = new Map();
    this.charProperties = new Map();
    this.paraProperties = new Map();
    this.fontFaces = new Map();
    this.numberings = new Map();
  }

  // ============================================
  // Main Parse Method
  // ============================================

  async parse(buffer: ArrayBuffer): Promise<HWPXDocument> {
    logger.info('📄 Starting HWPX parsing...');

    try {
      // 1. Unzip
      await this.unzip(buffer);

      // 2. Load resources
      await this.loadBinData();
      await this.loadFontFaces();
      await this.loadBorderFills();
      await this.loadParaProperties();
      await this.loadCharProperties();
      await this.loadNumberings();

      // 3. Parse content
      const sections = await this.parseContent();

      // 4. 원본 header.xml 저장 (export 시 재사용)
      let rawHeaderXml: string | undefined;
      try {
        const headerFile = this.zip.file('Contents/header.xml');
        if (headerFile) {
          rawHeaderXml = await headerFile.async('string');
          logger.info('✅ Original header.xml preserved');
        }
      } catch (e) {
        logger.warn('⚠️ Could not preserve header.xml:', e);
      }

      // 5. Build document
      const document: HWPXDocument = {
        sections,
        images: this.images,  // ✅ HWPXImageInfo 객체 전체 저장
        rawHeaderXml,  // ✅ 원본 header.xml 보존
        metadata: {
          createdAt: new Date().toISOString(),
        }
      };

      logger.info(`✅ HWPX parsed: ${sections.length} sections, ${this.images.size} images`);
      return document;

    } catch (error) {
      logger.error('❌ HWPX parsing error:', error);
      throw error;
    }
  }

  // ============================================
  // Unzip
  // ============================================

  private async unzip(buffer: ArrayBuffer): Promise<void> {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(buffer);
    
    // ✅ ZIP 객체 저장 (header.xml 접근용)
    this.zip = zipData;

    for (const [path, zipEntry] of Object.entries(zipData.files)) {
      if (!zipEntry.dir) {
        const data = await zipEntry.async('uint8array');
        this.entries.set(path, data);
      }
    }

    logger.debug(`📦 Unzipped ${this.entries.size} files`);
  }

  // ============================================
  // Load Binary Data (Images)
  // ============================================

  private async loadBinData(): Promise<void> {
    if (!this.options.parseImages) return;

    for (const [path, data] of this.entries) {
      if (path.startsWith('BinData/')) {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
          'png': 'image/png', 'gif': 'image/gif',
          'bmp': 'image/bmp', 'svg': 'image/svg+xml', 'webp': 'image/webp'
        };

        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        const blob = new Blob([data as BlobPart], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const filename = path.split('/').pop() || '';
        const id = filename.replace(/\.[^.]+$/, '');

        this.images.set(id, { id, url, path, mimeType, size: data.length, filename });
      }
    }

    logger.debug(`🖼️ Loaded ${this.images.size} images`);
  }

  // ============================================
  // Load Font Faces
  // ============================================

  private async loadFontFaces(): Promise<void> {
    const headData = this.entries.get('Contents/header.xml') || this.entries.get('Contents/head.xml');
    if (!headData) return;

    const headXml = new TextDecoder('utf-8').decode(headData);
    const parser = new DOMParser();
    const doc = parser.parseFromString(headXml, 'text/xml');

    const fontFaces = doc.querySelectorAll('fontFace, hh\\:fontFace');
    fontFaces.forEach(ffElem => {
      const id = ffElem.getAttribute('id');
      if (!id) return;

      const fontFace: FontFace = { id, name: 'Malgun Gothic' };

      const fontNames = ffElem.querySelectorAll('font, hh\\:font');
      fontNames.forEach(fontElem => {
        const lang = fontElem.getAttribute('lang');
        const name = fontElem.getAttribute('name') || fontElem.getAttribute('face');
        if (name) {
          if (lang === 'LATIN') fontFace.latin = name;
          else if (lang === 'HANGUL') fontFace.hangul = name;
          else if (lang === 'HANJA') fontFace.hanja = name;
          else if (lang === 'JAPANESE') fontFace.japanese = name;
          else if (lang === 'OTHER') fontFace.other = name;
        }
      });

      fontFace.name = fontFace.hangul || fontFace.latin || fontFace.other || 'Malgun Gothic';
      this.fontFaces.set(id, fontFace);
    });

    logger.debug(`🔤 Loaded ${this.fontFaces.size} font faces`);
  }

  // ============================================
  // Load Border Fills
  // ============================================

  private async loadBorderFills(): Promise<void> {
    const headData = this.entries.get('Contents/header.xml') || this.entries.get('Contents/head.xml');
    if (!headData) return;

    const headXml = new TextDecoder().decode(headData);
    const parser = new DOMParser();
    const doc = parser.parseFromString(headXml, 'text/xml');

    const borderFillElems = doc.querySelectorAll('borderFill, hp\\:borderFill, hh\\:borderFill');

    borderFillElems.forEach(elem => {
      const id = elem.getAttribute('id') || elem.getAttribute('itemId');
      if (!id) return;

      const borderFill: BorderFill = { id, borders: {}, fill: {} };

      // Parse borders
      ['left', 'right', 'top', 'bottom'].forEach(side => {
        const borderElem = elem.querySelector(`${side}Border, hh\\:${side}Border, hp\\:${side}Border, ${side}, hp\\:${side}`);
        if (borderElem) {
          const type = borderElem.getAttribute('type') || 'solid';
          const width = borderElem.getAttribute('width') || '1';
          const color = borderElem.getAttribute('color') || '#000000';
          const isVisible = type.toUpperCase() !== 'NONE';

          let widthValue: number;
          if (width.includes('mm')) {
            widthValue = parseFloat(width) * 3.7795;
          } else {
            widthValue = parseInt(width) / 7200 * 96;
          }
          const widthPx = isVisible ? Math.max(0.5, widthValue) : 0;

          borderFill.borders[side] = {
            type,
            width: `${widthPx.toFixed(2)}px`,
            widthRaw: widthPx,
            color: this.normalizeColor(color),
            visible: isVisible,
            css: isVisible ? `${widthPx.toFixed(2)}px ${this.getBorderStyle(type)} ${this.normalizeColor(color)}` : 'none'
          };
        }
      });

      // Parse diagonal lines
      ['slash', 'backSlash'].forEach(diagonal => {
        const diagonalElem = elem.querySelector(`${diagonal}, hh\\:${diagonal}, hp\\:${diagonal}`);
        if (diagonalElem) {
          const type = diagonalElem.getAttribute('type') || 'solid';
          const width = diagonalElem.getAttribute('width') || '1';
          const color = diagonalElem.getAttribute('color') || '#000000';
          const isVisible = type.toUpperCase() !== 'NONE';
          const widthPx = isVisible ? Math.max(0.5, parseInt(width) / 7200 * 96) : 0;

          borderFill.borders[diagonal] = {
            type, width: `${widthPx}`, widthRaw: widthPx,
            color: this.normalizeColor(color), visible: isVisible, css: ''
          };
        }
      });

      // Parse fill
      const fillElem = elem.querySelector('fill, hp\\:fill, fillBrush, hp\\:fillBrush, hh\\:fillBrush, hc\\:fillBrush');
      if (fillElem) {
        const winBrushElem = fillElem.querySelector('winBrush, hc\\:winBrush');
        let fillAlpha = 1.0;
        let faceColor: string | null = null;

        if (winBrushElem) {
          faceColor = winBrushElem.getAttribute('faceColor');
          const alpha = winBrushElem.getAttribute('alpha');
          if (alpha) {
            fillAlpha = 1.0 - (parseInt(alpha) / 255.0);
          }
        }

        const bgColor = faceColor || fillElem.getAttribute('backgroundColor') || fillElem.getAttribute('color') ||
                       fillElem.getAttribute('rgb') || fillElem.getAttribute('bgColor') || fillElem.getAttribute('fillColor');

        if (bgColor && bgColor !== 'none') {
          borderFill.fill.backgroundColor = this.normalizeColor(bgColor);
          borderFill.fill.opacity = fillAlpha;
        }

        // Pattern
        const patternType = fillElem.getAttribute('patternType');
        if (patternType && patternType !== 'none') {
          borderFill.fill.patternType = patternType;
          const fgColor = fillElem.getAttribute('patternColor') || fillElem.getAttribute('foregroundColor');
          if (fgColor) {
            borderFill.fill.patternForeground = this.normalizeColor(fgColor);
          }
        }

        // Gradient
        const gradationElem = fillElem.querySelector('gradation, hp\\:gradation, hc\\:gradation');
        if (gradationElem) {
          const gType = gradationElem.getAttribute('type') || 'linear';
          const angle = gradationElem.getAttribute('angle') || '0';
          const colors = gradationElem.getAttribute('colors') || '';
          const colorArray = colors.split(',').map(c => this.normalizeColor(c.trim()));
          
          if (gType === 'linear') {
            borderFill.fill.gradientCSS = `linear-gradient(${angle}deg, ${colorArray.join(', ')})`;
          } else if (gType === 'radial') {
            borderFill.fill.gradientCSS = `radial-gradient(circle, ${colorArray.join(', ')})`;
          }
        }

        // Image fill
        const imgBrushElem = fillElem.querySelector('imgBrush, hc\\:imgBrush');
        if (imgBrushElem) {
          const imgElem = imgBrushElem.querySelector('img, hc\\:img');
          if (imgElem) {
            const binaryItemIDRef = imgElem.getAttribute('binaryItemIDRef');
            const mode = imgBrushElem.getAttribute('mode') || 'TILE';
            if (binaryItemIDRef) {
              borderFill.fill.backgroundImage = { binaryItemIDRef, mode };
            }
          }
        }
      }

      this.borderFills.set(id, borderFill);
    });

    logger.debug(`🎨 Loaded ${this.borderFills.size} borderFills`);
  }

  // ============================================
  // Load Paragraph Properties
  // ============================================

  private async loadParaProperties(): Promise<void> {
    const headData = this.entries.get('Contents/header.xml') || this.entries.get('Contents/head.xml');
    if (!headData) return;

    const headXml = new TextDecoder('utf-8').decode(headData);
    const parser = new DOMParser();
    const doc = parser.parseFromString(headXml, 'text/xml');

    const paraPrElems = doc.querySelectorAll('paraPr, hp\\:paraPr, hh\\:paraPr');

    paraPrElems.forEach(elem => {
      const id = elem.getAttribute('id') || elem.getAttribute('itemId');
      if (!id) return;

      const paraProp: ParaProperty = { id };

      // Alignment
      const alignElem = elem.querySelector('align, hp\\:align, hh\\:align');
      if (alignElem) {
        const horizontal = alignElem.getAttribute('horizontal');
        if (horizontal) {
          const hAlignMap: Record<string, string> = {
            'LEFT': 'left', 'CENTER': 'center', 'RIGHT': 'right',
            'JUSTIFY': 'justify', 'DISTRIBUTE': 'justify'
          };
          paraProp.textAlign = hAlignMap[horizontal.toUpperCase()] || 'left';
        }

        const vertical = alignElem.getAttribute('vertical');
        if (vertical) {
          const vAlignMap: Record<string, string> = {
            'TOP': 'top', 'CENTER': 'middle', 'MIDDLE': 'middle',
            'BOTTOM': 'bottom', 'BASELINE': 'baseline'
          };
          paraProp.verticalAlign = vAlignMap[vertical.toUpperCase()] || 'baseline';
        }
      }

      // Margins
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

      // Line height
      const lineSpacingElem = elem.querySelector('lineSpacing, hp\\:lineSpacing, hh\\:lineSpacing');
      if (lineSpacingElem) {
        const type = lineSpacingElem.getAttribute('type');
        const value = lineSpacingElem.getAttribute('value');
        if (type && value) {
          if (type === 'PERCENT' || type === 'RATIO') {
            const percent = parseInt(value);
            paraProp.lineHeight = (percent / 100).toFixed(2);
          }
        }
      }

      this.paraProperties.set(id, paraProp);
    });

    logger.debug(`📐 Loaded ${this.paraProperties.size} paragraph properties`);
  }

  // ============================================
  // Load Character Properties
  // ============================================

  private async loadCharProperties(): Promise<void> {
    const headData = this.entries.get('Contents/header.xml') || this.entries.get('Contents/head.xml');
    if (!headData) return;

    const headXml = new TextDecoder('utf-8').decode(headData);
    const parser = new DOMParser();
    const doc = parser.parseFromString(headXml, 'text/xml');

    const charProps = doc.querySelectorAll('charPr, hh\\:charPr');

    charProps.forEach(cpElem => {
      const id = cpElem.getAttribute('id');
      if (!id) return;

      const charProp: CharProperty = { id };

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
        const fontFace = this.fontFaces.get(fontId);
        if (fontFace) {
          charProp.fontFamily = fontFace.name || 'Malgun Gothic';
        }
      }

      // Colors
      const textColor = cpElem.getAttribute('textColor');
      if (textColor && textColor !== 'auto') {
        charProp.color = this.normalizeColor(textColor);
      }

      // Bold
      if (cpElem.getAttribute('bold') === '1') charProp.bold = true;
      const boldElem = cpElem.querySelector('bold, hh\\:bold');
      if (boldElem) charProp.bold = true;

      // Italic
      if (cpElem.getAttribute('italic') === '1') charProp.italic = true;
      const italicElem = cpElem.querySelector('italic, hh\\:italic');
      if (italicElem) charProp.italic = true;

      // Underline
      if (cpElem.getAttribute('underline') === '1') charProp.underline = true;
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

      // Strikethrough
      const strikeoutElem = cpElem.querySelector('strikeout, hh\\:strikeout');
      if (strikeoutElem) {
        const strikeoutType = strikeoutElem.getAttribute('type');
        if (strikeoutType && strikeoutType !== 'NONE') {
          charProp.strikethrough = true;
          const strikeoutColor = strikeoutElem.getAttribute('color');
          if (strikeoutColor) {
            charProp.strikethroughColor = this.normalizeColor(strikeoutColor);
          }
        }
      }

      // Outline
      const outlineElem = cpElem.querySelector('outline, hh\\:outline');
      if (outlineElem) {
        const outlineType = outlineElem.getAttribute('type');
        if (outlineType && outlineType !== 'NONE') {
          charProp.outline = true;
        }
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
            charProp.textShadowValue = `${offsetXPx.toFixed(1)}px ${offsetYPx.toFixed(1)}px 0 ${this.normalizeColor(shadowColor)}`;
          }
        }
      }

      // Spacing (자간)
      const spacingElem = cpElem.querySelector('spacing, hh\\:spacing');
      if (spacingElem) {
        const hangulSpacing = spacingElem.getAttribute('hangul');
        if (hangulSpacing && parseInt(hangulSpacing) !== 0) {
          const spacingPercent = parseInt(hangulSpacing) / 100;
          charProp.letterSpacing = `${spacingPercent.toFixed(2)}em`;
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

      // Offset (위첨자/아래첨자)
      const offsetElem = cpElem.querySelector('offset, hh\\:offset');
      if (offsetElem) {
        const hangulOffset = offsetElem.getAttribute('hangul');
        if (hangulOffset && parseInt(hangulOffset) !== 0) {
          const offsetValue = parseInt(hangulOffset);
          charProp.verticalAlign = offsetValue > 0 ? 'super' : 'sub';
        }
      }

      // Background color
      const shadeColor = cpElem.getAttribute('shadeColor');
      if (shadeColor && shadeColor !== 'none' && shadeColor !== 'auto') {
        charProp.backgroundColor = this.normalizeColor(shadeColor);
      }

      this.charProperties.set(id, charProp);
    });

    logger.debug(`🔤 Loaded ${this.charProperties.size} character properties`);
  }

  // ============================================
  // Load Numberings (번호 매기기 정의)
  // ============================================

  private async loadNumberings(): Promise<void> {
    const headData = this.entries.get('Contents/header.xml') || this.entries.get('Contents/head.xml');
    if (!headData) return;

    const headXml = new TextDecoder('utf-8').decode(headData);
    const parser = new DOMParser();
    const doc = parser.parseFromString(headXml, 'text/xml');

    // Numbering definitions
    const numberingDefs = doc.querySelectorAll('numbering, hh\\:numbering');
    
    numberingDefs.forEach(numElem => {
      const id = numElem.getAttribute('id');
      if (!id) return;

      const numbering: any = {
        id,
        start: parseInt(numElem.getAttribute('start') || '1', 10),
        levels: []
      };

      // Parse levels
      const paraHeads = numElem.querySelectorAll('paraHead, hh\\:paraHead');
      paraHeads.forEach((phElem, level) => {
        const levelDef: any = {
          level,
          format: phElem.getAttribute('numFormat') || phElem.getAttribute('format') || 'DIGIT',
          numberFormat: phElem.getAttribute('numText') || phElem.getAttribute('text') || '%d.',
          startNum: parseInt(phElem.getAttribute('startNum') || '1', 10),
          align: phElem.getAttribute('align') || 'LEFT',
        };

        // Font info for numbering
        const fontId = phElem.getAttribute('fontId');
        if (fontId && this.fontFaces.has(fontId)) {
          levelDef.fontFamily = this.fontFaces.get(fontId)?.name;
        }

        numbering.levels.push(levelDef);
      });

      this.numberings.set(id, numbering);
    });

    // Bullet definitions
    const bulletDefs = doc.querySelectorAll('bullet, hh\\:bullet');
    bulletDefs.forEach(bulletElem => {
      const id = bulletElem.getAttribute('id');
      if (!id) return;

      const bullet: any = {
        id,
        type: 'bullet',
        levels: [{
          level: 0,
          format: 'BULLET',
          numberFormat: bulletElem.textContent?.trim() || bulletElem.getAttribute('char') || '•'
        }]
      };

      this.numberings.set(id, bullet);
    });

    logger.debug(`🔢 Loaded ${this.numberings.size} numbering definitions`);
  }

  // ============================================
  // Parse Content
  // ============================================

  private async parseContent(): Promise<HWPXSection[]> {
    const sections: HWPXSection[] = [];
    const sectionFiles = Array.from(this.entries.keys())
      .filter(path => path.match(/Contents\/section\d*\.xml/i))
      .sort();

    for (const sectionPath of sectionFiles) {
      const sectionData = this.entries.get(sectionPath);
      if (!sectionData) continue;

      const sectionXml = new TextDecoder('utf-8').decode(sectionData);
      const parser = new DOMParser();
      const doc = parser.parseFromString(sectionXml, 'text/xml');

      const section = this.parseSection(doc, sections.length);
      if (section) {
        sections.push(section);
      }
    }

    return sections;
  }

  // ============================================
  // Parse Section
  // ============================================

  private parseSection(doc: Document, index: number): HWPXSection {
    const section: HWPXSection = {
      id: `section-${index}`,
      elements: [],
      pageSettings: {}
    };

    // Parse page settings
    const secPrElem = doc.querySelector('secPr, hp\\:secPr');
    if (secPrElem) {
      const pagePrElem = secPrElem.querySelector('pagePr, hp\\:pagePr');
      if (pagePrElem) {
        const width = pagePrElem.getAttribute('width');
        const height = pagePrElem.getAttribute('height');

        if (width) {
          const widthPx = Math.round(parseInt(width) / 7200 * 96);
          section.pageSettings!.width = `${widthPx}px`;
        }
        if (height) {
          const heightPx = Math.round(parseInt(height) / 7200 * 96);
          section.pageSettings!.height = `${heightPx}px`;
        }

        // Margins
        const marginElem = pagePrElem.querySelector('margin, hp\\:margin');
        if (marginElem) {
          const left = marginElem.getAttribute('left');
          const right = marginElem.getAttribute('right');
          const top = marginElem.getAttribute('top');
          const bottom = marginElem.getAttribute('bottom');

          if (left) section.pageSettings!.marginLeft = `${Math.round(parseInt(left) / 7200 * 96)}px`;
          if (right) section.pageSettings!.marginRight = `${Math.round(parseInt(right) / 7200 * 96)}px`;
          if (top) section.pageSettings!.marginTop = `${Math.round(parseInt(top) / 7200 * 96)}px`;
          if (bottom) section.pageSettings!.marginBottom = `${Math.round(parseInt(bottom) / 7200 * 96)}px`;
        }
      }
    }

    // Find body element
    let bodyElem: Element = doc.documentElement;
    const possibleBody = bodyElem.querySelector('body, hh\\:body, hp\\:body, hs\\:sec');
    if (possibleBody) {
      bodyElem = possibleBody;
    }

    // Parse all children in document order
    const children = Array.from(bodyElem.children);
    
    children.forEach(child => {
      const localName = (child.localName || child.tagName).toLowerCase().replace(/^hp:|^hh:|^hs:/, '');

      if (localName === 'header' || localName === 'footer') return;

      if (localName === 'p') {
        // Check for tables inside paragraph
        const containsTable = child.querySelector('tbl, hp\\:tbl');
        
        if (containsTable && this.options.parseTables) {
          // Parse tables from runs
          const runs = child.querySelectorAll(':scope > run, :scope > hp\\:run');
          let currentTextRuns: any[] = [];

          runs.forEach(runElem => {
            const runChildren = Array.from(runElem.children);
            const hasTableInRun = runChildren.some(c => {
              const ln = (c.localName || c.tagName).toLowerCase();
              return ln === 'tbl' || ln.endsWith(':tbl');
            });

            if (hasTableInRun) {
              // Flush text runs
              if (currentTextRuns.length > 0) {
                section.elements.push({
                  type: 'paragraph',
                  runs: currentTextRuns
                } as HWPXParagraph);
                currentTextRuns = [];
              }

              // Parse tables
              const tblElems = runElem.querySelectorAll('tbl, hp\\:tbl');
              tblElems.forEach(tblElem => {
                const table = this.parseTable(tblElem);
                if (table) {
                  section.elements.push(table);
                }
              });
            } else {
              // Accumulate text runs
              const tElem = runElem.querySelector('t, hp\\:t');
              const text = tElem ? tElem.textContent : '';
              if (text?.trim()) {
                const charPrId = runElem.getAttribute('charPrIDRef');
                const run: HWPXRun = { text, style: {} };
                if (charPrId && this.charProperties.has(charPrId)) {
                  run.style = { ...this.charProperties.get(charPrId) };
                }
                currentTextRuns.push(run);
              }
            }
          });

          // Flush remaining runs
          if (currentTextRuns.length > 0) {
            section.elements.push({
              type: 'paragraph',
              runs: currentTextRuns
            } as HWPXParagraph);
          }
        } else {
          // Normal paragraph
          const para = this.parseParagraph(child);
          if (para) {
            section.elements.push(para);
          }
        }
      } else if ((localName === 'tbl' || localName === 'table') && this.options.parseTables) {
        const table = this.parseTable(child);
        if (table) {
          section.elements.push(table);
        }
      } else if (localName === 'sublist') {
        const parasInSubList = child.querySelectorAll('p, hp\\:p');
        parasInSubList.forEach(pElem => {
          const para = this.parseParagraph(pElem);
          if (para) {
            section.elements.push(para);
          }
        });
      }
    });

    // Parse standalone images
    if (this.options.parseImages) {
      const allImages = doc.querySelectorAll('pic, hp\\:pic');
      allImages.forEach(picElem => {
        const parent = picElem.parentElement;
        const parentTag = parent ? (parent.localName || parent.tagName).toLowerCase().replace('hp:', '') : '';
        if (parentTag === 'run' || picElem.closest('p, hp\\:p, tbl, hp\\:tbl')) return;

        const image = this.parseImage(picElem);
        if (image) {
          section.elements.push(image);
        }
      });
    }

    // Parse standalone shapes
    const shapes = doc.querySelectorAll('rect, hp\\:rect, ellipse, hp\\:ellipse, polygon, hp\\:polygon');
    shapes.forEach(shapeElem => {
      if (shapeElem.closest('container, hp\\:container')) return;
      if (shapeElem.closest('run, hp\\:run')) return;

      const shape = this.parseShape(shapeElem);
      if (shape) {
        section.elements.push(shape);
      }
    });

    // Parse containers
    const containers = doc.querySelectorAll('container, hp\\:container');
    containers.forEach(containerElem => {
      const parentContainer = containerElem.parentElement?.closest('container, hp\\:container');
      if (parentContainer && parentContainer !== containerElem) return;
      if (containerElem.closest('run, hp\\:run')) return;

      const container = this.parseContainer(containerElem);
      if (container) {
        section.elements.push(container);
      }
    });

    return section;
  }

  // ============================================
  // Parse Paragraph
  // ============================================

  private parseParagraph(pElem: Element): HWPXParagraph | null {
    const para: HWPXParagraph = {
      type: 'paragraph',
      runs: [],
      shapes: [],
      images: [],
      tables: []
    };

    // Paragraph properties
    const paraPrIDRef = pElem.getAttribute('paraPrIDRef');
    if (paraPrIDRef && this.paraProperties.has(paraPrIDRef)) {
      const paraProp = this.paraProperties.get(paraPrIDRef)!;
      if (paraProp.textAlign) para.alignment = paraProp.textAlign as any;
      if (paraProp.lineHeight) para.lineHeight = parseFloat(paraProp.lineHeight);
      if (paraProp.marginTop) para.marginTop = paraProp.marginTop;
      if (paraProp.marginBottom) para.marginBottom = paraProp.marginBottom;
      if (paraProp.marginLeft) para.marginLeft = paraProp.marginLeft;
      if (paraProp.marginRight) para.marginRight = paraProp.marginRight;
    }

    // Numbering (번호 매기기)
    const numPrIDRef = pElem.getAttribute('numPrIDRef');
    if (numPrIDRef) {
      const level = parseInt(pElem.getAttribute('level') || '0', 10);
      para.numbering = {
        id: numPrIDRef,
        level: level,
        definition: this.numberings.get(numPrIDRef)
      };
    }

    // Parse runs - try multiple selectors for different HWPX versions
    let runs = pElem.querySelectorAll(':scope > run, :scope > hp\\:run');
    
    // If no direct child runs, try deeper search
    if (runs.length === 0) {
      runs = pElem.querySelectorAll('run, hp\\:run');
    }
    
    // Debug logging for table cells
    const isInTable = pElem.closest('tc, hp\\:tc');
    if (isInTable && runs.length === 0) {
      // Try to find any text content
      const directText = pElem.textContent?.trim();
      if (directText && directText.length > 0) {
        logger.debug(`[parseParagraph] Cell paragraph with text but no runs: "${directText.substring(0, 30)}"`);
      }
    }

    if (runs.length > 0) {
      runs.forEach(runElem => {
        const charPrId = runElem.getAttribute('charPrIDRef');
        const runChildren = Array.from(runElem.children || []);

        runChildren.forEach(child => {
          const localName = child.localName || child.tagName.split(':').pop() || '';

          if (localName === 'secPr' || localName === 'ctrl') return;

          // Inline image
          if (localName === 'pic') {
            const image = this.parseImage(child);
            if (image) {
              image.treatAsChar = true;
              para.images!.push(image);
              para.runs.push({
                text: '',
                hasImage: true,
                imageIndex: para.images!.length - 1,
                style: {}
              });
            }
          }
          // Inline container
          else if (localName === 'container') {
            const container = this.parseContainer(child);
            if (container) {
              container.treatAsChar = true;
              para.shapes!.push(container as any);
              para.runs.push({ text: '', type: 'shape', style: {} });
            }
          }
          // Inline shape
          else if (['rect', 'ellipse', 'polygon'].includes(localName)) {
            const shape = this.parseShape(child);
            if (shape) {
              shape.treatAsChar = true;
              para.shapes!.push(shape);
              para.runs.push({ text: '', type: 'shape', style: {} });
            }
          }
          // Inline table
          else if (localName === 'tbl') {
            const table = this.parseTable(child);
            if (table) {
              para.tables!.push(table);
              para.runs.push({
                text: '',
                hasTable: true,
                tableIndex: para.tables!.length - 1,
                style: {}
              });
            }
          }
          // Text
          else if (localName === 't') {
            // Check for nested tabs
            const nestedTabs = child.querySelectorAll('tab, hp\\:tab');
            
            if (nestedTabs.length > 0) {
              const childNodes = Array.from(child.childNodes);
              childNodes.forEach(node => {
                if (node.nodeType === 3) {
                  const text = node.textContent || '';
                  if (text.length > 0) {
                    const run: HWPXRun = { text, style: {} };
                    if (charPrId && this.charProperties.has(charPrId)) {
                      run.style = { ...this.charProperties.get(charPrId) };
                    }
                    para.runs.push(run);
                  }
                } else if (node.nodeType === 1) {
                  const nodeName = (node as Element).localName || (node as Element).tagName.split(':').pop();
                  if (nodeName === 'tab') {
                    const tab: HWPXRun = { text: '', type: 'tab', style: {} };
                    const width = (node as Element).getAttribute('width');
                    const leader = (node as Element).getAttribute('leader');
                    if (width) {
                      (tab as any).widthPx = HWPXConstants.hwpuToPx(parseInt(width));
                    }
                    if (leader) {
                      (tab as any).leader = parseInt(leader);
                    }
                    para.runs.push(tab);
                  }
                }
              });
            } else {
              const text = child.textContent || '';
              const run: HWPXRun = { text, style: {} };
              if (charPrId && this.charProperties.has(charPrId)) {
                run.style = { ...this.charProperties.get(charPrId) };
              }
              para.runs.push(run);
            }
          }
          // Tab
          else if (localName === 'tab') {
            const tab: HWPXRun = { text: '', type: 'tab', style: {} };
            const width = child.getAttribute('width');
            const leader = child.getAttribute('leader');
            if (width) {
              (tab as any).widthPx = HWPXConstants.hwpuToPx(parseInt(width));
            }
            if (leader) {
              (tab as any).leader = parseInt(leader);
            }
            para.runs.push(tab);
          }
        });
      });
    } else {
      // Fallback 1: direct text elements (t tags)
      const textElems = pElem.querySelectorAll('t, hp\\:t');
      if (textElems.length > 0) {
        textElems.forEach(tElem => {
          const text = tElem.textContent || '';
          const charPrId = tElem.getAttribute('charPrIDRef');
          const run: HWPXRun = { text, style: {} };
          if (charPrId && this.charProperties.has(charPrId)) {
            run.style = { ...this.charProperties.get(charPrId) };
          }
          para.runs.push(run);
        });
      } else {
        // Fallback 2: direct text content (no run or t elements)
        const directText = pElem.textContent?.trim();
        if (directText && directText.length > 0) {
          // Check if text is not just from nested elements
          const childText = Array.from(pElem.children)
            .filter(c => {
              const ln = (c.localName || c.tagName).toLowerCase();
              return !['secpr', 'ctrl', 'lineseg'].includes(ln.replace('hp:', ''));
            })
            .map(c => c.textContent || '')
            .join('');
          
          const textToUse = childText.trim() || directText;
          if (textToUse.length > 0) {
            para.runs.push({ text: textToUse, style: {} });
          }
        }
      }
    }

    // Cleanup empty arrays
    if (para.shapes!.length === 0) delete para.shapes;
    if (para.images!.length === 0) delete para.images;
    if (para.tables!.length === 0) delete para.tables;

    return para;
  }

  // ============================================
  // Parse Table
  // ============================================

  private parseTable(tblElem: Element): HWPXTable | null {
    const table: HWPXTable = {
      type: 'table',
      rows: []
    };

    // Table size
    const szElem = tblElem.querySelector('sz, hp\\:sz');
    if (szElem) {
      const width = szElem.getAttribute('width');
      const height = szElem.getAttribute('height');
      if (width) {
        table.width = `${HWPXConstants.hwpuToPx(parseInt(width)).toFixed(2)}px`;
      }
      if (height) {
        table.height = `${HWPXConstants.hwpuToPx(parseInt(height)).toFixed(2)}px`;
      }
    }

    // Table border fill
    const tableBorderFillId = tblElem.getAttribute('borderFillIDRef') || tblElem.getAttribute('hp:borderFillIDRef');

    // Parse rows
    const rows = tblElem.querySelectorAll(':scope > tr, :scope > hp\\:tr');
    rows.forEach((trElem) => {
      const row: HWPXTableRow = { cells: [] };

      const cells = trElem.querySelectorAll(':scope > tc, :scope > hp\\:tc');
      cells.forEach((tcElem) => {
        const cell: HWPXTableCell = { elements: [] };

        // Cell span
        const cellSpanElem = tcElem.querySelector('cellSpan, hp\\:cellSpan');
        if (cellSpanElem) {
          const colSpan = cellSpanElem.getAttribute('colSpan');
          const rowSpan = cellSpanElem.getAttribute('rowSpan');
          if (colSpan && parseInt(colSpan) > 1) cell.colSpan = parseInt(colSpan);
          if (rowSpan && parseInt(rowSpan) > 1) cell.rowSpan = parseInt(rowSpan);
        }

        // Cell border fill
        const cellBorderFillId = tcElem.getAttribute('borderFillIDRef') || tcElem.getAttribute('hp:borderFillIDRef');
        if (cellBorderFillId && this.borderFills.has(cellBorderFillId)) {
          const borderFillDef = this.borderFills.get(cellBorderFillId)!;

          // Apply borders
          ['left', 'right', 'top', 'bottom'].forEach(side => {
            const def = borderFillDef.borders[side];
            if (def) {
              const borderKey = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof HWPXTableCell;
              (cell as any)[borderKey] = {
                width: def.widthRaw,
                style: this.getBorderStyle(def.type),
                color: def.color,
                visible: def.visible
              };
            }
          });

          // Fallback to table borders
          const hasVisibleBorder = ['left', 'right', 'top', 'bottom'].some(side => 
            borderFillDef.borders[side]?.visible
          );
          
          if (!hasVisibleBorder && tableBorderFillId && this.borderFills.has(tableBorderFillId)) {
            const tableBorderFillDef = this.borderFills.get(tableBorderFillId)!;
            ['left', 'right', 'top', 'bottom'].forEach(side => {
              const def = tableBorderFillDef.borders[side];
              if (def?.visible) {
                const borderKey = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof HWPXTableCell;
                (cell as any)[borderKey] = {
                  width: def.widthRaw,
                  style: this.getBorderStyle(def.type),
                  color: def.color,
                  visible: def.visible
                };
              }
            });
          }

          // Diagonal lines
          if (borderFillDef.borders.slash) {
            (cell as any).slashDef = borderFillDef.borders.slash;
          }
          if (borderFillDef.borders.backSlash) {
            (cell as any).backSlashDef = borderFillDef.borders.backSlash;
          }

          // Fill
          if (borderFillDef.fill.backgroundColor) {
            cell.backgroundColor = borderFillDef.fill.backgroundColor;
            if (borderFillDef.fill.opacity !== undefined) {
              (cell as any).opacity = borderFillDef.fill.opacity;
            }
          }
          if (borderFillDef.fill.gradientCSS) {
            cell.backgroundGradient = borderFillDef.fill.gradientCSS;
          }
          if (borderFillDef.fill.patternType) {
            (cell as any).patternType = borderFillDef.fill.patternType;
            (cell as any).patternForeground = borderFillDef.fill.patternForeground;
          }
          if (borderFillDef.fill.backgroundImage) {
            cell.backgroundImage = borderFillDef.fill.backgroundImage;
          }
        }

        // Cell size
        const cellSzElem = tcElem.querySelector('cellSz, hp\\:cellSz');
        if (cellSzElem) {
          const cellWidth = cellSzElem.getAttribute('width');
          const cellHeight = cellSzElem.getAttribute('height');
          if (cellWidth) {
            cell.width = `${HWPXConstants.hwpuToPx(parseInt(cellWidth)).toFixed(2)}px`;
          }
          if (cellHeight) {
            cell.height = `${HWPXConstants.hwpuToPx(parseInt(cellHeight)).toFixed(2)}px`;
          }
        }

        // Cell margin
        const cellMarginElem = tcElem.querySelector('cellMargin, hp\\:cellMargin');
        if (cellMarginElem) {
          const left = cellMarginElem.getAttribute('left');
          const right = cellMarginElem.getAttribute('right');
          const top = cellMarginElem.getAttribute('top');
          const bottom = cellMarginElem.getAttribute('bottom');
          
          const paddings = [
            top ? `${HWPXConstants.hwpuToPx(parseInt(top)).toFixed(1)}px` : '3px',
            right ? `${HWPXConstants.hwpuToPx(parseInt(right)).toFixed(1)}px` : '5px',
            bottom ? `${HWPXConstants.hwpuToPx(parseInt(bottom)).toFixed(1)}px` : '3px',
            left ? `${HWPXConstants.hwpuToPx(parseInt(left)).toFixed(1)}px` : '5px'
          ];
          cell.padding = paddings.join(' ');
        }

        // Cell alignment
        const cellAlign = tcElem.getAttribute('textAlign');
        const cellValign = tcElem.getAttribute('verticalAlign');
        if (cellAlign) cell.textAlign = cellAlign.toLowerCase() as any;
        if (cellValign) cell.verticalAlign = cellValign.toLowerCase() as any;

        // Parse nested tables first (they take precedence)
        const nestedTables = tcElem.querySelectorAll(':scope > subList > tbl, :scope > subList > hp\\:tbl, :scope > tbl, :scope > hp\\:tbl');
        nestedTables.forEach(nestedTbl => {
          const nestedTable = this.parseTable(nestedTbl);
          if (nestedTable) {
            cell.elements.push(nestedTable);
          }
        });

        // Parse cell paragraphs - ALL descendants, but exclude nested tables
        const subListElem = tcElem.querySelector('subList, hp\\:subList');
        if (subListElem) {
          // Get all paragraphs (including nested ones) - use :scope to get direct children first
          // Then include nested ones that aren't in tables
          const directParas = subListElem.querySelectorAll(':scope > p, :scope > hp\\:p');
          const nestedParas = subListElem.querySelectorAll('subList p, hp\\:subList hp\\:p, subList hp\\:p, hp\\:subList p');
          
          // Combine and deduplicate
          const allParas = new Set([...Array.from(directParas), ...Array.from(nestedParas)]);
          
          // Filter out paragraphs that are inside nested tables (already parsed above)
          const parasToProcess = Array.from(allParas).filter(pElem => {
            const parentTable = pElem.closest('tbl, hp\\:tbl');
            if (!parentTable) return true; // Not in a table, include it
            // Check if the parent table is one of the nested tables we already parsed
            return !nestedTables || !Array.from(nestedTables).some(nt => nt === parentTable || nt.contains(pElem));
          });
          
          parasToProcess.forEach(pElem => {
            const para = this.parseParagraph(pElem);
            if (para) {
              cell.elements.push(para);
            }
          });
        } else {
          // Fallback: try direct paragraphs in tc element
          const directParas = tcElem.querySelectorAll(':scope > p, :scope > hp\\:p');
          directParas.forEach(pElem => {
            const para = this.parseParagraph(pElem);
            if (para) {
              cell.elements.push(para);
            }
          });
        }

        // If no elements, try direct text
        if (cell.elements.length === 0) {
          const text = tcElem.textContent?.trim();
          if (text) {
            cell.elements.push({
              type: 'paragraph',
              runs: [{ text, style: {} }]
            } as HWPXParagraph);
          }
        }

        row.cells.push(cell);
      });

      // Row height
      const trHeight = trElem.getAttribute('height');
      if (trHeight) {
        row.height = `${HWPXConstants.hwpuToPx(parseInt(trHeight)).toFixed(2)}px`;
      }

      table.rows.push(row);
    });

    if (table.rows.length === 0) return null;
    
    // 열 너비를 비율(%)로 계산
    // 첫 번째 행에서 각 셀의 width를 수집
    if (table.rows.length > 0) {
      const firstRow = table.rows[0];
      const colWidthsPx: number[] = [];
      
      firstRow.cells.forEach(cell => {
        // colSpan 처리
        const span = cell.colSpan || 1;
        if (cell.width) {
          const widthPx = parseFloat(String(cell.width));
          // colSpan이 있는 경우 균등 분배
          const perColWidth = widthPx / span;
          for (let i = 0; i < span; i++) {
            colWidthsPx.push(perColWidth);
          }
        } else {
          // 폭 정보가 없으면 기본값
          for (let i = 0; i < span; i++) {
            colWidthsPx.push(100); // 기본 100px
          }
        }
      });
      
      // 총 폭 계산 및 비율 변환
      if (colWidthsPx.length > 0) {
        const totalWidth = colWidthsPx.reduce((a, b) => a + b, 0);
        table.colWidthsPercent = colWidthsPx.map(w => `${((w / totalWidth) * 100).toFixed(2)}%`);
        table.colWidths = colWidthsPx.map(w => `${w.toFixed(2)}px`);
      }
    }
    
    return table;
  }

  // ============================================
  // Parse Image
  // ============================================

  private parseImage(picElem: Element): HWPXImage | null {
    const image: HWPXImage = { type: 'image' };

    // Get image reference
    const imgElem = picElem.querySelector('img, hp\\:img, hc\\:img');
    if (imgElem) {
      const binaryItemIDRef = imgElem.getAttribute('binaryItemIDRef');
      if (binaryItemIDRef) {
        image.binaryItemIDRef = binaryItemIDRef;
        const imageData = this.images.get(binaryItemIDRef);
        if (imageData) {
          image.src = imageData.url;
          image.url = imageData.url;
          image.id = binaryItemIDRef;
        }
      }
    }

    // Get size
    const szElem = picElem.querySelector('sz, hp\\:sz');
    if (szElem) {
      const width = szElem.getAttribute('width');
      const height = szElem.getAttribute('height');
      if (width) image.width = HWPXConstants.hwpuToPx(parseInt(width));
      if (height) image.height = HWPXConstants.hwpuToPx(parseInt(height));
    }

    // Get position
    const posElem = picElem.querySelector('pos, hp\\:pos');
    if (posElem) {
      const treatAsChar = posElem.getAttribute('treatAsChar');
      image.treatAsChar = treatAsChar === '1' || treatAsChar === 'true';
      
      const x = posElem.getAttribute('x');
      const y = posElem.getAttribute('y');
      image.position = {
        treatAsChar: image.treatAsChar,
        x: x ? HWPXConstants.hwpuToPx(parseInt(x)) : undefined,
        y: y ? HWPXConstants.hwpuToPx(parseInt(y)) : undefined
      };
    }

    if (!image.src && !image.url) return null;
    return image;
  }

  // ============================================
  // Parse Shape
  // ============================================

  private parseShape(shapeElem: Element): HWPXShape | null {
    const localName = (shapeElem.localName || shapeElem.tagName).toLowerCase().replace(/^hp:|^hh:/, '');
    
    const shape: HWPXShape = {
      type: 'shape',
      shapeType: localName as any
    };

    // Get size
    const szElem = shapeElem.querySelector('sz, hp\\:sz');
    if (szElem) {
      const width = szElem.getAttribute('width');
      const height = szElem.getAttribute('height');
      if (width) shape.width = HWPXConstants.hwpuToPx(parseInt(width));
      if (height) shape.height = HWPXConstants.hwpuToPx(parseInt(height));
    }

    // Get position
    const posElem = shapeElem.querySelector('pos, hp\\:pos');
    if (posElem) {
      const treatAsChar = posElem.getAttribute('treatAsChar');
      shape.treatAsChar = treatAsChar === '1' || treatAsChar === 'true';
      
      const x = posElem.getAttribute('x');
      const y = posElem.getAttribute('y');
      shape.x = x ? HWPXConstants.hwpuToPx(parseInt(x)) : 0;
      shape.y = y ? HWPXConstants.hwpuToPx(parseInt(y)) : 0;
      
      shape.position = {
        treatAsChar: shape.treatAsChar,
        x: shape.x,
        y: shape.y
      };
    }

    // Get fill
    const fillElem = shapeElem.querySelector('fillBrush, hp\\:fillBrush, hc\\:fillBrush');
    if (fillElem) {
      const winBrushElem = fillElem.querySelector('winBrush, hc\\:winBrush');
      if (winBrushElem) {
        const faceColor = winBrushElem.getAttribute('faceColor');
        if (faceColor) {
          shape.fill = this.normalizeColor(faceColor);
        }
      }
    }

    // Get stroke
    const lineElem = shapeElem.querySelector('line, hp\\:line, hc\\:line');
    if (lineElem) {
      const color = lineElem.getAttribute('color');
      const width = lineElem.getAttribute('width');
      if (color) shape.stroke = this.normalizeColor(color);
      if (width) shape.strokeWidth = HWPXConstants.hwpuToPx(parseInt(width));
    }

    // Parse DrawText (text inside shape)
    const drawTextElem = shapeElem.querySelector('drawText, hp\\:drawText');
    if (drawTextElem) {
      const paragraphs: HWPXParagraph[] = [];
      const parasInDrawText = drawTextElem.querySelectorAll('p, hp\\:p');
      
      parasInDrawText.forEach(pElem => {
        const para = this.parseParagraph(pElem);
        if (para) {
          paragraphs.push(para);
        }
      });

      if (paragraphs.length > 0) {
        (shape as any).drawText = { paragraphs };
        shape.paragraphs = paragraphs;
        shape.text = paragraphs.map(p => p.runs?.map(r => r.text).join('') || '').join('\n');
        
        // Vertical align
        const textVertAlign = drawTextElem.getAttribute('textVertAlign');
        if (textVertAlign) {
          (shape as any).drawText.vertAlign = textVertAlign;
        }

        // Text margin
        const textMarginElem = drawTextElem.querySelector('textMargin, hp\\:textMargin');
        if (textMarginElem) {
          (shape as any).drawText.textMargin = {
            left: HWPXConstants.hwpuToPx(parseInt(textMarginElem.getAttribute('left') || '0')),
            right: HWPXConstants.hwpuToPx(parseInt(textMarginElem.getAttribute('right') || '0')),
            top: HWPXConstants.hwpuToPx(parseInt(textMarginElem.getAttribute('top') || '0')),
            bottom: HWPXConstants.hwpuToPx(parseInt(textMarginElem.getAttribute('bottom') || '0'))
          };
        }
      }
    }

    return shape;
  }

  // ============================================
  // Parse Container
  // ============================================

  private parseContainer(containerElem: Element): HWPXContainer | null {
    const container: HWPXContainer = {
      type: 'container',
      elements: []
    };

    // Get size
    const szElem = containerElem.querySelector(':scope > sz, :scope > hp\\:sz');
    if (szElem) {
      const width = szElem.getAttribute('width');
      const height = szElem.getAttribute('height');
      if (width) container.width = HWPXConstants.hwpuToPx(parseInt(width));
      if (height) container.height = HWPXConstants.hwpuToPx(parseInt(height));
    }

    // Get position
    const posElem = containerElem.querySelector(':scope > pos, :scope > hp\\:pos');
    if (posElem) {
      const treatAsChar = posElem.getAttribute('treatAsChar');
      container.treatAsChar = treatAsChar === '1' || treatAsChar === 'true';
      
      const x = posElem.getAttribute('x');
      const y = posElem.getAttribute('y');
      container.x = x ? HWPXConstants.hwpuToPx(parseInt(x)) : 0;
      container.y = y ? HWPXConstants.hwpuToPx(parseInt(y)) : 0;
    }

    // Parse children (images, shapes, nested containers)
    const children = Array.from(containerElem.children);
    
    children.forEach(child => {
      const localName = (child.localName || child.tagName).toLowerCase().replace(/^hp:|^hh:/, '');

      if (localName === 'sz' || localName === 'pos') return;

      if (localName === 'pic') {
        const image = this.parseImage(child);
        if (image) container.elements.push(image);
      } else if (['rect', 'ellipse', 'polygon'].includes(localName)) {
        const shape = this.parseShape(child);
        if (shape) container.elements.push(shape);
      } else if (localName === 'container') {
        const nestedContainer = this.parseContainer(child);
        if (nestedContainer) container.elements.push(nestedContainer as any);
      }
    });

    return container;
  }

  // ============================================
  // Utility Methods
  // ============================================

  private normalizeColor(color: string): string {
    if (!color) return '#000000';
    
    // RGB format (numeric)
    if (color.match(/^\d+$/)) {
      const num = parseInt(color);
      const r = (num >> 16) & 0xFF;
      const g = (num >> 8) & 0xFF;
      const b = num & 0xFF;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // Hex without #
    if (color.match(/^[0-9a-fA-F]{6}$/)) {
      return `#${color}`;
    }

    return color;
  }

  private getBorderStyle(type: string): string {
    const styleMap: Record<string, string> = {
      'SOLID': 'solid',
      'NONE': 'none',
      'DASH': 'dashed',
      'DOT': 'dotted',
      'DASH_DOT': 'dashed',
      'DASH_DOT_DOT': 'dashed',
      'DOUBLE': 'double',
      'WAVE': 'solid'
    };
    return styleMap[type?.toUpperCase()] || 'solid';
  }

  reset(): void {
    this.entries.clear();
    this.images.clear();
    this.borderFills.clear();
    this.charProperties.clear();
    this.paraProperties.clear();
    this.fontFaces.clear();
    this.numberings.clear();
  }

  cleanup(): void {
    this.images.forEach(img => {
      URL.revokeObjectURL(img.url);
    });
    this.reset();
  }
}

export default SimpleHWPXParser;
