/**
 * TruthAnchor Offline Validation Engine
 * Python halluguard 엔진의 L0(가드레일) + L0.5(수치검증) + 클레임추출 + 근거매칭을 JS로 포팅
 *
 * @module ai/truthanchor-offline
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TruthAnchorOffline');

// ============================================================
// 1. 클레임 추출 (claim_extractor.py 포팅)
// ============================================================

const SENTENCE_END_PATTERN = /(?<=[.!?。])\s+|(?<=다)\.\s+|(?<=요)\.\s+|(?<=죠)\.\s+|(?<=니다)\s+|(?<=니까)\s+|(?<=됩니다)\s+|(?<=있다)\s+|(?<=없다)\s+|(?<=였다)\s+|(?<=했다)\s+|(?<=된다)\s+|(?<=이다)\s+|(?<=란다)\s+|(?<=한다)\s+|(?<=왔다)\s+|(?<=같다)\s+|(?<=았다)\s+|(?<=겠다)\s+|(?<=셨다)\s+/g;

const COMPOUND_SPLITTERS = /(?<=\S),\s+(?=\S.{8,})|(?<=고)\s+(?=\S.{6,})|(?<=며)\s+(?=\S.{6,})|(?<=으며)\s+(?=\S.{6,})|;\s+/g;

const NON_FACTUAL_PATTERNS = [
    /^(안녕|감사|죄송|수고|실례|네,|아,|음,|글쎄|아니요|예,|네 )/,
    /\?$/,
    /(일까요|인가요|은가요|할까요|될까요|나요|을까요|ㄹ까요|맞을까요)\s*[.?]?\s*$/,
    /^(해주세요|알려주세요|부탁|확인해|설명해|찾아)/,
    /(해주세요|해 주세요|바랍니다|하시기 바랍니다|알려주세요|주세요)\s*\.?\s*$/,
    /^(I think|In my opinion|Maybe|Perhaps|Personally|I believe|I feel)/i,
    /^(Hello|Hi|Thanks|Sorry|Please|Could you|Would you|Can you)/i,
    /^(그리고|또한|하지만|그러나|따라서|그래서|즉,|예를 들어)\s*$/,
    /^(다음과 같|아래와 같|아래를 참|다음을 참)/,
];

function isNonFactual(sentence) {
    for (const pattern of NON_FACTUAL_PATTERNS) {
        if (pattern.test(sentence)) return true;
    }
    return false;
}

function splitSentences(text) {
    const lines = text.split('\n');
    const sentences = [];
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        line = line.replace(/^\s*[-•*]\s+/, '');
        line = line.replace(/^\s*\d+[.)]\s+/, '');
        const parts = line.split(SENTENCE_END_PATTERN);
        sentences.push(...parts);
    }
    return sentences;
}

function splitCompoundSentence(sentence) {
    if (sentence.length < 25) return [sentence];
    const parts = sentence.split(COMPOUND_SPLITTERS);
    if (parts.length <= 1) return [sentence];

    const result = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length >= 10) {
            result.push(trimmed);
        } else if (result.length > 0) {
            result[result.length - 1] += ', ' + trimmed;
        }
    }
    return result.length > 0 ? result : [sentence];
}

/**
 * 텍스트에서 검증 가능한 클레임 추출
 */
export function extractClaims(text) {
    const sentences = splitSentences(text);
    const claims = [];

    for (let sent of sentences) {
        sent = sent.trim();
        if (!sent || sent.length < 10) continue;
        if (isNonFactual(sent)) continue;

        const subClaims = splitCompoundSentence(sent);
        for (let sc of subClaims) {
            sc = sc.trim();
            if (sc && sc.length >= 10 && !isNonFactual(sc)) {
                claims.push(sc);
            }
        }
    }
    return claims;
}

// ============================================================
// 2. 근거 매칭 (evidence_matcher.py 포팅)
// ============================================================

const STOPWORDS = new Set([
    '의', '에', '를', '이', '가', '은', '는', '에서', '으로', '로', '와', '과',
    '도', '만', '을', '한', '된', '할', '하는', '그', '이런', '저런', '것',
    '수', '등', '및', '또는', '그리고', '하지만', '때문', '대한', '위한',
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'of', 'to', 'and',
    'for', 'on', 'at', 'by', 'with', 'from', 'that', 'this', 'it', 'be',
]);

const MIN_RELEVANCE = 0.25;

function keywordOverlap(claim, chunk) {
    const claimWords = new Set(claim.split(/\s+/));
    const chunkWords = new Set(chunk.split(/\s+/));
    if (claimWords.size === 0) return 0;

    const meaningfulClaim = new Set([...claimWords].filter(w => !STOPWORDS.has(w)));
    if (meaningfulClaim.size === 0) return 0;
    const overlap = [...meaningfulClaim].filter(w => chunkWords.has(w));
    return overlap.length / meaningfulClaim.size;
}

function ngramOverlap(text1, text2, n = 2) {
    if (text1.length < n || text2.length < n) return 0;
    const ngrams1 = new Set();
    const ngrams2 = new Set();
    for (let i = 0; i <= text1.length - n; i++) ngrams1.add(text1.substring(i, i + n));
    for (let i = 0; i <= text2.length - n; i++) ngrams2.add(text2.substring(i, i + n));
    if (ngrams1.size === 0) return 0;
    let overlap = 0;
    for (const ng of ngrams1) { if (ngrams2.has(ng)) overlap++; }
    return overlap / ngrams1.size;
}

function sequenceRatio(a, b) {
    // 간단한 LCS 기반 유사도 (Python SequenceMatcher.ratio() 근사)
    const lenA = a.length, lenB = b.length;
    if (lenA === 0 || lenB === 0) return 0;
    // 짧은 텍스트에만 정확한 계산 (성능)
    if (lenA > 500 || lenB > 500) {
        return ngramOverlap(a, b, 3); // 긴 텍스트는 3-gram으로 근사
    }
    let matches = 0;
    const used = new Set();
    for (let i = 0; i < lenA; i++) {
        for (let j = 0; j < lenB; j++) {
            if (!used.has(j) && a[i] === b[j]) {
                matches++;
                used.add(j);
                break;
            }
        }
    }
    return (2.0 * matches) / (lenA + lenB);
}

/**
 * 클레임에 가장 관련성 높은 청크 반환
 */
export function matchEvidence(claim, chunks, topK = 3) {
    const claimLower = claim.toLowerCase();
    const scored = [];

    for (const chunk of chunks) {
        const chunkLower = chunk.text.toLowerCase();
        const kwScore = keywordOverlap(claimLower, chunkLower);
        const ngScore = ngramOverlap(claimLower, chunkLower, 2);
        const seqScore = sequenceRatio(claimLower, chunkLower);
        const score = 0.5 * kwScore + 0.3 * ngScore + 0.2 * seqScore;
        scored.push({ ...chunk, relevanceScore: Math.round(score * 10000) / 10000 });
    }

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const filtered = scored.slice(0, topK).filter(s => s.relevanceScore >= MIN_RELEVANCE);
    return filtered.length > 0 ? filtered : scored.slice(0, 1);
}

// ============================================================
// 3. 가드레일 (domain_adapters.py 포팅)
// ============================================================

const COMMON_GUARDRAILS = [
    { id: 'CG-001', pattern: /(투자|매수|매도|가입)\s*(하세요|하시길|권합니다|추천|바랍니다)/i, severity: 'CRITICAL', message: '투자 권유 금지' },
    { id: 'CG-002', pattern: /(확실히|반드시|무조건)\s*(수익|이익|이득|보장|보증)/i, severity: 'CRITICAL', message: '수익 보장 금지' },
    { id: 'CG-003', pattern: /\d+[.,%].*(?:이다|입니다|됩니다).*출처|근거|자료/i, severity: 'MEDIUM', message: '수치에 출처 필요' },
    { id: 'CG-004', pattern: /(금리|이율|이자율)\s*(?:은|는|이|가)?\s*\d/i, severity: 'HIGH', message: '금리 정확성 검증 필요' },
    { id: 'CG-005', pattern: /(과거\s*수익|과거\s*실적).*(?:미래|향후|앞으로)/i, severity: 'HIGH', message: '과거 실적은 미래를 보장하지 않음' },
    { id: 'CG-006', pattern: /(\d{6}[-]\d{7}|\d{3}[-]\d{2}[-]\d{5})/i, severity: 'CRITICAL', message: '개인정보(주민번호 등) 포함 금지' },
    { id: 'CG-007', pattern: /(모든|항상|절대|전부|누구나)\s*(가능|해당|적용|보장)/i, severity: 'MEDIUM', message: '근거 없는 일반화 주의' },
    { id: 'CG-008', pattern: /(최고|최저|가장\s*좋|가장\s*나쁜|1위|꼴찌).*(?:상품|서비스|은행|보험)/i, severity: 'HIGH', message: '상품 비교 시 공정성 필요' },
    { id: 'CG-009', pattern: /(반드시|확실히|분명히)\s*(오를|하락|상승|증가|감소)\s*(것|겁니다|예정)/i, severity: 'CRITICAL', message: '미래 예측 단정 금지' },
    { id: 'CG-010', pattern: /(보다|대비|비해)\s*(높|낮|좋|나쁘|우수|열등)/i, severity: 'MEDIUM', message: '비교 시 조건 명시 필요' },
];

const FINANCE_GUARDRAILS = [
    { id: 'CG-018', pattern: /(보험|보장)\s*(?:범위|내용|한도).*(?:모두|전부|모든\s*경우)/i, severity: 'HIGH', message: '보험 보장 범위 왜곡 주의' },
    { id: 'CG-019', pattern: /(카드|신용)\s*(?:한도|금리|수수료).*(?:무조건|항상|모두)/i, severity: 'HIGH', message: '카드 조건 왜곡 주의' },
    { id: 'CG-020', pattern: /(연금|퇴직)\s*(?:수령|자격|조건).*(?:누구나|모두|항상)/i, severity: 'HIGH', message: '연금 수급 조건 왜곡 주의' },
    { id: 'CG-021', pattern: /(외환|환전|송금)\s*(?:규제|제한|한도).*(?:없|자유|무제한)/i, severity: 'HIGH', message: '외환 규제 왜곡 주의' },
    { id: 'CG-022', pattern: /(세금|세율|세액)\s*(?:은|는)?\s*(?:없|면제|공제).*(?:항상|모두|누구나)/i, severity: 'HIGH', message: '세금 정보 왜곡 주의' },
    { id: 'CG-023', pattern: /(분쟁|소송|환불|배상)\s*(?:은|는)?\s*(?:항상|무조건|반드시)/i, severity: 'MEDIUM', message: '소비자 분쟁 해결 왜곡 주의' },
    { id: 'CG-024', pattern: /(핀테크|간편결제|P2P)\s*(?:은|는)?\s*(?:안전|보장|위험\s*없)/i, severity: 'HIGH', message: '핀테크 서비스 왜곡 주의' },
    { id: 'CG-025', pattern: /(대출|융자|차입)\s*(?:금리|이자|조건).*(?:무조건|항상|누구나)/i, severity: 'HIGH', message: '대출 조건 왜곡 주의' },
];

const SEVERITY_CONFIDENCE = { CRITICAL: 0.97, HIGH: 0.90, MEDIUM: 0.75 };

/**
 * 가드레일 패턴 검사
 */
export function checkGuardrails(claim, domain = 'general') {
    const rules = domain === 'finance'
        ? [...COMMON_GUARDRAILS, ...FINANCE_GUARDRAILS]
        : COMMON_GUARDRAILS;

    for (const rule of rules) {
        if (rule.pattern.test(claim)) {
            return {
                ruleId: rule.id,
                severity: rule.severity,
                message: rule.message,
                confidence: SEVERITY_CONFIDENCE[rule.severity] || 0.75,
            };
        }
    }
    return null;
}

// ============================================================
// 4. 수치 교차검증 (numerical_verifier.py 포팅)
// ============================================================

const NUMERIC_PATTERNS = [
    { pattern: /(?:연\s*)?(\d+(?:\.\d+)?)\s*(%|퍼센트)/gi, type: 'percent' },
    { pattern: /약?\s*(\d+(?:\.\d+)?)\s*(조)\s*(원|달러|위안)?/gi, type: 'trillion' },
    { pattern: /약?\s*(\d[\d,.]*)\s*(억)\s*(원|달러|위안)?/gi, type: 'billion' },
    { pattern: /약?\s*(\d[\d,.]*)\s*(만)\s*(원|달러|명|건|개)?/gi, type: 'ten_thousand' },
    { pattern: /(\d[\d,.]*)\s*(명|건|개|회|년|월|일|세|개월|차원|kg|km|m|MB|GB|TB)/gi, type: 'count' },
    { pattern: /(\d{4})\s*년/g, type: 'year' },
    { pattern: /(\d{4})\s*년\s*(\d{1,2})\s*월/g, type: 'date' },
    { pattern: /(\d+\.\d+)/g, type: 'decimal' },
];

const CONTEXT_KEYWORDS = /(GDP|금리|이율|기준금리|인구|매출|수익|가격|비용|면적|거리|속도|무게|한도|세율|보험료|연금|대출|예산|수수료|연회비|보장|성장률|실업률|물가|환율|시가총액|자본금|부채|자산|이자율|수익률|연이율|배당률|배당금|순이익|영업이익|출생률|사망률|취업률|합격률|점유율)/g;

const CONTEXT_CATEGORIES = {
    '금리': new Set(['금리', '이율', '기준금리', '이자율', '연이율']),
    '수익': new Set(['수익', '수익률', '배당률', '배당금', '순이익', '영업이익', '매출']),
    '인구': new Set(['인구', '출생률', '사망률']),
    '고용': new Set(['실업률', '취업률', '합격률']),
    '가격': new Set(['가격', '비용', '수수료', '연회비', '보험료']),
    'GDP': new Set(['GDP', '성장률', '물가']),
    '자산': new Set(['자산', '부채', '자본금', '시가총액']),
    '환율': new Set(['환율']),
    '예산': new Set(['예산', '세율']),
};

function contextsCompatible(ctx1, ctx2) {
    if (!ctx1 || !ctx2) return true;
    if (ctx1 === ctx2) return true;
    for (const words of Object.values(CONTEXT_CATEGORIES)) {
        if (words.has(ctx1) && words.has(ctx2)) return true;
    }
    return false;
}

function normalizeUnit(match, type) {
    if (type === 'percent') return '%';
    if (type === 'trillion') return '조' + (match[3] || '원');
    if (type === 'billion') return '억' + (match[3] || '원');
    if (type === 'ten_thousand') return '만' + (match[3] || '원');
    if (type === 'count') return match[2];
    if (type === 'year') return '년';
    if (type === 'date') return '년월';
    if (type === 'decimal') return 'number';
    return type;
}

function extractNumerics(text) {
    const facts = [];
    const seenPositions = new Set();

    for (const { pattern, type } of NUMERIC_PATTERNS) {
        pattern.lastIndex = 0; // reset regex state
        let m;
        while ((m = pattern.exec(text)) !== null) {
            const start = m.index;
            let skip = false;
            for (const pos of seenPositions) {
                if (Math.abs(start - pos) < 3) { skip = true; break; }
            }
            if (skip) continue;
            seenPositions.add(start);

            const raw = m[0];
            const valStr = m[1].replace(/,/g, '');
            const value = parseFloat(valStr);
            if (isNaN(value)) continue;

            // 단위 정규화
            const unit = normalizeUnit(m, type);

            // 문맥 키워드 추출 (앞뒤 60자)
            const ctxStart = Math.max(0, start - 60);
            const ctxEnd = Math.min(text.length, m.index + m[0].length + 60);
            const ctxWindow = text.substring(ctxStart, ctxEnd);

            CONTEXT_KEYWORDS.lastIndex = 0;
            let context = '';
            let bestDist = Infinity;
            const numPosInWindow = start - ctxStart;
            let cm;
            while ((cm = CONTEXT_KEYWORDS.exec(ctxWindow)) !== null) {
                const dist = Math.abs(cm.index - numPosInWindow);
                if (dist < bestDist) { bestDist = dist; context = cm[1]; }
            }

            facts.push({ value, unit, context, raw });
        }
    }
    return facts;
}

function valuesMatch(claimVal, evidenceVal, unit, tolerance = 0.05) {
    if (evidenceVal === 0) return claimVal === 0;
    if (unit === '%') return Math.abs(claimVal - evidenceVal) <= 0.5;
    if (unit === '년' || unit === '년월') return claimVal === evidenceVal;
    return Math.abs(claimVal - evidenceVal) / Math.abs(evidenceVal) <= tolerance;
}

function unitsCompatible(u1, u2) {
    const groups = [
        new Set(['%']),
        new Set(['조원', '억원', '만원', '조달러', '억달러', '만달러']),
        new Set(['명', '건', '개', '회', '만명', '만건', '만개']),
        new Set(['년', '월', '일', '개월', '세', '년월']),
    ];
    for (const g of groups) { if (g.has(u1) && g.has(u2)) return true; }
    return u1 === u2;
}

function findMatchingEvidenceFact(claimFact, evidenceFacts) {
    const candidates = [];
    for (const ef of evidenceFacts) {
        if (claimFact.context && ef.context && !contextsCompatible(claimFact.context, ef.context)) continue;
        let score = 0;
        if (ef.unit === claimFact.unit) score += 3;
        if (claimFact.context && ef.context && claimFact.context === ef.context) score += 5;
        if (unitsCompatible(claimFact.unit, ef.unit)) score += 2;
        if (claimFact.context && ef.context && claimFact.context !== ef.context && contextsCompatible(claimFact.context, ef.context)) score += 3;
        if (score >= 2) candidates.push({ score, fact: ef });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].fact;
}

/**
 * 수치 교차검증
 */
export function crossVerifyNumerics(claim, evidenceTexts, tolerance = 0.05) {
    const claimFacts = extractNumerics(claim);
    if (claimFacts.length === 0) return null;

    const evidenceFacts = [];
    for (const ev of evidenceTexts) evidenceFacts.push(...extractNumerics(ev));
    if (evidenceFacts.length === 0) return null;

    const mismatches = [];
    for (const cf of claimFacts) {
        const best = findMatchingEvidenceFact(cf, evidenceFacts);
        if (!best) continue;
        if (!valuesMatch(cf.value, best.value, cf.unit, tolerance)) {
            mismatches.push({
                mismatched: true,
                claimValue: cf.value, claimRaw: cf.raw,
                evidenceValue: best.value, evidenceRaw: best.raw,
                context: cf.context,
                description: `수치 불일치: 클레임 '${cf.raw}' vs 근거 '${best.raw}' (문맥: ${cf.context || '일반'})`,
            });
        }
    }

    if (mismatches.length === 0) return null;
    const result = mismatches[0];
    if (mismatches.length > 1) {
        result.description = mismatches.map(m => m.description).join('; ');
        result.allMismatches = mismatches;
    }
    return result;
}

// ============================================================
// 5. 텍스트 청킹
// ============================================================

function chunkText(text) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let idx = 0;
    for (const p of paragraphs) {
        const trimmed = p.trim();
        if (trimmed.length > 5) {
            chunks.push({ text: trimmed, index: idx++ });
        }
    }
    // 단일 문단이면 줄 단위로도 분할
    if (chunks.length <= 1) {
        const lines = text.split('\n').filter(l => l.trim().length > 5);
        return lines.map((l, i) => ({ text: l.trim(), index: i }));
    }
    return chunks;
}

// ============================================================
// 6. 최상위: 오프라인 검증 파이프라인
// ============================================================

/**
 * 오프라인 할루시네이션 검증
 * @param {string} sourceText - 원본 문서 텍스트
 * @param {string} llmOutput - AI 생성 텍스트
 * @param {string} domain - 도메인 ('general'|'finance')
 * @returns {object} 검증 결과
 */
export function validateOffline(sourceText, llmOutput, domain = 'general') {
    const startTime = Date.now();

    // 1. 클레임 추출
    const claims = extractClaims(llmOutput);
    if (claims.length === 0) {
        return {
            available: true,
            mode: 'offline',
            overallScore: 1.0,
            totalClaims: 0, supportedClaims: 0, contradictedClaims: 0, neutralClaims: 0,
            claims: [], multiScores: {}, correctedText: '', elapsedMs: Date.now() - startTime,
        };
    }

    // 2. 원본 문서 청킹
    const chunks = chunkText(sourceText);

    // 3. 각 클레임 검증
    const results = [];
    let supported = 0, contradicted = 0, neutral = 0;

    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];
        let verdict = 'neutral';
        let confidence = 0.5;
        let evidence = '';
        let correction = null;

        // 3a. 가드레일 검사
        const guardrailHit = checkGuardrails(claim, domain);
        if (guardrailHit) {
            if (guardrailHit.severity === 'CRITICAL') {
                verdict = 'contradicted';
                confidence = guardrailHit.confidence;
                evidence = `[가드레일 ${guardrailHit.ruleId}] ${guardrailHit.message}`;
                correction = `(${guardrailHit.message}) 해당 표현을 수정하세요.`;
                contradicted++;
                results.push({ text: claim, verdict, confidence, evidence, correction, order: i });
                continue;
            }
        }

        // 3b. 근거 매칭
        const matched = matchEvidence(claim, chunks);
        const evidenceTexts = matched.map(m => m.text);

        // 3c. 수치 교차검증
        const numericResult = crossVerifyNumerics(claim, evidenceTexts);
        if (numericResult) {
            verdict = 'contradicted';
            confidence = 0.92;
            evidence = `[수치 교차검증] ${numericResult.description}`;
            correction = claim.replace(numericResult.claimRaw, numericResult.evidenceRaw);
            contradicted++;
            results.push({ text: claim, verdict, confidence, evidence, correction, order: i });
            continue;
        }

        // 3d. HIGH 가드레일 경고
        if (guardrailHit && guardrailHit.severity === 'HIGH') {
            verdict = 'contradicted';
            confidence = guardrailHit.confidence;
            evidence = `[가드레일 ${guardrailHit.ruleId}] ${guardrailHit.message}`;
            contradicted++;
            results.push({ text: claim, verdict, confidence, evidence, correction: null, order: i });
            continue;
        }

        // 3e. 근거 매칭 점수 기반 판별
        if (matched.length > 0 && matched[0].relevanceScore >= 0.5) {
            verdict = 'supported';
            confidence = Math.min(0.85, matched[0].relevanceScore);
            evidence = matched[0].text.substring(0, 200);
            supported++;
        } else {
            // MEDIUM 가드레일
            if (guardrailHit) {
                verdict = 'neutral';
                evidence = `[주의 ${guardrailHit.ruleId}] ${guardrailHit.message}`;
            }
            neutral++;
        }

        results.push({ text: claim, verdict, confidence, evidence, correction, order: i });
    }

    const overallScore = claims.length > 0 ? supported / claims.length : 1.0;

    return {
        available: true,
        mode: 'offline',
        overallScore: Math.round(overallScore * 100) / 100,
        totalClaims: claims.length,
        supportedClaims: supported,
        contradictedClaims: contradicted,
        neutralClaims: neutral,
        claims: results,
        multiScores: {
            factualAccuracy: overallScore,
            numericalAccuracy: contradicted === 0 ? 1.0 : Math.max(0, 1 - contradicted / claims.length),
            evidenceReliability: results.reduce((sum, r) => sum + r.confidence, 0) / Math.max(results.length, 1),
        },
        correctedText: '',
        elapsedMs: Date.now() - startTime,
    };
}
