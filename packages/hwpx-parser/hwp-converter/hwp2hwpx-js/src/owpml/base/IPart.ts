/**
 * IPart 인터페이스
 * OWPML Part를 나타내는 인터페이스
 */

/**
 * Part namespace information
 */
export interface PartNamespaceInfo {
  prefix?: string;
  uri?: string;
  [key: string]: unknown;
}

export interface IPart {
  /**
   * Part의 이름을 반환
   */
  getName(): string;

  /**
   * Part의 네임스페이스 정보를 반환
   */
  getNamespaceInfo(): PartNamespaceInfo;
}

