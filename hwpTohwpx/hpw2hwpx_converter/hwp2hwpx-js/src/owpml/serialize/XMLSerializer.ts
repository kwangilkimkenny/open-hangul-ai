/**
 * XML Serializer 구현
 * hwpx-owpml-model의 XMLSerializer.h를 참고하여 포팅
 */

import { Serializer } from '../base/Serializer';
import { OWPMLObject, OWPMLNamedObject } from '../base/Object';
import { XMLAttribute } from '../base/Attribute';

/**
 * XML Serializer 클래스
 */
export class XMLSerializer extends Serializer {
  private buffer: string = '';
  private indentLevel: number = 0;
  private indentString: string = '  ';

  constructor() {
    super();
  }

  /**
   * XML 요소 쓰기
   */
  writeElement(
    curObjName: string,
    _object: OWPMLObject,
    attribute: XMLAttribute,
    value: string,
    _bAvailPreserveSpace: boolean = true
  ): boolean {
    const indent = this.getIndent();
    const attrs = attribute.toXMLString();
    const attrsStr = attrs ? ` ${attrs}` : '';

    if (value && value.trim().length > 0) {
      // 값이 있는 경우
      const needsPreserveSpace = _bAvailPreserveSpace && this.needPreserveWhiteSpace(value);
      const valueStr = needsPreserveSpace ? this.escapeXML(value) : value;

      this.buffer += `${indent}<${curObjName}${attrsStr}>${valueStr}</${curObjName}>\n`;
    } else {
      // 빈 요소
      this.buffer += `${indent}<${curObjName}${attrsStr}/>\n`;
    }

    return true;
  }

  /**
   * 버퍼와 함께 XML 요소 쓰기
   */
  writeElementWithBuffer(
    curObjName: string,
    _object: OWPMLObject,
    attribute: XMLAttribute,
    _value: string,
    buffer: string,
    _bufferlen: number,
    _bAvailPreserveSpace: boolean = true
  ): boolean {
    const indent = this.getIndent();
    const attrs = attribute.toXMLString();
    const attrsStr = attrs ? ` ${attrs}` : '';

    this.buffer += `${indent}<${curObjName}${attrsStr}>\n`;
    this.indentLevel++;
    this.writeBuffer(buffer, _bufferlen);
    this.indentLevel--;
    this.buffer += `${indent}</${curObjName}>\n`;

    return true;
  }

  /**
   * 속성 쓰기
   */
  writeAttribute(attribute: XMLAttribute): boolean {
    const attrs = attribute.toXMLString();
    if (attrs) {
      this.buffer += ` ${attrs}`;
    }
    return true;
  }

  /**
   * 버퍼 쓰기
   */
  writeBuffer(buffer: string, _bufferlen: number): boolean {
    const indent = this.getIndent();
    const lines = buffer.split('\n');
    for (const line of lines) {
      if (line.trim().length > 0 || lines.length === 1) {
        this.buffer += `${indent}${line}\n`;
      }
    }
    return true;
  }

  /**
   * 파일로 저장
   */
  save(_path: string, object: OWPMLNamedObject): boolean {
    // 실제 구현에서는 파일 시스템을 사용
    // 여기서는 버퍼를 반환하는 방식으로 구현
    this.buffer = '';
    this.indentLevel = 0;

    // XML 선언
    this.buffer += '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

    // 네임스페이스 설정
    this.setNamespaces(object);

    // 객체 직렬화
    this.serializeObject(object);

    // 파일 저장은 호출자가 처리
    return true;
  }

  /**
   * 스트림 버퍼로 저장
   */
  saveToStream(streamBuffer: string, object: OWPMLNamedObject): boolean {
    this.buffer = streamBuffer;
    this.indentLevel = 0;
    this.serializeObject(object);
    return true;
  }

  /**
   * 파일 열기
   */
  open(_path: string): boolean {
    this.buffer = '';
    this.indentLevel = 0;
    return true;
  }

  /**
   * 현재 버퍼 내용 가져오기
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * 버퍼 초기화
   */
  clear(): void {
    this.buffer = '';
    this.indentLevel = 0;
  }

  /**
   * 들여쓰기 문자열 가져오기
   */
  private getIndent(): string {
    return this.indentString.repeat(this.indentLevel);
  }

  /**
   * 공백 보존이 필요한지 확인
   */
  private needPreserveWhiteSpace(valueStr: string): boolean {
    // 줄바꿈이나 연속된 공백이 있으면 보존 필요
    return /\n|\r|\t|  +/.test(valueStr);
  }

  /**
   * XML 특수 문자 이스케이프
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 네임스페이스 설정
   */
  private setNamespaces(_object: OWPMLNamedObject): void {
    // 네임스페이스 설정 로직
    // 실제 구현에서는 IPart에서 네임스페이스 정보를 가져와야 함
  }

  /**
   * 객체 직렬화
   */
  private serializeObject(object: OWPMLNamedObject): void {
    const elemName = object.getElemName();
    if (!elemName) {
      return;
    }

    const att = new XMLAttribute();
    object.readAttribute(att);

    this.buffer += `${this.getIndent()}<${elemName}`;
    if (att.getCount() > 0) {
      this.writeAttribute(att);
    }
    this.buffer += '>\n';

    this.indentLevel++;

    // 자식 요소 직렬화
    const objectList = object.getObjectList();
    if (objectList) {
      for (const child of objectList) {
        if (child instanceof OWPMLNamedObject) {
          this.serializeObject(child);
        }
      }
    }

    this.indentLevel--;
    this.buffer += `${this.getIndent()}</${elemName}>\n`;
  }
}

