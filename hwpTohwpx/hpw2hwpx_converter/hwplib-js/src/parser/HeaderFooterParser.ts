/**
 * HeaderFooter (머리말/꼬리말) 및 Footnote/Endnote (각주/미주) 파서
 */

import type { Header, Footer, Footnote, Endnote, HeaderParagraph, FootnoteParagraph, HeaderField } from '../models/HeaderFooter';
import { HeaderFooterType, PageApplication, NumberingType, LineType, FieldType, TextAlignment } from '../models/HeaderFooter';

export class HeaderFooterParser {
  private data: Uint8Array;
  private view: DataView;
  
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  
  /**
   * Header 파싱 (TagID 90)
   */
  parseHeader(offset: number): Header | null {
    try {
      if (offset + 64 > this.data.length) {
        return null;
      }
      
      // 기본 속성 (추정)
      const flags = this.view.getUint32(offset + 0, true);
      const type = (flags & 0x03) as HeaderFooterType;
      const applyTo = ((flags >> 2) & 0x07) as PageApplication;
      
      const height = this.view.getUint32(offset + 4, true);
      const topMargin = this.view.getUint32(offset + 8, true);
      const bottomMargin = this.view.getUint32(offset + 12, true);
      const leftMargin = this.view.getUint32(offset + 16, true);
      const rightMargin = this.view.getUint32(offset + 20, true);
      
      const borderTop = !!(flags & 0x0100);
      const borderBottom = !!(flags & 0x0200);
      const textWrap = !!(flags & 0x0400);
      
      // 텍스트 내용은 별도 LIST 레코드에서 파싱 필요
      const paragraphs: HeaderParagraph[] = [];
      
      return {
        id: 0, // 외부에서 할당
        type,
        applyTo,
        paragraphs,
        topMargin,
        bottomMargin,
        leftMargin,
        rightMargin,
        borderTop,
        borderBottom,
        height,
        textWrap,
      };
    } catch (error) {
      console.error('❌ Header 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * Footer 파싱 (TagID 91)
   */
  parseFooter(offset: number): Footer | null {
    try {
      if (offset + 64 > this.data.length) {
        return null;
      }
      
      // Header와 구조 유사
      const flags = this.view.getUint32(offset + 0, true);
      const type = (flags & 0x03) as HeaderFooterType;
      const applyTo = ((flags >> 2) & 0x07) as PageApplication;
      
      const height = this.view.getUint32(offset + 4, true);
      const topMargin = this.view.getUint32(offset + 8, true);
      const bottomMargin = this.view.getUint32(offset + 12, true);
      const leftMargin = this.view.getUint32(offset + 16, true);
      const rightMargin = this.view.getUint32(offset + 20, true);
      
      const borderTop = !!(flags & 0x0100);
      const borderBottom = !!(flags & 0x0200);
      const textWrap = !!(flags & 0x0400);
      
      const paragraphs: HeaderParagraph[] = [];
      
      return {
        id: 0,
        type,
        applyTo,
        paragraphs,
        topMargin,
        bottomMargin,
        leftMargin,
        rightMargin,
        borderTop,
        borderBottom,
        height,
        textWrap,
      };
    } catch (error) {
      console.error('❌ Footer 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * Footnote 파싱 (TagID 92)
   */
  parseFootnote(offset: number): Footnote | null {
    try {
      if (offset + 32 > this.data.length) {
        return null;
      }
      
      const index = this.view.getUint32(offset + 0, true);
      const flags = this.view.getUint32(offset + 4, true);
      
      const numberingType = (flags & 0x0F) as NumberingType;
      const numberingStart = this.view.getUint16(offset + 8, true);
      
      const separatorLine = !!(flags & 0x0100);
      const separatorLineType = ((flags >> 9) & 0x07) as LineType;
      
      // 참조 위치 (추정)
      const referencePageNo = this.view.getUint16(offset + 10, true);
      const referenceParagraphNo = this.view.getUint16(offset + 12, true);
      const referenceCharPos = this.view.getUint16(offset + 14, true);
      
      const paragraphs: FootnoteParagraph[] = [];
      
      return {
        id: 0,
        index,
        referencePageNo,
        referenceParagraphNo,
        referenceCharPos,
        paragraphs,
        numberingType,
        numberingStart,
        separatorLine,
        separatorLineType,
      };
    } catch (error) {
      console.error('❌ Footnote 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * Endnote 파싱 (TagID 93)
   */
  parseEndnote(offset: number): Endnote | null {
    try {
      if (offset + 32 > this.data.length) {
        return null;
      }
      
      const index = this.view.getUint32(offset + 0, true);
      const flags = this.view.getUint32(offset + 4, true);
      
      const numberingType = (flags & 0x0F) as NumberingType;
      const numberingStart = this.view.getUint16(offset + 8, true);
      const placement = ((flags >> 4) & 0x01) as any;
      
      const referencePageNo = this.view.getUint16(offset + 10, true);
      const referenceParagraphNo = this.view.getUint16(offset + 12, true);
      const referenceCharPos = this.view.getUint16(offset + 14, true);
      
      const paragraphs: FootnoteParagraph[] = [];
      
      return {
        id: 0,
        index,
        referencePageNo,
        referenceParagraphNo,
        referenceCharPos,
        paragraphs,
        numberingType,
        numberingStart,
        placement,
      };
    } catch (error) {
      console.error('❌ Endnote 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 머리말/꼬리말 문단 파싱 (PARA_TEXT에서 추출)
   */
  parseHeaderParagraph(textData: Uint8Array): HeaderParagraph {
    // UTF-16LE 디코딩
    const text = new TextDecoder('utf-16le').decode(textData);
    
    // 특수 필드 감지 (페이지 번호 등)
    const fields: HeaderField[] = [];
    
    // "##PAGE##" 패턴 감지
    if (text.includes('##PAGE##')) {
      fields.push({
        type: FieldType.PAGE_NUMBER,
        position: text.indexOf('##PAGE##'),
        pageNumberFormat: '1',
      });
    }
    
    return {
      text: text.replace(/##PAGE##/g, '{{PAGE}}'),
      fields,
    };
  }
  
  /**
   * 섹션 데이터에서 모든 Header/Footer/Footnote/Endnote 추출
   */
  extractAll(): {
    headers: Header[];
    footers: Footer[];
    footnotes: Footnote[];
    endnotes: Endnote[];
  } {
    const headers: Header[] = [];
    const footers: Footer[] = [];
    const footnotes: Footnote[] = [];
    const endnotes: Endnote[] = [];
    
    let offset = 0;
    
    while (offset < this.data.length - 4) {
      const header = this.view.getUint32(offset, true);
      offset += 4;
      
      const tagId = header & 0x3FF;
      let size = (header >> 20) & 0xFFF;
      
      if (size === 0xFFF) {
        if (offset + 4 > this.data.length) break;
        size = this.view.getUint32(offset, true);
        offset += 4;
      }
      
      if (offset + size > this.data.length) break;
      
      if (tagId === 90) {
        // HWPTAG_HEADER
        const headerObj = this.parseHeader(offset);
        if (headerObj) {
          headerObj.id = headers.length;
          headers.push(headerObj);
          console.log(`✅ Header #${headerObj.id} 파싱 완료`);
        }
      } else if (tagId === 91) {
        // HWPTAG_FOOTER
        const footerObj = this.parseFooter(offset);
        if (footerObj) {
          footerObj.id = footers.length;
          footers.push(footerObj);
          console.log(`✅ Footer #${footerObj.id} 파싱 완료`);
        }
      } else if (tagId === 92) {
        // HWPTAG_FOOTNOTE
        const footnoteObj = this.parseFootnote(offset);
        if (footnoteObj) {
          footnoteObj.id = footnotes.length;
          footnotes.push(footnoteObj);
          console.log(`✅ Footnote #${footnoteObj.id} 파싱 완료`);
        }
      } else if (tagId === 93) {
        // HWPTAG_ENDNOTE
        const endnoteObj = this.parseEndnote(offset);
        if (endnoteObj) {
          endnoteObj.id = endnotes.length;
          endnotes.push(endnoteObj);
          console.log(`✅ Endnote #${endnoteObj.id} 파싱 완료`);
        }
      }
      
      offset += size;
    }
    
    console.log(`\n📄 머리말/꼬리말/각주/미주 추출 완료:`);
    console.log(`   Headers: ${headers.length}개`);
    console.log(`   Footers: ${footers.length}개`);
    console.log(`   Footnotes: ${footnotes.length}개`);
    console.log(`   Endnotes: ${endnotes.length}개\n`);
    
    return { headers, footers, footnotes, endnotes };
  }
}

