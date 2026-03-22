/**
 * SectionType 클래스
 * hwpx-owpml-model의 SectionType.h를 참고하여 포팅
 */

import { OWPMLNamedObject, OWPMLObject } from '../base/Object';
import { XMLAttribute } from '../base/Attribute';
import { Serializer } from '../base/Serializer';
import { ID_PARA_SectionType } from '../base/ClassID';

/**
 * PType 클래스 (문단 타입)
 */
export class PType extends OWPMLNamedObject {
  protected constructor() {
    super(ID_PARA_SectionType);
    this.setElemName('p');
  }

  static create(): PType {
    return new PType();
  }

  initMap(_bRead: boolean): void {
    // 맵 초기화
  }

  setObject(_object: OWPMLObject, _bAutoSet: boolean = true): void {
    // 객체 설정
  }

  createObject(_elemName: string, _bAutoSet: boolean = true): OWPMLObject | null {
    return null;
  }

  getElemName(): string {
    return this.elemName || 'p';
  }

  writeElement(
    curObjName: string,
    serializer: Serializer,
    att: XMLAttribute
  ): boolean {
    return serializer.writeElement(curObjName, this, att, '');
  }

  readAttribute(_att: XMLAttribute): boolean {
    return true;
  }

  readNodeValue(_value: string, _length: number): boolean {
    return true;
  }
}

/**
 * SectionType 클래스
 */
export class SectionType extends OWPMLNamedObject {
  private pList: PType[] = [];

  constructor() {
    super(ID_PARA_SectionType);
    this.setElemName('section');
    this.initMap(true);
  }

  static create(): SectionType {
    return new SectionType();
  }

  /**
   * 맵 초기화
   */
  initMap(_bRead: boolean): void {
    // 맵 초기화 로직
  }

  /**
   * 객체 설정
   */
  setObject(_object: OWPMLObject, _bAutoSet: boolean = true): void {
    // 객체 설정 로직
  }

  /**
   * 객체 생성
   */
  createObject(elemName: string, _bAutoSet: boolean = true): OWPMLObject | null {
    if (elemName === 'p') {
      return PType.create();
    }
    return null;
  }

  /**
   * PType 추가
   */
  setP(p: PType | null = null): PType {
    if (p === null) {
      p = PType.create();
    }
    this.addObject(p);
    this.pList.push(p);
    return p;
  }

  /**
   * PType 가져오기
   */
  getP(index: number = 0): PType | null {
    if (index < 0 || index >= this.pList.length) {
      return null;
    }
    return this.pList[index];
  }

  /**
   * 모든 PType 가져오기
   */
  getAllP(): PType[] {
    return [...this.pList];
  }

  /**
   * PType 개수
   */
  getPCount(): number {
    return this.pList.length;
  }

  getElemName(): string {
    return this.elemName || 'section';
  }

  writeElement(
    curObjName: string,
    serializer: Serializer,
    _att: XMLAttribute
  ): boolean {
    return serializer.writeElement(curObjName, this, new XMLAttribute(), '');
  }

  readAttribute(_att: XMLAttribute): boolean {
    return true;
  }

  readNodeValue(_value: string, _length: number): boolean {
    return true;
  }
}

