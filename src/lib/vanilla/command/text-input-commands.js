/**
 * Text Input Commands Module
 * 텍스트 입력 관련 명령 (삽입, 삭제, 백스페이스)
 *
 * @module command/text-input-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <ray.kim@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 텍스트 입력 명령 클래스
 */
export class TextInputCommands {
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
        this.positionManager = viewer.positionManager;
    }

    /**
     * 텍스트 삽입
     * @param {string} text - 삽입할 텍스트
     */
    executeInsertText(text) {
        try {
            const cursor = this.viewer.cursor;
            if (!cursor || cursor.getCursorIndex() < 0) {
                logger.warn('No cursor position');
                return;
            }

            const cursorIndex = cursor.getCursorIndex();
            const position = this.positionManager.getPositionByIndex(cursorIndex);

            if (!position) {
                logger.warn('Invalid cursor position');
                return;
            }

            // 현재 위치의 데이터 구조 파악
            const cellData = position.cellData;
            const paraData = position.paraData;

            if (!cellData && !paraData) {
                logger.warn('No editable element at cursor');
                return;
            }

            // 이전 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                // 텍스트 삽입
                if (cellData) {
                    this._insertTextIntoCell(cellData, position, text);
                } else if (paraData) {
                    this._insertTextIntoParagraph(paraData, position, text);
                }

                // DOM 업데이트 및 재렌더링
                this.viewer.updateDocument(this.viewer.getDocument());

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서를 삽입된 텍스트 뒤로 이동
                    cursor.setCursorPosition(cursorIndex + text.length);
                });

                logger.debug(`Inserted text: "${text}" at index ${cursorIndex}`);
            };

            const undo = () => {
                // 이전 문서로 복원
                this.viewer.updateDocument(oldDocument);

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서 위치 복원
                    cursor.setCursorPosition(cursorIndex);
                });

                logger.debug(`Undone insert text: "${text}"`);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Insert Text');

        } catch (error) {
            logger.error('Failed to insert text', error);
            throw error;
        }
    }

    /**
     * 이전 문자 삭제 (Backspace)
     */
    executeDeleteBackward() {
        try {
            const cursor = this.viewer.cursor;
            if (!cursor || cursor.getCursorIndex() <= 0) {
                logger.warn('Cannot delete backward');
                return;
            }

            const cursorIndex = cursor.getCursorIndex();
            const prevPosition = this.positionManager.getPositionByIndex(cursorIndex - 1);

            if (!prevPosition) {
                return;
            }

            // 삭제할 문자
            const deletedChar = prevPosition.value;

            // 이전 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                // 이전 문자 삭제
                if (prevPosition.cellData) {
                    this._deleteCharFromCell(prevPosition.cellData, prevPosition);
                } else if (prevPosition.paraData) {
                    this._deleteCharFromParagraph(prevPosition.paraData, prevPosition);
                }

                // DOM 업데이트 및 재렌더링
                this.viewer.updateDocument(this.viewer.getDocument());

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서를 이전 위치로 이동
                    cursor.setCursorPosition(cursorIndex - 1);
                });

                logger.debug(`Deleted backward: "${deletedChar}"`);
            };

            const undo = () => {
                // 이전 문서로 복원
                this.viewer.updateDocument(oldDocument);

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서 위치 복원
                    cursor.setCursorPosition(cursorIndex);
                });

                logger.debug(`Undone delete backward: "${deletedChar}"`);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Delete Backward');

        } catch (error) {
            logger.error('Failed to delete backward', error);
            throw error;
        }
    }

    /**
     * 다음 문자 삭제 (Delete)
     */
    executeDeleteForward() {
        try {
            const cursor = this.viewer.cursor;
            if (!cursor) {
                return;
            }

            const cursorIndex = cursor.getCursorIndex();
            const positions = this.positionManager.getPositionList();

            if (cursorIndex < 0 || cursorIndex >= positions.length) {
                logger.warn('Cannot delete forward');
                return;
            }

            const currentPosition = positions[cursorIndex];
            if (!currentPosition) {
                return;
            }

            // 삭제할 문자
            const deletedChar = currentPosition.value;

            // 이전 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                // 현재 문자 삭제
                if (currentPosition.cellData) {
                    this._deleteCharFromCell(currentPosition.cellData, currentPosition);
                } else if (currentPosition.paraData) {
                    this._deleteCharFromParagraph(currentPosition.paraData, currentPosition);
                }

                // DOM 업데이트 및 재렌더링
                this.viewer.updateDocument(this.viewer.getDocument());

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서 위치 유지 (삭제 후 같은 인덱스)
                    cursor.setCursorPosition(cursorIndex);
                });

                logger.debug(`Deleted forward: "${deletedChar}"`);
            };

            const undo = () => {
                // 이전 문서로 복원
                this.viewer.updateDocument(oldDocument);

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서 위치 복원
                    cursor.setCursorPosition(cursorIndex);
                });

                logger.debug(`Undone delete forward: "${deletedChar}"`);
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Delete Forward');

        } catch (error) {
            logger.error('Failed to delete forward', error);
            throw error;
        }
    }

    /**
     * 개행 삽입 (Enter)
     */
    executeInsertNewline() {
        try {
            const cursor = this.viewer.cursor;
            if (!cursor) {
                logger.warn('No cursor available');
                return;
            }

            const cursorIndex = cursor.getCursorIndex();
            const position = this.positionManager.getPositionByIndex(cursorIndex);

            if (!position) {
                logger.warn('Invalid cursor position');
                return;
            }

            // 이전 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

            const execute = () => {
                // 현재 위치에서 단락 분할
                if (position.paraData) {
                    this._splitParagraph(position);
                } else {
                    // 일반 개행 삽입
                    this.executeInsertText('\n');
                }

                // DOM 업데이트 및 재렌더링
                this.viewer.updateDocument(this.viewer.getDocument());

                logger.debug(`Inserted newline at index ${cursorIndex}`);
            };

            const undo = () => {
                // 이전 문서로 복원
                this.viewer.updateDocument(oldDocument);

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서 위치 복원
                    cursor.setCursorPosition(cursorIndex);
                });

                logger.debug('Undone insert newline');
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Insert Newline');

        } catch (error) {
            logger.error('Failed to insert newline', error);
            throw error;
        }
    }

    /**
     * 탭 삽입
     */
    executeInsertTab() {
        try {
            // 탭을 4개 공백으로 변환
            this.executeInsertText('    ');
            logger.debug('Tab inserted (as 4 spaces)');

        } catch (error) {
            logger.error('Failed to insert tab', error);
            throw error;
        }
    }

    /**
     * 셀에 텍스트 삽입 (내부 메서드)
     * @private
     */
    _insertTextIntoCell(cellData, position, text) {
        if (!cellData.elements || cellData.elements.length === 0) {
            cellData.elements = [{
                type: 'paragraph',
                runs: [{ text: '' }]
            }];
        }

        const paragraph = cellData.elements[0];
        if (!paragraph.runs || paragraph.runs.length === 0) {
            paragraph.runs = [{ text: '' }];
        }

        // 현재 run에 텍스트 삽입
        let currentRun = paragraph.runs[0];
        if (!currentRun.text) {
            currentRun.text = '';
        }

        // 텍스트 노드 내 오프셋 계산
        const offset = position.textOffset || 0;
        currentRun.text = currentRun.text.slice(0, offset) + text + currentRun.text.slice(offset);
    }

    /**
     * 단락에 텍스트 삽입 (내부 메서드)
     * @private
     */
    _insertTextIntoParagraph(paraData, position, text) {
        if (!paraData.runs || paraData.runs.length === 0) {
            paraData.runs = [{ text: '' }];
        }

        // 현재 run에 텍스트 삽입
        let currentRun = paraData.runs[0];
        if (!currentRun.text) {
            currentRun.text = '';
        }

        // 텍스트 노드 내 오프셋 계산
        const offset = position.textOffset || 0;
        currentRun.text = currentRun.text.slice(0, offset) + text + currentRun.text.slice(offset);
    }

    /**
     * 셀에서 문자 삭제 (내부 메서드)
     * @private
     */
    _deleteCharFromCell(cellData, position) {
        if (!cellData.elements || cellData.elements.length === 0) {
            return;
        }

        const paragraph = cellData.elements[0];
        if (!paragraph || !paragraph.runs || paragraph.runs.length === 0) {
            return;
        }

        const run = paragraph.runs[0];
        if (!run || !run.text) {
            return;
        }

        const offset = position.textOffset || 0;
        if (offset < run.text.length) {
            run.text = run.text.substring(0, offset) + run.text.substring(offset + 1);
        }
    }

    /**
     * 단락에서 문자 삭제 (내부 메서드)
     * @private
     */
    _deleteCharFromParagraph(paraData, position) {
        if (!paraData.runs || paraData.runs.length === 0) {
            return;
        }

        const run = paraData.runs[0];
        if (!run || !run.text) {
            return;
        }

        const offset = position.textOffset || 0;
        if (offset < run.text.length) {
            run.text = run.text.substring(0, offset) + run.text.substring(offset + 1);
        }
    }

    /**
     * 단락 분할 (내부 메서드)
     * @private
     */
    _splitParagraph(position) {
        const paraData = position.paraData;
        const section = position.section;

        if (!section || !section.paragraphs || !paraData) {
            return;
        }

        const paraIndex = section.paragraphs.indexOf(paraData);
        if (paraIndex < 0) {
            return;
        }

        const offset = position.textOffset || 0;
        const currentRun = paraData.runs[0];

        if (currentRun && currentRun.text) {
            // 현재 텍스트를 두 부분으로 나누기
            const beforeText = currentRun.text.substring(0, offset);
            const afterText = currentRun.text.substring(offset);

            // 현재 단락의 텍스트를 첫 번째 부분으로 업데이트
            currentRun.text = beforeText;

            // 새 단락 생성
            const newParagraph = {
                runs: [{
                    text: afterText,
                    formatting: { ...currentRun.formatting }
                }],
                formatting: { ...paraData.formatting }
            };

            // 섹션에 새 단락 삽입
            section.paragraphs.splice(paraIndex + 1, 0, newParagraph);
        } else {
            // 빈 단락 추가
            const newParagraph = {
                runs: [{ text: '', formatting: {} }],
                formatting: {}
            };

            section.paragraphs.splice(paraIndex + 1, 0, newParagraph);
        }
    }

    /**
     * 타이핑 중인지 확인
     */
    isTyping() {
        // 실제 구현에서는 타이핑 상태를 추적하는 로직이 필요
        return false;
    }

    /**
     * 자동 완성 제안 가져오기
     */
    getAutocompleteSuggestions(text) {
        // 기본 자동완성 단어 목록
        const commonWords = [
            '안녕하세요', '감사합니다', '죄송합니다', '괜찮습니다',
            '문서', '편집', '저장', '출력', '공유', '설정'
        ];

        if (!text || text.length < 2) {
            return [];
        }

        return commonWords
            .filter(word => word.toLowerCase().includes(text.toLowerCase()))
            .slice(0, 5); // 최대 5개 제안
    }

    /**
     * 맞춤법 검사
     */
    checkSpelling(text) {
        // 기본 맞춤법 검사 (실제로는 외부 서비스 연동 필요)
        const misspelledWords = [];

        // 간단한 패턴 기반 검사
        const words = text.split(/\s+/);
        for (const word of words) {
            // 예시: 연속된 같은 문자가 3개 이상인 경우
            if (/(.)\1{2,}/.test(word)) {
                misspelledWords.push({
                    word,
                    suggestions: [word.replace(/(.)\1+/g, '$1')]
                });
            }
        }

        return misspelledWords;
    }
}

export default TextInputCommands;