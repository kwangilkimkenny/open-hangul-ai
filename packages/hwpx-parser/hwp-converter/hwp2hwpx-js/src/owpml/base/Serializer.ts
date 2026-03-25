/**
 * OWPML Serializer 인터페이스
 * hwpx-owpml-model의 Serialize.h를 참고하여 포팅
 */

import { OWPMLObject, OWPMLNamedObject } from './Object';
import { XMLAttribute } from './Attribute';

/**
 * Serializer 추상 클래스
 */
export abstract class Serializer {
  /**
   * XML 요소 쓰기
   */
  abstract writeElement(
    curObjName: string,
    object: OWPMLObject,
    attribute: XMLAttribute,
    value: string,
    bAvailPreserveSpace?: boolean
  ): boolean;

  /**
   * 버퍼와 함께 XML 요소 쓰기
   */
  abstract writeElementWithBuffer(
    curObjName: string,
    object: OWPMLObject,
    attribute: XMLAttribute,
    value: string,
    buffer: string,
    bufferlen: number,
    bAvailPreserveSpace?: boolean
  ): boolean;

  /**
   * 속성 쓰기
   */
  abstract writeAttribute(attribute: XMLAttribute): boolean;

  /**
   * 버퍼 쓰기
   */
  abstract writeBuffer(buffer: string, bufferlen: number): boolean;

  /**
   * 파일로 저장
   */
  abstract save(path: string, object: OWPMLNamedObject): boolean;

  /**
   * 스트림 버퍼로 저장
   */
  abstract saveToStream(streamBuffer: string, object: OWPMLNamedObject): boolean;

  /**
   * 파일 열기
   */
  abstract open(path: string): boolean;
}

