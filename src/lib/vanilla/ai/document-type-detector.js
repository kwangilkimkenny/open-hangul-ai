/**
 * Document Type Detector
 * 문서 유형을 로컬 키워드 매칭으로 자동 감지 (GPT 호출 없음)
 *
 * @module ai/document-type-detector
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 문서 유형 정의 및 감지 패턴
 */
const DOCUMENT_TYPE_PATTERNS = {
    '보고서': {
        headerKeywords: ['추진배경', '현황', '문제점', '추진방안', '추진내용', '기대효과', '향후계획', '추진경과', '추진실적', '성과'],
        contentKeywords: ['추진하고자', '보고드리', '검토한 결과', '분석 결과', '조치 사항'],
        weight: 1.0,
    },
    '공문': {
        headerKeywords: ['수신', '발신', '참조', '제목', '시행일', '문서번호', '경유'],
        contentKeywords: ['관련:', '알려드립니다', '협조하여 주시기', '통보합니다', '시행'],
        weight: 1.2,
    },
    '회의록': {
        headerKeywords: ['참석자', '안건', '결정사항', '회의일시', '회의장소', '논의사항', '불참자', '회의명', '토의내용'],
        contentKeywords: ['회의를 개최', '논의하였', '의결하였', '합의하였', '참석하여'],
        weight: 1.0,
    },
    '설명자료': {
        headerKeywords: ['개요', '목적', '필요성', '주요내용', '세부내용', '문의처', '참고사항', '붙임'],
        contentKeywords: ['설명드리', '안내드리', '참고하시기', '문의하시기'],
        weight: 0.9,
    },
    '정책문서': {
        headerKeywords: ['정책목표', '비전', '전략', '중점과제', '실행계획', '이행방안', '정책방향', '제도개선', '법적근거'],
        contentKeywords: ['정책을 수립', '제도를 개선', '법률에 따라', '시행령', '고시'],
        weight: 1.0,
    },
    '사업계획서': {
        headerKeywords: ['사업개요', '사업명', '사업목적', '사업기간', '소요예산', '기대성과', '목표시장', '수익모델', '투자계획'],
        contentKeywords: ['사업을 추진', '예산을 확보', '투자 유치', '매출 목표'],
        weight: 0.9,
    },
    '양식': {
        headerKeywords: ['성명', '생년월일', '주소', '연락처', '소속', '직위', '서명', '날인', '신청인'],
        contentKeywords: [],
        weight: 0.8,
        specialRule: (stats) => stats.emptyRatio > 0.5,
    },
};

/**
 * 문서 유형 자동 감지기
 */
export class DocumentTypeDetector {
    /**
     * 문서 유형을 감지합니다
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍 배열
     * @returns {{ type: string, confidence: number, scores: Object, stats: Object }}
     */
    detect(headerContentPairs) {
        logger.info('🔍 Detecting document type...');

        if (!headerContentPairs || headerContentPairs.length === 0) {
            return { type: '알수없음', confidence: 0, scores: {}, stats: {} };
        }

        const headers = headerContentPairs.map(p => p.header || '');
        const contents = headerContentPairs.map(p => p.content || '');
        const allText = [...headers, ...contents].join(' ');

        const stats = {
            totalPairs: headerContentPairs.length,
            emptyCount: headerContentPairs.filter(p => p.isEmpty || !p.content?.trim()).length,
            emptyRatio: 0,
        };
        stats.emptyRatio = stats.totalPairs > 0 ? stats.emptyCount / stats.totalPairs : 0;

        const scores = {};

        for (const [typeName, pattern] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
            let score = 0;

            // 헤더 키워드 매칭
            for (const keyword of pattern.headerKeywords) {
                const matched = headers.some(h => h.includes(keyword));
                if (matched) score += 10;
            }

            // 내용 키워드 매칭
            for (const keyword of pattern.contentKeywords) {
                if (allText.includes(keyword)) score += 5;
            }

            // 특수 규칙 적용
            if (pattern.specialRule && pattern.specialRule(stats)) {
                score += 15;
            }

            // 가중치 적용
            score *= pattern.weight;

            scores[typeName] = Math.round(score * 10) / 10;
        }

        // 최고 점수 유형 선택
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const [bestType, bestScore] = sorted[0];
        const [secondType, secondScore] = sorted.length > 1 ? sorted[1] : [null, 0];

        // confidence 계산: 최고점 대비 상대적 우위
        let confidence = 0;
        if (bestScore > 0) {
            const maxPossible = Math.max(...Object.values(DOCUMENT_TYPE_PATTERNS).map(p =>
                (p.headerKeywords.length * 10 + p.contentKeywords.length * 5) * p.weight
            ));
            confidence = Math.min(bestScore / maxPossible * 2, 1.0); // 절반 이상 매칭이면 1.0
            // 2위와 격차가 작으면 confidence 감소
            if (secondScore > 0 && bestScore - secondScore < 10) {
                confidence *= 0.7;
            }
        }

        const result = {
            type: bestScore > 0 ? bestType : '알수없음',
            confidence: Math.round(confidence * 100) / 100,
            scores,
            stats,
        };

        logger.info(`🔍 Detected: ${result.type} (confidence: ${result.confidence})`);
        return result;
    }

    /**
     * 지원되는 문서 유형 목록 반환
     * @returns {string[]}
     */
    getSupportedTypes() {
        return Object.keys(DOCUMENT_TYPE_PATTERNS);
    }
}

export default DocumentTypeDetector;
