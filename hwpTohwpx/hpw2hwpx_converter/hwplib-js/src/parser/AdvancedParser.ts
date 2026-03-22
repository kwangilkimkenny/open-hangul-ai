/**
 * Advanced Features (고급 기능) 파서
 * 하이퍼링크, 책갈피, 필드, 텍스트상자 파싱
 */

import type { Hyperlink, Bookmark, Field, TextBox, TextBoxParagraph, FieldData } from '../models/Advanced';
import { HyperlinkType, HyperlinkTarget, FieldType, LineStyle, VerticalAlignment, WrapType, AnchorType } from '../models/Advanced';

export class AdvancedParser {
  private data: Uint8Array;
  private view: DataView;
  
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  
  /**
   * Hyperlink 파싱 (TagID 107)
   */
  parseHyperlink(offset: number): Hyperlink | null {
    try {
      if (offset + 64 > this.data.length) {
        return null;
      }
      
      // URL 길이
      const urlLength = this.view.getUint16(offset + 0, true);
      
      // URL 읽기 (UTF-16LE)
      let url = '';
      if (urlLength > 0 && urlLength < 1000) {
        const urlData = this.data.slice(offset + 2, offset + 2 + urlLength * 2);
        url = new TextDecoder('utf-16le').decode(urlData);
      }
      
      // 표시 텍스트 길이 (URL 다음)
      const displayTextOffset = offset + 2 + urlLength * 2;
      const displayTextLength = displayTextOffset + 2 <= this.data.length 
        ? this.view.getUint16(displayTextOffset, true) 
        : 0;
      
      let displayText = '';
      if (displayTextLength > 0 && displayTextLength < 1000) {
        const displayData = this.data.slice(displayTextOffset + 2, displayTextOffset + 2 + displayTextLength * 2);
        displayText = new TextDecoder('utf-16le').decode(displayData);
      }
      
      // 타입 감지
      let type = HyperlinkType.URL;
      if (url.startsWith('mailto:')) {
        type = HyperlinkType.EMAIL;
      } else if (url.startsWith('file://')) {
        type = HyperlinkType.FILE;
      } else if (url.startsWith('#')) {
        type = HyperlinkType.BOOKMARK;
      }
      
      return {
        id: 0,
        url,
        displayText: displayText || url,
        paragraphNo: 0,
        charPos: 0,
        length: displayText.length,
        type,
        target: HyperlinkTarget.BLANK,
      };
    } catch (error) {
      console.error('❌ Hyperlink 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * Bookmark 파싱 (TagID 100)
   */
  parseBookmark(offset: number): Bookmark | null {
    try {
      if (offset + 32 > this.data.length) {
        return null;
      }
      
      // 이름 길이
      const nameLength = this.view.getUint16(offset + 0, true);
      
      // 이름 읽기
      let name = '';
      if (nameLength > 0 && nameLength < 100) {
        const nameData = this.data.slice(offset + 2, offset + 2 + nameLength * 2);
        name = new TextDecoder('utf-16le').decode(nameData);
      }
      
      // 위치
      const paragraphNo = this.view.getUint16(offset + 2 + nameLength * 2, true);
      const charPos = this.view.getUint16(offset + 4 + nameLength * 2, true);
      
      return {
        id: 0,
        name,
        paragraphNo,
        charPos,
        visible: true,
      };
    } catch (error) {
      console.error('❌ Bookmark 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * Field 파싱 (TagID 96-106)
   */
  parseField(offset: number, tagId: number): Field | null {
    try {
      if (offset + 16 > this.data.length) {
        return null;
      }
      
      // 필드 타입 결정
      let fieldType = FieldType.PAGE_NUMBER;
      let data: FieldData;
      
      switch (tagId) {
        case 97:  // FIELD_DATE
          fieldType = FieldType.DATE;
          data = { type: 'DATE', format: 'YYYY-MM-DD' };
          break;
        case 99:  // FIELD_PATH
          fieldType = FieldType.PATH;
          data = { type: 'FILENAME', includePath: true, includeExtension: true };
          break;
        case 100: // FIELD_BOOKMARK
          fieldType = FieldType.REFERENCE;
          data = { type: 'TITLE', value: '' };
          break;
        case 103: // FIELD_FORMULA
          fieldType = FieldType.FORMULA;
          data = { type: 'FORMULA', expression: '', result: 0 };
          break;
        default:
          data = { type: 'PAGE_NUMBER', format: 0 };
      }
      
      return {
        id: 0,
        type: fieldType,
        paragraphNo: 0,
        charPos: 0,
        data,
        autoUpdate: true,
      };
    } catch (error) {
      console.error('❌ Field 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * TextBox 파싱 (TagID 108)
   */
  parseTextBox(offset: number): TextBox | null {
    try {
      if (offset + 64 > this.data.length) {
        return null;
      }
      
      // 위치 및 크기
      const x = this.view.getInt32(offset + 0, true);
      const y = this.view.getInt32(offset + 4, true);
      const width = this.view.getInt32(offset + 8, true);
      const height = this.view.getInt32(offset + 12, true);
      
      // 회전 (degree * 100)
      const rotation = this.view.getInt32(offset + 16, true) / 100;
      
      // Z-order
      const zOrder = this.view.getInt32(offset + 20, true);
      
      // 색상 (추정)
      const backgroundColor = offset + 24 <= this.data.length - 4 
        ? this.view.getUint32(offset + 24, true) 
        : 0xFFFFFF;
      const borderColor = offset + 28 <= this.data.length - 4 
        ? this.view.getUint32(offset + 28, true) 
        : 0x000000;
      
      return {
        id: 0,
        x,
        y,
        width,
        height,
        rotation,
        zOrder,
        paragraphs: [],
        backgroundColor,
        borderColor,
        borderWidth: 10,
        borderStyle: LineStyle.SOLID,
        verticalAlign: VerticalAlignment.TOP,
        padding: { top: 100, right: 100, bottom: 100, left: 100 },
        wrapType: WrapType.SQUARE,
        anchor: AnchorType.PARAGRAPH,
        shadow: false,
        opacity: 100,
      };
    } catch (error) {
      console.error('❌ TextBox 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 섹션 데이터에서 모든 고급 기능 추출
   */
  extractAll(): {
    hyperlinks: Hyperlink[];
    bookmarks: Bookmark[];
    fields: Field[];
    textBoxes: TextBox[];
  } {
    const hyperlinks: Hyperlink[] = [];
    const bookmarks: Bookmark[] = [];
    const fields: Field[] = [];
    const textBoxes: TextBox[] = [];
    
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
      
      if (tagId === 107) {
        // HYPERLINK
        const hyperlink = this.parseHyperlink(offset);
        if (hyperlink) {
          hyperlink.id = hyperlinks.length;
          hyperlinks.push(hyperlink);
        }
      } else if (tagId === 100) {
        // BOOKMARK
        const bookmark = this.parseBookmark(offset);
        if (bookmark) {
          bookmark.id = bookmarks.length;
          bookmarks.push(bookmark);
        }
      } else if (tagId >= 96 && tagId <= 106) {
        // FIELD
        const field = this.parseField(offset, tagId);
        if (field) {
          field.id = fields.length;
          fields.push(field);
        }
      } else if (tagId === 108) {
        // TEXT_BOX
        const textBox = this.parseTextBox(offset);
        if (textBox) {
          textBox.id = textBoxes.length;
          textBoxes.push(textBox);
        }
      }
      
      offset += size;
    }
    
    console.log(`\n🔗 고급 기능 추출 완료:`);
    console.log(`   Hyperlinks: ${hyperlinks.length}개`);
    console.log(`   Bookmarks: ${bookmarks.length}개`);
    console.log(`   Fields: ${fields.length}개`);
    console.log(`   TextBoxes: ${textBoxes.length}개\n`);
    
    return { hyperlinks, bookmarks, fields, textBoxes };
  }
}

