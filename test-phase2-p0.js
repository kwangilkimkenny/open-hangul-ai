/**
 * Phase 2 P0 기능 테스트
 * Issue #2.1: Command Pattern 재설계
 * - execute와 undo 함수 모두 저장
 * - Redo 스택에 전체 command 이동
 * - DOM 동기화 (_refreshDOM)
 */

console.log('\n🧪 Phase 2 P0 Tests - Command Pattern Redesign\n');
console.log('='.repeat(60));

// Mock logger
const logger = {
    debug: () => {},
    info: console.log,
    warn: console.warn,
    error: console.error
};

// ============================================
// Mock HistoryManagerV2 (수정된 버전)
// ============================================

class HistoryManagerV2 {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.isExecuting = false;
    }

    /**
     * ✅ Phase 2 P0: Command Pattern 재설계 - execute와 undo 모두 저장
     */
    execute(execute, undo, actionName = 'Edit') {
        if (this.isExecuting) {
            logger.warn('⚠️ Already executing a command, skipping history');
            execute();
            return;
        }

        this.isExecuting = true;

        try {
            // 명령 실행
            execute();

            // ✅ Command 객체 저장 (execute와 undo 모두 포함)
            this.undoStack.push({
                execute,
                undo,
                actionName,
                timestamp: Date.now()
            });

            // 새 명령 실행 시 redo 스택 초기화
            this.redoStack = [];

            logger.debug(`✅ Executed: "${actionName}" (Undo stack: ${this.undoStack.length})`);

        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * ✅ Phase 2 P0: Undo - 전체 command를 redoStack으로 이동
     */
    undo() {
        if (this.undoStack.length === 0) {
            logger.warn('⚠️ Nothing to undo');
            return false;
        }

        if (this.isExecuting) {
            logger.warn('⚠️ Command is executing, cannot undo');
            return false;
        }

        this.isExecuting = true;

        try {
            const command = this.undoStack.pop();

            logger.info(`↶ Undoing: "${command.actionName}"`);

            // ✅ Undo 실행 (이전 상태로 복원)
            command.undo();

            // ✅ Redo 스택에 전체 command 추가 (execute 함수 포함)
            this.redoStack.push(command);

            logger.info(`✅ Undone: "${command.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);

            return true;

        } catch (error) {
            logger.error('❌ Undo failed:', error);
            return false;

        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * ✅ Phase 2 P0: Redo - 전체 command를 undoStack으로 이동
     */
    redo() {
        if (this.redoStack.length === 0) {
            logger.warn('⚠️ Nothing to redo');
            return false;
        }

        if (this.isExecuting) {
            logger.warn('⚠️ Command is executing, cannot redo');
            return false;
        }

        this.isExecuting = true;

        try {
            const command = this.redoStack.pop();

            logger.info(`↷ Redoing: "${command.actionName}"`);

            // ✅ Execute 다시 실행 (변경 재적용)
            command.execute();

            // ✅ Undo 스택에 전체 command 다시 추가
            this.undoStack.push(command);

            logger.info(`✅ Redone: "${command.actionName}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`);

            return true;

        } catch (error) {
            logger.error('❌ Redo failed:', error);
            return false;

        } finally {
            this.isExecuting = false;
        }
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }
}

// ============================================
// Mock InlineEditor - _refreshDOM 메서드
// ============================================

class MockInlineEditor {
    constructor() {
        this.editingCell = null;
        this.domState = {}; // 테스트용 DOM 상태 저장
    }

    /**
     * ✅ Phase 2 P0: DOM 업데이트 (데이터와 화면 동기화)
     */
    _refreshDOM(element, data, text) {
        // Mock element (실제로는 HTMLElement)
        if (!element || !element.isConnected) {
            logger.debug('⚠️ Element not in DOM, skipping refresh');
            return;
        }

        // 현재 편집 중이면 업데이트하지 않음
        if (element === this.editingCell) {
            logger.debug('⚠️ Element is being edited, skipping refresh');
            return;
        }

        // 줄바꿈을 <br>로 변환
        const html = text.split('\n').join('<br>');

        // Mock DOM 업데이트 (실제로는 element.innerHTML = html)
        this.domState[element.id] = html;

        logger.debug(`✅ DOM refreshed (${text.length} chars, ${(text.match(/\n/g) || []).length} line breaks)`);
    }

    _updateCellData(data, newText) {
        // Mock 구현
        data.text = newText;
    }
}

// ============================================
// Test 2.1: Command Pattern 재설계
// ============================================

console.log('\n🧪 Test 2.1: Command with execute and undo functions');
console.log('='.repeat(60));

const historyManager = new HistoryManagerV2();
const editor = new MockInlineEditor();

// Mock DOM element
const mockElement = {
    id: 'cell-1',
    isConnected: true
};

// Mock data
const cellData = { text: '원래 텍스트' };

console.log('\n📝 Initial state:', JSON.stringify(cellData));

// 편집 시뮬레이션: "원래 텍스트" → "수정된 텍스트"
const newText = '수정된 텍스트';
const oldText = cellData.text;

historyManager.execute(
    // Execute function: 새 텍스트 적용
    () => {
        editor._updateCellData(cellData, newText);
        editor._refreshDOM(mockElement, cellData, newText);
        console.log('  ✓ Execute: Text changed to "수정된 텍스트"');
    },
    // Undo function: 이전 텍스트 복원
    () => {
        editor._updateCellData(cellData, oldText);
        editor._refreshDOM(mockElement, cellData, oldText);
        console.log('  ✓ Undo: Text restored to "원래 텍스트"');
    },
    '텍스트 편집'
);

console.log('\n✓ After execute:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  DOM:', editor.domState[mockElement.id]);
console.log('  Undo stack size:', historyManager.undoStack.length);
console.log('  Redo stack size:', historyManager.redoStack.length);

// 검증 1: 텍스트가 수정되었는가?
if (cellData.text !== '수정된 텍스트') {
    console.error('❌ FAIL: Text not changed');
    process.exit(1);
}

// 검증 2: DOM이 업데이트되었는가?
if (editor.domState[mockElement.id] !== '수정된 텍스트') {
    console.error('❌ FAIL: DOM not updated');
    console.error('  Expected: "수정된 텍스트"');
    console.error('  Actual:', editor.domState[mockElement.id]);
    process.exit(1);
}

// 검증 3: Undo stack에 command가 저장되었는가?
if (historyManager.undoStack.length !== 1) {
    console.error('❌ FAIL: Command not saved to undo stack');
    process.exit(1);
}

// 검증 4: Command 객체에 execute와 undo가 모두 있는가?
const savedCommand = historyManager.undoStack[0];
if (typeof savedCommand.execute !== 'function' || typeof savedCommand.undo !== 'function') {
    console.error('❌ FAIL: Command does not have execute and undo functions');
    process.exit(1);
}

console.log('\n✅ PASS: Command Pattern redesigned correctly');

// ============================================
// Test 2.2: Undo 기능
// ============================================

console.log('\n\n🧪 Test 2.2: Undo functionality');
console.log('='.repeat(60));

console.log('\n📝 Before undo:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  DOM:', editor.domState[mockElement.id]);

const undoSuccess = historyManager.undo();

console.log('\n✓ After undo:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  DOM:', editor.domState[mockElement.id]);
console.log('  Undo stack size:', historyManager.undoStack.length);
console.log('  Redo stack size:', historyManager.redoStack.length);

// 검증 1: Undo가 성공했는가?
if (!undoSuccess) {
    console.error('❌ FAIL: Undo failed');
    process.exit(1);
}

// 검증 2: 텍스트가 복원되었는가?
if (cellData.text !== '원래 텍스트') {
    console.error('❌ FAIL: Text not restored');
    console.error('  Expected: "원래 텍스트"');
    console.error('  Actual:', cellData.text);
    process.exit(1);
}

// 검증 3: DOM이 복원되었는가?
if (editor.domState[mockElement.id] !== '원래 텍스트') {
    console.error('❌ FAIL: DOM not restored');
    console.error('  Expected: "원래 텍스트"');
    console.error('  Actual:', editor.domState[mockElement.id]);
    process.exit(1);
}

// 검증 4: Command가 redo stack으로 이동했는가?
if (historyManager.undoStack.length !== 0 || historyManager.redoStack.length !== 1) {
    console.error('❌ FAIL: Command not moved to redo stack');
    console.error('  Undo stack:', historyManager.undoStack.length);
    console.error('  Redo stack:', historyManager.redoStack.length);
    process.exit(1);
}

console.log('\n✅ PASS: Undo works correctly with DOM synchronization');

// ============================================
// Test 2.3: Redo 기능
// ============================================

console.log('\n\n🧪 Test 2.3: Redo functionality');
console.log('='.repeat(60));

console.log('\n📝 Before redo:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  DOM:', editor.domState[mockElement.id]);

const redoSuccess = historyManager.redo();

console.log('\n✓ After redo:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  DOM:', editor.domState[mockElement.id]);
console.log('  Undo stack size:', historyManager.undoStack.length);
console.log('  Redo stack size:', historyManager.redoStack.length);

// 검증 1: Redo가 성공했는가?
if (!redoSuccess) {
    console.error('❌ FAIL: Redo failed');
    process.exit(1);
}

// 검증 2: 텍스트가 다시 수정되었는가?
if (cellData.text !== '수정된 텍스트') {
    console.error('❌ FAIL: Text not re-applied');
    console.error('  Expected: "수정된 텍스트"');
    console.error('  Actual:', cellData.text);
    process.exit(1);
}

// 검증 3: DOM이 다시 업데이트되었는가?
if (editor.domState[mockElement.id] !== '수정된 텍스트') {
    console.error('❌ FAIL: DOM not re-updated');
    console.error('  Expected: "수정된 텍스트"');
    console.error('  Actual:', editor.domState[mockElement.id]);
    process.exit(1);
}

// 검증 4: Command가 undo stack으로 복귀했는가?
if (historyManager.undoStack.length !== 1 || historyManager.redoStack.length !== 0) {
    console.error('❌ FAIL: Command not moved back to undo stack');
    console.error('  Undo stack:', historyManager.undoStack.length);
    console.error('  Redo stack:', historyManager.redoStack.length);
    process.exit(1);
}

console.log('\n✅ PASS: Redo works correctly with DOM synchronization');

// ============================================
// Test 2.4: 다중 Undo/Redo
// ============================================

console.log('\n\n🧪 Test 2.4: Multiple Undo/Redo cycles');
console.log('='.repeat(60));

// 추가 편집 수행
const edit2 = '두번째 수정';
const prevText2 = cellData.text;

historyManager.execute(
    () => {
        editor._updateCellData(cellData, edit2);
        editor._refreshDOM(mockElement, cellData, edit2);
    },
    () => {
        editor._updateCellData(cellData, prevText2);
        editor._refreshDOM(mockElement, cellData, prevText2);
    },
    '두번째 편집'
);

const edit3 = '세번째 수정';
const prevText3 = cellData.text;

historyManager.execute(
    () => {
        editor._updateCellData(cellData, edit3);
        editor._refreshDOM(mockElement, cellData, edit3);
    },
    () => {
        editor._updateCellData(cellData, prevText3);
        editor._refreshDOM(mockElement, cellData, prevText3);
    },
    '세번째 편집'
);

console.log('\n✓ After 3 edits:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  Undo stack size:', historyManager.undoStack.length);

// 검증: 3개의 command가 저장되었는가?
if (historyManager.undoStack.length !== 3) {
    console.error('❌ FAIL: Expected 3 commands in undo stack');
    console.error('  Actual:', historyManager.undoStack.length);
    process.exit(1);
}

// 2번 Undo
historyManager.undo();
historyManager.undo();

console.log('\n✓ After 2 undos:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  Undo stack size:', historyManager.undoStack.length);
console.log('  Redo stack size:', historyManager.redoStack.length);

// 검증: "수정된 텍스트"로 돌아왔는가?
if (cellData.text !== '수정된 텍스트') {
    console.error('❌ FAIL: Undo did not restore correctly');
    console.error('  Expected: "수정된 텍스트"');
    console.error('  Actual:', cellData.text);
    process.exit(1);
}

// 1번 Redo
historyManager.redo();

console.log('\n✓ After 1 redo:');
console.log('  Data:', JSON.stringify(cellData));
console.log('  Undo stack size:', historyManager.undoStack.length);
console.log('  Redo stack size:', historyManager.redoStack.length);

// 검증: "두번째 수정"으로 복귀했는가?
if (cellData.text !== '두번째 수정') {
    console.error('❌ FAIL: Redo did not restore correctly');
    console.error('  Expected: "두번째 수정"');
    console.error('  Actual:', cellData.text);
    process.exit(1);
}

console.log('\n✅ PASS: Multiple Undo/Redo cycles work correctly');

// ============================================
// Test 2.5: DOM 동기화 - 편집 중인 요소 보호
// ============================================

console.log('\n\n🧪 Test 2.5: DOM synchronization - protect editing element');
console.log('='.repeat(60));

// 편집 중인 요소 설정
editor.editingCell = mockElement;

// 이전 DOM 상태 저장
const beforeDOM = editor.domState[mockElement.id];

// Undo 시도 (DOM은 업데이트되지 않아야 함)
historyManager.undo();

console.log('\n✓ After undo (element is being edited):');
console.log('  Data:', JSON.stringify(cellData));
console.log('  DOM (should be unchanged):', editor.domState[mockElement.id]);

// 검증: 데이터는 변경되었지만 DOM은 변경되지 않았는가?
if (cellData.text === beforeDOM || editor.domState[mockElement.id] !== beforeDOM) {
    console.error('❌ FAIL: DOM protection logic not working');
    console.error('  Expected DOM to remain unchanged during editing');
    process.exit(1);
}

console.log('\n✅ PASS: Editing element protected from DOM refresh');

// ============================================
// Summary
// ============================================

console.log('\n\n' + '='.repeat(60));
console.log('🎉 ALL PHASE 2 P0 TESTS PASSED!');
console.log('='.repeat(60));

console.log('\n✅ Issue #2.1: Command Pattern 재설계 - PASS');
console.log('   - execute와 undo 함수 모두 저장');
console.log('   - Undo: command를 redoStack으로 이동');
console.log('   - Redo: command를 undoStack으로 복귀');
console.log('   - 다중 Undo/Redo 사이클 지원');
console.log('   - DOM 동기화 (_refreshDOM)');
console.log('   - 편집 중인 요소 보호');

console.log('\n📊 Test Results:');
console.log('   ✓ Command Pattern: execute + undo functions');
console.log('   ✓ Undo functionality with DOM sync');
console.log('   ✓ Redo functionality with DOM sync');
console.log('   ✓ Multiple Undo/Redo cycles');
console.log('   ✓ Editing element protection');

console.log('\n🚀 Phase 2 P0 구현 완료!\n');
