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

    // ═══════════════════════════════════════════════════════════
    // AI 친화 문서 검사 규칙 (Phase 1)
    // ═══════════════════════════════════════════════════════════

    /**
     * AI 친화 문서 품질 빠른 검사 (로컬, GPT 호출 없음)
     * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍
     * @returns {Object} { score, issues, summary }
     */
    checkAIFriendliness(headerContentPairs) {
        const issues = [];
        let totalChecks = 0;
        let passedChecks = 0;

        headerContentPairs.forEach(pair => {
            const text = pair.content || '';
            if (!text.trim()) return;

            // 1. 불완전 문장 감지
            const incompleteIssues = this.checkIncompleteSentences(text);
            issues.push(...incompleteIssues.map(i => ({ ...i, header: pair.header })));
            totalChecks++;
            if (incompleteIssues.length === 0) passedChecks++;

            // 2. 모호한 지시어 감지
            const vagueIssues = this.checkVagueReferences(text);
            issues.push(...vagueIssues.map(i => ({ ...i, header: pair.header })));
            totalChecks++;
            if (vagueIssues.length === 0) passedChecks++;

            // 3. 개조식 나열 감지
            const bulletIssues = this.checkBulletOnly(text);
            issues.push(...bulletIssues.map(i => ({ ...i, header: pair.header })));
            totalChecks++;
            if (bulletIssues.length === 0) passedChecks++;

            // 4. 과도한 수식어 감지
            const verboseIssues = this.checkVerboseExpressions(text);
            issues.push(...verboseIssues.map(i => ({ ...i, header: pair.header })));
            totalChecks++;
            if (verboseIssues.length === 0) passedChecks++;
        });

        const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

        return {
            score,
            grade: score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F',
            issues,
            summary: {
                totalPairs: headerContentPairs.length,
                totalIssues: issues.length,
                byCategory: {
                    incompleteSentence: issues.filter(i => i.category === '불완전 문장').length,
                    vagueReference: issues.filter(i => i.category === '모호한 지시어').length,
                    bulletOnly: issues.filter(i => i.category === '개조식 나열').length,
                    verbose: issues.filter(i => i.category === '과도한 수식어').length,
                },
            },
        };
    }

    /**
     * 불완전 문장 감지 (주어/서술어 없는 짧은 단문)
     * @param {string} text
     * @returns {Array}
     */
    checkIncompleteSentences(text) {
        const issues = [];
        // 줄바꿈으로 나뉜 각 줄을 검사
        const lines = text.split(/\n/).filter(l => l.trim());

        lines.forEach(line => {
            const trimmed = line.trim();
            // 5자 이하 단문이면서 명사로만 끝나는 경우 (서술어 없음)
            if (trimmed.length > 0 && trimmed.length <= 10 &&
                !trimmed.match(/[다요함임음됨됩][\.\!\?]?$/) && // 서술어 어미가 없음
                !trimmed.match(/^[0-9\.\-\(\)]+$/) && // 번호가 아닌 경우
                !trimmed.match(/^\d{4}[\.\-\/]/) // 날짜가 아닌 경우
            ) {
                issues.push({
                    type: 'warning',
                    category: '불완전 문장',
                    original: trimmed,
                    reason: `"${trimmed}" — 주어와 서술어가 포함된 완전한 문장으로 작성하세요.`,
                    confidence: 0.7,
                });
            }
        });

        return issues;
    }

    /**
     * 모호한 지시어 감지
     * @param {string} text
     * @returns {Array}
     */
    checkVagueReferences(text) {
        const issues = [];
        const vaguePatterns = [
            { pattern: /이것[을은이가]/g, word: '이것' },
            { pattern: /그것[을은이가]/g, word: '그것' },
            { pattern: /해당\s/g, word: '해당' },
            { pattern: /상기\s/g, word: '상기' },
            { pattern: /전술한\s/g, word: '전술한' },
            { pattern: /이를\s/g, word: '이를' },
            { pattern: /그에\s따라/g, word: '그에 따라' },
        ];

        vaguePatterns.forEach(({ pattern, word }) => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                issues.push({
                    type: 'warning',
                    category: '모호한 지시어',
                    position: match.index,
                    original: match[0],
                    reason: `"${word}" — 구체적인 명사로 교체하면 AI가 더 정확하게 이해할 수 있습니다.`,
                    confidence: 0.8,
                });
            }
        });

        return issues;
    }

    /**
     * 개조식 나열만 있는 경우 감지
     * @param {string} text
     * @returns {Array}
     */
    checkBulletOnly(text) {
        const issues = [];
        const lines = text.split(/\n/).filter(l => l.trim());

        if (lines.length < 2) return issues;

        // 개조식 패턴: "-", "·", "•", "※", "○" 등으로 시작하는 줄
        const bulletLines = lines.filter(l => /^\s*[-·•※○▶▷◆◇★☆►]\s/.test(l.trim()));
        const bulletRatio = bulletLines.length / lines.length;

        if (bulletRatio >= 0.7 && bulletLines.length >= 3) {
            // 개조식 줄이 서술형이 아닌지 확인 (서술어 어미 없음)
            const nonDescriptive = bulletLines.filter(l =>
                !l.trim().match(/[다요함임음됨됩니까][\.\!\?]?\s*$/)
            );

            if (nonDescriptive.length >= 2) {
                issues.push({
                    type: 'info',
                    category: '개조식 나열',
                    original: bulletLines.slice(0, 3).join(', ').substring(0, 80) + '...',
                    reason: `${bulletLines.length}개의 개조식 나열이 감지되었습니다. 의미가 완결된 서술형 문장으로 변환하면 AI 이해도가 높아집니다.`,
                    confidence: 0.75,
                });
            }
        }

        return issues;
    }

    /**
     * 과도한 수식어/미사여구 감지
     * @param {string} text
     * @returns {Array}
     */
    checkVerboseExpressions(text) {
        const issues = [];
        const verbosePatterns = [
            { pattern: /혁신적이고\s*획기적인/g, suggestion: '새로운', label: '혁신적이고 획기적인' },
            { pattern: /미래지향적[인\s]*패러다임/g, suggestion: '새로운 방향', label: '미래지향적 패러다임' },
            { pattern: /총체적[이\s]*(이고)?.*역량/g, suggestion: '역량', label: '총체적 역량' },
            { pattern: /선진화[된\s]*시스템/g, suggestion: '개선된 시스템', label: '선진화된 시스템' },
            { pattern: /글로벌\s*스탠다드에\s*부합하는/g, suggestion: '국제 기준에 맞는', label: '글로벌 스탠다드에 부합하는' },
            { pattern: /시너지\s*효과를\s*극대화/g, suggestion: '함께 효과를 높임', label: '시너지 효과를 극대화' },
        ];

        verbosePatterns.forEach(({ pattern, suggestion, label }) => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                issues.push({
                    type: 'style',
                    category: '과도한 수식어',
                    position: match.index,
                    original: match[0],
                    suggestion,
                    reason: `"${label}" → "${suggestion}" — 간결한 표현이 AI 처리에 더 적합합니다.`,
                    confidence: 0.85,
                });
            }
        });

        return issues;
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        logger.debug('='.repeat(80));
        logger.debug('📊 TextAnalyzer Debug Info');
        logger.debug('='.repeat(80));
        logger.debug('Rule Categories:', Object.keys(this.rules));
        logger.debug('Spelling Rules:', Object.keys(this.rules.spelling).length);
        logger.debug('Spacing Rules:', this.rules.spacing.length);
        logger.debug('Duplication Rules:', this.rules.duplication.length);
        logger.debug('Prohibited Words:', this.rules.prohibited.length);
        logger.debug('Punctuation Rules:', this.rules.punctuation.length);
        logger.debug('='.repeat(80));
    }
}

