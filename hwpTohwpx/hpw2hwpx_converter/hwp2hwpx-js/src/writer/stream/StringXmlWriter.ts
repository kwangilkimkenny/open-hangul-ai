/**
 * StringXmlWriter - String-based XML Writer
 *
 * Implements IXmlWriter using string array concatenation.
 * Backwards compatible with existing StringBuilder usage pattern.
 *
 * Performance: O(n) string building using array push + join
 *
 * @module Writer/Stream
 * @category Writer
 */

import type { IXmlWriter, XmlWriterOptions } from './XmlWriter';
import { escapeXmlText, formatAttributes } from './XmlWriter';

// Pre-compiled regex for format placeholders
const FORMAT_PLACEHOLDER_REGEX = /\{(\d+)\}/g;

/**
 * String-based XML Writer implementation
 *
 * Uses the same optimization strategy as StringBuilder:
 * array.push() + join() instead of string concatenation
 *
 * @example
 * ```typescript
 * const writer = new StringXmlWriter();
 * writer.writeXmlDeclaration();
 * writer.writeStartElement('root', { xmlns: 'http://example.com' });
 * writer.writeElement('child', 'content', { id: '1' });
 * writer.writeEndElement('root');
 * const xml = writer.toString();
 * ```
 */
export class StringXmlWriter implements IXmlWriter {
    private parts: string[] = [];
    private indentLevel: number;
    private readonly indentString: string;
    private readonly prettyPrint: boolean;

    constructor(options: XmlWriterOptions = {}) {
        this.indentLevel = options.initialIndent ?? 0;
        this.indentString = options.indentString ?? '  ';
        this.prettyPrint = options.prettyPrint ?? false;
    }

    /**
     * Write raw string content
     */
    write(str: string): this {
        this.parts.push(str);
        return this;
    }

    /**
     * Write string with newline
     */
    writeLine(str: string = ''): this {
        this.parts.push(str);
        this.parts.push('\n');
        return this;
    }

    /**
     * Write formatted string with placeholders
     */
    writeFormat(template: string, ...args: unknown[]): this {
        if (args.length === 0) {
            this.parts.push(template);
            return this;
        }

        const result = template.replace(FORMAT_PLACEHOLDER_REGEX, (_, index) => {
            const idx = parseInt(index, 10);
            return idx < args.length ? String(args[idx]) : `{${index}}`;
        });

        this.parts.push(result);
        return this;
    }

    /**
     * Write XML element start tag
     */
    writeStartElement(name: string, attributes?: Record<string, string | number | boolean>): this {
        if (this.prettyPrint && this.indentLevel > 0) {
            this.parts.push(this.indentString.repeat(this.indentLevel));
        }

        this.parts.push('<');
        this.parts.push(name);
        this.parts.push(formatAttributes(attributes));
        this.parts.push('>');

        if (this.prettyPrint) {
            this.parts.push('\n');
            this.indentLevel++;
        }

        return this;
    }

    /**
     * Write XML element end tag
     */
    writeEndElement(name: string): this {
        if (this.prettyPrint) {
            this.indentLevel = Math.max(0, this.indentLevel - 1);
            this.parts.push(this.indentString.repeat(this.indentLevel));
        }

        this.parts.push('</');
        this.parts.push(name);
        this.parts.push('>');

        if (this.prettyPrint) {
            this.parts.push('\n');
        }

        return this;
    }

    /**
     * Write self-closing XML element
     */
    writeEmptyElement(name: string, attributes?: Record<string, string | number | boolean>): this {
        if (this.prettyPrint && this.indentLevel > 0) {
            this.parts.push(this.indentString.repeat(this.indentLevel));
        }

        this.parts.push('<');
        this.parts.push(name);
        this.parts.push(formatAttributes(attributes));
        this.parts.push('/>');

        if (this.prettyPrint) {
            this.parts.push('\n');
        }

        return this;
    }

    /**
     * Write complete element with text content
     */
    writeElement(name: string, content: string, attributes?: Record<string, string | number | boolean>): this {
        if (this.prettyPrint && this.indentLevel > 0) {
            this.parts.push(this.indentString.repeat(this.indentLevel));
        }

        this.parts.push('<');
        this.parts.push(name);
        this.parts.push(formatAttributes(attributes));
        this.parts.push('>');
        this.parts.push(escapeXmlText(content));
        this.parts.push('</');
        this.parts.push(name);
        this.parts.push('>');

        if (this.prettyPrint) {
            this.parts.push('\n');
        }

        return this;
    }

    /**
     * Write XML declaration
     */
    writeXmlDeclaration(version: string = '1.0', encoding: string = 'UTF-8', standalone: string = 'yes'): this {
        this.parts.push(`<?xml version="${version}" encoding="${encoding}" standalone="${standalone}" ?>`);
        if (this.prettyPrint) {
            this.parts.push('\n');
        }
        return this;
    }

    /**
     * Write raw XML content (already escaped)
     */
    writeRaw(xml: string): this {
        this.parts.push(xml);
        return this;
    }

    /**
     * Write content conditionally
     */
    writeIf(condition: boolean, content: string | (() => void)): this {
        if (condition) {
            if (typeof content === 'function') {
                content();
            } else {
                this.parts.push(content);
            }
        }
        return this;
    }

    /**
     * Write indented content
     */
    writeIndent(str: string, level: number, indentChar: string = this.indentString): this {
        this.parts.push(indentChar.repeat(level) + str);
        return this;
    }

    /**
     * Increase indentation level
     */
    indent(): this {
        this.indentLevel++;
        return this;
    }

    /**
     * Decrease indentation level
     */
    unindent(): this {
        this.indentLevel = Math.max(0, this.indentLevel - 1);
        return this;
    }

    /**
     * Get current length (approximate)
     */
    get length(): number {
        let total = 0;
        const partsLen = this.parts.length;
        for (let i = 0; i < partsLen; i++) {
            total += this.parts[i].length;
        }
        return total;
    }

    /**
     * Check if writer is empty
     */
    get isEmpty(): boolean {
        return this.parts.length === 0;
    }

    /**
     * Clear all content
     */
    clear(): this {
        this.parts = [];
        return this;
    }

    /**
     * Get final output as string
     */
    toString(): string {
        return this.parts.join('');
    }

    /**
     * Flush content (no-op for string writer)
     */
    flush(): void {
        // No-op for string-based writer
    }

    /**
     * Close the writer (no-op for string writer)
     */
    close(): void {
        // No-op for string-based writer
    }

    // ===== StringBuilder-compatible methods =====

    /**
     * Append string (StringBuilder compatibility)
     */
    append(str: string): this {
        return this.write(str);
    }

    /**
     * Append string with newline (StringBuilder compatibility)
     */
    appendLine(str: string = ''): this {
        return this.writeLine(str);
    }

    /**
     * Append formatted string (StringBuilder compatibility)
     */
    appendFormat(template: string, ...args: unknown[]): this {
        return this.writeFormat(template, ...args);
    }

    /**
     * Conditional append (StringBuilder compatibility)
     */
    appendIf(condition: boolean, str: string): this {
        if (condition) {
            this.parts.push(str);
        }
        return this;
    }

    /**
     * Append all strings (StringBuilder compatibility)
     */
    appendAll(strings: string[]): this {
        this.parts.push(...strings);
        return this;
    }

    /**
     * Append strings with separator (StringBuilder compatibility)
     */
    appendJoin(strings: string[], separator: string = ''): this {
        this.parts.push(strings.join(separator));
        return this;
    }

    /**
     * Append indented string (StringBuilder compatibility)
     */
    appendIndent(str: string, level: number, indentChar: string = '  '): this {
        return this.writeIndent(str, level, indentChar);
    }

    /**
     * Join with separator (StringBuilder compatibility)
     */
    join(separator: string = ''): string {
        return this.parts.join(separator);
    }
}

/**
 * Factory function for StringXmlWriter
 */
export function createStringXmlWriter(options?: XmlWriterOptions): StringXmlWriter {
    return new StringXmlWriter(options);
}
