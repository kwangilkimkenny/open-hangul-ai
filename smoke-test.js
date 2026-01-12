/**
 * Smoke Test - Quick verification that all Phase 2-5 features are accessible
 * Run this to verify the implementation is ready for manual testing
 */

console.log('\n🔥 Smoke Test - Phase 2-5 Implementation\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`✅ ${description}`);
        passed++;
    } catch (error) {
        console.error(`❌ ${description}`);
        console.error(`   ${error.message}`);
        failed++;
    }
}

// ============================================
// Phase 2: Undo/Redo System
// ============================================

console.log('\n📦 Phase 2: Undo/Redo System');
console.log('-'.repeat(60));

test('HistoryManagerV2 exists', () => {
    const { HistoryManagerV2 } = require('./src/lib/vanilla/features/history-manager-v2.js');
    if (!HistoryManagerV2) throw new Error('HistoryManagerV2 not exported');
});

test('HistoryManagerV2 has required methods', () => {
    const { HistoryManagerV2 } = require('./src/lib/vanilla/features/history-manager-v2.js');
    const instance = new HistoryManagerV2({});
    if (!instance.execute) throw new Error('Missing execute method');
    if (!instance.undo) throw new Error('Missing undo method');
    if (!instance.redo) throw new Error('Missing redo method');
    if (!instance.canUndo) throw new Error('Missing canUndo method');
    if (!instance.canRedo) throw new Error('Missing canRedo method');
});

test('HistoryManagerV2 has batch operations', () => {
    const { HistoryManagerV2 } = require('./src/lib/vanilla/features/history-manager-v2.js');
    const instance = new HistoryManagerV2({});
    if (!instance.undoMultiple) throw new Error('Missing undoMultiple method');
    if (!instance.redoMultiple) throw new Error('Missing redoMultiple method');
});

test('HistoryManagerV2 has React Context support', () => {
    const { HistoryManagerV2 } = require('./src/lib/vanilla/features/history-manager-v2.js');
    const instance = new HistoryManagerV2({});
    if (!instance.hasOwnProperty('onStateChange')) throw new Error('Missing onStateChange property');
});

// ============================================
// Phase 3: Pagination
// ============================================

console.log('\n📦 Phase 3: Page Splitting & Auto-pagination');
console.log('-'.repeat(60));

test('DocumentRenderer exists', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    if (!DocumentRenderer) throw new Error('DocumentRenderer not exported');
});

test('DocumentRenderer has pagination methods', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    const instance = new DocumentRenderer(document.createElement('div'));
    if (!instance.autoPaginateContent) throw new Error('Missing autoPaginateContent method');
    if (!instance.checkPagination) throw new Error('Missing checkPagination method');
});

test('DocumentRenderer has helper methods', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    const instance = new DocumentRenderer(document.createElement('div'));
    if (!instance._getElementTotalHeight) throw new Error('Missing _getElementTotalHeight method');
    if (!instance._splitLargeTable) throw new Error('Missing _splitLargeTable method');
});

// ============================================
// Phase 4: Performance
// ============================================

console.log('\n📦 Phase 4: Dynamic Pagination Performance');
console.log('-'.repeat(60));

test('DocumentRenderer has pagination state', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    const instance = new DocumentRenderer(document.createElement('div'));
    if (instance.isPaginating === undefined) throw new Error('Missing isPaginating property');
    if (!Array.isArray(instance.paginationQueue)) throw new Error('Missing paginationQueue array');
    if (!(instance.dirtyPages instanceof Set)) throw new Error('Missing dirtyPages Set');
});

test('DocumentRenderer has debounced pagination', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    const instance = new DocumentRenderer(document.createElement('div'));
    if (!instance.checkPaginationDebounced) throw new Error('Missing checkPaginationDebounced method');
});

test('DocumentRenderer has dirty flag methods', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    const instance = new DocumentRenderer(document.createElement('div'));
    if (!instance.markPageDirty) throw new Error('Missing markPageDirty method');
    if (!instance.clearPageDirty) throw new Error('Missing clearPageDirty method');
    if (!instance.isPageDirty) throw new Error('Missing isPageDirty method');
});

test('DocumentRenderer has debug mode', () => {
    const { DocumentRenderer } = require('./src/lib/vanilla/core/renderer.js');
    const instance = new DocumentRenderer(document.createElement('div'));
    if (!instance.enablePaginationDebug) throw new Error('Missing enablePaginationDebug method');
    if (!instance.disablePaginationDebug) throw new Error('Missing disablePaginationDebug method');
});

// ============================================
// Phase 5: Error Handling
// ============================================

console.log('\n📦 Phase 5: Error Handling & Integration');
console.log('-'.repeat(60));

test('Error boundary utilities exist', () => {
    const errorBoundary = require('./src/lib/vanilla/utils/error-boundary.js');
    if (!errorBoundary.withErrorBoundary) throw new Error('Missing withErrorBoundary');
    if (!errorBoundary.withAsyncErrorBoundary) throw new Error('Missing withAsyncErrorBoundary');
    if (!errorBoundary.safeDOMOperation) throw new Error('Missing safeDOMOperation');
});

test('Logging validator exists', () => {
    const validator = require('./src/lib/vanilla/utils/logging-validator.js');
    if (!validator.validateLogging) throw new Error('Missing validateLogging');
    if (!validator.createProductionLogger) throw new Error('Missing createProductionLogger');
});

test('CircuitBreaker pattern implemented', () => {
    const { CircuitBreaker } = require('./src/lib/vanilla/utils/error-boundary.js');
    if (!CircuitBreaker) throw new Error('Missing CircuitBreaker class');
    const breaker = new CircuitBreaker();
    if (!breaker.execute) throw new Error('Missing execute method on CircuitBreaker');
});

// ============================================
// React Components
// ============================================

console.log('\n📦 React Components');
console.log('-'.repeat(60));

test('HistoryContext exists', () => {
    const fs = require('fs');
    const path = './src/contexts/HistoryContext.tsx';
    if (!fs.existsSync(path)) throw new Error('HistoryContext.tsx not found');
});

test('UndoRedoButtons component exists', () => {
    const fs = require('fs');
    const path = './src/components/UndoRedoButtons.tsx';
    if (!fs.existsSync(path)) throw new Error('UndoRedoButtons.tsx not found');
});

// ============================================
// Test Files
// ============================================

console.log('\n📦 Test Suites');
console.log('-'.repeat(60));

test('All test files exist', () => {
    const fs = require('fs');
    const tests = [
        'test-phase2-p0.js',
        'test-phase2-p1.js',
        'test-phase2-p2.js',
        'test-phase2-p3.js',
        'test-phase3.js',
        'test-phase4.js',
        'test-phase5.js'
    ];

    tests.forEach(test => {
        if (!fs.existsSync(test)) {
            throw new Error(`${test} not found`);
        }
    });
});

// ============================================
// Summary
// ============================================

console.log('\n' + '='.repeat(60));
console.log('🔥 Smoke Test Results');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}`);

if (failed === 0) {
    console.log('\n✨ All smoke tests passed! Implementation is ready for manual testing.');
    console.log('🌐 Dev server running at: http://localhost:5090/');
    console.log('📖 See test-live-features.md for manual testing guide.');
} else {
    console.log('\n⚠️ Some tests failed. Please review the errors above.');
    process.exit(1);
}

console.log('\n🚀 Ready for testing!\n');
