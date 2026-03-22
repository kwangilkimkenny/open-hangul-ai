/**
 * ID Generator Utility
 *
 * HWPX XML 요소에 사용되는 고유 ID 생성
 * Math.random() 대신 순차적 카운터를 사용하여 충돌 방지
 */

/**
 * ID 생성기 클래스
 * 변환 세션별로 인스턴스를 생성하여 사용
 */
export class IdGenerator {
    private counter: number = 0;
    private readonly prefix: string;

    constructor(prefix: string = '') {
        this.prefix = prefix;
    }

    /**
     * 다음 순차 ID 생성
     */
    next(): number {
        return ++this.counter;
    }

    /**
     * 문자열 ID 생성 (prefix 포함)
     */
    nextString(): string {
        return `${this.prefix}${++this.counter}`;
    }

    /**
     * 현재 카운터 값 조회
     */
    get current(): number {
        return this.counter;
    }

    /**
     * 카운터 리셋
     */
    reset(): void {
        this.counter = 0;
    }
}

/**
 * 전역 인스턴스 ID 생성기
 * XML 요소의 instId, id 등에 사용
 */
let globalInstanceIdCounter = 0;

/**
 * 인스턴스 ID 생성 (hp:tbl, hp:pic 등의 id 속성)
 * 변환 세션 내에서 고유한 순차 ID 반환
 */
export function generateInstanceId(): number {
    return ++globalInstanceIdCounter;
}

/**
 * 헤더/푸터 ID 생성
 */
export function generateHeaderFooterId(): number {
    return ++globalInstanceIdCounter;
}

/**
 * 전역 카운터 리셋 (새 변환 세션 시작 시 호출)
 */
export function resetIdCounters(): void {
    globalInstanceIdCounter = 0;
}

/**
 * 현재 카운터 값 조회 (디버깅용)
 */
export function getCurrentIdCounter(): number {
    return globalInstanceIdCounter;
}

/**
 * Worker 요청 ID 생성
 * 타임스탬프 + 순차번호 조합으로 고유성 보장
 */
let workerRequestCounter = 0;

export function generateRequestId(): string {
    return `req_${Date.now()}_${(++workerRequestCounter).toString(36)}`;
}
