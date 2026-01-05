/**
 * Command
 * 공개 API 파사드
 * Canvas-editor의 Command 클래스를 참고하여 구현
 *
 * @module command/command
 * @version 1.0.0
 */

import { CommandAdapt } from './command-adapt.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Command 클래스
 * 모든 편집 명령에 대한 공개 API 제공
 */
export class Command {
    /**
     * Command 생성자
     * @param {CommandAdapt} commandAdapt - CommandAdapt 인스턴스
     */
    constructor(commandAdapt) {
        this.adapt = commandAdapt;
        logger.info('🎮 Command API initialized');
    }

    // ===========================
    // History Commands
    // ===========================

    /**
     * 실행 취소
     * @returns {boolean} 성공 여부
     *
     * @example
     * viewer.command.undo();
     */
    undo() {
        return this.adapt.executeUndo();
    }

    /**
     * 다시 실행
     * @returns {boolean} 성공 여부
     *
     * @example
     * viewer.command.redo();
     */
    redo() {
        return this.adapt.executeRedo();
    }

    // ===========================
    // Range Commands
    // ===========================

    /**
     * 범위 설정
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     *
     * @example
     * viewer.command.setRange(0, 99);
     */
    setRange(startIndex, endIndex) {
        this.adapt.executeSetRange(startIndex, endIndex);
    }

    /**
     * 전체 선택
     *
     * @example
     * viewer.command.selectAll();
     */
    selectAll() {
        this.adapt.executeSelectAll();
    }

    /**
     * 선택 해제
     *
     * @example
     * viewer.command.clearSelection();
     */
    clearSelection() {
        this.adapt.executeClearSelection();
    }

    // ===========================
    // Format Commands
    // ===========================

    /**
     * Bold 적용/해제
     * @param {boolean} value - Bold 활성화 여부 (기본값: true)
     *
     * @example
     * viewer.command.bold(true);  // Bold 적용
     * viewer.command.bold(false); // Bold 해제
     */
    bold(value = true) {
        this.adapt.executeBold(value);
    }

    /**
     * Italic 적용/해제
     * @param {boolean} value - Italic 활성화 여부 (기본값: true)
     *
     * @example
     * viewer.command.italic(true);
     */
    italic(value = true) {
        this.adapt.executeItalic(value);
    }

    /**
     * Underline 적용/해제
     * @param {boolean} value - Underline 활성화 여부 (기본값: true)
     *
     * @example
     * viewer.command.underline(true);
     */
    underline(value = true) {
        this.adapt.executeUnderline(value);
    }

    /**
     * Strikethrough 적용/해제 (취소선)
     * @param {boolean} value - Strikethrough 활성화 여부 (기본값: true)
     *
     * @example
     * viewer.command.strikethrough(true);  // 취소선 적용
     * viewer.command.strikethrough(false); // 취소선 해제
     */
    strikethrough(value = true) {
        this.adapt.executeStrikethrough(value);
    }

    /**
     * 색상 변경
     * @param {string} color - 색상 값 (CSS color)
     *
     * @example
     * viewer.command.color('#ff0000');
     * viewer.command.color('rgb(255, 0, 0)');
     */
    color(color) {
        this.adapt.executeColor(color);
    }

    /**
     * 형광펜 (배경색) 적용
     * @param {string} color - 배경 색상 값 (null이면 제거)
     *
     * @example
     * viewer.command.highlight('#ffff00');           // 노란색 형광펜
     * viewer.command.highlight('#90EE90');           // 연두색 형광펜
     * viewer.command.highlight('rgba(255,255,0,0.3)'); // 반투명 노란색
     * viewer.command.highlight(null);                // 형광펜 제거
     */
    highlight(color) {
        this.adapt.executeHighlight(color);
    }

    /**
     * 위 첨자 적용/해제
     * @param {boolean} value - 위 첨자 활성화 여부 (기본값: true)
     *
     * @example
     * viewer.command.superscript(true);  // 위 첨자 적용 (x²)
     * viewer.command.superscript(false); // 위 첨자 해제
     */
    superscript(value = true) {
        this.adapt.executeSuperscript(value);
    }

    /**
     * 아래 첨자 적용/해제
     * @param {boolean} value - 아래 첨자 활성화 여부 (기본값: true)
     *
     * @example
     * viewer.command.subscript(true);  // 아래 첨자 적용 (H₂O)
     * viewer.command.subscript(false); // 아래 첨자 해제
     */
    subscript(value = true) {
        this.adapt.executeSubscript(value);
    }

    // ===========================
    // Text Input Commands
    // ===========================

    /**
     * 텍스트 삽입
     * @param {string} text - 삽입할 텍스트
     *
     * @example
     * viewer.command.insertText('Hello');
     */
    insertText(text) {
        this.adapt.executeInsertText(text);
    }

    /**
     * 이전 문자 삭제 (Backspace)
     *
     * @example
     * viewer.command.deleteBackward();
     */
    deleteBackward() {
        this.adapt.executeDeleteBackward();
    }

    /**
     * 다음 문자 삭제 (Delete)
     *
     * @example
     * viewer.command.deleteForward();
     */
    deleteForward() {
        this.adapt.executeDeleteForward();
    }

    /**
     * 줄바꿈 삽입 (Enter)
     *
     * @example
     * viewer.command.insertLineBreak();
     */
    insertLineBreak() {
        this.adapt.executeInsertLineBreak();
    }

    // ===========================
    // Clipboard Commands
    // ===========================

    /**
     * 복사
     * @returns {string} 복사된 텍스트
     *
     * @example
     * const text = viewer.command.copy();
     * console.log('Copied:', text);
     */
    copy() {
        return this.adapt.executeCopy();
    }

    /**
     * 잘라내기
     * @returns {string} 잘라낸 텍스트
     *
     * @example
     * const text = viewer.command.cut();
     * console.log('Cut:', text);
     */
    cut() {
        return this.adapt.executeCut();
    }

    /**
     * 붙여넣기
     * @param {string} text - 붙여넣을 텍스트
     *
     * @example
     * viewer.command.paste('Hello World');
     */
    paste(text) {
        this.adapt.executePaste(text);
    }

    // ===========================
    // Find/Replace Commands
    // ===========================

    /**
     * 찾기
     * @param {string} searchText - 검색할 텍스트
     * @param {Object} options - 검색 옵션
     * @param {boolean} options.caseSensitive - 대소문자 구분
     * @param {boolean} options.wholeWord - 전체 단어 일치
     * @param {boolean} options.useRegex - 정규식 사용
     * @returns {number} 찾은 개수
     *
     * @example
     * const count = viewer.command.find('hello');
     * const count = viewer.command.find('Hello', { caseSensitive: true });
     * const count = viewer.command.find('\\d+', { useRegex: true });
     */
    find(searchText, options) {
        return this.adapt.executeFind(searchText, options);
    }

    /**
     * 다음 찾기
     * @returns {boolean} 성공 여부
     *
     * @example
     * viewer.command.findNext();
     */
    findNext() {
        return this.adapt.executeFindNext();
    }

    /**
     * 이전 찾기
     * @returns {boolean} 성공 여부
     *
     * @example
     * viewer.command.findPrevious();
     */
    findPrevious() {
        return this.adapt.executeFindPrevious();
    }

    /**
     * 교체
     * @param {string} replaceText - 교체할 텍스트
     * @returns {boolean} 성공 여부
     *
     * @example
     * viewer.command.find('old');
     * viewer.command.replace('new');
     */
    replace(replaceText) {
        return this.adapt.executeReplace(replaceText);
    }

    /**
     * 모두 교체
     * @param {string} searchText - 검색할 텍스트
     * @param {string} replaceText - 교체할 텍스트
     * @param {Object} options - 검색 옵션
     * @returns {number} 교체된 개수
     *
     * @example
     * const count = viewer.command.replaceAll('old', 'new');
     * const count = viewer.command.replaceAll('Hello', 'Hi', { caseSensitive: true });
     */
    replaceAll(searchText, replaceText, options) {
        return this.adapt.executeReplaceAll(searchText, replaceText, options);
    }

    /**
     * 검색 초기화
     *
     * @example
     * viewer.command.clearSearch();
     */
    clearSearch() {
        this.adapt.executeClearSearch();
    }

    // ===========================
    // Text Alignment Commands
    // ===========================

    /**
     * 왼쪽 정렬
     *
     * @example
     * viewer.command.alignLeft();
     */
    alignLeft() {
        this.adapt.executeAlignLeft();
    }

    /**
     * 가운데 정렬
     *
     * @example
     * viewer.command.alignCenter();
     */
    alignCenter() {
        this.adapt.executeAlignCenter();
    }

    /**
     * 오른쪽 정렬
     *
     * @example
     * viewer.command.alignRight();
     */
    alignRight() {
        this.adapt.executeAlignRight();
    }

    /**
     * 양쪽 정렬
     *
     * @example
     * viewer.command.alignJustify();
     */
    alignJustify() {
        this.adapt.executeAlignJustify();
    }

    // ===========================
    // List Commands
    // ===========================

    /**
     * 글머리 기호 적용
     * @param {string} bulletType - 기호 종류 ('bullet', 'circle', 'square')
     *
     * @example
     * viewer.command.bulletList();           // ● (기본)
     * viewer.command.bulletList('circle');   // ○
     * viewer.command.bulletList('square');   // ■
     */
    bulletList(bulletType = 'bullet') {
        this.adapt.executeBulletList(bulletType);
    }

    /**
     * 번호 매기기 적용
     * @param {string} numberType - 번호 형식
     *
     * @example
     * viewer.command.numberedList();                  // 1, 2, 3...
     * viewer.command.numberedList('lower-alpha');     // a, b, c...
     * viewer.command.numberedList('upper-alpha');     // A, B, C...
     * viewer.command.numberedList('lower-roman');     // i, ii, iii...
     * viewer.command.numberedList('upper-roman');     // I, II, III...
     */
    numberedList(numberType = 'decimal') {
        this.adapt.executeNumberedList(numberType);
    }

    /**
     * 목록 제거
     *
     * @example
     * viewer.command.removeList();
     */
    removeList() {
        this.adapt.executeRemoveList();
    }

    /**
     * 목록 들여쓰기 증가
     *
     * @example
     * viewer.command.increaseIndent();
     */
    increaseIndent() {
        this.adapt.executeIncreaseIndent();
    }

    /**
     * 목록 들여쓰기 감소
     *
     * @example
     * viewer.command.decreaseIndent();
     */
    decreaseIndent() {
        this.adapt.executeDecreaseIndent();
    }

    // ===========================
    // Line Spacing Commands
    // ===========================

    /**
     * 줄 간격 설정
     * @param {number} lineHeight - 줄 간격 (1.0 = 단일, 1.5 = 1.5줄, 2.0 = 2줄)
     *
     * @example
     * viewer.command.lineSpacing(1.0);   // 단일 간격
     * viewer.command.lineSpacing(1.15);  // 1.15줄 간격
     * viewer.command.lineSpacing(1.5);   // 1.5줄 간격
     * viewer.command.lineSpacing(2.0);   // 2줄 간격
     */
    lineSpacing(lineHeight) {
        this.adapt.executeLineSpacing(lineHeight);
    }

    // ===========================
    // Paragraph Spacing Commands
    // ===========================

    /**
     * 단락 앞 간격 설정
     * @param {number} spacing - 단락 앞 간격 (pt)
     *
     * @example
     * viewer.command.paragraphSpaceBefore(6);   // 6pt 간격
     * viewer.command.paragraphSpaceBefore(12);  // 12pt 간격
     */
    paragraphSpaceBefore(spacing) {
        this.adapt.executeParagraphSpaceBefore(spacing);
    }

    /**
     * 단락 뒤 간격 설정
     * @param {number} spacing - 단락 뒤 간격 (pt)
     *
     * @example
     * viewer.command.paragraphSpaceAfter(6);   // 6pt 간격
     * viewer.command.paragraphSpaceAfter(12);  // 12pt 간격
     */
    paragraphSpaceAfter(spacing) {
        this.adapt.executeParagraphSpaceAfter(spacing);
    }

    /**
     * 단락 간격 설정 (앞/뒤 동시)
     * @param {number} spaceBefore - 단락 앞 간격 (pt)
     * @param {number} spaceAfter - 단락 뒤 간격 (pt)
     *
     * @example
     * viewer.command.paragraphSpacing(6, 6);    // 앞/뒤 각 6pt
     * viewer.command.paragraphSpacing(0, 10);   // 앞 0pt, 뒤 10pt
     * viewer.command.paragraphSpacing(12, 0);   // 앞 12pt, 뒤 0pt
     */
    paragraphSpacing(spaceBefore, spaceAfter) {
        this.adapt.executeParagraphSpacing(spaceBefore, spaceAfter);
    }

    // ===========================
    // Font Size Commands
    // ===========================

    /**
     * 글꼴 크기 설정
     * @param {number} size - 글꼴 크기 (pt)
     *
     * @example
     * viewer.command.setFontSize(16);
     * viewer.command.setFontSize(24);
     */
    setFontSize(size) {
        this.adapt.executeSetFontSize(size);
    }

    /**
     * 글꼴 크기 증가
     * @param {number} step - 증가량 (기본값: 2pt)
     *
     * @example
     * viewer.command.increaseFontSize();     // +2pt
     * viewer.command.increaseFontSize(4);    // +4pt
     */
    increaseFontSize(step) {
        this.adapt.executeIncreaseFontSize(step);
    }

    /**
     * 글꼴 크기 감소
     * @param {number} step - 감소량 (기본값: 2pt)
     *
     * @example
     * viewer.command.decreaseFontSize();     // -2pt
     * viewer.command.decreaseFontSize(4);    // -4pt
     */
    decreaseFontSize(step) {
        this.adapt.executeDecreaseFontSize(step);
    }

    // ===========================
    // Font Family Commands
    // ===========================

    /**
     * 글꼴 종류 설정
     * @param {string} fontFamily - 글꼴 이름
     *
     * @example
     * viewer.command.setFontFamily('Arial');
     * viewer.command.setFontFamily('맑은 고딕');
     * viewer.command.setFontFamily('나눔고딕');
     */
    setFontFamily(fontFamily) {
        this.adapt.executeSetFontFamily(fontFamily);
    }

    // ===========================
    // Cell Edit Commands
    // ===========================

    /**
     * 셀 편집
     * @param {HTMLElement} cellElement - 셀 요소
     * @param {string} newText - 새 텍스트
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.editCell(cell, 'New content');
     */
    editCell(cellElement, newText) {
        this.adapt.executeEditCell(cellElement, newText);
    }

    /**
     * 셀 내용 비우기
     * @param {HTMLElement} cellElement - 셀 요소
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.clearCell(cell);
     */
    clearCell(cellElement) {
        this.adapt.executeClearCell(cellElement);
    }

    // ===========================
    // Table Commands
    // ===========================

    /**
     * 행 추가 (위)
     * @param {HTMLElement} cellElement - 기준 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.addRowAbove(cell);
     */
    addRowAbove(cellElement) {
        this.adapt.executeAddRowAbove(cellElement);
    }

    /**
     * 행 추가 (아래)
     * @param {HTMLElement} cellElement - 기준 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.addRowBelow(cell);
     */
    addRowBelow(cellElement) {
        this.adapt.executeAddRowBelow(cellElement);
    }

    /**
     * 열 추가 (왼쪽)
     * @param {HTMLElement} cellElement - 기준 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.addColumnLeft(cell);
     */
    addColumnLeft(cellElement) {
        this.adapt.executeAddColumnLeft(cellElement);
    }

    /**
     * 열 추가 (오른쪽)
     * @param {HTMLElement} cellElement - 기준 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.addColumnRight(cell);
     */
    addColumnRight(cellElement) {
        this.adapt.executeAddColumnRight(cellElement);
    }

    /**
     * 행 삭제
     * @param {HTMLElement} cellElement - 기준 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.deleteRow(cell);
     */
    deleteRow(cellElement) {
        this.adapt.executeDeleteRow(cellElement);
    }

    /**
     * 열 삭제
     * @param {HTMLElement} cellElement - 기준 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.deleteColumn(cell);
     */
    deleteColumn(cellElement) {
        this.adapt.executeDeleteColumn(cellElement);
    }

    /**
     * 테이블 삽입
     * @param {number} rows - 행 수
     * @param {number} cols - 열 수
     *
     * @example
     * viewer.command.insertTable(3, 4); // 3행 4열 테이블 삽입
     */
    insertTable(rows = 3, cols = 3) {
        this.adapt.executeInsertTable(rows, cols);
    }

    /**
     * 테이블 삭제
     * @param {HTMLElement} cellElement - 테이블 내 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.deleteTable(cell);
     */
    deleteTable(cellElement) {
        this.adapt.executeDeleteTable(cellElement);
    }

    /**
     * 셀 병합
     * @param {HTMLElement[]} cells - 병합할 셀들
     *
     * @example
     * const cells = [cell1, cell2, cell3];
     * viewer.command.mergeCells(cells);
     */
    mergeCells(cells) {
        this.adapt.executeMergeCells(cells);
    }

    /**
     * 셀 분할 (병합 해제)
     * @param {HTMLElement} cellElement - 분할할 셀
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.splitCell(cell);
     */
    splitCell(cellElement) {
        this.adapt.executeSplitCell(cellElement);
    }

    /**
     * 셀 배경색 설정
     * @param {HTMLElement} cellElement - 대상 셀
     * @param {string} color - 배경색
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.setCellBackgroundColor(cell, '#ff0000');
     */
    setCellBackgroundColor(cellElement, color) {
        this.adapt.executeSetCellBackgroundColor(cellElement, color);
    }

    /**
     * 셀 테두리 설정
     * @param {HTMLElement} cellElement - 대상 셀
     * @param {Object} borders - 테두리 설정 { top, bottom, left, right }
     *
     * @example
     * const cell = document.querySelector('td');
     * viewer.command.setCellBorders(cell, {
     *   top: '1px solid #000',
     *   bottom: '1px solid #000',
     *   left: '1px solid #000',
     *   right: '1px solid #000'
     * });
     */
    setCellBorders(cellElement, borders) {
        this.adapt.executeSetCellBorders(cellElement, borders);
    }

    // ===========================
    // Image Commands
    // ===========================

    /**
     * 이미지 삽입
     * @param {string} imageUrl - 이미지 URL (data URL 또는 http URL)
     * @param {Object} options - 옵션 { width, height, position, alt }
     *
     * @example
     * viewer.command.insertImage('data:image/png;base64,...', { width: 300, height: 200 });
     */
    insertImage(imageUrl, options = {}) {
        this.adapt.executeInsertImage(imageUrl, options);
    }

    /**
     * 이미지 삭제
     * @param {HTMLElement} imageElement - 이미지 요소
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.deleteImage(img);
     */
    deleteImage(imageElement) {
        this.adapt.executeDeleteImage(imageElement);
    }

    /**
     * 이미지 크기 조정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} width - 너비
     * @param {number} height - 높이
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.resizeImage(img, 400, 300);
     */
    resizeImage(imageElement, width, height) {
        this.adapt.executeResizeImage(imageElement, width, height);
    }

    /**
     * 이미지 정렬 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} alignment - 정렬 ('left', 'center', 'right', 'inline')
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.setImageAlignment(img, 'center');
     */
    setImageAlignment(imageElement, alignment) {
        this.adapt.executeSetImageAlignment(imageElement, alignment);
    }

    /**
     * 이미지 위치 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.setImagePosition(img, 100, 50);
     */
    setImagePosition(imageElement, x, y) {
        this.adapt.executeSetImagePosition(imageElement, x, y);
    }

    /**
     * 이미지 Alt 텍스트 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} altText - Alt 텍스트
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.setImageAltText(img, 'Description of image');
     */
    setImageAltText(imageElement, altText) {
        this.adapt.executeSetImageAltText(imageElement, altText);
    }

    /**
     * 이미지 회전
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} degrees - 회전 각도 (0, 90, 180, 270)
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.rotateImage(img, 90);
     */
    rotateImage(imageElement, degrees) {
        this.adapt.executeRotateImage(imageElement, degrees);
    }

    /**
     * 이미지 테두리 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {string} border - CSS 테두리 문자열
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.setImageBorder(img, '2px solid #000');
     */
    setImageBorder(imageElement, border) {
        this.adapt.executeSetImageBorder(imageElement, border);
    }

    /**
     * 이미지 불투명도 설정
     * @param {HTMLElement} imageElement - 이미지 요소
     * @param {number} opacity - 불투명도 (0.0 ~ 1.0)
     *
     * @example
     * const img = document.querySelector('.hwp-image-wrapper');
     * viewer.command.setImageOpacity(img, 0.7);
     */
    setImageOpacity(imageElement, opacity) {
        this.adapt.executeSetImageOpacity(imageElement, opacity);
    }

    // ===========================
    // Shape Commands
    // ===========================

    /**
     * 도형 삽입
     * @param {string} shapeType - 도형 타입 ('rectangle', 'ellipse', 'line', 'textbox')
     * @param {Object} options - 옵션
     *
     * @example
     * viewer.command.insertShape('rectangle', { width: 200, height: 150, fillColor: '#ff0000' });
     */
    insertShape(shapeType, options = {}) {
        this.adapt.executeInsertShape(shapeType, options);
    }

    /**
     * 도형 삭제
     * @param {HTMLElement} shapeElement - 도형 요소
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.deleteShape(shape);
     */
    deleteShape(shapeElement) {
        this.adapt.executeDeleteShape(shapeElement);
    }

    /**
     * 도형 크기 조정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} width - 너비
     * @param {number} height - 높이
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.resizeShape(shape, 300, 200);
     */
    resizeShape(shapeElement, width, height) {
        this.adapt.executeResizeShape(shapeElement, width, height);
    }

    /**
     * 도형 위치 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.setShapePosition(shape, 100, 50);
     */
    setShapePosition(shapeElement, x, y) {
        this.adapt.executeSetShapePosition(shapeElement, x, y);
    }

    /**
     * 도형 채우기 색상 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} color - 채우기 색상
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.setShapeFillColor(shape, '#ff0000');
     */
    setShapeFillColor(shapeElement, color) {
        this.adapt.executeSetShapeFillColor(shapeElement, color);
    }

    /**
     * 도형 테두리 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} color - 테두리 색상
     * @param {number} width - 테두리 두께
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.setShapeStroke(shape, '#000000', 2);
     */
    setShapeStroke(shapeElement, color, width) {
        this.adapt.executeSetShapeStroke(shapeElement, color, width);
    }

    /**
     * 도형 회전
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} degrees - 회전 각도
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.rotateShape(shape, 45);
     */
    rotateShape(shapeElement, degrees) {
        this.adapt.executeRotateShape(shapeElement, degrees);
    }

    /**
     * 도형 불투명도 설정
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} opacity - 불투명도 (0.0 ~ 1.0)
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.setShapeOpacity(shape, 0.5);
     */
    setShapeOpacity(shapeElement, opacity) {
        this.adapt.executeSetShapeOpacity(shapeElement, opacity);
    }

    /**
     * 도형 텍스트 설정 (textbox용)
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {string} text - 텍스트
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.setShapeText(shape, 'Hello World');
     */
    setShapeText(shapeElement, text) {
        this.adapt.executeSetShapeText(shapeElement, text);
    }

    /**
     * 도형 테두리 둥글기 설정 (rectangle용)
     * @param {HTMLElement} shapeElement - 도형 요소
     * @param {number} radius - 둥글기 (0-100)
     *
     * @example
     * const shape = document.querySelector('.hwp-shape');
     * viewer.command.setShapeBorderRadius(shape, 50);
     */
    setShapeBorderRadius(shapeElement, radius) {
        this.adapt.executeSetShapeBorderRadius(shapeElement, radius);
    }

    // ===========================
    // Document Commands
    // ===========================

    /**
     * 문서 업데이트
     * @param {Object} newDocument - 새 문서
     * @param {string} actionName - 액션 이름
     *
     * @example
     * viewer.command.updateDocument(modifiedDoc, 'AI Edit');
     */
    updateDocument(newDocument, actionName = 'Update Document') {
        this.adapt.executeUpdateDocument(newDocument, actionName);
    }

    // ===========================
    // Utility Methods
    // ===========================

    /**
     * 현재 문서 가져오기
     * @returns {Object} 문서
     *
     * @example
     * const doc = viewer.command.getDocument();
     */
    getDocument() {
        return this.adapt.getDocument();
    }

    /**
     * 렌더링
     *
     * @example
     * viewer.command.render();
     */
    render() {
        this.adapt.render();
    }
}

export default Command;
