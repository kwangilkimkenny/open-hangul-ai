/**
 * Parser Web Worker - High Performance Edition (v3.0)
 *
 * Uses the same SimpleHWPXParser as the main thread for full feature parity.
 * Runs in background to prevent UI blocking.
 */

import { SimpleHWPXParser } from '../core/parser.js';

/**
 * Worker message handler
 */
self.addEventListener('message', async (event) => {
    const { type, payload, id } = event.data;

    try {
        switch (type) {
        case 'PARSE_HWPX':
            await parseHWPX(payload.buffer, id);
            break;

        case 'CANCEL':
            self.postMessage({ type: 'CANCELLED', id });
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
 * HWPX file parsing using full SimpleHWPXParser
 * @param {ArrayBuffer} buffer - HWPX file buffer
 * @param {string} id - Request ID
 */
async function parseHWPX(buffer, id) {
    const startTime = performance.now();

    sendProgress(id, 0, 'ZIP 압축 해제 중...');

    const parser = new SimpleHWPXParser({
        parseImages: true,
        parseTables: true,
        parseStyles: true
    });

    sendProgress(id, 10, '파서 초기화 완료...');

    // Hook into parser phases for progress reporting
    const originalUnzip = parser.unzip.bind(parser);
    parser.unzip = async function(buf) {
        sendProgress(id, 15, 'ZIP 압축 해제 중...');
        const result = await originalUnzip(buf);
        sendProgress(id, 30, 'ZIP 압축 해제 완료');
        return result;
    };

    const originalLoadBinData = parser.loadBinData.bind(parser);
    parser.loadBinData = async function() {
        sendProgress(id, 35, '이미지 로딩 중...');
        const result = await originalLoadBinData();
        sendProgress(id, 45, '이미지 로딩 완료');
        return result;
    };

    const originalLoadHeader = parser.loadHeaderDefinitions.bind(parser);
    parser.loadHeaderDefinitions = async function() {
        sendProgress(id, 50, '스타일 정의 파싱 중...');
        const result = await originalLoadHeader();
        sendProgress(id, 65, '스타일 정의 파싱 완료');
        return result;
    };

    const originalParseContent = parser.parseContent.bind(parser);
    parser.parseContent = async function() {
        sendProgress(id, 70, '문서 내용 파싱 중...');
        const result = await originalParseContent();
        sendProgress(id, 90, '문서 내용 파싱 완료');
        return result;
    };

    // Run full parse
    const document = await parser.parse(buffer);

    // Images: convert from Map to serializable array (Worker can't transfer Maps with blob URLs)
    // The main thread will need to recreate blob URLs from the raw image data
    const images = [];
    for (const [path, data] of parser.entries) {
        if (path.startsWith('BinData/')) {
            const ext = path.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'png': 'image/png', 'gif': 'image/gif',
                'bmp': 'image/bmp', 'svg': 'image/svg+xml',
                'webp': 'image/webp'
            };

            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            const filename = path.split('/').pop();
            const imageId = filename.replace(/\.[^.]+$/, '');

            images.push({
                id: imageId,
                path,
                mimeType,
                data: Array.from(data),
                size: data.length
            });
        }
    }

    sendProgress(id, 95, '최종 처리 중...');

    // Build serializable result
    const result = {
        sections: document.sections,
        images,
        borderFills: Object.fromEntries(document.borderFills || new Map()),
        rawHeaderXml: document.rawHeaderXml,
        metadata: {
            ...document.metadata,
            parseTime: performance.now() - startTime,
            workerParsed: true
        }
    };

    sendProgress(id, 100, '완료!');

    self.postMessage({
        type: 'PARSE_COMPLETE',
        id,
        result
    });
}

/**
 * Progress reporting
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
self.postMessage({ type: 'READY' });
