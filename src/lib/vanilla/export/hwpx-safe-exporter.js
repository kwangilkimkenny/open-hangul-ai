/**
 * HWPX Safe Exporter (브라우저용)
 * 
 * 원본 HWPX 파일을 기반으로 안전하게 수정된 내용만 교체하여 저장
 * 
 * @module export/hwpx-safe-exporter
 * @version 2.0.0
 * @author HWPX Viewer Team
 */

import { getLogger } from '../utils/logger.js';
import { HWPXError, ErrorType } from '../utils/error.js';
import { HeaderBasedReplacer } from './header-based-replacer.js';

const logger = getLogger('HwpxSafeExporter');

/**
 * 안전한 HWPX 파일 생성 및 다운로드
 * 원본 HWPX ZIP을 그대로 가져와서 수정된 section XML만 교체
 */
export class HwpxSafeExporter {
    constructor() {
        // JSZip이 로드되었는지 확인
        if (typeof window.JSZip === 'undefined') {
            throw new HWPXError(
                ErrorType.EXPORT_ERROR,
                'JSZip 라이브러리가 로드되지 않았습니다'
            );
        }
        
        // 헤더 기반 교체 시스템 초기화
        this.headerReplacer = new HeaderBasedReplacer();
        logger.info('✅ HwpxSafeExporter initialized with HeaderBasedReplacer');
    }

    /**
     * 원본 HWPX 파일과 수정된 문서를 받아 새 HWPX 파일 생성
     * @param {File|Blob} originalHwpxFile - 원본 HWPX 파일
     * @param {Object} modifiedDocument - 수정된 문서 객체
     * @param {string} filename - 저장할 파일명
     * @returns {Promise<void>}
     */
    async exportModifiedHwpx(originalHwpxFile, modifiedDocument, filename = 'document.hwpx') {
        try {
            logger.info('📦 안전한 HWPX 내보내기 시작...');
            logger.time('Safe HWPX Export');

            // 1. 원본 HWPX ZIP 로드
            const originalZip = await window.JSZip.loadAsync(originalHwpxFile);
            logger.info('  ✅ 원본 HWPX ZIP 로드 완료');
            
            // ✅ 이미지 파일 확인 (디버깅용)
            const allFiles = Object.keys(originalZip.files);
            const imageFiles = allFiles.filter(path => path.startsWith('BinData/'));
            logger.info(`  📷 원본 ZIP 내 이미지: ${imageFiles.length}개`);
            imageFiles.forEach(path => logger.debug(`    - ${path}`));
            
            // 1.5. header.xml 수정 (자동 줄바꿈 설정)
            await this._fixHeaderParaPr(originalZip);
            
            // 2. 원본 section XML을 읽어서 TEXT 내용 교체 + 자동 줄바꿈 설정
            const sections = modifiedDocument.sections || [];
            for (let idx = 0; idx < sections.length; idx++) {
                const sectionFilename = `Contents/section${idx}.xml`;
                const originalSectionXml = await originalZip.file(sectionFilename).async('string');
                
                if (originalSectionXml) {
                    // ✅ 1단계: 자동 줄바꿈 속성 추가
                    const sectionXmlWithLineWrap = this._addLineWrapAttributes(originalSectionXml);
                    
                    // ✅ 2단계: 텍스트 내용 교체
                    const modifiedSectionXml = this._replaceTextInSectionXml(
                        sectionXmlWithLineWrap, 
                        sections[idx]
                    );
                    
                    // 원본 ZIP에서 section XML 교체
                    originalZip.file(sectionFilename, modifiedSectionXml);
                    logger.debug(`    ✓ ${sectionFilename} 텍스트 교체 완료`);
                } else {
                    logger.warn(`    ⚠️  ${sectionFilename} not found in original ZIP`);
                }
            }
            
            logger.info(`  ✅ ${sections.length}개 section XML 업데이트 완료`);

            // 3. 새 HWPX ZIP 생성
            const blob = await originalZip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            logger.info(`  ✅ 새 HWPX 생성 완료: ${blob.size.toLocaleString()} bytes`);

            // 4. 다운로드
            this.downloadBlob(blob, filename);

            logger.timeEnd('Safe HWPX Export');
            logger.info('✅ 안전한 HWPX 다운로드 완료!');

        } catch (error) {
            logger.error('❌ 안전한 HWPX 내보내기 실패:', error);
            throw new HWPXError(
                ErrorType.EXPORT_ERROR,
                '안전한 HWPX 파일 내보내기에 실패했습니다',
                error
            );
        }
    }

    /**
     * 헤더 기반 섹션 교체 (새로운 방식)
     * @param {string} originalXml - 원본 XML 문자열
     * @param {Object} modifiedSection - 수정된 섹션 객체
     * @returns {string|null} 수정된 XML 또는 null (실패 시)
     * @private
     */
    _replaceTextByHeaderMapping(originalXml, modifiedSection) {
        try {
            logger.info('    🔄 === 헤더 기반 섹션 교체 시작 ===');
            
            // DOM 파싱
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(originalXml, 'text/xml');
            
            // 파싱 오류 확인
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                logger.error('    ❌ XML 파싱 오류:', parseError.textContent);
                return null;
            }
            
            // 1. 테이블 셀 추출
            const cells = this.headerReplacer.extractTableCells(xmlDoc);
            if (cells.length === 0) {
                logger.warn('    ⚠️  테이블 셀을 찾을 수 없습니다');
                return null;
            }
            
            // 2. 헤더-섹션 쌍 생성
            const pairs = this.headerReplacer.createHeaderSectionPairs(cells);
            if (pairs.length === 0) {
                logger.warn('    ⚠️  헤더-섹션 쌍을 생성할 수 없습니다');
                return null;
            }
            
            // 3. AI가 생성한 내용 매핑 생성 (modifiedSection에서 추출)
            const aiContentMap = {};
            
            // modifiedSection에서 행(row) 기반으로 헤더-내용 매칭
            // ⚠️ 한 행에 여러 헤더-내용 쌍이 있을 수 있음 (예: 놀이기간 | 내용 | 연령 | 내용)
            if (modifiedSection && modifiedSection.elements) {
                for (const element of modifiedSection.elements) {
                    if (element.type === 'table' && element.rows) {
                        logger.info(`    🔍 테이블 분석: ${element.rows.length}개 행`);
                        
                        let pendingHeader = null;  // 단일 셀 헤더 대기
                        
                        for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
                            const row = element.rows[rowIdx];
                            logger.info(`    🔍 행 ${rowIdx}: ${row.cells ? row.cells.length : 0}개 셀`);
                            
                            if (row.cells && row.cells.length >= 2) {
                                // 모든 셀을 2개씩 묶어서 헤더-내용 쌍으로 처리
                                for (let cellIdx = 0; cellIdx < row.cells.length - 1; cellIdx += 2) {
                                    const headerCell = row.cells[cellIdx];
                                    const contentCell = row.cells[cellIdx + 1];
                                    
                                    // 헤더 텍스트 추출
                                    let headerText = '';
                                    if (headerCell && headerCell.elements) {
                                        for (const cellElem of headerCell.elements) {
                                            if (cellElem.type === 'paragraph' && cellElem.runs) {
                                                headerText = cellElem.runs
                                                    .map(run => run.text || '')
                                                    .join('')
                                                    .trim();
                                                break;
                                            }
                                        }
                                    }
                                    
                                    // 내용 텍스트 추출
                                    let contentParts = [];
                                    if (contentCell && contentCell.elements) {
                                        for (const cellElem of contentCell.elements) {
                                            if (cellElem.type === 'paragraph' && cellElem.runs) {
                                                const cellText = cellElem.runs
                                                    .map(run => run.text || '')
                                                    .join('')
                                                    .trim();
                                                if (cellText) {
                                                    contentParts.push(cellText);
                                                }
                                            }
                                        }
                                    }
                                    
                                    const contentText = contentParts.join('\n').trim();
                                    
                                    logger.info(`    🔍 셀 [${cellIdx}, ${cellIdx+1}]: 헤더="${headerText}", 내용="${contentText ? contentText.substring(0, 30) : '(없음)'}..."`);
                                    
                                    // 헤더가 유효한지 확인
                                    const isHeader = pairs.some(pair => 
                                        pair.header === headerText || 
                                        pair.header.includes(headerText) ||
                                        headerText.includes(pair.header)
                                    );
                                    
                                    if (isHeader && contentText && contentText !== '' && contentText !== '(비어있음)') {
                                        aiContentMap[headerText] = contentText;
                                        logger.info(`    ✅ 매핑 성공: "${headerText}" (${contentText.length}자)`);
                                    } else if (headerText) {
                                        logger.info(`    ⚠️  건너뜀: "${headerText}" (isHeader=${isHeader}, hasContent=${!!contentText}, length=${contentText.length})`);
                                    }
                                }
                                
                                // 2개 이상 셀이면 pendingHeader 초기화
                                pendingHeader = null;
                                
                            } else if (row.cells && row.cells.length === 1) {
                                // 단일 셀: 헤더 또는 내용
                                const singleCell = row.cells[0];
                                let cellText = '';
                                if (singleCell && singleCell.elements) {
                                    for (const cellElem of singleCell.elements) {
                                        if (cellElem.type === 'paragraph' && cellElem.runs) {
                                            const text = cellElem.runs
                                                .map(run => run.text || '')
                                                .join('')
                                                .trim();
                                            if (text) {
                                                cellText += (cellText ? '\n' : '') + text;
                                            }
                                        }
                                    }
                                }
                                
                                logger.info(`    🔍 단일 셀 행 [${rowIdx}]: "${cellText.substring(0, 30)}..."`);
                                
                                // 헤더인지 확인
                                const isHeader = pairs.some(pair => 
                                    pair.header === cellText || 
                                    pair.header.includes(cellText) ||
                                    cellText.includes(pair.header)
                                );
                                
                                if (pendingHeader) {
                                    // 이전 행이 헤더였으면, 현재 행은 내용
                                    if (cellText && cellText !== '' && cellText !== '(비어있음)') {
                                        aiContentMap[pendingHeader] = cellText;
                                        logger.info(`    ✅ 단일 셀 쌍 매핑: "${pendingHeader}" → 내용 (${cellText.length}자)`);
                                    }
                                    pendingHeader = null;
                                } else if (isHeader) {
                                    // 헤더이면 다음 행을 기다림
                                    pendingHeader = cellText;
                                    logger.info(`    🔄 헤더 대기 중: "${pendingHeader}"`);
                                } else {
                                    // 헤더도 아니고 대기 중인 헤더도 없으면 무시
                                    logger.info(`    ⚠️  단일 셀 무시: "${cellText.substring(0, 30)}..." (헤더 아님)`);
                                }
                            }
                        }
                    }
                }
            }
            
            logger.info(`    📊 AI 생성 내용: ${Object.keys(aiContentMap).length}개 항목`);
            logger.info(`    📊 헤더 목록: ${Object.keys(aiContentMap).join(', ')}`);
            
            // 디버그: 누락된 헤더 확인
            const allExpectedHeaders = pairs.map(p => p.header);
            const missingHeaders = allExpectedHeaders.filter(h => !Object.keys(aiContentMap).includes(h));
            if (missingHeaders.length > 0) {
                logger.warn(`    ⚠️  누락된 헤더 (${missingHeaders.length}개): ${missingHeaders.join(', ')}`);
            }
            
            if (Object.keys(aiContentMap).length === 0) {
                logger.warn('    ⚠️  AI 생성 내용이 없습니다 (모든 셀이 비어있음)');
                return null;
            }
            
            // 4. 각 헤더-섹션 쌍에 대해 내용 교체
            let replacedCount = 0;
            for (const pair of pairs) {
                const headerKey = pair.header.trim();
                
                // 헤더 이름 정규화 함수 (공백, 괄호 제거하여 매칭)
                const normalizeHeader = (header) => {
                    return header
                        .replace(/\s+/g, '')      // 모든 공백 제거
                        .replace(/\(|\)/g, '')    // 괄호 제거
                        .toLowerCase();           // 소문자 변환
                };
                
                const normalizedHeaderKey = normalizeHeader(headerKey);
                let matchedContent = null;
                let matchedHeaderName = null;
                
                // AI 생성 내용에서 매칭되는 헤더 찾기
                for (const aiHeader of Object.keys(aiContentMap)) {
                    const normalizedAiHeader = normalizeHeader(aiHeader);
                    
                    // 정규화된 이름으로 비교
                    if (normalizedAiHeader === normalizedHeaderKey || 
                        normalizedAiHeader.includes(normalizedHeaderKey) || 
                        normalizedHeaderKey.includes(normalizedAiHeader)) {
                        matchedContent = aiContentMap[aiHeader];
                        matchedHeaderName = aiHeader;
                        logger.info(`    🔗 매칭 성공: "${headerKey}" ← "${aiHeader}"`);
                        break;
                    }
                }
                
                if (matchedContent) {
                    const success = this.headerReplacer.replaceSectionContent(xmlDoc, pair, matchedContent);
                    if (success) {
                        replacedCount++;
                    }
                } else {
                    logger.warn(`    ⚠️  "${headerKey}"에 매칭되는 AI 내용이 없습니다 (정규화: "${normalizedHeaderKey}")`);
                }
            }
            
            if (replacedCount === 0) {
                logger.warn('    ⚠️  교체된 섹션이 없습니다');
                return null;
            }
            
            logger.info(`    ✅ ${replacedCount}/${pairs.length}개 섹션 교체 완료`);
            
            // 5. XML 직렬화
            const serializer = new XMLSerializer();
            const modifiedXml = serializer.serializeToString(xmlDoc);
            
            logger.info('    ✅ 헤더 기반 섹션 교체 완료!');
            return modifiedXml;
            
        } catch (error) {
            logger.error('    ❌ 헤더 기반 교체 실패:', error.message);
            logger.debug('    스택:', error.stack);
            return null;
        }
    }
    
    /**
     * v2.2.7: 요소 타입 기반 매칭 (paragraph와 table을 1:1 매칭)
     * @param {string} originalXml - 원본 section XML
     * @param {Object} modifiedSection - 수정된 섹션 객체
     * @returns {string|null} 수정된 section XML 또는 null
     */
    _replaceByElementTypeMatching(originalXml, modifiedSection) {
        try {
            logger.info('    🔄 === 요소 타입 기반 매칭 시작 ===');
            
            // 1. XML 파싱
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(originalXml, 'text/xml');
            
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                logger.error('    ❌ XML 파싱 오류:', parseError.textContent);
                return null;
            }
            
            // 2. 원본 XML에서 hp:p와 hp:tbl을 **순서대로** 찾기 (DOM 순서 유지)
            const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
            
            // sec의 직접 자식 요소들만 순회
            const secElement = xmlDoc.documentElement;
            if (!secElement) {
                logger.error('    ❌ sec 요소를 찾을 수 없습니다');
                return null;
            }
            
            // sec의 모든 자식 hp:p를 찾되, 최상위 레벨만
            const topLevelElements = [];
            
            function findTopLevelElements(node) {
                for (let i = 0; i < node.childNodes.length; i++) {
                    const child = node.childNodes[i];
                    if (child.nodeType !== 1) continue; // Element만
                    
                    const tagName = child.tagName || child.nodeName;
                    
                    if (tagName === 'hp:p' || tagName === 'p') {
                        // hp:p 안에 ctrl/tbl이 있는지 확인
                        const hasTable = child.querySelector('hp\\:tbl, tbl');
                        if (hasTable) {
                            // 테이블을 포함한 hp:p: 테이블 요소로 처리
                            topLevelElements.push({ type: 'table', element: hasTable });
                        } else {
                            // 일반 단락
                            topLevelElements.push({ type: 'paragraph', element: child });
                        }
                    }
                }
            }
            
            findTopLevelElements(secElement);
            
            const paragraphCount = topLevelElements.filter(e => e.type === 'paragraph').length;
            const tableCount = topLevelElements.filter(e => e.type === 'table').length;
            logger.info(`    📊 원본 XML: ${paragraphCount}개 일반 단락, ${tableCount}개 테이블 (총 ${topLevelElements.length}개 요소)`);
            logger.info(`    📋 요소 순서: ${topLevelElements.map(e => e.type[0].toUpperCase()).join(' → ')}`);
            
            // 3. 수정된 데이터도 같은 순서로 가져오기
            const modifiedElements = modifiedSection.elements || [];
            logger.info(`    📊 수정된 데이터: ${modifiedElements.length}개 요소`);
            logger.info(`    📋 수정 순서: ${modifiedElements.map(e => e.type[0].toUpperCase()).join(' → ')}`);
            
            // 4. 1:1 매칭하여 순서대로 교체
            let replacedCount = 0;
            const minLength = Math.min(topLevelElements.length, modifiedElements.length);
            
            for (let i = 0; i < minLength; i++) {
                const xmlElem = topLevelElements[i];
                const modElem = modifiedElements[i];
                
                // 타입이 일치하는지 확인
                if (xmlElem.type !== modElem.type) {
                    logger.warn(`    ⚠️  요소 ${i + 1}: 타입 불일치 (XML: ${xmlElem.type}, 수정: ${modElem.type})`);
                    continue;
                }
                
                if (xmlElem.type === 'paragraph') {
                    // 일반 단락 교체 (줄바꿈 보존)
                    const xmlP = xmlElem.element;
                    
                    // ✅ 줄바꿈을 포함한 run 구조 재구성
                    this._replaceRunsWithLinebreaks(xmlP, modElem.runs || [], hpNamespace);
                    
                    logger.info(`    ✅ 요소 ${i + 1} (단락) 교체 완료`);
                    replacedCount++;
                    
                } else if (xmlElem.type === 'table') {
                    // 테이블 교체 (v2.2.7b: 셀 구조 유지)
                    const xmlTbl = xmlElem.element;
                    const subLists = xmlTbl.getElementsByTagNameNS(hpNamespace, 'subList');
                    
                    // 수정된 테이블의 모든 셀을 배열로 수집 (paragraph 구조 유지)
                    const modifiedCells = [];
                    for (const row of (modElem.rows || [])) {
                        for (const cell of (row.cells || [])) {
                            modifiedCells.push(cell);
                        }
                    }
                    
                    logger.info(`    📊 테이블 ${i + 1}: ${subLists.length}개 subList, ${modifiedCells.length}개 수정 셀`);
                    
                    // 각 subList를 수정된 cell과 1:1 매칭
                    const matchedCells = Math.min(subLists.length, modifiedCells.length);
                    
                    for (let cellIdx = 0; cellIdx < matchedCells; cellIdx++) {
                        const subList = subLists[cellIdx];
                        const modCell = modifiedCells[cellIdx];
                        
                        // 원본 subList의 모든 hp:p 찾기
                        const xmlParagraphs = subList.getElementsByTagNameNS(hpNamespace, 'p');
                        
                        // 수정된 셀의 모든 paragraph
                        const modParagraphs = (modCell.elements || []).filter(el => el.type === 'paragraph');
                        
                        // paragraph 개수 비교
                        if (xmlParagraphs.length !== modParagraphs.length) {
                            logger.warn(`    ⚠️  셀 ${cellIdx + 1}: paragraph 개수 불일치 (XML: ${xmlParagraphs.length}, 수정: ${modParagraphs.length})`);
                        }
                        
                        // 각 paragraph를 1:1 매칭
                        const matchedParas = Math.min(xmlParagraphs.length, modParagraphs.length);
                        
                        for (let paraIdx = 0; paraIdx < matchedParas; paraIdx++) {
                            const xmlPara = xmlParagraphs[paraIdx];
                            const modPara = modParagraphs[paraIdx];
                            
                            // ✅ 줄바꿈을 포함한 run 구조 재구성
                            this._replaceRunsWithLinebreaks(xmlPara, modPara.runs || [], hpNamespace);
                        }
                        
                        logger.info(`    ✅ 셀 ${cellIdx + 1}: ${matchedParas}개 paragraph 교체`);
                    }
                    
                    logger.info(`    ✅ 요소 ${i + 1} (테이블): ${matchedCells}개 셀 교체 완료`);
                    replacedCount++;
                }
            }
            
            logger.info(`    🎯 총 ${replacedCount}/${minLength}개 요소 교체 완료`);
            
            // 교체된 요소가 없으면 실패
            if (replacedCount === 0) {
                logger.warn('    ⚠️  교체된 요소가 없습니다');
                return null;
            }
            
            // 6. XML 직렬화
            const serializer = new XMLSerializer();
            let modifiedXml = serializer.serializeToString(xmlDoc);
            
            // 7. xml:space="preserve" 검증 및 보정
            const beforeCount = (modifiedXml.match(/<hp:t xml:space="preserve"/g) || []).length;
            const allTCount = (modifiedXml.match(/<hp:t[\s>]/g) || []).length;
            
            if (beforeCount < allTCount) {
                logger.warn(`    ⚠️  일부 <hp:t>에 xml:space="preserve"가 누락됨 (${beforeCount}/${allTCount})`);
                logger.info(`    🔧 정규식으로 xml:space="preserve" 추가 중...`);
                
                // 빈 <hp:t/> 태그 → <hp:t xml:space="preserve"/>
                modifiedXml = modifiedXml.replace(/<hp:t\/>/g, '<hp:t xml:space="preserve"/>');
                
                // 내용 있는 <hp:t> 태그 → <hp:t xml:space="preserve">
                modifiedXml = modifiedXml.replace(/<hp:t>/g, '<hp:t xml:space="preserve">');
                
                const afterCount = (modifiedXml.match(/<hp:t xml:space="preserve"/g) || []).length;
                logger.info(`    ✅ xml:space="preserve" 추가 완료: ${afterCount}개 <hp:t> 태그`);
            } else {
                logger.info(`    ✅ xml:space="preserve" 정상: ${beforeCount}/${allTCount}개 <hp:t> 태그`);
            }
            
            logger.info('    ✅ 요소 타입 기반 매칭 완료!');
            return modifiedXml;
            
        } catch (error) {
            logger.error('    ❌ 요소 타입 기반 매칭 실패:', error.message);
            logger.debug('    스택:', error.stack);
            return null;
        }
    }

    /**
     * 줄바꿈을 포함한 runs를 XML paragraph에 적용 (ctrl 절대 건드리지 않기)
     * @param {Element} xmlPara - XML paragraph 요소
     * @param {Array} runs - 수정된 runs 배열
     * @param {string} hpNamespace - HWPX namespace
     * @private
     */
    _replaceRunsWithLinebreaks(xmlPara, runs, hpNamespace) {
        if (!runs || runs.length === 0) return;

        // ✅ 전략: <hp:t> 노드만 찾아서 텍스트만 교체 (ctrl/run/lnbrk 구조는 절대 건드리지 않음)
        const tNodes = xmlPara.getElementsByTagNameNS(hpNamespace, 't');
        
        if (tNodes.length === 0) {
            logger.warn('    ⚠️  No <hp:t> found in paragraph');
            return;
        }

        // 모든 runs의 텍스트를 하나로 합치기 (linebreak는 \n으로 변환)
        let combinedText = '';
        for (const run of runs) {
            if (run.type === 'linebreak') {
                combinedText += '\n';
            } else if (run.text) {
                combinedText += run.text;
            }
        }

        // ✅ 첫 번째 <hp:t>에만 텍스트 설정
        tNodes[0].textContent = combinedText;
        tNodes[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');

        // 나머지 <hp:t>는 비우기
        for (let i = 1; i < tNodes.length; i++) {
            tNodes[i].textContent = '';
            tNodes[i].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        }
        
        // ✅ ctrl, run, lnbrk 구조는 절대 건드리지 않음 → 이미지 보존
    }

    /**
     * <hp:run> 요소 생성 (텍스트 포함)
     * @param {Document} xmlDoc - XML Document
     * @param {string} hpNamespace - HWPX namespace
     * @param {string} text - 텍스트 내용
     * @returns {Element} <hp:run> 요소
     * @private
     */
    _createRunElement(xmlDoc, hpNamespace, text) {
        const run = xmlDoc.createElementNS(hpNamespace, 'hp:run');
        const t = xmlDoc.createElementNS(hpNamespace, 'hp:t');
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        t.textContent = text;
        run.appendChild(t);
        return run;
    }
    
    /**
     * 원본 section XML에서 TEXT 내용만 교체
     * @param {string} originalXml - 원본 section XML
     * @param {Object} modifiedSection - 수정된 섹션 객체
     * @returns {string} 수정된 section XML
     */
    _replaceTextInSectionXml(originalXml, modifiedSection) {
        // ============================================================
        // 수동 편집용: 요소 타입 기반 교체 우선 사용 (모든 셀 반영)
        // ============================================================
        logger.info('    🔄 v2.2.7: 요소 타입 기반 재생성 시도 (수동 편집 모드)...');
        const elementBasedResult = this._replaceByElementTypeMatching(originalXml, modifiedSection);
        if (elementBasedResult) {
            logger.info('    ✅ 요소 타입 기반 재생성 성공!');
            return elementBasedResult;
        }
        
        logger.warn('    ⚠️  요소 타입 기반 재생성 실패, 헤더 기반 교체 시도...');
        
        // ============================================================
        // 백업: 헤더 기반 교체 시도 (AI 생성용)
        // ============================================================
        const headerBasedResult = this._replaceTextByHeaderMapping(originalXml, modifiedSection);
        if (headerBasedResult) {
            logger.info('    ✅ 헤더 기반 교체 성공!');
            return headerBasedResult;
        }
        
        logger.warn('    ⚠️  헤더 기반 교체도 실패, 레거시 방식으로 시도...');
        
        try {
            // DOMParser로 XML 파싱
            const parser = new DOMParser();
            let xmlDoc = parser.parseFromString(originalXml, 'text/xml');
            
            // 파싱 오류 확인
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                logger.error('XML 파싱 오류:', parseError.textContent);
                return originalXml; // 오류 시 원본 반환
            }
            
            // 원본 XML 구조 디버깅 (더 긴 샘플)
            logger.info('    🔍 원본 XML 구조 샘플 (처음 5000자):');
            logger.info(originalXml.substring(0, 5000));
            
            // 텍스트가 있는 부분을 찾기 위해 중간 부분도 확인
            const xmlLength = originalXml.length;
            if (xmlLength > 10000) {
                logger.info('    🔍 원본 XML 중간 부분 (5000-10000자):');
                logger.info(originalXml.substring(5000, 10000));
            }
            
            // XML 루트 및 자식 태그 확인
            logger.info(`    📋 루트 태그: ${xmlDoc.documentElement.tagName}`);
            const allTags = Array.from(xmlDoc.getElementsByTagName('*')).map(el => el.tagName);
            const uniqueTags = [...new Set(allTags)].slice(0, 20);
            logger.info(`    📋 문서 내 태그 (처음 20개): ${uniqueTags.join(', ')}`);
            
            // ============================================================
            // 1단계: 먼저 빈 run에 <hp:t> 추가
            // ============================================================
            logger.info('    🔍 === 1단계: 빈 run에 <hp:t> 추가 ===');
            
            try {
                const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
                
                // 테이블 셀 찾기 (네임스페이스 포함)
                const tcNodes = xmlDoc.getElementsByTagName('hp:tc');
                logger.debug(`    🔍 발견된 테이블 셀: ${tcNodes.length}개`);
                
                // 네임스페이스로도 시도
                if (tcNodes.length === 0) {
                    const tcNodesNS = xmlDoc.getElementsByTagNameNS(hpNamespace, 'tc');
                    logger.debug(`    🔍 네임스페이스로 발견된 셀: ${tcNodesNS.length}개`);
                }
                
                let emptyRunCount = 0;
                
                // 모든 run 태그 찾기
                const allRunNodes = xmlDoc.getElementsByTagNameNS(hpNamespace, 'run');
                logger.debug(`    🔍 전체 run 노드: ${allRunNodes.length}개`);
                
                for (let i = 0; i < allRunNodes.length; i++) {
                    const run = allRunNodes[i];
                    
                    // 이 run이 테이블 셀(subList) 안에 있는지 확인
                    let isInTableCell = false;
                    let parent = run.parentNode;
                    while (parent) {
                        const tagName = parent.tagName || parent.nodeName;
                        // subList는 테이블 셀(tc) 안의 콘텐츠 영역
                        if (tagName === 'hp:subList' || tagName === 'subList') {
                            isInTableCell = true;
                            break;
                        }
                        // sec나 document까지 올라가면 중단
                        if (tagName === 'hp:sec' || tagName === 'sec' || tagName === 'hs:sec') {
                            break;
                        }
                        parent = parent.parentNode;
                    }
                    
                    // 테이블 셀(subList) 안의 run만 처리
                    if (isInTableCell) {
                        // run에 hp:t 자식이 있는지 확인
                        const existingT = run.getElementsByTagNameNS(hpNamespace, 't');
                        
                        if (existingT.length === 0) {
                            // hp:t 태그가 없으면 추가 (xml:space="preserve" 속성 포함)
                            const newT = xmlDoc.createElementNS(hpNamespace, 'hp:t');
                            newT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
                            run.appendChild(newT);
                            emptyRunCount++;
                        } else {
                            // 기존 hp:t 태그에도 xml:space="preserve" 추가
                            for (let t = 0; t < existingT.length; t++) {
                                existingT[t].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
                            }
                        }
                    }
                }
                
                if (emptyRunCount > 0) {
                    logger.info(`    ✅ ${emptyRunCount}개 테이블 내 빈 run에 <hp:t> 추가 완료`);
                } else {
                    logger.warn(`    ⚠️  테이블 내 빈 run을 찾지 못했습니다.`);
                }
                
                // 디버그: xml:space="preserve" 적용 확인
                const allTNodes = xmlDoc.getElementsByTagNameNS(hpNamespace, 't');
                let preserveCount = 0;
                for (let i = 0; i < allTNodes.length; i++) {
                    const attr = allTNodes[i].getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space');
                    if (attr === 'preserve') {
                        preserveCount++;
                    }
                }
                logger.info(`    ✅ xml:space="preserve" 적용: ${preserveCount}/${allTNodes.length}개 <hp:t> 태그`);
            } catch (e) {
                logger.error('    ❌ 빈 run 태그 처리 실패:', e.message);
            }
            
            // XML을 문자열로 변환 (<hp:t> 추가된 상태)
            const serializer = new XMLSerializer();
            const xmlStringWithT = serializer.serializeToString(xmlDoc);
            
            // ============================================================
            // 2단계: 수정된 XML로 텍스트 수집
            // ============================================================
            logger.info('    🔍 === 2단계: 텍스트 수집 ===');
            const modifiedTexts = this._collectAllTextsFromSection(modifiedSection, xmlStringWithT);
            logger.debug(`    📝 수집된 텍스트: ${modifiedTexts.length}개`);
            
            // ============================================================
            // 3단계: XML 노드 찾기 및 교체
            // ============================================================
            logger.info('    🔍 === 3단계: XML 노드 찾기 ===');
            
            // 네임스페이스를 고려한 텍스트 노드 찾기
            let textNodes = null;
            let usedMethod = null;
            
            // 방법 1: hp:t 태그 시도 (네임스페이스 포함) - ✅ 모든 텍스트 노드 포함
            try {
                const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
                const allTextNodes = xmlDoc.getElementsByTagNameNS(hpNamespace, 't');
                logger.debug(`    🔍 전체 hp:t 태그: ${allTextNodes.length}개`);
                
                // ✅ 모든 빈 노드를 인덱스와 함께 수집 (테이블 내외 구분 없이)
                const emptyNodesWithIndex = [];
                let nodeIndex = 0;
                
                for (let i = 0; i < allTextNodes.length; i++) {
                    const textNode = allTextNodes[i];
                    const textContent = textNode.textContent || textNode.nodeValue || '';
                    
                    if (textContent.trim() === '') {
                        // 빈 노드: 인덱스와 함께 저장
                        emptyNodesWithIndex.push({ node: textNode, index: nodeIndex });
                    }
                    nodeIndex++;  // 전체 인덱스 증가
                }
                
                // 연속 빈 노드 필터링 (첫 번째 제외, 두 번째 선택)
                const filteredNodes = [];
                for (let i = 0; i < emptyNodesWithIndex.length; i++) {
                    const current = emptyNodesWithIndex[i];
                    const next = emptyNodesWithIndex[i + 1];
                    
                    // 다음 노드가 연속인지 확인
                    if (next && current.index + 1 === next.index) {
                        // 연속 빈 노드: 두 번째를 선택, 첫 번째는 제외 (헤더 연장일 가능성)
                        logger.info(`    🔍 XML 연속 빈 노드 발견: [${current.index}, ${next.index}] → [${current.index}] 제외, [${next.index}] 선택`);
                        filteredNodes.push(next.node);  // 두 번째 선택
                        i++;  // 다음 노드 이미 처리했으므로 건너뛰기
                    } else {
                        // 연속되지 않음: 그대로 선택
                        filteredNodes.push(current.node);
                    }
                }
                
                if (filteredNodes.length > 0) {
                    textNodes = filteredNodes;
                    usedMethod = 'getElementsByTagNameNS("hp", "t") + all nodes + consecutive skip';
                    logger.info(`    ✅ 텍스트 노드 발견: hp:t 태그 (전체 ${allTextNodes.length}개 → 빈 노드 ${emptyNodesWithIndex.length}개 → 연속 제외 후 ${filteredNodes.length}개) [테이블 내외 모두 포함]`);
                }
            } catch (e) {
                logger.debug('    getElementsByTagNameNS 실패:', e.message);
            }
            
            // 방법 2: 와일드카드로 모든 't' 태그 찾기 - ✅ 모든 텍스트 노드 포함
            if (!textNodes || textNodes.length === 0) {
                try {
                    const allTextNodes = xmlDoc.getElementsByTagName('t');
                    logger.debug(`    🔍 전체 t 태그: ${allTextNodes.length}개`);
                    
                    // ✅ 모든 빈 노드를 인덱스와 함께 수집 (테이블 내외 구분 없이)
                    const emptyNodesWithIndex = [];
                    let nodeIndex = 0;
                    
                    for (let i = 0; i < allTextNodes.length; i++) {
                        const textNode = allTextNodes[i];
                        const textContent = textNode.textContent || textNode.nodeValue || '';
                        
                        if (textContent.trim() === '') {
                            emptyNodesWithIndex.push({ node: textNode, index: nodeIndex });
                        }
                        nodeIndex++;
                    }
                    
                    // 연속 빈 노드 필터링 (첫 번째 제외, 두 번째 선택)
                    const filteredNodes = [];
                    for (let i = 0; i < emptyNodesWithIndex.length; i++) {
                        const current = emptyNodesWithIndex[i];
                        const next = emptyNodesWithIndex[i + 1];
                        
                        if (next && current.index + 1 === next.index) {
                            // 연속 빈 노드: 두 번째를 선택, 첫 번째는 제외
                            logger.info(`    🔍 XML 연속 빈 노드 발견: [${current.index}, ${next.index}] → [${current.index}] 제외, [${next.index}] 선택`);
                            filteredNodes.push(next.node);  // 두 번째 선택
                            i++;
                        } else {
                            filteredNodes.push(current.node);
                        }
                    }
                    
                    if (filteredNodes.length > 0) {
                        textNodes = filteredNodes;
                        usedMethod = 'getElementsByTagName("t") + all nodes + consecutive skip';
                        logger.info(`    ✅ 텍스트 노드 발견: t 태그 (전체 ${allTextNodes.length}개 → 빈 노드 ${emptyNodesWithIndex.length}개 → 연속 제외 후 ${filteredNodes.length}개) [테이블 내외 모두 포함]`);
                    }
                } catch (e) {
                    logger.debug('    getElementsByTagName("t") 실패:', e.message);
                }
            }
            
            // 방법 3: hp:run 안의 직접 텍스트 노드 찾기
            if (!textNodes || textNodes.length === 0) {
                try {
                    const runs = xmlDoc.getElementsByTagName('run');
                    logger.info(`    🔍 hp:run 태그 개수: ${runs.length}개`);
                    const textNodeList = [];
                    for (let i = 0; i < runs.length; i++) {
                        const run = runs[i];
                        // run의 직접 자식 텍스트 노드 찾기
                        for (let j = 0; j < run.childNodes.length; j++) {
                            const child = run.childNodes[j];
                            if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) {
                                textNodeList.push(child);
                            } else if (child.nodeType === Node.ELEMENT_NODE) {
                                // 자식 요소 안의 텍스트도 확인
                                const childText = child.textContent || '';
                                if (childText.trim()) {
                                    textNodeList.push(child);
                                }
                            }
                        }
                    }
                    if (textNodeList.length > 0) {
                        textNodes = textNodeList;
                        usedMethod = 'hp:run child nodes';
                        logger.info(`    ✅ 텍스트 노드 발견: hp:run 자식 (${textNodes.length}개)`);
                    }
                } catch (e) {
                    logger.debug('    hp:run 탐색 실패:', e.message);
                }
            }
            
            // 방법 4: XPath로 모든 텍스트 노드 찾기
            if (!textNodes || textNodes.length === 0) {
                try {
                    const xpath = '//text()[normalize-space()]';
                    const xpathResult = xmlDoc.evaluate(xpath, xmlDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    if (xpathResult.snapshotLength > 0) {
                        // NodeList 스타일로 변환
                        const nodeArray = [];
                        for (let i = 0; i < xpathResult.snapshotLength; i++) {
                            nodeArray.push(xpathResult.snapshotItem(i));
                        }
                        textNodes = nodeArray;
                        usedMethod = 'XPath text nodes';
                        logger.info(`    ✅ 텍스트 노드 발견: XPath (${textNodes.length}개)`);
                    }
                } catch (e) {
                    logger.debug('    XPath 실패:', e.message);
                }
            }
            
            // 방법 5: 정규식으로 직접 교체 (최후의 수단)
            if (!textNodes || textNodes.length === 0) {
                logger.warn('    ⚠️  DOM 방식으로 텍스트 노드를 찾을 수 없습니다.');
                logger.info('    🔧 정규식 방식으로 XML 문자열 직접 교체 시도...');
                return this._replaceTextWithRegex(originalXml, modifiedTexts);
            }
            
            logger.info(`    📝 사용된 방법: ${usedMethod}`);
            
            // 텍스트 노드를 배열로 변환 (NodeList나 HTMLCollection 대응)
            const textNodeArray = Array.isArray(textNodes) ? textNodes : Array.from(textNodes);
            
            logger.info(`    📝 총 ${textNodeArray.length}개 텍스트 노드, ${modifiedTexts.length}개 수정 텍스트`);
            
            if (textNodeArray.length !== modifiedTexts.length) {
                logger.warn(`    ⚠️  텍스트 노드 개수와 수정 텍스트 개수가 일치하지 않습니다!`);
                logger.warn(`    ⚠️  원본: ${textNodeArray.length}개, 수정: ${modifiedTexts.length}개`);
                
                // 디버깅: XML 텍스트 노드의 실제 내용 출력 (처음 30개)
                logger.info(`    🔍 XML 텍스트 노드 내용 (처음 30개):`);
                for (let idx = 0; idx < Math.min(textNodeArray.length, 30); idx++) {
                    const originalText = textNodeArray[idx].textContent || textNodeArray[idx].nodeValue || '';
                    logger.info(`      [${idx}] "${originalText.substring(0, 40) || '(빈)'}" (길이: ${originalText.length})`);
                }
            }
            
            // 텍스트 내용 교체 (순서대로)
            logger.info(`    🔍 === XML 텍스트 교체 시작 ===`);
            
            let textIndex = 0;
            for (let idx = 0; idx < textNodeArray.length && textIndex < modifiedTexts.length; idx++) {
                const textNode = textNodeArray[idx];
                const originalText = textNode.textContent || textNode.nodeValue || '';
                // 1. 긴 텍스트에 자동 줄바꿈 추가 (기본값 35자)
                const textWithBreaks = this.addAutoLineBreaks(modifiedTexts[textIndex]);
                // 2. XML 엔티티 변환
                const newText = this.escapeXml(textWithBreaks);
                
                const originalPreview = originalText.length > 30 ? originalText.substring(0, 30) + '...' : originalText;
                const newPreview = newText.length > 30 ? newText.substring(0, 30) + '...' : newText;
                
                // 디버그: 개행 문자 개수 확인
                const lineBreakCount = (newText.match(/\n/g) || []).length;
                if (lineBreakCount > 0) {
                    logger.info(`    🔄 XML 노드 [${idx}]: "${originalPreview}" → "${newPreview}" (줄바꿈 ${lineBreakCount}개 포함)`);
                } else {
                    logger.info(`    🔄 XML 노드 [${idx}]: "${originalPreview}" → "${newPreview}"`);
                }
                
                // ⚠️ 중요: 개행 문자가 있으면 여러 개의 단락 (<hp:p>)으로 분리!
                // lineBreak 컨트롤은 작동하지 않으므로, 각 줄을 별도의 단락으로 만들기
                if (lineBreakCount > 0) {
                    // 개행 문자로 분리
                    const lines = newText.split('\n');
                    
                    // 현재 run과 단락 찾기
                    const currentRun = textNode.parentNode; // <hp:run>
                    const currentP = currentRun ? currentRun.parentNode : null; // <hp:p>
                    const subList = currentP ? currentP.parentNode : null; // <hp:subList>
                    
                    logger.info(`    🔍 디버그: 단락 분리 준비 - lines = ${lines.length}개`);
                    
                    if (currentP && subList && (currentP.tagName === 'hp:p' || currentP.localName === 'p')) {
                        // 첫 번째 줄은 현재 textNode에
                        if (textNode.textContent !== undefined) {
                            textNode.textContent = lines[0];
                        } else if (textNode.nodeValue !== undefined) {
                            textNode.nodeValue = lines[0];
                        }
                        
                        const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
                        let lastInsertedP = currentP;
                        
                        // 나머지 줄은 새로운 단락(<hp:p>)으로 생성
                        for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
                            // 새 단락 생성
                            const newP = xmlDoc.createElementNS(hpNamespace, 'hp:p');
                            newP.setAttribute('id', '0');
                            
                            // 원본 단락의 속성 복사
                            const paraPrIDRef = currentP.getAttribute('paraPrIDRef');
                            const styleIDRef = currentP.getAttribute('styleIDRef');
                            if (paraPrIDRef) newP.setAttribute('paraPrIDRef', paraPrIDRef);
                            if (styleIDRef) newP.setAttribute('styleIDRef', styleIDRef);
                            newP.setAttribute('pageBreak', '0');
                            newP.setAttribute('columnBreak', '0');
                            newP.setAttribute('merged', '0');
                            newP.setAttribute('autoLineBreak', '1');
                            
                            // 새 run 생성
                            const newRun = xmlDoc.createElementNS(hpNamespace, 'hp:run');
                            const charPrIDRef = currentRun.getAttribute('charPrIDRef');
                            if (charPrIDRef) {
                                newRun.setAttribute('charPrIDRef', charPrIDRef);
                            }
                            
                            // 새 텍스트 노드 생성
                            const newT = xmlDoc.createElementNS(hpNamespace, 'hp:t');
                            newT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
                            newT.textContent = lines[lineIdx];
                            
                            newRun.appendChild(newT);
                            newP.appendChild(newRun);
                            
                            // subList에 새 단락 추가
                            if (lastInsertedP.nextSibling) {
                                subList.insertBefore(newP, lastInsertedP.nextSibling);
                            } else {
                                subList.appendChild(newP);
                            }
                            
                            lastInsertedP = newP;
                        }
                        
                        logger.info(`    ✂️ ${lines.length}개 단락으로 분리 완료! (${lineBreakCount}개 줄바꿈)`);
                        logger.info(`    📄 ${lines.length - 1}개 새 <hp:p> 단락 생성됨`);
                    } else {
                        // 단락을 찾을 수 없으면 그냥 텍스트 교체
                        logger.warn(`    ⚠️  단락 구조를 찾을 수 없어 텍스트만 교체합니다`);
                        if (textNode.textContent !== undefined) {
                            textNode.textContent = newText;
                        } else if (textNode.nodeValue !== undefined) {
                            textNode.nodeValue = newText;
                        }
                    }
                } else {
                    // 개행 문자가 없으면 일반 교체
                    if (textNode.textContent !== undefined) {
                        textNode.textContent = newText;
                    } else if (textNode.nodeValue !== undefined) {
                        textNode.nodeValue = newText;
                    }
                }
                
                textIndex++;
            }
            
            logger.info(`    ✅ ${textIndex}개 텍스트 노드 업데이트 완료 (전체: ${textNodeArray.length}개)`);
            
            // XML을 문자열로 변환 (serializer 재사용)
            let modifiedXml = serializer.serializeToString(xmlDoc);
            
            // ⚠️ XMLSerializer가 xml:space="preserve"를 제대로 serialize하지 못하는 경우가 있음
            // 해결: 모든 <hp:t> 태그에 xml:space="preserve" 속성을 직접 추가
            const beforeCount = (modifiedXml.match(/<hp:t xml:space="preserve"/g) || []).length;
            if (beforeCount === 0) {
                logger.warn(`    ⚠️  XMLSerializer가 xml:space="preserve"를 serialize하지 못했습니다!`);
                logger.info(`    🔧 정규식으로 xml:space="preserve" 직접 추가 중...`);
                
                // 1. 빈 <hp:t/> 태그 → <hp:t xml:space="preserve"/>
                modifiedXml = modifiedXml.replace(/<hp:t\/>/g, '<hp:t xml:space="preserve"/>');
                
                // 2. 내용 있는 <hp:t> 태그 → <hp:t xml:space="preserve">
                modifiedXml = modifiedXml.replace(/<hp:t>/g, '<hp:t xml:space="preserve">');
                
                const afterCount = (modifiedXml.match(/<hp:t xml:space="preserve"/g) || []).length;
                logger.info(`    ✅ xml:space="preserve" 추가 완료: ${afterCount}개 <hp:t> 태그`);
            } else {
                logger.info(`    ✅ xml:space="preserve"가 이미 serialize되어 있습니다: ${beforeCount}개`);
            }
            
            // 디버그: serialization 후 개행 문자 확인
            const totalLineBreaksInXml = (modifiedXml.match(/\n/g) || []).length;
            logger.info(`    📝 Serialization 완료: 전체 ${totalLineBreaksInXml}개 개행 문자 포함`);
            
            // 샘플 <hp:t> 태그 확인 (디버그) - xml:space="preserve" 포함 여부 확인
            const allHpTOpen = modifiedXml.match(/<hp:t[^>]*>/g);
            if (allHpTOpen && allHpTOpen.length > 0) {
                logger.info(`    📝 전체 <hp:t> 태그: ${allHpTOpen.length}개`);
                const withPreserve = modifiedXml.match(/<hp:t xml:space="preserve"[^>]*>/g);
                const preserveCount = withPreserve ? withPreserve.length : 0;
                logger.info(`    📝 xml:space="preserve" 포함: ${preserveCount}/${allHpTOpen.length}개`);
                
                if (preserveCount === allHpTOpen.length) {
                    logger.info(`    ✅ 모든 <hp:t> 태그에 xml:space="preserve" 적용됨!`);
                } else {
                    logger.warn(`    ⚠️  일부 <hp:t> 태그에 xml:space="preserve"가 없습니다!`);
                }
                
                // 긴 텍스트가 있는 <hp:t> 태그 찾기 (개행 문자 포함)
                const longTextMatches = modifiedXml.match(/<hp:t[^>]*>[^<]{50,}?<\/hp:t>/g);
                if (longTextMatches && longTextMatches.length > 0) {
                    logger.info(`    📝 긴 텍스트 <hp:t> 태그: ${longTextMatches.length}개`);
                    // 처음 3개만 출력
                    for (let i = 0; i < Math.min(3, longTextMatches.length); i++) {
                        const sample = longTextMatches[i].replace(/\n/g, '\\n').substring(0, 120);
                        logger.info(`    📝 샘플 ${i + 1}: ${sample}...`);
                    }
                }
            }
            
            return modifiedXml;
            
        } catch (error) {
            logger.error('TEXT 교체 중 오류:', error);
            return originalXml; // 오류 시 원본 반환
        }
    }
    
    /**
     * 정규식을 사용해 XML 문자열에서 직접 텍스트 교체 (최후의 수단)
     * @param {string} xmlString - 원본 XML 문자열
     * @param {string[]} newTexts - 새로운 텍스트 배열
     * @returns {string} 교체된 XML 문자열
     */
    _replaceTextWithRegex(xmlString, newTexts) {
        try {
            logger.info('    🔧 정규식 기반 텍스트 교체 시작...');
            
            // 1단계: 빈 <hp:run> 태그에 <hp:t> 추가
            // <hp:run ...></hp:run> 또는 <hp:run .../> 형태를 찾아서 <hp:t></hp:t> 추가
            let processedXml = xmlString.replace(/<hp:run([^>]*)\/>/g, '<hp:run$1><hp:t></hp:t></hp:run>');
            processedXml = processedXml.replace(/<hp:run([^>]*)><\/hp:run>/g, '<hp:run$1><hp:t></hp:t></hp:run>');
            
            logger.info('    ✅ 빈 run 태그에 <hp:t> 추가 완료');
            
            // 2단계: 모든 <hp:t> 태그의 텍스트 교체
            const textTagPattern = /<hp:t[^>]*>(.*?)<\/hp:t>/gs;
            
            let textIndex = 0;
            const replacedXml = processedXml.replace(textTagPattern, (match, textContent) => {
                if (textIndex < newTexts.length) {
                    const newText = newTexts[textIndex];
                    // 1. 긴 텍스트에 자동 줄바꿈 추가 (기본값 35자)
                    const textWithBreaks = this.addAutoLineBreaks(newText);
                    // 2. XML 엔티티 변환
                    const escapedText = this.escapeXml(textWithBreaks);
                    
                    if (textIndex < 10) {
                        logger.info(`    [${textIndex}] "${textContent.substring(0, 30)}..." → "${newText.substring(0, 30)}..."`);
                    }
                    
                    textIndex++;
                    // 태그 구조는 유지하고 내용만 교체
                    return match.replace(textContent, escapedText);
                }
                return match;
            });
            
            logger.info(`    ✅ 정규식으로 ${textIndex}개 텍스트 교체 완료`);
            return replacedXml;
            
        } catch (error) {
            logger.error('    ❌ 정규식 교체 실패:', error);
            return xmlString;
        }
    }
    
    /**
     * 원본 XML의 빈 노드 위치에 해당하는 텍스트만 수집
     * @param {Object} section - 섹션 객체 (수정된 문서)
     * @param {string} originalXmlString - 원본 XML 문자열 (이미 <hp:t> 추가된 상태!)
     * @returns {Array<string>} 텍스트 배열
     */
    _collectAllTextsFromSection(section, originalXmlString) {
        const texts = [];
        
        // 원본 XML 파싱 (이미 빈 run에 <hp:t> 추가된 상태)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(originalXmlString, 'text/xml');
        
        // 원본 XML에서 테이블 안(subList)의 모든 텍스트와 빈 노드 위치 파악
        const emptyNodePositions = [];
        const originalSubListTexts = [];  // 원본의 모든 텍스트 (디버깅용)
        
        try {
            const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
            const allTextNodes = xmlDoc.getElementsByTagNameNS(hpNamespace, 't');
            
            let subListIndex = 0;  // subList 내에서의 상대 인덱스
            
            logger.info(`    🔍 === 원본 XML 분석 시작 ===`);
            logger.info(`    🔍 전체 텍스트 노드: ${allTextNodes.length}개`);
            
            for (let i = 0; i < allTextNodes.length; i++) {
                const textNode = allTextNodes[i];
                let parent = textNode.parentNode;
                let isInSubList = false;
                
                // subList 확인
                for (let depth = 0; depth < 10 && parent; depth++) {
                    const tagName = parent.tagName || parent.nodeName;
                    if (tagName === 'hp:subList' || tagName === 'subList') {
                        isInSubList = true;
                        break;
                    }
                    if (tagName === 'hp:sec' || tagName === 'sec' || tagName === 'hs:sec') {
                        break;
                    }
                    parent = parent.parentNode;
                }
                
                const textContent = textNode.textContent || '';
                const preview = textContent.length > 20 ? textContent.substring(0, 20) + '...' : textContent;
                
                // ✅ v2.3.0: 모든 텍스트 노드 처리 (테이블 내외 모두)
                // subList 안에 있는 경우와 밖에 있는 경우 모두 처리
                originalSubListTexts.push(textContent);
                
                if (textContent.trim() === '') {
                    emptyNodePositions.push(subListIndex);  // 상대 위치
                    const location = isInSubList ? '(테이블 내부)' : '(테이블 외부)';
                    logger.info(`    🔍 [원본 ${i}→인덱스 ${subListIndex}] "(빈)" ${location} ← 빈 노드 위치 기록!`);
                } else {
                    const location = isInSubList ? '(테이블 내부)' : '(테이블 외부)';
                    logger.info(`    🔍 [원본 ${i}→인덱스 ${subListIndex}] "${preview}" ${location}`);
                }
                subListIndex++;  // 카운트 증가
            }
            
            logger.info(`    🎯 원본 XML 총 ${subListIndex}개 텍스트 (테이블 내외 모두), ${emptyNodePositions.length}개 빈 노드`);
        } catch (e) {
            logger.warn('    ⚠️ 원본 XML 파싱 실패, 모든 텍스트 수집:', e.message);
        }
        
        // 연속된 빈 노드 필터링 + 위치 조정
        const filteredEmptyPositions = [];
        let removedCount = 0; // 제거된 노드 개수 추적
        
        for (let i = 0; i < emptyNodePositions.length; i++) {
            const currentPos = emptyNodePositions[i];
            const nextPos = emptyNodePositions[i + 1];
            
            // 다음 노드가 연속인지 확인 (currentPos + 1 === nextPos)
            const isConsecutive = nextPos !== undefined && (currentPos + 1 === nextPos);
            
            if (isConsecutive) {
                // 연속된 빈 노드의 경우, 두 번째를 선택 (첫 번째는 헤더 연장일 가능성)
                const adjustedPos = nextPos - (removedCount + 1);  // nextPos 사용, 첫 번째 제거 반영
                filteredEmptyPositions.push(adjustedPos);
                logger.info(`    🔍 연속 빈 노드 발견: [${currentPos}, ${nextPos}] → [${nextPos}] 선택 (첫 번째 제거) → 조정 위치: ${adjustedPos}`);
                removedCount++; // 첫 번째 노드를 제거했으므로 카운트 증가
                i++; // 다음 것은 이미 처리했으므로 건너뛰기
            } else {
                // 연속되지 않은 경우 오프셋 조정 후 선택
                const adjustedPos = currentPos - removedCount;
                filteredEmptyPositions.push(adjustedPos);
            }
        }
        
        logger.info(`    🎯 빈 노드 위치 (원본): [${emptyNodePositions.join(', ')}]`);
        logger.info(`    🎯 빈 노드 위치 (필터링 + 조정 후): [${filteredEmptyPositions.join(', ')}]`);
        logger.info(`    🎯 제거된 노드: ${removedCount}개`);
        
        // 필터링된 위치 사용
        const finalEmptyPositions = filteredEmptyPositions.length > 0 ? filteredEmptyPositions : emptyNodePositions;
        
        // 수정된 문서에서 모든 텍스트를 순서대로 수집
        const allTexts = [];
        const elements = section.elements || [];
        
        logger.info(`    🔍 === 수정된 문서 분석 시작 ===`);
        
        for (const element of elements) {
            // ✅ v2.3.0: 일반 단락도 처리 (테이블 외부)
            if (element.type === 'paragraph') {
                const runs = element.runs || [];
                runs.forEach((run, runIdx) => {
                    // linebreak는 텍스트가 아니므로 제외
                    if (run.type === 'linebreak') return;
                    
                    const text = run.text || '';
                    const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
                    logger.info(`    🔍 [수정 ${allTexts.length}] "${preview}" (일반 단락)`);
                    allTexts.push(text);
                });
            }
            // 테이블 처리
            else if (element.type === 'table') {
                const rows = element.rows || [];
                rows.forEach((row, rowIdx) => {
                    const cells = row.cells || [];
                    cells.forEach((cell, cellIdx) => {
                        const cellElements = cell.elements || [];
                        cellElements.forEach((cellElement, elemIdx) => {
                            if (cellElement.type === 'paragraph') {
                                const runs = cellElement.runs || [];
                                runs.forEach((run, runIdx) => {
                                    const text = run.text || '';
                                    const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
                                    logger.info(`    🔍 [수정 ${allTexts.length}] "${preview}" (테이블 셀)`);
                                    allTexts.push(text);
                                });
                            }
                        });
                    });
                });
            }
        }
        
        logger.info(`    🎯 수정된 문서에서 총 ${allTexts.length}개 텍스트 수집`);
        
        // 빈 노드 위치에 해당하는 텍스트만 선택
        logger.info(`    🔍 === 매칭 시작 ===`);
        
        if (finalEmptyPositions.length > 0 && finalEmptyPositions.length <= allTexts.length) {
            for (let i = 0; i < finalEmptyPositions.length; i++) {
                const pos = finalEmptyPositions[i];
                if (pos < allTexts.length) {
                    const selectedText = allTexts[pos];
                    const preview = selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText;
                    texts.push(selectedText);
                    logger.info(`    🎯 빈 노드 [${i}] ← 위치 [${pos}] "${preview}"`);
                }
            }
            logger.info(`    ✅ ${texts.length}개 텍스트 수집 완료 (빈 노드 위치 기반)`);
        } else {
            // 폴백: 모든 텍스트 수집
            logger.warn(`    ⚠️ 빈 노드 위치 매칭 실패 (빈 노드: ${finalEmptyPositions.length}, 텍스트: ${allTexts.length})`);
            texts.push(...allTexts);
        }
        
        // 처음 15개 텍스트 로그
        if (texts.length > 0) {
            logger.info('    📋 수집된 텍스트 샘플 (처음 15개):');
            for (let i = 0; i < Math.min(15, texts.length); i++) {
                const preview = texts[i].length > 30 ? texts[i].substring(0, 30) + '...' : texts[i];
                logger.info(`      [${i}] "${preview}"`);
            }
        }
        
        return texts;
    }

    /**
     * 단일 section XML 생성
     * @param {Object} section - 섹션 객체
     * @returns {string} section XML 문자열
     */
    _generateSectionXml(section) {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<HWPML xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml">\n`;
        xml += `  <SECTION>\n`;

        // 섹션의 요소들 순회
        const elements = section.elements || [];
        for (const element of elements) {
            if (element.type === 'paragraph') {
                xml += this._generateParagraphXml(element, 4);
            } else if (element.type === 'table') {
                xml += this._generateTableXml(element, 4);
            }
        }

        xml += `  </SECTION>\n`;
        xml += `</HWPML>`;

        return xml;
    }

    /**
     * 문단 XML 생성
     * @param {Object} paragraph - 문단 객체
     * @param {number} indent - 들여쓰기 칸 수
     * @returns {string} 문단 XML
     */
    _generateParagraphXml(paragraph, indent = 0) {
        const indentStr = ' '.repeat(indent);
        const paraShapeId = paragraph.paraShapeId || 0;
        const styleId = paragraph.styleId || 0;

        let xml = `${indentStr}<P ParaShape="${paraShapeId}" Style="${styleId}">\n`;

        // 텍스트 런 생성
        const runs = paragraph.runs || [];
        if (runs.length === 0 && paragraph.text) {
            // 단순 텍스트인 경우 (기본값 35자)
            const textWithBreaks = this.addAutoLineBreaks(paragraph.text);
            xml += `${indentStr}  <TEXT CharShape="0">${this.escapeXml(textWithBreaks)}</TEXT>\n`;
        } else {
            // 런이 있는 경우 (기본값 35자)
            runs.forEach(run => {
                const charShapeId = run.charShapeId || 0;
                const textWithBreaks = this.addAutoLineBreaks(run.text || '');
                xml += `${indentStr}  <TEXT CharShape="${charShapeId}">${this.escapeXml(textWithBreaks)}</TEXT>\n`;
            });
        }

        xml += `${indentStr}</P>\n`;

        return xml;
    }

    /**
     * 테이블 XML 생성
     * @param {Object} table - 테이블 객체
     * @param {number} indent - 들여쓰기 칸 수
     * @returns {string} 테이블 XML
     */
    _generateTableXml(table, indent = 0) {
        const indentStr = ' '.repeat(indent);
        const rows = table.rows || [];
        const cols = table.cols || (rows[0]?.cells?.length || 1);

        let xml = `${indentStr}<TABLE>\n`;
        xml += `${indentStr}  <SHAPEOBJECT>\n`;
        xml += `${indentStr}    <TABLE Id="${table.id || 0}" TreatAsChar="0" Lock="0" Width="60000" Height="0" ZOrder="0" NumberingType="1" TextWrap="0" TextFlow="0" InstId="${Date.now()}">\n`;
        xml += `${indentStr}      <TABLEFORMAT ColCount="${cols}" RowCount="${rows.length}">\n`;

        // 열 정의
        for (let i = 0; i < cols; i++) {
            const width = Math.floor(60000 / cols);
            xml += `${indentStr}        <COLDEF Width="${width}"/>\n`;
        }

        // 행 생성
        rows.forEach((row, rowIdx) => {
            xml += `${indentStr}        <ROW>\n`;

            const cells = row.cells || [];
            cells.forEach((cell, cellIdx) => {
                const colSpan = cell.colSpan || 1;
                const rowSpan = cell.rowSpan || 1;

                xml += `${indentStr}          <CELL ColAddr="${cellIdx}" RowAddr="${rowIdx}" ColSpan="${colSpan}" RowSpan="${rowSpan}">\n`;
                xml += `${indentStr}            <CELLPROPERTY>\n`;
                xml += `${indentStr}              <CELLBORDER Left="1" Right="1" Top="1" Bottom="1"/>\n`;
                xml += `${indentStr}            </CELLPROPERTY>\n`;
                xml += `${indentStr}            <SUBLIST>\n`;

                // 셀 내용 (문단들)
                const cellElements = cell.elements || [];
                if (cellElements.length === 0) {
                    // 빈 셀
                    xml += `${indentStr}              <P ParaShape="0" Style="0">\n`;
                    xml += `${indentStr}                <TEXT CharShape="0"></TEXT>\n`;
                    xml += `${indentStr}              </P>\n`;
                } else {
                    cellElements.forEach(element => {
                        if (element.type === 'paragraph') {
                            xml += this._generateParagraphXml(element, indent + 14);
                        }
                    });
                }

                xml += `${indentStr}            </SUBLIST>\n`;
                xml += `${indentStr}          </CELL>\n`;
            });

            xml += `${indentStr}        </ROW>\n`;
        });

        xml += `${indentStr}      </TABLEFORMAT>\n`;
        xml += `${indentStr}    </TABLE>\n`;
        xml += `${indentStr}  </SHAPEOBJECT>\n`;
        xml += `${indentStr}</TABLE>\n`;

        return xml;
    }

    /**
     * 긴 텍스트에 자동 줄바꿈 추가 (한글 텍스트 최적화)
     * @param {string} text - 원본 텍스트
     * @param {number} maxLineLength - 최대 줄 길이 (기본값: 35자)
     * @returns {string} 줄바꿈이 추가된 텍스트
     */
    addAutoLineBreaks(text, maxLineLength = 35) {
        if (typeof text !== 'string' || text.length <= maxLineLength) {
            return text;
        }
        
        // ⚠️ 중요: 이미 구조화된 텍스트는 이미 줄바꿈이 있으므로 건드리지 않기!
        // GPT가 만든 구조화된 텍스트는 이미 \n을 포함하고 있음
        if (text.includes('\n')) {
            logger.debug(`    ✅ 이미 줄바꿈 포함 - 자동 줄바꿈 건너뛰기: "${text.substring(0, 30)}..."`);
            return text;
        }
        
        logger.debug(`    📏 자동 줄바꿈 처리: "${text.substring(0, 30)}..." (${text.length}자)`);
        
        // 이미 줄바꿈이 있으면 각 줄을 개별 처리
        const lines = text.split('\n');
        const processedLines = lines.map(line => {
            if (line.length <= maxLineLength) {
                return line;
            }
            
            // 긴 줄을 적절한 위치에서 분리
            const result = [];
            let remaining = line;
            let loopCount = 0; // 무한 루프 방지
            
            while (remaining.length > maxLineLength && loopCount < 20) {
                loopCount++;
                let breakPoint = -1;
                
                // 우선순위 1: 마침표 뒤 (공백 있든 없든)
                let periodIndex = remaining.substring(0, maxLineLength).lastIndexOf('.');
                if (periodIndex > maxLineLength * 0.4 && periodIndex !== -1) {
                    breakPoint = periodIndex + 1;
                }
                
                // 우선순위 2: 쉼표 뒤 (공백 있든 없든)
                if (breakPoint === -1) {
                    let commaIndex = remaining.substring(0, maxLineLength).lastIndexOf(',');
                    if (commaIndex > maxLineLength * 0.4 && commaIndex !== -1) {
                        breakPoint = commaIndex + 1;
                    }
                }
                
                // 우선순위 3: 공백
                if (breakPoint === -1) {
                    let spaceIndex = remaining.substring(0, maxLineLength).lastIndexOf(' ');
                    if (spaceIndex > maxLineLength * 0.3 && spaceIndex !== -1) {
                        breakPoint = spaceIndex + 1;
                    }
                }
                
                // 우선순위 4: 괄호 닫기 뒤
                if (breakPoint === -1) {
                    const parenIndex = remaining.substring(0, maxLineLength).lastIndexOf(')');
                    if (parenIndex > maxLineLength * 0.4 && parenIndex !== -1) {
                        breakPoint = parenIndex + 1;
                    }
                }
                
                // 우선순위 5: 강제 분리 (한글 텍스트 고려)
                if (breakPoint === -1 || breakPoint === 0) {
                    breakPoint = Math.min(maxLineLength, remaining.length);
                }
                
                const chunk = remaining.substring(0, breakPoint).trim();
                if (chunk.length > 0) {
                    result.push(chunk);
                }
                remaining = remaining.substring(breakPoint).trim();
            }
            
            // 남은 텍스트 추가
            if (remaining.length > 0) {
                result.push(remaining);
            }
            
            const lineBreaks = result.length - 1;
            if (lineBreaks > 0) {
                logger.debug(`    ✂️ ${result.length}줄로 분리 (${lineBreaks}개 줄바꿈 추가)`);
            }
            
            return result.join('\n');
        });
        
        const finalText = processedLines.join('\n');
        const totalLineBreaks = (finalText.match(/\n/g) || []).length;
        if (totalLineBreaks > 0) {
            logger.info(`    ✂️ 줄바꿈 추가: ${totalLineBreaks}개 (${text.length}자 → ${finalText.length}자)`);
        }
        
        return finalText;
    }

    /**
     * XML 이스케이프 처리
     * @param {string} text - 이스케이프할 텍스트
     * @returns {string} 이스케이프된 텍스트
     */
    escapeXml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        
        // XML 텍스트 컨텐츠에 필수적인 엔티티만 이스케이프
        // 작은따옴표(')와 큰따옴표(")는 XML 속성값이 아닌 텍스트 컨텐츠에서는 이스케이프 불필요
        // 줄바꿈(\n)은 그대로 유지 - HWPX에서 실제 개행 문자로 처리됨
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
            // ", ', \n은 변환하지 않음!
    }

    /**
     * Section XML에 자동 줄바꿈 속성 추가 (DOM 파싱 사용)
     * @param {string} sectionXml - 원본 section XML 문자열
     * @returns {string} 수정된 section XML 문자열
     * @private
     */
    _addLineWrapAttributes(sectionXml) {
        try {
            logger.info('  🔧 자동 줄바꿈 속성 추가 중 (DOM 파싱)...');
            
            const parser = new DOMParser();
            const sectionDoc = parser.parseFromString(sectionXml, 'text/xml');
            
            const parseError = sectionDoc.querySelector('parsererror');
            if (parseError) {
                logger.error('  ❌ section XML 파싱 오류:', parseError.textContent);
                return sectionXml;
            }
            
            const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
            
            // 1. 모든 subList에 lineWrap="BREAK" 설정
            let subListNodes = sectionDoc.getElementsByTagNameNS(hpNamespace, 'subList');
            if (subListNodes.length === 0) {
                subListNodes = sectionDoc.getElementsByTagName('hp:subList');
            }
            
            let modifiedSubListCount = 0;
            for (let i = 0; i < subListNodes.length; i++) {
                const subList = subListNodes[i];
                // 기존 lineWrap 값에 관계없이 BREAK로 설정
                subList.setAttribute('lineWrap', 'BREAK');
                modifiedSubListCount++;
            }
            
            // 2. 셀 내부의 모든 paragraph에 자동 줄바꿈 속성 추가
            let paragraphNodes = sectionDoc.getElementsByTagNameNS(hpNamespace, 'p');
            if (paragraphNodes.length === 0) {
                paragraphNodes = sectionDoc.getElementsByTagName('hp:p');
            }
            
            let modifiedParagraphCount = 0;
            for (let i = 0; i < paragraphNodes.length; i++) {
                const p = paragraphNodes[i];
                
                // 테이블 셀 내부인지 확인
                let parent = p.parentNode;
                let isInCell = false;
                while (parent) {
                    if (parent.tagName === 'hp:subList' || parent.localName === 'subList') {
                        isInCell = true;
                        break;
                    }
                    parent = parent.parentNode;
                }
                
                if (isInCell) {
                    // ✅ 자동 줄바꿈 관련 모든 속성 추가
                    p.setAttribute('autoLineBreak', '1');
                    p.setAttribute('wordWrap', 'BREAK');
                    p.setAttribute('lineWrap', 'BREAK');  // paragraph 레벨에도 추가
                    
                    // paraPrIDRef 확인 및 수정
                    const paraPrIDRef = p.getAttribute('paraPrIDRef');
                    if (paraPrIDRef) {
                        // paraPr 참조를 가지고 있으면 나중에 header.xml에서도 수정 필요
                        logger.debug(`    🔍 Paragraph has paraPrIDRef="${paraPrIDRef}"`);
                    }
                    
                    modifiedParagraphCount++;
                }
            }
            
            // 3. 🔥 핵심: 모든 linesegarray 제거!
            // linesegarray는 이전 레이아웃 계산 정보를 담고 있어,
            // 텍스트가 변경되면 한글이 잘못된 정보를 사용하여 줄바꿈이 안 됨
            let removedLinesegCount = 0;
            
            // XPath로 모든 linesegarray 요소 찾기
            const xpathResult = sectionDoc.evaluate(
                '//*[local-name()="linesegarray"]',
                sectionDoc,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );
            
            // 찾은 모든 linesegarray 제거 (역순으로 제거해야 안전)
            const linesegNodes = [];
            for (let i = 0; i < xpathResult.snapshotLength; i++) {
                linesegNodes.push(xpathResult.snapshotItem(i));
            }
            
            linesegNodes.forEach(lsa => {
                if (lsa.parentNode) {
                    lsa.parentNode.removeChild(lsa);
                    removedLinesegCount++;
                }
            });
            
            logger.info(`  ✅ 자동 줄바꿈 속성 추가 완료: subList ${modifiedSubListCount}개, paragraph ${modifiedParagraphCount}개, linesegarray ${removedLinesegCount}개 제거`);
            
            // 수정된 XML 반환
            const serializer = new XMLSerializer();
            return serializer.serializeToString(sectionDoc);
            
        } catch (error) {
            logger.error('  ❌ 자동 줄바꿈 속성 추가 실패:', error);
            return sectionXml; // 실패 시 원본 반환
        }
    }

    /**
     * header.xml의 paraPr 속성 수정 ("한 줄로 입력" 해제)
     * @param {JSZip} zip - HWPX ZIP 객체
     */
    async _fixHeaderParaPr(zip) {
        try {
            const headerFile = zip.file('Contents/header.xml');
            if (!headerFile) {
                logger.warn('  ⚠️  header.xml을 찾을 수 없습니다');
                return;
            }
            
            const headerXml = await headerFile.async('string');
            logger.info('  📝 header.xml 읽기 완료');
            
            // DOMParser로 header.xml 파싱
            const parser = new DOMParser();
            const headerDoc = parser.parseFromString(headerXml, 'text/xml');
            
            // 파싱 오류 확인
            const parseError = headerDoc.querySelector('parsererror');
            if (parseError) {
                logger.error('  ❌ header.xml 파싱 오류:', parseError.textContent);
                return;
            }
            
            // paraPr 태그 찾기 (모든 네임스페이스 시도)
            let paraPrNodes = [];
            
            // 1. head 네임스페이스 (가장 가능성 높음)
            const hhNamespace = 'http://www.hancom.co.kr/hwpml/2011/head';
            paraPrNodes = Array.from(headerDoc.getElementsByTagNameNS(hhNamespace, 'paraPr'));
            
            // 2. paragraph 네임스페이스
            if (paraPrNodes.length === 0) {
                const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
                paraPrNodes = Array.from(headerDoc.getElementsByTagNameNS(hpNamespace, 'paraPr'));
            }
            
            // 3. 네임스페이스 프리픽스로 시도
            if (paraPrNodes.length === 0) {
                paraPrNodes = Array.from(headerDoc.getElementsByTagName('hh:paraPr'));
            }
            if (paraPrNodes.length === 0) {
                paraPrNodes = Array.from(headerDoc.getElementsByTagName('hp:paraPr'));
            }
            
            // 4. 네임스페이스 없이 시도
            if (paraPrNodes.length === 0) {
                paraPrNodes = Array.from(headerDoc.getElementsByTagName('paraPr'));
            }
            
            // 5. XPath로 모든 paraPr 요소 찾기 (최후의 수단)
            if (paraPrNodes.length === 0) {
                const xpathResult = headerDoc.evaluate(
                    '//*[local-name()="paraPr"]',
                    headerDoc,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );
                for (let i = 0; i < xpathResult.snapshotLength; i++) {
                    paraPrNodes.push(xpathResult.snapshotItem(i));
                }
            }
            
            logger.info(`  🔍 발견된 paraPr: ${paraPrNodes.length}개`);
            
            let modifiedCount = 0;
            
            for (let i = 0; i < paraPrNodes.length; i++) {
                const paraPr = paraPrNodes[i];
                
                // 기존 속성 확인
                const lineBreak = paraPr.getAttribute('lineBreak');
                const lineWrap = paraPr.getAttribute('lineWrap');
                const wordWrap = paraPr.getAttribute('wordWrap');
                
                // "한 줄로 입력" 해제 속성 설정
                let modified = false;
                
                // lineBreak: "KEEP_ALL" → 제거
                if (lineBreak === 'KEEP_ALL') {
                    paraPr.removeAttribute('lineBreak');
                    modified = true;
                    logger.debug(`    🔧 paraPr[${i}]: lineBreak="KEEP_ALL" 제거`);
                }
                
                // lineWrap: BREAK 설정
                if (!lineWrap || lineWrap === 'NONE') {
                    paraPr.setAttribute('lineWrap', 'BREAK');
                    modified = true;
                    logger.debug(`    🔧 paraPr[${i}]: lineWrap="BREAK" 설정`);
                }
                
                // ✅ wordWrap: BREAK 설정 (단어 단위 줄바꿈)
                if (!wordWrap || wordWrap === 'NONE') {
                    paraPr.setAttribute('wordWrap', 'BREAK');
                    modified = true;
                    logger.debug(`    🔧 paraPr[${i}]: wordWrap="BREAK" 설정`);
                }
                
                if (modified) {
                    modifiedCount++;
                }
            }
            
            if (modifiedCount > 0) {
                // 수정된 header.xml을 문자열로 변환
                const serializer = new XMLSerializer();
                const modifiedHeaderXml = serializer.serializeToString(headerDoc);
                
                // ZIP에 업데이트
                zip.file('Contents/header.xml', modifiedHeaderXml);
                logger.info(`  ✅ header.xml 수정 완료: ${modifiedCount}개 paraPr 업데이트`);
            } else {
                logger.info('  ✅ header.xml 수정 불필요 (이미 올바른 설정)');
            }
            
        } catch (error) {
            logger.error('  ❌ header.xml 수정 실패:', error);
            // 실패해도 계속 진행 (원본 header.xml 유지)
        }
    }
    
    /**
     * section XML의 테이블 셀 속성 수정 (자동 줄바꿈 활성화)
     * @param {JSZip} zip - HWPX ZIP 객체
     */
    async _fixSectionCellProperties(zip) {
        try {
            const sectionFiles = [];
            zip.forEach((relativePath, file) => {
                if (relativePath.startsWith('Contents/section') && relativePath.endsWith('.xml')) {
                    sectionFiles.push({ path: relativePath, file });
                }
            });
            
            if (sectionFiles.length === 0) {
                logger.warn('  ⚠️  section XML 파일을 찾을 수 없습니다');
                return;
            }
            
            logger.info(`  📝 ${sectionFiles.length}개 section XML 파일 처리 중...`);
            
            for (const { path, file } of sectionFiles) {
                const sectionXml = await file.async('string');
                
                // DOMParser로 section XML 파싱
                const parser = new DOMParser();
                const sectionDoc = parser.parseFromString(sectionXml, 'text/xml');
                
                // 파싱 오류 확인
                const parseError = sectionDoc.querySelector('parsererror');
                if (parseError) {
                    logger.error(`  ❌ ${path} 파싱 오류:`, parseError.textContent);
                    continue;
                }
                
                const hpNamespace = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
                
                // 1. 모든 subList 찾기 (테이블 셀 내부)
                let subListNodes = sectionDoc.getElementsByTagNameNS(hpNamespace, 'subList');
                if (subListNodes.length === 0) {
                    subListNodes = sectionDoc.getElementsByTagName('hp:subList');
                }
                
                let modifiedSubListCount = 0;
                
                for (let i = 0; i < subListNodes.length; i++) {
                    const subList = subListNodes[i];
                    
                    // lineWrap 속성 확인 및 설정
                    const lineWrap = subList.getAttribute('lineWrap');
                    if (!lineWrap || lineWrap === 'NONE') {
                        subList.setAttribute('lineWrap', 'BREAK');
                        modifiedSubListCount++;
                    }
                }
                
                // 2. 모든 단락(<hp:p>) 찾기
                let paragraphNodes = sectionDoc.getElementsByTagNameNS(hpNamespace, 'p');
                if (paragraphNodes.length === 0) {
                    paragraphNodes = sectionDoc.getElementsByTagName('hp:p');
                }
                
                let modifiedParagraphCount = 0;
                let removedLinesegCount = 0;
                
                for (let i = 0; i < paragraphNodes.length; i++) {
                    const p = paragraphNodes[i];
                    
                    // 테이블 셀 내부의 단락인지 확인
                    let parent = p.parentNode;
                    let isInCell = false;
                    while (parent) {
                        if (parent.tagName === 'hp:subList' || parent.localName === 'subList') {
                            isInCell = true;
                            break;
                        }
                        parent = parent.parentNode;
                    }
                    
                    if (isInCell) {
                        // 단락에 autoLineBreak 속성 추가 (있으면 유지)
                        if (!p.hasAttribute('autoLineBreak')) {
                            p.setAttribute('autoLineBreak', '1');
                            modifiedParagraphCount++;
                        }
                    }
                    
                    // 🔥 핵심 수정: linesegarray 제거 (모든 단락에서)
                    // linesegarray는 이전 레이아웃 계산 정보를 담고 있어,
                    // 텍스트가 변경되면 한글이 잘못된 정보를 사용하여 줄바꿈이 안 됨
                    const linesegArrays = p.querySelectorAll('hp\\:linesegarray, linesegarray');
                    linesegArrays.forEach(lsa => {
                        lsa.parentNode.removeChild(lsa);
                        removedLinesegCount++;
                    });
                }
                
                if (modifiedSubListCount > 0 || modifiedParagraphCount > 0 || removedLinesegCount > 0) {
                    // 수정된 section XML을 문자열로 변환
                    const serializer = new XMLSerializer();
                    const modifiedSectionXml = serializer.serializeToString(sectionDoc);
                    
                    // ZIP에 업데이트
                    zip.file(path, modifiedSectionXml);
                    logger.info(`  ✅ ${path} 수정 완료: subList ${modifiedSubListCount}개, 단락 ${modifiedParagraphCount}개, linesegarray ${removedLinesegCount}개 제거`);
                } else {
                    logger.info(`  ✅ ${path} 수정 불필요`);
                }
            }
            
        } catch (error) {
            logger.error('  ❌ section XML 수정 실패:', error);
            // 실패해도 계속 진행 (원본 유지)
        }
    }
    
    /**
     * Blob을 파일로 다운로드
     * @param {Blob} blob - 다운로드할 Blob
     * @param {string} filename - 파일명
     */
    downloadBlob(blob, filename) {
        // 파일명에 .hwpx 확장자가 없으면 추가
        if (!filename.toLowerCase().endsWith('.hwpx')) {
            filename += '.hwpx';
        }

        // 다운로드 링크 생성
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        // DOM에 추가하고 클릭
        document.body.appendChild(link);
        link.click();

        // 정리
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        logger.info(`📥 다운로드 시작: ${filename}`);
    }
}

export default HwpxSafeExporter;


