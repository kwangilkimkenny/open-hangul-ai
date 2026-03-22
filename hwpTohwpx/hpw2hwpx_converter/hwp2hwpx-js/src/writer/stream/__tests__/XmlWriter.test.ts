/**
 * Tests for XmlWriter implementations
 */

import { StringXmlWriter, StreamXmlWriter, createXmlWriter } from '../index';
import { escapeXmlText, escapeXmlAttribute, formatAttributes } from '../XmlWriter';

describe('XmlWriter Utilities', () => {
    describe('escapeXmlText', () => {
        it('should escape special characters in text', () => {
            expect(escapeXmlText('Hello & World')).toBe('Hello &amp; World');
            expect(escapeXmlText('<script>')).toBe('&lt;script&gt;');
            expect(escapeXmlText('normal text')).toBe('normal text');
        });

        it('should handle empty string', () => {
            expect(escapeXmlText('')).toBe('');
        });
    });

    describe('escapeXmlAttribute', () => {
        it('should escape all XML special characters', () => {
            expect(escapeXmlAttribute('a & b')).toBe('a &amp; b');
            expect(escapeXmlAttribute('say "hello"')).toBe('say &quot;hello&quot;');
            expect(escapeXmlAttribute("it's")).toBe('it&apos;s');
        });
    });

    describe('formatAttributes', () => {
        it('should format attributes as XML string', () => {
            expect(formatAttributes({ id: '1', name: 'test' })).toBe(' id="1" name="test"');
            expect(formatAttributes({ value: 42, enabled: true })).toBe(' value="42" enabled="true"');
        });

        it('should return empty string for no attributes', () => {
            expect(formatAttributes(undefined)).toBe('');
            expect(formatAttributes({})).toBe('');
        });
    });
});

describe('StringXmlWriter', () => {
    let writer: StringXmlWriter;

    beforeEach(() => {
        writer = new StringXmlWriter();
    });

    it('should write simple XML', () => {
        writer.write('<root>');
        writer.write('content');
        writer.write('</root>');
        expect(writer.toString()).toBe('<root>content</root>');
    });

    it('should write XML elements', () => {
        writer.writeStartElement('hp:p', { id: '0', paraPrIDRef: '1' });
        writer.writeElement('hp:t', 'Hello', { charPrIDRef: '0' });
        writer.writeEndElement('hp:p');

        const result = writer.toString();
        expect(result).toContain('<hp:p');
        expect(result).toContain('id="0"');
        expect(result).toContain('<hp:t charPrIDRef="0">Hello</hp:t>');
    });

    it('should write empty elements', () => {
        writer.writeEmptyElement('hp:br', { type: 'line' });
        expect(writer.toString()).toContain('<hp:br type="line"/>');
    });

    it('should support StringBuilder compatibility', () => {
        writer.append('Hello');
        writer.append(' ');
        writer.append('World');
        expect(writer.toString()).toBe('Hello World');
    });

    it('should support format strings', () => {
        writer.appendFormat('<item id="{0}">{1}</item>', 1, 'test');
        expect(writer.toString()).toBe('<item id="1">test</item>');
    });

    it('should track length', () => {
        writer.write('12345');
        expect(writer.length).toBe(5);
    });

    it('should support conditional write', () => {
        writer.writeIf(true, '<yes/>');
        writer.writeIf(false, '<no/>');
        expect(writer.toString()).toBe('<yes/>');
    });

    it('should support indentation', () => {
        writer.writeIndent('<child/>', 2);
        expect(writer.toString()).toBe('    <child/>');
    });

    it('should clear content', () => {
        writer.write('content');
        writer.clear();
        expect(writer.isEmpty).toBe(true);
        expect(writer.toString()).toBe('');
    });
});

describe('StreamXmlWriter', () => {
    let writer: StreamXmlWriter;

    beforeEach(() => {
        writer = new StreamXmlWriter();
    });

    afterEach(async () => {
        await writer.close();
    });

    it('should write simple XML', () => {
        writer.write('<root>');
        writer.write('content');
        writer.write('</root>');
        expect(writer.toString()).toBe('<root>content</root>');
    });

    it('should collect chunks', () => {
        writer.write('<element>');
        writer.write('data');
        writer.write('</element>');

        const result = writer.toUint8Array();
        expect(result.length).toBeGreaterThan(0);
    });

    it('should support flush', async () => {
        writer.write('test');
        await writer.flush();
        expect(writer.length).toBeGreaterThan(0);
    });

    it('should track length', () => {
        writer.write('Hello');
        expect(writer.length).toBeGreaterThan(0);
    });
});

describe('createXmlWriter factory', () => {
    it('should create StringXmlWriter by default', () => {
        const writer = createXmlWriter();
        expect(writer).toBeInstanceOf(StringXmlWriter);
    });

    it('should create StreamXmlWriter when streaming is true', () => {
        const writer = createXmlWriter({ streaming: true });
        expect(writer).toBeInstanceOf(StreamXmlWriter);
    });
});
