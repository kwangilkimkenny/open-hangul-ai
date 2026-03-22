/**
 * Tests for BufferPool
 */

import {
    BufferPool,
    getGlobalBufferPool,
    resetGlobalBufferPool,
    withBufferPool,
    withBufferPoolSync,
    createSpecializedPool
} from '../BufferPool';

describe('BufferPool', () => {
    let pool: BufferPool;

    beforeEach(() => {
        pool = new BufferPool();
    });

    afterEach(() => {
        pool.clear();
    });

    describe('acquire', () => {
        it('should acquire buffers of appropriate size', () => {
            const buffer = pool.acquire(1000);
            expect(buffer).toBeInstanceOf(Uint8Array);
            expect(buffer.length).toBeGreaterThanOrEqual(1000);
        });

        it('should reuse released buffers', () => {
            const buffer1 = pool.acquire(4096);
            pool.release(buffer1);

            const buffer2 = pool.acquire(4096);
            expect(buffer2).toBe(buffer1);
        });

        it('should allocate larger buffers for larger requests', () => {
            const buffer = pool.acquire(100000);
            expect(buffer.length).toBeGreaterThanOrEqual(100000);
        });
    });

    describe('acquireWithData', () => {
        it('should copy data into buffer', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const buffer = pool.acquireWithData(data);

            expect(buffer.slice(0, 5)).toEqual(data);
        });
    });

    describe('acquireZeroed', () => {
        it('should return zeroed buffer', () => {
            const buffer = pool.acquireZeroed(100);
            expect(buffer.every(b => b === 0)).toBe(true);
        });
    });

    describe('release', () => {
        it('should add buffer back to pool', () => {
            const statsBefore = pool.getStats();
            const buffer = pool.acquire(4096);
            pool.release(buffer);
            const statsAfter = pool.getStats();

            expect(statsAfter.totalBuffers).toBeGreaterThan(statsBefore.totalBuffers);
        });

        it('should not add buffers of non-standard sizes', () => {
            const buffer = new Uint8Array(1234); // Non-standard size
            const statsBefore = pool.getStats();
            pool.release(buffer);
            const statsAfter = pool.getStats();

            expect(statsAfter.totalBuffers).toBe(statsBefore.totalBuffers);
        });
    });

    describe('getStats', () => {
        it('should return pool statistics', () => {
            const stats = pool.getStats();

            expect(stats).toHaveProperty('bucketCount');
            expect(stats).toHaveProperty('totalBuffers');
            expect(stats).toHaveProperty('totalMemory');
            expect(stats).toHaveProperty('hits');
            expect(stats).toHaveProperty('misses');
            expect(stats).toHaveProperty('hitRate');
        });

        it('should track hits and misses', () => {
            pool.acquire(4096); // miss
            pool.acquire(4096); // miss

            const buffer = pool.acquire(4096);
            pool.release(buffer);
            pool.acquire(4096); // hit

            const stats = pool.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(3);
        });
    });

    describe('preWarm', () => {
        it('should pre-allocate buffers', () => {
            const newPool = new BufferPool({ preWarm: true, preWarmCount: 3 });
            const stats = newPool.getStats();

            expect(stats.totalBuffers).toBeGreaterThan(0);
            newPool.clear();
        });
    });

    describe('trim', () => {
        it('should reduce buffer count', () => {
            // Add multiple buffers
            for (let i = 0; i < 5; i++) {
                const buffer = pool.acquire(4096);
                pool.release(buffer);
            }

            pool.trim(2);
            const stats = pool.getStats();

            // Each bucket should have at most 2 buffers
            expect(stats.buckets.every(b => b.count <= 2)).toBe(true);
        });
    });

    describe('clear', () => {
        it('should remove all buffers', () => {
            pool.acquire(4096);
            pool.acquire(16384);
            pool.clear();

            const stats = pool.getStats();
            expect(stats.totalBuffers).toBe(0);
            expect(stats.totalMemory).toBe(0);
        });
    });
});

describe('Global BufferPool', () => {
    afterEach(() => {
        resetGlobalBufferPool();
    });

    it('should return singleton instance', () => {
        const pool1 = getGlobalBufferPool();
        const pool2 = getGlobalBufferPool();
        expect(pool1).toBe(pool2);
    });

    it('should reset correctly', () => {
        const pool1 = getGlobalBufferPool();
        resetGlobalBufferPool();
        const pool2 = getGlobalBufferPool();
        expect(pool1).not.toBe(pool2);
    });
});

describe('withBufferPool', () => {
    it('should automatically release buffers', async () => {
        const pool = new BufferPool();

        await withBufferPool(pool, async (acquire) => {
            acquire(1000);
            acquire(2000);
        });

        const stats = pool.getStats();
        expect(stats.totalBuffers).toBeGreaterThan(0);

        pool.clear();
    });
});

describe('withBufferPoolSync', () => {
    it('should automatically release buffers synchronously', () => {
        const pool = new BufferPool();

        const result = withBufferPoolSync(pool, (acquire) => {
            const buf = acquire(1000);
            return buf.length;
        });

        expect(result).toBeGreaterThanOrEqual(1000);
        pool.clear();
    });
});

describe('createSpecializedPool', () => {
    it('should create small pool', () => {
        const pool = createSpecializedPool('small');
        const stats = pool.getStats();
        expect(stats.buckets[0].size).toBeLessThan(10000);
        pool.clear();
    });

    it('should create large pool', () => {
        const pool = createSpecializedPool('large');
        const stats = pool.getStats();
        expect(stats.buckets[0].size).toBeGreaterThanOrEqual(256 * 1024);
        pool.clear();
    });
});
