/**
 * StringBuilder Utility
 *
 * 대용량 문자열 생성 시 성능 최적화를 위한 빌더 클래스
 * += 연산 대신 배열 push 후 join 방식 사용
 *
 * @module Utils
 * @category Utils
 */

/**
 * 문자열 빌더 클래스
 *
 * @example
 * ```typescript
 * const sb = new StringBuilder();
 * sb.append('<root>');
 * sb.appendLine('  <child>content</child>');
 * sb.append('</root>');
 * const result = sb.toString();
 * ```
 */
export class StringBuilder {
    private parts: string[] = [];

    /**
     * 문자열 추가
     */
    append(str: string): this {
        this.parts.push(str);
        return this;
    }

    /**
     * 문자열 추가 후 줄바꿈
     */
    appendLine(str: string = ''): this {
        this.parts.push(str);
        this.parts.push('\n');
        return this;
    }

    /**
     * 포맷된 문자열 추가
     * Optimized with single regex pass instead of sequential replacements
     */
    appendFormat(template: string, ...args: unknown[]): this {
        if (args.length === 0) {
            this.parts.push(template);
            return this;
        }

        // Single regex pass with callback for all placeholders
        const result = template.replace(/\{(\d+)\}/g, (_, index) => {
            const idx = parseInt(index, 10);
            return idx < args.length ? String(args[idx]) : `{${index}}`;
        });

        this.parts.push(result);
        return this;
    }

    /**
     * 조건부 추가
     */
    appendIf(condition: boolean, str: string): this {
        if (condition) {
            this.parts.push(str);
        }
        return this;
    }

    /**
     * 배열의 각 요소를 추가
     */
    appendAll(strings: string[]): this {
        this.parts.push(...strings);
        return this;
    }

    /**
     * 구분자로 연결하여 추가
     */
    appendJoin(strings: string[], separator: string = ''): this {
        this.parts.push(strings.join(separator));
        return this;
    }

    /**
     * 들여쓰기와 함께 추가
     */
    appendIndent(str: string, level: number, indentChar: string = '  '): this {
        this.parts.push(indentChar.repeat(level) + str);
        return this;
    }

    /**
     * 현재 길이 (대략적)
     */
    get length(): number {
        return this.parts.reduce((sum, part) => sum + part.length, 0);
    }

    /**
     * 비어있는지 확인
     */
    get isEmpty(): boolean {
        return this.parts.length === 0;
    }

    /**
     * 내용 초기화
     */
    clear(): this {
        this.parts = [];
        return this;
    }

    /**
     * 최종 문자열 생성
     */
    toString(): string {
        return this.parts.join('');
    }

    /**
     * 구분자로 연결하여 최종 문자열 생성
     */
    join(separator: string = ''): string {
        return this.parts.join(separator);
    }
}

/**
 * 팩토리 함수
 */
export function createStringBuilder(): StringBuilder {
    return new StringBuilder();
}
