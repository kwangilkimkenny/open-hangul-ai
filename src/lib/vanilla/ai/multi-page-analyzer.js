/**
 * Multi-Page Analyzer
 * 다중 페이지 문서의 전체 구조와 페이지 간 관계 분석
 * 
 * @module ai/multi-page-analyzer
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { PageClassifier } from './page-classifier.js';

const logger = getLogger();

/**
 * 다중 페이지 분석기
 * 문서 전체의 구조, 페이지 유형, 페이지 간 관계를 종합 분석
 */
export class MultiPageAnalyzer {
    constructor() {
        this.classifier = new PageClassifier();
        logger.info('📊 MultiPageAnalyzer initialized');
    }

    /**
     * 전체 문서 분석
     * @param {Object} document - HWPX 문서 객체
     * @returns {Object} 문서 분석 결과
     */
    analyzeDocument(document) {
        logger.info('📊 Analyzing multi-page document...');

        const sections = document.sections || [];
        const totalPages = sections.length;

        const analysis = {
            totalPages,
            pages: [],
            documentType: null,
            overallTheme: null,
            relationships: [],
            strategy: null
        };

        // 단일 페이지 문서
        if (totalPages === 1) {
            logger.info('  ℹ️ Single-page document detected');
            analysis.documentType = '단일 페이지 문서';
            analysis.strategy = 'single-page';
            
            const pageAnalysis = this.classifier.classifyPage(sections[0], 0, 1);
            analysis.pages.push(pageAnalysis);
            
            return analysis;
        }

        // 각 페이지 분석
        logger.info(`  📄 Analyzing ${totalPages} pages...`);
        sections.forEach((section, index) => {
            const pageAnalysis = this.classifier.classifyPage(section, index, totalPages);
            analysis.pages.push(pageAnalysis);
            logger.debug(`    ${this.classifier.describeClassification(pageAnalysis)}`);
        });

        // 문서 전체 유형 판정
        analysis.documentType = this.inferDocumentType(analysis.pages);
        logger.info(`  📋 Document type: ${analysis.documentType}`);

        // 페이지 간 관계 파악
        analysis.relationships = this.findPageRelationships(analysis.pages);
        logger.info(`  🔗 Found ${analysis.relationships.length} page relationships`);

        // 전체 주제 추론
        analysis.overallTheme = this.inferOverallTheme(analysis.pages);
        logger.info(`  🎯 Overall theme: ${analysis.overallTheme}`);

        // 생성 전략 결정
        analysis.strategy = this.determineGenerationStrategy(analysis);
        logger.info(`  📐 Generation strategy: ${analysis.strategy}`);

        logger.info('✅ Multi-page analysis completed');
        
        return analysis;
    }

    /**
     * 문서 유형 추론
     * @private
     */
    inferDocumentType(pages) {
        const types = pages.map(p => p.type).filter(t => t);
        const typeCounts = {};
        
        types.forEach(type => {
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        // 가장 많은 유형 찾기
        const dominantType = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        // 패턴 기반 판정
        if (types.includes('표지') && types.includes('양식/서식')) {
            return '양식 문서집 (표지 포함)';
        }
        
        if (types.filter(t => t === '양식/서식').length >= 2) {
            return '다중 양식 문서';
        }
        
        if (types.includes('표지') && types.includes('본문')) {
            return '보고서/제안서';
        }
        
        if (types.includes('목차')) {
            return '구조화된 문서 (목차 포함)';
        }
        
        if (dominantType === '표/데이터') {
            return '데이터 중심 문서';
        }

        return `${dominantType || '혼합형'} 문서`;
    }

    /**
     * 페이지 간 관계 찾기
     * @private
     */
    findPageRelationships(pages) {
        const relationships = [];

        for (let i = 0; i < pages.length - 1; i++) {
            const current = pages[i];
            const next = pages[i + 1];

            // 1. 표지 → 본문/양식
            if (current.type === '표지') {
                if (next.type === '양식/서식' || next.type === '본문') {
                    relationships.push({
                        from: i + 1,
                        to: i + 2,
                        relationship: 'cover-to-content',
                        strength: 'strong',
                        note: '표지의 제목이 다음 페이지 내용의 주제가 됩니다',
                        recommendation: '표지 정보를 다음 페이지 생성 시 컨텍스트로 활용'
                    });
                }
            }

            // 2. 목차 → 본문
            if (current.type === '목차') {
                relationships.push({
                    from: i + 1,
                    to: i + 2,
                    relationship: 'toc-to-content',
                    strength: 'strong',
                    note: '목차 항목이 후속 페이지의 내용 구조를 정의합니다',
                    recommendation: '목차 항목에 따라 후속 페이지 내용 구성'
                });
            }

            // 3. 양식 연속 (동일 주제의 여러 페이지)
            if (current.type === '양식/서식' && next.type === '양식/서식') {
                const similarity = this.calculateHeaderSimilarity(
                    current.characteristics.headerPatterns,
                    next.characteristics.headerPatterns
                );

                if (similarity > 0.3) {
                    relationships.push({
                        from: i + 1,
                        to: i + 2,
                        relationship: 'sequential-forms',
                        strength: similarity > 0.6 ? 'strong' : 'medium',
                        note: '연속된 양식으로 주제의 일관성이 필요합니다',
                        recommendation: '이전 페이지의 주제와 톤을 유지하며 생성'
                    });
                }
            }

            // 4. 본문 연속
            if (current.type === '본문' && next.type === '본문') {
                relationships.push({
                    from: i + 1,
                    to: i + 2,
                    relationship: 'continuous-content',
                    strength: 'medium',
                    note: '연속된 본문으로 논리적 흐름이 필요합니다',
                    recommendation: '이전 페이지의 마지막 내용을 이어받아 생성'
                });
            }

            // 5. 본문 → 부록/참고자료
            if (current.type === '본문' && 
                (next.type === '부록' || next.type === '참고자료')) {
                relationships.push({
                    from: i + 1,
                    to: i + 2,
                    relationship: 'content-to-appendix',
                    strength: 'weak',
                    note: '본문 내용을 보완하는 추가 자료',
                    recommendation: '본문에서 언급된 내용을 상세히 설명'
                });
            }
        }

        return relationships;
    }

    /**
     * 헤더 유사도 계산
     * @private
     */
    calculateHeaderSimilarity(headers1, headers2) {
        if (headers1.length === 0 || headers2.length === 0) {
            return 0;
        }

        const set1 = new Set(headers1.map(h => h.toLowerCase().trim()));
        const set2 = new Set(headers2.map(h => h.toLowerCase().trim()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * 전체 주제 추론
     * @private
     */
    inferOverallTheme(pages) {
        // 모든 페이지의 헤더 패턴 수집
        const allHeaders = [];
        pages.forEach(page => {
            if (page.characteristics.headerPatterns) {
                allHeaders.push(...page.characteristics.headerPatterns);
            }
        });

        if (allHeaders.length === 0) {
            return '일반 주제';
        }

        // 빈도 분석
        const headerFreq = {};
        allHeaders.forEach(header => {
            // 숫자 제거하고 정규화
            const key = header.replace(/[0-9]/g, '').trim().toLowerCase();
            if (key.length > 1) {
                headerFreq[key] = (headerFreq[key] || 0) + 1;
            }
        });

        // 가장 빈번한 키워드 3개
        const sortedHeaders = Object.entries(headerFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([key]) => key);

        // 특정 도메인 패턴 감지
        const joinedHeaders = sortedHeaders.join(' ');
        
        if (joinedHeaders.includes('놀이') || joinedHeaders.includes('교육')) {
            return '교육/놀이 활동 계획';
        }
        if (joinedHeaders.includes('프로젝트') || joinedHeaders.includes('계획')) {
            return '프로젝트 계획서';
        }
        if (joinedHeaders.includes('보고') || joinedHeaders.includes('결과')) {
            return '보고서';
        }

        return sortedHeaders.join(', ') || '일반 주제';
    }

    /**
     * 생성 전략 결정
     * @private
     */
    determineGenerationStrategy(analysis) {
        // 관계가 많고 강하면 순차 생성
        const strongRelationships = analysis.relationships.filter(
            r => r.strength === 'strong'
        ).length;

        if (strongRelationships >= 2) {
            return 'sequential'; // 순차 생성 (컨텍스트 전달)
        }

        if (analysis.relationships.length > 0) {
            return 'semi-sequential'; // 부분 순차 (관련 페이지만)
        }

        // 관계가 없으면 병렬 생성
        return 'parallel'; // 병렬 생성 (독립적)
    }

    /**
     * 분석 결과 요약
     * @param {Object} analysis - 분석 결과
     * @returns {string} 요약 문자열
     */
    summarizeAnalysis(analysis) {
        let summary = `\n📊 문서 분석 결과\n`;
        summary += `${'='.repeat(50)}\n`;
        summary += `총 페이지: ${analysis.totalPages}페이지\n`;
        summary += `문서 유형: ${analysis.documentType}\n`;
        summary += `전체 주제: ${analysis.overallTheme}\n`;
        summary += `생성 전략: ${analysis.strategy}\n\n`;

        summary += `📄 페이지별 분석:\n`;
        analysis.pages.forEach((page, i) => {
            summary += `  ${i + 1}. ${page.type} (신뢰도: ${(page.confidence * 100).toFixed(0)}%)\n`;
            summary += `     역할: ${page.role}\n`;
        });

        if (analysis.relationships.length > 0) {
            summary += `\n🔗 페이지 관계:\n`;
            analysis.relationships.forEach((rel, i) => {
                summary += `  ${i + 1}. 페이지 ${rel.from} → ${rel.to} (${rel.strength})\n`;
                summary += `     ${rel.note}\n`;
            });
        }

        summary += `${'='.repeat(50)}\n`;

        return summary;
    }
}

