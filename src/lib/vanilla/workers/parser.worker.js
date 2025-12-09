/**
 * Parser Web Worker
 * 백그라운드에서 HWPX 파일 파싱을 수행하여 UI 블로킹 방지
 */

// JSZip import (worker context)
importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

/**
 * Worker 메시지 핸들러
 */
self.addEventListener('message', async (event) => {
    const { type, payload, id } = event.data;

    try {
        switch (type) {
        case 'PARSE_HWPX':
            await parseHWPX(payload.buffer, id);
            break;
            
        case 'CANCEL':
            // 파싱 취소 (구현 예정)
            self.postMessage({
                type: 'CANCELLED',
                id
            });
            break;
            
        default:
            throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            id,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

/**
 * HWPX 파일 파싱
 * @param {ArrayBuffer} buffer - HWPX 파일 버퍼
 * @param {string} id - 요청 ID
 */
async function parseHWPX(buffer, id) {
    const startTime = performance.now();

    // Progress 전송
    sendProgress(id, 0, 'ZIP 압축 해제 중...');

    // 1. Unzip
    const zip = new JSZip();
    const zipData = await zip.loadAsync(buffer);
    const entries = {};

    const files = Object.keys(zipData.files);
    let processedFiles = 0;

    for (const path of files) {
        const zipEntry = zipData.files[path];
        if (!zipEntry.dir) {
            const data = await zipEntry.async('uint8array');
            entries[path] = Array.from(data); // Convert to regular array for transfer
            
            processedFiles++;
            const progress = (processedFiles / files.length) * 30; // 30% for unzipping
            sendProgress(id, progress, `파일 추출 중... (${processedFiles}/${files.length})`);
        }
    }

    sendProgress(id, 35, '이미지 로딩 중...');

    // 2. Load images
    const images = [];
    for (const [path, data] of Object.entries(entries)) {
        if (path.startsWith('BinData/')) {
            const ext = path.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp'
            };
            
            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            const filename = path.split('/').pop();
            const imageId = filename.replace(/\.[^.]+$/, '');
            
            images.push({
                id: imageId,
                path,
                mimeType,
                data, // Array of bytes
                size: data.length
            });
        }
    }

    sendProgress(id, 50, '문서 구조 파싱 중...');

    // 3. Parse content
    const sections = [];
    const sectionFiles = Object.keys(entries)
        .filter(path => path.match(/Contents\/section\d+\.xml/))
        .sort();

    for (let i = 0; i < sectionFiles.length; i++) {
        const sectionPath = sectionFiles[i];
        const sectionData = entries[sectionPath];
        
        if (sectionData) {
            const sectionXml = new TextDecoder('utf-8').decode(new Uint8Array(sectionData));
            const section = parseSection(sectionXml);
            sections.push(section);
            
            const progress = 50 + (i / sectionFiles.length) * 40; // 50-90%
            sendProgress(id, progress, `섹션 파싱 중... (${i + 1}/${sectionFiles.length})`);
        }
    }

    sendProgress(id, 95, '최종 처리 중...');

    // 4. Build document
    const document = {
        sections,
        images,
        metadata: {
            parsedAt: new Date().toISOString(),
            sectionsCount: sections.length,
            imagesCount: images.length,
            parseTime: performance.now() - startTime
        }
    };

    sendProgress(id, 100, '완료!');

    // Send result
    self.postMessage({
        type: 'PARSE_COMPLETE',
        id,
        result: document
    });
}

/**
 * 섹션 파싱 (간단한 구현)
 * @param {string} xmlString - XML 문자열
 * @returns {Object} 파싱된 섹션
 */
function parseSection(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    const section = {
        elements: []
    };

    // Parse paragraphs
    const paragraphs = doc.querySelectorAll('p, hp\\:p');
    paragraphs.forEach(pElem => {
        const para = parseParagraph(pElem);
        if (para) {
            section.elements.push(para);
        }
    });

    // Parse tables
    const tables = doc.querySelectorAll('tbl, hp\\:tbl');
    tables.forEach(tblElem => {
        const table = parseTable(tblElem);
        if (table) {
            section.elements.push(table);
        }
    });

    return section;
}

/**
 * 단락 파싱
 */
function parseParagraph(pElem) {
    const runs = pElem.querySelectorAll('t, hp\\:t');
    if (runs.length === 0) {
        return null;
    }

    const para = {
        type: 'paragraph',
        runs: []
    };

    runs.forEach(tElem => {
        para.runs.push({
            text: tElem.textContent || '',
            charPrIDRef: tElem.getAttribute('charPrIDRef')
        });
    });

    return para;
}

/**
 * 테이블 파싱
 */
function parseTable(tblElem) {
    const rows = tblElem.querySelectorAll('tr, hp\\:tr');
    if (rows.length === 0) {
        return null;
    }

    const table = {
        type: 'table',
        rows: []
    };

    rows.forEach(trElem => {
        const row = { cells: [] };
        const cells = trElem.querySelectorAll('tc, hp\\:tc');
        
        cells.forEach(tcElem => {
            const cell = { elements: [] };
            const paras = tcElem.querySelectorAll('p, hp\\:p');
            
            paras.forEach(pElem => {
                const para = parseParagraph(pElem);
                if (para) {
                    cell.elements.push(para);
                }
            });
            
            row.cells.push(cell);
        });
        
        table.rows.push(row);
    });

    return table;
}

/**
 * Progress 전송
 */
function sendProgress(id, percent, message) {
    self.postMessage({
        type: 'PROGRESS',
        id,
        progress: {
            percent: Math.min(100, Math.max(0, percent)),
            message
        }
    });
}

// Worker ready
self.postMessage({
    type: 'READY'
});

