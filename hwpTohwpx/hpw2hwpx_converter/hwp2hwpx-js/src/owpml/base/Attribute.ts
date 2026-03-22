/**
 * XML Attribute 클래스
 * hwpx-owpml-model의 Attribute.h를 참고하여 포팅
 */

export class XMLAttribute {
  private attributes: Map<string, string> = new Map();

  /**
   * 속성 값 가져오기
   */
  getValue(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  /**
   * 속성 값 설정
   */
  setValue(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  /**
   * 속성 제거
   */
  removeValue(name: string): boolean {
    return this.attributes.delete(name);
  }

  /**
   * 모든 속성 가져오기
   */
  getAllAttributes(): Map<string, string> {
    return new Map(this.attributes);
  }

  /**
   * 속성 개수
   */
  getCount(): number {
    return this.attributes.size;
  }

  /**
   * 속성 존재 여부 확인
   */
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  /**
   * 모든 속성 제거
   */
  clear(): void {
    this.attributes.clear();
  }

  /**
   * XML 속성 문자열로 변환
   */
  toXMLString(): string {
    const parts: string[] = [];
    for (const [name, value] of this.attributes.entries()) {
      const escapedValue = this.escapeXML(value);
      parts.push(`${name}="${escapedValue}"`);
    }
    return parts.join(' ');
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
}

