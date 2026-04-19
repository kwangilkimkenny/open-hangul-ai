/**
 * List Commands Module
 * 목록 관련 명령 (글머리 기호, 번호 매기기)
 *
 * @module command/list-commands
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 목록 명령 클래스
 */
export class ListCommands {
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
    }

    /**
     * 글머리 기호 적용
     * @param {string} bulletType - 기호 종류 ('bullet', 'circle', 'square')
     */
    executeBulletList(bulletType = 'bullet') {
        try {
            const bulletMap = {
                bullet: '●',
                circle: '○',
                square: '■'
            };

            const symbol = bulletMap[bulletType] || '●';
            this._applyListFormatting('BULLET', symbol, 'Bullet List');
            logger.debug('Bullet list applied', { bulletType, symbol });

        } catch (error) {
            logger.error('Failed to apply bullet list', error);
            throw error;
        }
    }

    /**
     * 번호 매기기 적용
     * @param {string} numberType - 번호 형식 ('decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman')
     */
    executeNumberedList(numberType = 'decimal') {
        try {
            const formatMap = {
                'decimal': 'DECIMAL',
                'lower-alpha': 'LOWER_ALPHA',
                'upper-alpha': 'UPPER_ALPHA',
                'lower-roman': 'LOWER_ROMAN',
                'upper-roman': 'UPPER_ROMAN'
            };

            const format = formatMap[numberType] || 'DECIMAL';
            this._applyListFormatting(format, '%d.', 'Numbered List');
            logger.debug('Numbered list applied', { numberType, format });

        } catch (error) {
            logger.error('Failed to apply numbered list', error);
            throw error;
        }
    }

    /**
     * 목록 제거
     */
    executeRemoveList() {
        try {
            this._removeListFormatting('Remove List');
            logger.debug('List formatting removed');

        } catch (error) {
            logger.error('Failed to remove list', error);
            throw error;
        }
    }

    /**
     * 목록 들여쓰기 증가
     */
    executeIncreaseIndent() {
        try {
            this._adjustIndentLevel(1, 'Increase Indent');
            logger.debug('Indent level increased');

        } catch (error) {
            logger.error('Failed to increase indent', error);
            throw error;
        }
    }

    /**
     * 목록 들여쓰기 감소
     */
    executeDecreaseIndent() {
        try {
            this._adjustIndentLevel(-1, 'Decrease Indent');
            logger.debug('Indent level decreased');

        } catch (error) {
            logger.error('Failed to decrease indent', error);
            throw error;
        }
    }

    /**
     * 목록 포맷 적용 헬퍼
     * @private
     */
    _applyListFormatting(format, numberFormat, actionName) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 목록 ID 생성
        const listId = `list-${Date.now()}`;

        // 각 단락에 numbering 적용
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (!para.numbering) {
                para.numbering = {
                    id: listId,
                    level: 0,
                    definition: {
                        start: 1,
                        levels: []
                    }
                };
            }

            // 레벨 정의 추가/업데이트
            const levelData = {
                level: para.numbering.level,
                format: format,
                numberFormat: numberFormat,
                indent: para.numbering.level * 20
            };

            const existingLevelIndex = para.numbering.definition.levels.findIndex(
                l => l.level === para.numbering.level
            );

            if (existingLevelIndex >= 0) {
                para.numbering.definition.levels[existingLevelIndex] = levelData;
            } else {
                para.numbering.definition.levels.push(levelData);
            }
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`Applied ${actionName}`);
    }

    /**
     * 목록 제거 헬퍼
     * @private
     */
    _removeListFormatting(actionName) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락의 numbering 제거
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;
            delete para.numbering;
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`${actionName} completed`);
    }

    /**
     * 들여쓰기 레벨 조정 헬퍼
     * @private
     */
    _adjustIndentLevel(delta, actionName) {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) {
            logger.warn('No selection');
            return;
        }

        // 현재 문서 상태 저장
        const currentDoc = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        // 커서가 위치한 단락들 찾기
        const paragraphsToFormat = this._getParagraphsInRange(range);

        // 각 단락의 레벨 조정
        paragraphsToFormat.forEach(paraInfo => {
            const para = paraInfo.paraData;

            if (para.numbering) {
                const newLevel = Math.max(0, Math.min(8, para.numbering.level + delta));
                para.numbering.level = newLevel;

                // 레벨 정의 추가 (없으면)
                const levelData = para.numbering.definition.levels.find(l => l.level === newLevel);
                if (!levelData) {
                    const currentLevelData = para.numbering.definition.levels.find(
                        l => l.level === (newLevel - delta)
                    ) || para.numbering.definition.levels[0];

                    if (currentLevelData) {
                        para.numbering.definition.levels.push({
                            level: newLevel,
                            format: currentLevelData.format,
                            numberFormat: currentLevelData.numberFormat,
                            indent: newLevel * 20
                        });
                    }
                }
            }
        });

        // 문서 업데이트
        const newDoc = this.viewer.getDocument();
        this.viewer.render(newDoc);

        // History에 추가
        const execute = () => {
            this.viewer.render(newDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        const undo = () => {
            this.viewer.render(currentDoc);
            rangeManager.setRange(range.startIndex, range.endIndex);
        };

        this.historyManager.execute(execute, undo, actionName);

        logger.info(`${actionName} completed`);
    }

    /**
     * 범위 내 단락들 가져오기
     * @private
     */
    _getParagraphsInRange(range) {
        const positions = this.viewer.getCharacterPositions();
        const paragraphs = [];
        const seenParagraphs = new Set();

        for (let i = range.startIndex; i <= range.endIndex && i < positions.length; i++) {
            const position = positions[i];
            const para = position.paraData;

            if (para && !seenParagraphs.has(para)) {
                paragraphs.push({
                    paraData: para,
                    position: position
                });
                seenParagraphs.add(para);
            }
        }

        return paragraphs;
    }

    /**
     * 현재 단락이 목록인지 확인
     */
    isCurrentParagraphList() {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) return false;

        const paragraphs = this._getParagraphsInRange(range);
        return paragraphs.length > 0 && paragraphs[0].paraData.numbering;
    }

    /**
     * 현재 목록 타입 가져오기
     */
    getCurrentListType() {
        const rangeManager = this.viewer.getRangeManager();
        const range = rangeManager.getRange();

        if (!range) return null;

        const paragraphs = this._getParagraphsInRange(range);
        if (paragraphs.length === 0 || !paragraphs[0].paraData.numbering) {
            return null;
        }

        const numbering = paragraphs[0].paraData.numbering;
        const levelData = numbering.definition.levels.find(l => l.level === numbering.level);

        return levelData ? levelData.format : null;
    }
}

export default ListCommands;