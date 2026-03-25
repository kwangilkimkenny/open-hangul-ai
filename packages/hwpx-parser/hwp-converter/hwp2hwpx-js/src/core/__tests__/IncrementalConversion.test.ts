/**
 * Tests for Incremental Conversion components
 */

import { ContentHasher, fnv1a32, fnv1a64, quickHash, getGlobalHasher } from '../ContentHasher';
import { ConversionCache, SectionCache, DocInfoCache, getGlobalCache, resetGlobalCache } from '../ConversionCache';
import { IncrementalConverter, createIncrementalConverter } from '../IncrementalConverter';

describe('ContentHasher', () => {
    describe('fnv1a32', () => {
        it('should hash strings consistently', () => {
            const hash1 = fnv1a32('hello');
            const hash2 = fnv1a32('hello');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different inputs', () => {
            const hash1 = fnv1a32('hello');
            const hash2 = fnv1a32('world');
            expect(hash1).not.toBe(hash2);
        });

        it('should hash Uint8Array', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const hash = fnv1a32(data);
            expect(typeof hash).toBe('number');
        });
    });

    describe('fnv1a64', () => {
        it('should return bigint', () => {
            const hash = fnv1a64('test');
            expect(typeof hash).toBe('bigint');
        });

        it('should be consistent', () => {
            const hash1 = fnv1a64('hello');
            const hash2 = fnv1a64('hello');
            expect(hash1).toBe(hash2);
        });
    });

    describe('ContentHasher class', () => {
        let hasher: ContentHasher;

        beforeEach(() => {
            hasher = new ContentHasher();
        });

        it('should hash strings', () => {
            const result = hasher.hash('test');
            expect(result).toHaveProperty('hash32');
            expect(result).toHaveProperty('hash64');
            expect(result).toHaveProperty('hex');
            expect(result).toHaveProperty('size');
        });

        it('should hash sections', () => {
            const section = { paragraphs: [], pageDef: { width: 100 } };
            const result = hasher.hashSection(section);
            expect(result.hex.length).toBe(16);
        });

        it('should hash binary data', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const result = hasher.hashBinary(data);
            expect(result.size).toBe(5);
        });

        it('should compare hashes', () => {
            const hash1 = hasher.hash('test');
            const hash2 = hasher.hash('test');
            const hash3 = hasher.hash('different');

            expect(hasher.compare(hash1, hash2)).toBe(true);
            expect(hasher.compare(hash1, hash3)).toBe(false);
        });
    });

    describe('quickHash', () => {
        it('should return hex string', () => {
            const hash = quickHash('test');
            expect(hash.length).toBe(16);
            expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
        });
    });

    describe('getGlobalHasher', () => {
        it('should return singleton', () => {
            const h1 = getGlobalHasher();
            const h2 = getGlobalHasher();
            expect(h1).toBe(h2);
        });
    });
});

describe('ConversionCache', () => {
    let cache: ConversionCache<string>;

    beforeEach(() => {
        cache = new ConversionCache<string>();
    });

    afterEach(() => {
        cache.dispose();
    });

    it('should set and get values', () => {
        cache.set('key1', 'value1', 'hash1');
        expect(cache.get('key1', 'hash1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
        expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should invalidate on hash mismatch', () => {
        cache.set('key1', 'value1', 'hash1');
        expect(cache.get('key1', 'hash2')).toBeUndefined();
    });

    it('should track statistics', () => {
        cache.set('key1', 'value1', 'hash1');
        cache.get('key1', 'hash1'); // hit
        cache.get('nonexistent'); // miss

        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });

    it('should evict LRU entries', () => {
        const smallCache = new ConversionCache<string>({ maxEntries: 2 });

        smallCache.set('key1', 'value1', 'hash1');
        smallCache.set('key2', 'value2', 'hash2');
        smallCache.set('key3', 'value3', 'hash3'); // should evict key1

        expect(smallCache.get('key1')).toBeUndefined();
        expect(smallCache.get('key2', 'hash2')).toBe('value2');
        expect(smallCache.get('key3', 'hash3')).toBe('value3');

        smallCache.dispose();
    });

    it('should check existence', () => {
        cache.set('key1', 'value1', 'hash1');
        expect(cache.has('key1', 'hash1')).toBe(true);
        expect(cache.has('key1', 'wronghash')).toBe(false);
        expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
        cache.set('key1', 'value1', 'hash1');
        cache.delete('key1');
        expect(cache.has('key1')).toBe(false);
    });

    it('should clear all entries', () => {
        cache.set('key1', 'value1', 'hash1');
        cache.set('key2', 'value2', 'hash2');
        cache.clear();
        expect(cache.size).toBe(0);
    });
});

describe('SectionCache', () => {
    let cache: SectionCache;

    beforeEach(() => {
        cache = new SectionCache();
    });

    afterEach(() => {
        cache.dispose();
    });

    it('should cache section XML', () => {
        cache.setSectionXml(0, '<section>content</section>', 'hash1');
        expect(cache.getSectionXml(0, 'hash1')).toBe('<section>content</section>');
    });

    it('should check section existence', () => {
        cache.setSectionXml(0, 'xml', 'hash1');
        expect(cache.hasSection(0, 'hash1')).toBe(true);
        expect(cache.hasSection(1, 'hash1')).toBe(false);
    });
});

describe('DocInfoCache', () => {
    let cache: DocInfoCache;

    beforeEach(() => {
        cache = new DocInfoCache();
    });

    afterEach(() => {
        cache.dispose();
    });

    it('should cache DocInfo XML', () => {
        cache.setDocInfoXml('<docinfo>data</docinfo>', 'hash1');
        expect(cache.getDocInfoXml('hash1')).toBe('<docinfo>data</docinfo>');
    });

    it('should check DocInfo existence', () => {
        cache.setDocInfoXml('xml', 'hash1');
        expect(cache.hasDocInfo('hash1')).toBe(true);
        expect(cache.hasDocInfo('hash2')).toBe(false);
    });
});

describe('IncrementalConverter', () => {
    let converter: IncrementalConverter;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDocInfoConverter = jest.fn((docInfo: any) => `<docinfo>${JSON.stringify(docInfo)}</docinfo>`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockSectionConverter = jest.fn((section: any, index: number) => `<section id="${index}">${JSON.stringify(section)}</section>`);

    beforeEach(() => {
        converter = createIncrementalConverter({
            docInfoConverter: mockDocInfoConverter,
            sectionConverter: mockSectionConverter
        });
        mockDocInfoConverter.mockClear();
        mockSectionConverter.mockClear();
    });

    afterEach(() => {
        converter.dispose();
    });

    it('should detect changes in document', () => {
        const parsed1 = {
            docInfo: { raw: {} },
            sections: [{ paragraphs: [] }, { paragraphs: [] }],
            binData: new Map()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const changes = converter.detectChanges(parsed1);

        expect(changes.totalSections).toBe(2);
        expect(changes.changeType).toBe('full');
    });

    it('should detect no changes when document is same', () => {
        const parsed = {
            docInfo: { raw: {} },
            sections: [{ paragraphs: [] }],
            binData: new Map()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        converter.detectChanges(parsed);
        const changes = converter.detectChanges(parsed);

        expect(changes.changeType).toBe('none');
        expect(changes.changedSections).toHaveLength(0);
    });

    it('should convert document with caching', async () => {
        const parsed = {
            docInfo: { raw: {} },
            sections: [{ paragraphs: [] }, { paragraphs: [] }],
            binData: new Map()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const result1 = await converter.convert(parsed);
        expect(result1.cacheHits).toBe(0);
        expect(result1.cacheMisses).toBe(3); // 1 docinfo + 2 sections

        const result2 = await converter.convert(parsed);
        expect(result2.cacheHits).toBe(3);
        expect(result2.cacheMisses).toBe(0);
        expect(result2.savingsPercent).toBe(100);
    });

    it('should clear cache', () => {
        const parsed = {
            docInfo: { raw: {} },
            sections: [{ paragraphs: [] }],
            binData: new Map()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        converter.detectChanges(parsed);
        converter.clearCache();

        const changes = converter.detectChanges(parsed);
        expect(changes.changeType).toBe('full');
    });

    it('should return cache stats', () => {
        const stats = converter.getCacheStats();

        expect(stats).toHaveProperty('sections');
        expect(stats).toHaveProperty('docInfo');
        expect(stats.sections).toHaveProperty('entries');
        expect(stats.docInfo).toHaveProperty('entries');
    });
});

describe('Global Cache', () => {
    afterEach(() => {
        resetGlobalCache();
    });

    it('should return singleton', () => {
        const c1 = getGlobalCache();
        const c2 = getGlobalCache();
        expect(c1).toBe(c2);
    });

    it('should reset correctly', () => {
        const c1 = getGlobalCache();
        resetGlobalCache();
        const c2 = getGlobalCache();
        expect(c1).not.toBe(c2);
    });
});
