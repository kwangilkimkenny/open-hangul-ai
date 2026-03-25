/**
 * OWPML 기본 객체 클래스
 * hwpx-owpml-model의 Object.h를 참고하여 포팅
 */

import { IPart } from './IPart';
import { XMLAttribute } from './Attribute';
import { ErrorCode } from './types';
import type { Serializer } from './Serializer';

/**
 * 객체 생성 함수 타입
 */
export type CreateFunction = () => OWPMLObject;

/**
 * 객체 리스트 타입
 */
export type ObjectList = OWPMLObject[];

/**
 * OWPML 기본 객체 클래스
 */
export abstract class OWPMLObject {
  protected id: number = 0;
  protected rootPart: IPart | null = null;
  protected parent: OWPMLObject | null = null;
  protected errorCode: ErrorCode = ErrorCode.NO_ERROR;

  /**
   * 생성자
   */
  protected constructor(id: number) {
    this.id = id;
  }

  /**
   * 객체 ID 가져오기
   */
  getID(): number {
    return this.id;
  }

  /**
   * 객체 ID 설정
   */
  setObjectID(id: number): void {
    this.id = id;
  }

  /**
   * Root Part 설정
   */
  setRootPart(part: IPart | null): void {
    this.rootPart = part;
  }

  /**
   * Root Part 가져오기
   */
  getRootPart(): IPart | null {
    return this.rootPart;
  }

  /**
   * 부모 객체 설정
   */
  setParentObj(parent: OWPMLObject | null): void {
    this.parent = parent;
  }

  /**
   * 부모 객체 가져오기
   */
  getParentObj(): OWPMLObject | null {
    return this.parent;
  }

  /**
   * 에러 코드 설정
   */
  setErrorCode(error: ErrorCode): void {
    this.errorCode = error;
  }

  /**
   * 에러 코드 가져오기
   */
  getErrorCode(): ErrorCode {
    return this.errorCode;
  }

  /**
   * 객체 복제 (기본 구현은 null 반환)
   */
  clone(): OWPMLObject | null {
    return null;
  }

  /**
   * XML 요소 이름 가져오기
   */
  abstract getElemName(): string | null;

  /**
   * XML 요소 쓰기
   */
  abstract writeElement(
    curObjName: string,
    serializer: Serializer,
    att: XMLAttribute
  ): boolean;

  /**
   * 속성 읽기
   */
  abstract readAttribute(att: XMLAttribute): boolean;

  /**
   * 노드 값 읽기
   */
  abstract readNodeValue(value: string, length: number): boolean;

  /**
   * 자식 요소 생성 (기본 구현은 null 반환)
   */
  childElementCreate(_qname: string, _attrs: XMLAttribute): OWPMLObject | null {
    return null;
  }

  /**
   * 객체 리스트 가져오기 (기본 구현은 null 반환)
   */
  getObjectList(): ObjectList | null {
    return null;
  }

  /**
   * ID로 객체 가져오기 (기본 구현은 null 반환)
   */
  getObjectByID(_id: number, _index: number = 0): OWPMLObject | null {
    return null;
  }

  /**
   * 인덱스로 객체 가져오기 (기본 구현은 null 반환)
   */
  getObjectByIndex(_index: number): OWPMLObject | null {
    return null;
  }

  /**
   * 자식 요소를 가졌는지 여부
   */
  hasChildList(): boolean {
    return false;
  }

  /**
   * 그리기 객체인지 여부
   */
  isDrawingObject(): boolean {
    return false;
  }

  /**
   * AnyElement를 가졌는지 여부
   */
  hasAnyelement(): boolean {
    return false;
  }
}

/**
 * 확장 객체 클래스 (자식 요소를 가질 수 있는 객체)
 */
export abstract class OWPMLExtObject extends OWPMLObject {
  protected objectList: ObjectList | null = null;
  protected mapStruct: MapElement[] | null = null;

  protected constructor(id: number) {
    super(id);
  }

  /**
   * 맵 초기화
   */
  abstract initMap(bRead: boolean): void;

  /**
   * 객체 설정
   */
  abstract setObject(object: OWPMLObject, bAutoSet?: boolean): void;

  /**
   * 객체 생성
   */
  abstract createObject(elemName: string, bAutoSet?: boolean): OWPMLObject | null;

  /**
   * 객체 리스트 가져오기
   */
  getObjectList(): ObjectList | null {
    return this.objectList;
  }

  /**
   * ID로 객체 가져오기
   */
  getObjectByID(id: number, index: number = 0): OWPMLObject | null {
    if (!this.objectList) {
      return null;
    }

    let count = 0;
    for (const obj of this.objectList) {
      if (obj.getID() === id) {
        if (count === index) {
          return obj;
        }
        count++;
      }
    }
    return null;
  }

  /**
   * 인덱스로 객체 가져오기
   */
  getObjectByIndex(index: number): OWPMLObject | null {
    if (!this.objectList || index < 0 || index >= this.objectList.length) {
      return null;
    }
    return this.objectList[index];
  }

  /**
   * ID로 객체 리스트 가져오기
   */
  getObjectListByID(id: number, objectList: ObjectList): number {
    if (!this.objectList) {
      return 0;
    }

    let count = 0;
    for (const obj of this.objectList) {
      if (obj.getID() === id) {
        objectList.push(obj);
        count++;
      }
    }
    return count;
  }

  /**
   * ID로 객체 개수 가져오기
   */
  getObjectCountByID(id: number): number {
    if (!this.objectList) {
      return 0;
    }

    let count = 0;
    for (const obj of this.objectList) {
      if (obj.getID() === id) {
        count++;
      }
    }
    return count;
  }

  /**
   * 자식 요소를 가졌는지 여부
   */
  hasChildList(): boolean {
    return this.objectList !== null && this.objectList.length > 0;
  }

  /**
   * 자식 개수 가져오기
   */
  getChildCount(): number {
    return this.objectList ? this.objectList.length : 0;
  }

  /**
   * 객체 리스트 설정
   */
  setObjectList(objectList: ObjectList | null): void {
    this.objectList = objectList;
  }

  /**
   * 객체 추가
   */
  addObject(object: OWPMLObject): void {
    if (!this.objectList) {
      this.objectList = [];
    }
    this.objectList.push(object);
    object.setParentObj(this);
  }

  /**
   * 객체 제거
   */
  removeObject(object: OWPMLObject): boolean {
    if (!this.objectList) {
      return false;
    }

    const index = this.objectList.indexOf(object);
    if (index >= 0) {
      this.objectList.splice(index, 1);
      object.setParentObj(null);
      return true;
    }
    return false;
  }
}

/**
 * 맵 요소 타입
 */
export interface MapElement {
  elemId: number;
  elemName: string;
  elemFunc: CreateFunction;
}

/**
 * 이름을 가진 객체 클래스
 */
export abstract class OWPMLNamedObject extends OWPMLExtObject {
  protected elemName: string = '';

  protected constructor(id: number) {
    super(id);
  }

  /**
   * 요소 이름 설정
   */
  setElemName(name: string): void {
    this.elemName = name;
  }

  /**
   * 요소 이름 가져오기
   */
  getElemName(): string {
    return this.elemName;
  }
}

/**
 * 값 객체 클래스 (템플릿)
 */
export abstract class OWPMLValueObject<T, R> extends OWPMLObject {
  protected value: T;

  protected constructor(id: number, defaultValue: T) {
    super(id);
    this.value = defaultValue;
  }

  /**
   * 값 설정
   */
  setValue(val: R): void {
    this.value = val as unknown as T;
  }

  /**
   * 값 가져오기
   */
  getValue(): R {
    return this.value as unknown as R;
  }
}

/**
 * 문자열 값 객체 클래스
 */
export abstract class OWPMLStringValueObject extends OWPMLValueObject<string, string> {
  protected constructor(id: number) {
    super(id, '');
  }

  /**
   * 값 설정
   */
  setValue(val: string): void {
    this.value = val;
  }

  /**
   * 값 가져오기
   */
  getValue(): string {
    return this.value;
  }
}

