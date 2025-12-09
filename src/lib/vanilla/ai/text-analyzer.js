/**
 * Text Analyzer
 * 로컬 규칙 기반 텍스트 분석
 * 
 * @module ai/text-analyzer
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TextAnalyzer');

/**
 * 텍스트 분석기
 * AI 호출 전 로컬 규칙으로 빠른 검사
 */
export class TextAnalyzer {
    constructor() {
        this.rules = this._loadRules();
        logger.info('📊 TextAnalyzer initialized with', Object.keys(this.rules).length, 'rule sets');
    }

    /**
     * 규칙 로드
     * @private
     */
    _loadRules() {
        return {
            // 맞춤법 규칙
            spelling: {
                '되요': '돼요',
                '됬다': '됐다',
                '됬습니다': '됐습니다',
                '안돼요': '안 돼요',
                '않됩니다': '않습니다',
                '웬지': '왠지',
                '왠만하면': '웬만하면',
                '로서': '로써', // 맥락 필요
                '로써': '로서', // 맥락 필요
                '겠습니다다': '겠습니다',
                '습니다습니다': '습니다'
            },

            // 띄어쓰기 규칙
            spacing: [
                { pattern: /것같다/g, correct: '것 같다' },
                { pattern: /것같습니다/g, correct: '것 같습니다' },
                { pattern: /수있다/g, correct: '수 있다' },
                { pattern: /수있습니다/g, correct: '수 있습니다' },
                { pattern: /수없다/g, correct: '수 없다' },
                { pattern: /수없습니다/g, correct: '수 없습니다' },
                { pattern: /할수있다/g, correct: '할 수 있다' },
                { pattern: /할수없다/g, correct: '할 수 없다' },
                { pattern: /해야한다/g, correct: '해야 한다' },
                { pattern: /해야합니다/g, correct: '해야 합니다' },
                { pattern: /할수도있다/g, correct: '할 수도 있다' },
                { pattern: /그런데도불구하고/g, correct: '그런데도 불구하고' }
            ],

            // 중복 표현
            duplication: [
                { pattern: /\.\.+/g, correct: '.', message: '마침표가 중복되었습니다' },
                { pattern: /\?\?+/g, correct: '?', message: '물음표가 중복되었습니다' },
                { pattern: /!!+/g, correct: '!', message: '느낌표가 중복되었습니다' },
                { pattern: /,,+/g, correct: ',', message: '쉼표가 중복되었습니다' },
                { pattern: /  +/g, correct: ' ', message: '공백이 중복되었습니다' }
            ],

            // 금지 단어 (예: 비속어, 차별 표현 등)
            prohibited: [
                '바보', '멍청이', '개새끼' // 실제로는 더 많은 단어 추가
            ],

            // 문장 부호 규칙
            punctuation: [
                { pattern: /\s+\./g, correct: '.', message: '마침표 앞 공백 제거' },
                { pattern: /\s+,/g, correct: ',', message: '쉼표 앞 공백 제거' },
                { pattern: /\(\s+/g, correct: '(', message: '괄호 안쪽 공백 제거' },
                { pattern: /\s+\)/g, correct: ')', message: '괄호 안쪽 공백 제거' }
            ]
        };
    }

    /**
     * 빠른 검사 (로컬 규칙 기반)
     * @param {string} text - 검사할 텍스트
     * @returns {Array} 발견된 이슈 배열
     */
    quickCheck(text) {
        const issues = [];

        // 1. 맞춤법 체크
        issues.push(...this.checkSpelling(text));

        // 2. 띄어쓰기 체크
        issues.push(...this.checkSpacing(text));

        // 3. 중복 표현 체크
        issues.push(...this.checkDuplication(text));

        // 4. 금지 단어 체크
        issues.push(...this.checkProhibitedWords(text));

        // 5. 문장 부호 체크
        issues.push(...this.checkPunctuation(text));

        logger.debug(`Quick check found ${issues.length} issues in text:`, text.substring(0, 50));

        return issues;
    }

    /**
     * 맞춤법 체크
     * @param {string} text - 검사할 텍스트
     * @returns {Array} 발견된 이슈
     */
    checkSpelling(text) {
        const issues = [];
        const spellingRules = this.rules.spelling;

        for (const [wrong, correct] of Object.entries(spellingRules)) {
            const regex = new RegExp(wrong, 'g');
            let match;

            while ((match = regex.exec(text)) !== null) {
                issues.push({
                    type: 'error',
                    category: '맞춤법',
                    position: match.index,
                    length: wrong.length,
                    original: wrong,
                    suggestion: correct,
                    reason: `'${wrong}'는 '${correct}'의 잘못된 표현입니다.`,
                    confidence: 0.95
                });
            }
        }

        return issues;
    }

    /**
     * 띄어쓰기 체크
     * @param {string} text - 검사할 텍스트
     * @returns {Array} 발견된 이슈
     */
    checkSpacing(text) {
        const issues = [];
        const spacingRules = this.rules.spacing;

        for (const rule of spacingRules) {
            let match;
            while ((match = rule.pattern.exec(text)) !== null) {
                issues.push({
                    type: 'warning',
                    category: '띄어쓰기',
                    position: match.index,
                    length: match[0].length,
                    original: match[0],
                    suggestion: rule.correct,
                    reason: `'${match[0]}'는 '${rule.correct}'로 띄어 써야 합니다.`,
                    confidence: 0.90
                });
            }
        }

        return issues;
    }

    /**
     * 중복 표현 체크
     * @param {string} text - 검사할 텍스트
     * @returns {Array} 발견된 이슈
     */
    checkDuplication(text) {
        const issues = [];
        const duplicationRules = this.rules.duplication;

        for (const rule of duplicationRules) {
            let match;
            while ((match = rule.pattern.exec(text)) !== null) {
                issues.push({
                    type: 'style',
                    category: '중복',
                    position: match.index,
                    length: match[0].length,
                    original: match[0],
                    suggestion: rule.correct,
                    reason: rule.message,
                    confidence: 0.98
                });
            }
        }

        return issues;
    }

    /**
     * 금지 단어 체크
     * @param {string} text - 검사할 텍스트
     * @returns {Array} 발견된 이슈
     */
    checkProhibitedWords(text) {
        const issues = [];
        const prohibitedWords = this.rules.prohibited;

        for (const word of prohibitedWords) {
            const regex = new RegExp(word, 'gi');
            let match;

            while ((match = regex.exec(text)) !== null) {
                issues.push({
                    type: 'error',
                    category: '부적절한 표현',
                    position: match.index,
                    length: word.length,
                    original: match[0],
                    suggestion: '[삭제 권장]',
                    reason: '부적절한 표현입니다. 삭제하거나 다른 표현으로 대체해주세요.',
                    confidence: 0.99
                });
            }
        }

        return issues;
    }

    /**
     * 문장 부호 체크
     * @param {string} text - 검사할 텍스트
     * @returns {Array} 발견된 이슈
     */
    checkPunctuation(text) {
        const issues = [];
        const punctuationRules = this.rules.punctuation;

        for (const rule of punctuationRules) {
            let match;
            while ((match = rule.pattern.exec(text)) !== null) {
                issues.push({
                    type: 'style',
                    category: '문장 부호',
                    position: match.index,
                    length: match[0].length,
                    original: match[0],
                    suggestion: rule.correct,
                    reason: rule.message,
                    confidence: 0.92
                });
            }
        }

        return issues;
    }

    /**
     * 문장 길이 분석
     * @param {string} text - 분석할 텍스트
     * @returns {Object} 분석 결과
     */
    analyzeSentenceLength(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const lengths = sentences.map(s => s.trim().length);

        return {
            count: sentences.length,
            averageLength: lengths.reduce((a, b) => a + b, 0) / lengths.length || 0,
            maxLength: Math.max(...lengths, 0),
            minLength: Math.min(...lengths, Number.MAX_VALUE),
            longSentences: sentences.filter(s => s.trim().length > 100)
        };
    }

    /**
     * 가독성 점수 계산
     * @param {string} text - 분석할 텍스트
     * @returns {number} 0-100 점수
     */
    calculateReadabilityScore(text) {
        const sentenceAnalysis = this.analyzeSentenceLength(text);
        
        // 간단한 가독성 점수 (0-100)
        let score = 100;

        // 평균 문장 길이 패널티
        if (sentenceAnalysis.averageLength > 50) {
            score -= Math.min(30, (sentenceAnalysis.averageLength - 50) / 2);
        }

        // 긴 문장 패널티
        score -= sentenceAnalysis.longSentences.length * 5;

        // 문장 수가 너무 적으면 패널티
        if (sentenceAnalysis.count < 3 && text.length > 100) {
            score -= 10;
        }

        return Math.max(0, Math.round(score));
    }

    /**
     * 통계 정보 가져오기
     * @param {string} text - 분석할 텍스트
     * @returns {Object} 통계 정보
     */
    getStatistics(text) {
        const words = text.trim().split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

        return {
            characters: text.length,
            charactersWithoutSpaces: text.replace(/\s/g, '').length,
            words: words.length,
            sentences: sentences.length,
            paragraphs: paragraphs.length,
            averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length || 0,
            averageSentenceLength: sentences.reduce((sum, sent) => sum + sent.length, 0) / sentences.length || 0
        };
    }

    /**
     * 규칙 추가
     * @param {string} category - 규칙 카테고리
     * @param {Object} rule - 규칙 객체
     */
    addRule(category, rule) {
        if (!this.rules[category]) {
            this.rules[category] = [];
        }

        if (Array.isArray(this.rules[category])) {
            this.rules[category].push(rule);
        } else {
            Object.assign(this.rules[category], rule);
        }

        logger.debug(`Rule added to category: ${category}`);
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        console.log('='.repeat(80));
        console.log('📊 TextAnalyzer Debug Info');
        console.log('='.repeat(80));
        console.log('Rule Categories:', Object.keys(this.rules));
        console.log('Spelling Rules:', Object.keys(this.rules.spelling).length);
        console.log('Spacing Rules:', this.rules.spacing.length);
        console.log('Duplication Rules:', this.rules.duplication.length);
        console.log('Prohibited Words:', this.rules.prohibited.length);
        console.log('Punctuation Rules:', this.rules.punctuation.length);
        console.log('='.repeat(80));
    }
}

