/**
 * Special Objects (특수 객체) 파서
 * OLE 객체, 멀티미디어, 양식 필드 파싱
 */

import type { OLEObject, Multimedia, FormField, Chart, Equation } from '../models/Special';
import { OLEObjectType, MultimediaType, FormFieldType, ChartType, WrapType, AnchorType, getOLETypeFromCLSID, getMultimediaTypeFromExtension } from '../models/Special';

export class SpecialParser {
  private data: Uint8Array;
  private view: DataView;
  
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  
  /**
   * OLE 객체 파싱 (TagID 84)
   */
  parseOLEObject(offset: number): OLEObject | null {
    try {
      if (offset + 128 > this.data.length) {
        return null;
      }
      
      // 위치 및 크기
      const x = this.view.getInt32(offset + 0, true);
      const y = this.view.getInt32(offset + 4, true);
      const width = this.view.getInt32(offset + 8, true);
      const height = this.view.getInt32(offset + 12, true);
      
      // Z-order
      const zOrder = this.view.getInt32(offset + 16, true);
      
      // CLSID 길이 및 읽기 (추정)
      const clsidLength = offset + 20 <= this.data.length - 2 
        ? this.view.getUint16(offset + 20, true) 
        : 0;
      
      let classID = '';
      if (clsidLength > 0 && clsidLength < 100) {
        const clsidData = this.data.slice(offset + 22, offset + 22 + clsidLength);
        classID = new TextDecoder('utf-8').decode(clsidData);
      }
      
      // Storage ID (OLE 내 경로)
      const storageIDOffset = offset + 22 + clsidLength;
      const storageIDLength = storageIDOffset + 2 <= this.data.length 
        ? this.view.getUint16(storageIDOffset, true) 
        : 0;
      
      let storageID = '';
      if (storageIDLength > 0 && storageIDLength < 100) {
        const storageData = this.data.slice(storageIDOffset + 2, storageIDOffset + 2 + storageIDLength * 2);
        storageID = new TextDecoder('utf-16le').decode(storageData);
      }
      
      // OLE 타입 결정
      const type = getOLETypeFromCLSID(classID);
      
      return {
        id: 0,
        type,
        x,
        y,
        width,
        height,
        data: new Uint8Array(0), // 실제 데이터는 별도 스트림에서 읽어야 함
        storageID,
        classID,
        progID: type === OLEObjectType.EXCEL ? 'Excel.Sheet' : 'Unknown',
        embedded: true,
        zOrder,
        wrapType: WrapType.SQUARE,
        anchor: AnchorType.PARAGRAPH,
      };
    } catch (error) {
      console.error('❌ OLEObject 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 멀티미디어 파싱 (TagID 114)
   */
  parseMultimedia(offset: number): Multimedia | null {
    try {
      if (offset + 64 > this.data.length) {
        return null;
      }
      
      // 위치 및 크기
      const x = this.view.getInt32(offset + 0, true);
      const y = this.view.getInt32(offset + 4, true);
      const width = this.view.getInt32(offset + 8, true);
      const height = this.view.getInt32(offset + 12, true);
      
      // 형식 길이 및 읽기
      const formatLength = offset + 16 <= this.data.length - 2 
        ? this.view.getUint16(offset + 16, true) 
        : 0;
      
      let format = 'mp4';
      if (formatLength > 0 && formatLength < 20) {
        const formatData = this.data.slice(offset + 18, offset + 18 + formatLength);
        format = new TextDecoder('utf-8').decode(formatData);
      }
      
      // 타입 결정
      const type = getMultimediaTypeFromExtension(format);
      
      // 재생 옵션 (플래그로 추정)
      const flags = offset + 18 + formatLength + 4 <= this.data.length 
        ? this.view.getUint32(offset + 18 + formatLength, true) 
        : 0;
      
      const autoPlay = !!(flags & 0x01);
      const loop = !!(flags & 0x02);
      const showControls = !!(flags & 0x04);
      const volume = ((flags >> 8) & 0xFF) || 50;
      
      return {
        id: 0,
        type,
        x,
        y,
        width,
        height,
        data: new Uint8Array(0), // 실제 데이터는 별도 스트림
        format,
        mimeType: `video/${format}`,
        autoPlay,
        loop,
        showControls,
        volume,
        zOrder: 0,
        wrapType: WrapType.SQUARE,
        anchor: AnchorType.PARAGRAPH,
      };
    } catch (error) {
      console.error('❌ Multimedia 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 양식 필드 파싱 (TagID 112)
   */
  parseFormField(offset: number): FormField | null {
    try {
      if (offset + 32 > this.data.length) {
        return null;
      }
      
      // 필드 타입
      const typeValue = this.view.getUint8(offset + 0);
      const type = typeValue as FormFieldType;
      
      // 이름 길이 및 읽기
      const nameLength = this.view.getUint16(offset + 1, true);
      let name = '';
      if (nameLength > 0 && nameLength < 100) {
        const nameData = this.data.slice(offset + 3, offset + 3 + nameLength * 2);
        name = new TextDecoder('utf-16le').decode(nameData);
      }
      
      // 값 길이 및 읽기
      const valueOffset = offset + 3 + nameLength * 2;
      const valueLength = valueOffset + 2 <= this.data.length 
        ? this.view.getUint16(valueOffset, true) 
        : 0;
      
      let value: string | boolean | number = '';
      if (valueLength > 0 && valueLength < 1000) {
        const valueData = this.data.slice(valueOffset + 2, valueOffset + 2 + valueLength * 2);
        value = new TextDecoder('utf-16le').decode(valueData);
      }
      
      // 옵션 플래그
      const flagsOffset = valueOffset + 2 + valueLength * 2;
      const flags = flagsOffset + 4 <= this.data.length 
        ? this.view.getUint32(flagsOffset, true) 
        : 0;
      
      const required = !!(flags & 0x01);
      const readOnly = !!(flags & 0x02);
      const enabled = !(flags & 0x04);
      
      return {
        id: 0,
        type,
        name,
        paragraphNo: 0,
        charPos: 0,
        value,
        defaultValue: value,
        required,
        readOnly,
        enabled,
        width: 100,
        height: 20,
      };
    } catch (error) {
      console.error('❌ FormField 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 수식 파싱 (TagID 111)
   */
  parseEquation(offset: number): Equation | null {
    try {
      if (offset + 64 > this.data.length) {
        return null;
      }
      
      // MathML 길이 및 읽기
      const mathMLLength = this.view.getUint16(offset + 0, true);
      let mathML = '';
      
      if (mathMLLength > 0 && mathMLLength < 10000) {
        const mathMLData = this.data.slice(offset + 2, offset + 2 + mathMLLength);
        mathML = new TextDecoder('utf-8').decode(mathMLData);
      }
      
      // 폰트 크기
      const fontSize = offset + 2 + mathMLLength + 2 <= this.data.length 
        ? this.view.getUint16(offset + 2 + mathMLLength, true) 
        : 12;
      
      // 인라인 여부
      const flags = offset + 2 + mathMLLength + 4 <= this.data.length 
        ? this.view.getUint32(offset + 2 + mathMLLength + 2, true) 
        : 0;
      const inline = !!(flags & 0x01);
      
      return {
        id: 0,
        paragraphNo: 0,
        charPos: 0,
        mathML,
        fontSize,
        inline,
      };
    } catch (error) {
      console.error('❌ Equation 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 섹션 데이터에서 모든 특수 객체 추출
   */
  extractAll(): {
    oleObjects: OLEObject[];
    multimedia: Multimedia[];
    formFields: FormField[];
    equations: Equation[];
  } {
    const oleObjects: OLEObject[] = [];
    const multimedia: Multimedia[] = [];
    const formFields: FormField[] = [];
    const equations: Equation[] = [];
    
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
      
      if (tagId === 84) {
        // OLE_OBJECT
        const oleObj = this.parseOLEObject(offset);
        if (oleObj) {
          oleObj.id = oleObjects.length;
          oleObjects.push(oleObj);
        }
      } else if (tagId === 114) {
        // MULTIMEDIA
        const mmObj = this.parseMultimedia(offset);
        if (mmObj) {
          mmObj.id = multimedia.length;
          multimedia.push(mmObj);
        }
      } else if (tagId === 112) {
        // FORM_FIELD
        const formField = this.parseFormField(offset);
        if (formField) {
          formField.id = formFields.length;
          formFields.push(formField);
        }
      } else if (tagId === 111) {
        // EQUATION
        const equation = this.parseEquation(offset);
        if (equation) {
          equation.id = equations.length;
          equations.push(equation);
        }
      }
      
      offset += size;
    }
    
    console.log(`\n🎯 특수 객체 추출 완료:`);
    console.log(`   OLE Objects: ${oleObjects.length}개`);
    console.log(`   Multimedia: ${multimedia.length}개`);
    console.log(`   Form Fields: ${formFields.length}개`);
    console.log(`   Equations: ${equations.length}개\n`);
    
    return { oleObjects, multimedia, formFields, equations };
  }
}

