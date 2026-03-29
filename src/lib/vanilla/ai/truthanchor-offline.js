/**
 * TruthAnchor Offline Validation Engine
 * Python halluguard 엔진의 L0(가드레일) + L0.5(수치검증) + 클레임추출 + 근거매칭을 JS로 포팅
 *
 * @module ai/truthanchor-offline
 * @version 2.0.0
 *
 * 지원 도메인: general, finance, medical, education, defense, admin
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

const MIN_RELEVANCE = 0.2;

function keywordOverlap(claim, chunk) {
    const claimWords = new Set(claim.split(/\s+/));
    const chunkWords = new Set(chunk.split(/\s+/));
    if (claimWords.size === 0) return 0;

    const meaningfulClaim = new Set([...claimWords].filter(w => w.length >= 2 && !STOPWORDS.has(w)));
    if (meaningfulClaim.size === 0) return 0;

    let matchCount = 0;
    for (const word of meaningfulClaim) {
        // 정확한 매칭
        if (chunkWords.has(word)) { matchCount++; continue; }
        // 한글 부분 매칭: claim 단어가 chunk 어딘가에 포함 (조사 제거 효과)
        if (word.length >= 2 && chunk.includes(word)) { matchCount += 0.8; continue; }
        // chunk 단어가 claim 단어를 포함하는 경우
        for (const cw of chunkWords) {
            if (cw.length >= 2 && (cw.includes(word) || word.includes(cw))) {
                matchCount += 0.6; break;
            }
        }
    }
    return matchCount / meaningfulClaim.size;
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
        const ngScore = ngramOverlap(claimLower, chunkLower, 3);
        const seqScore = sequenceRatio(claimLower, chunkLower);
        const score = 0.55 * kwScore + 0.25 * ngScore + 0.2 * seqScore;
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
    // ── 한국어 ──
    { id: 'CG-001', pattern: /(투자|매수|매도|가입)\s*(하세요|하시길|권합니다|추천|바랍니다)/i, severity: 'CRITICAL', message: '투자 권유 금지' },
    { id: 'CG-002', pattern: /(확실히|반드시|무조건)\s*(수익|이익|이득|보장|보증)/i, severity: 'CRITICAL', message: '수익 보장 금지' },
    { id: 'CG-003', pattern: /\d+[.,%].*(?:이다|입니다|됩니다).*출처|근거|자료/i, severity: 'MEDIUM', message: '수치에 출처 필요' },
    { id: 'CG-004', pattern: /(금리|이율|이자율)\s*(?:은|는|이|가)?\s*\d/i, severity: 'HIGH', message: '금리 정확성 검증 필요' },
    { id: 'CG-005', pattern: /(과거\s*수익|과거\s*실적).*(?:미래|향후|앞으로)/i, severity: 'HIGH', message: '과거 실적은 미래를 보장하지 않음' },
    { id: 'CG-006', pattern: /(\d{6}[-]\d{7}|\d{3}[-]\d{2}[-]\d{5})/i, severity: 'CRITICAL', message: '개인정보(주민번호 등) 포함 금지' },
    { id: 'CG-007', pattern: /(모든|항상|절대|전부|누구나)\s*(?:\S{0,15})?\s*(가능|해당|적용|보장)/i, severity: 'MEDIUM', message: '근거 없는 일반화 주의' },
    { id: 'CG-008', pattern: /(최고|최저|가장\s*좋|가장\s*나쁜|1위|꼴찌).*(?:상품|서비스|은행|보험)/i, severity: 'HIGH', message: '상품 비교 시 공정성 필요' },
    { id: 'CG-009', pattern: /(반드시|확실히|분명히)\s*(?:\S{0,5})?\s*(오를|하락|상승|증가|감소)\s*(?:\S{0,5})?\s*(것|겁니다|예정|입니다|합니다)/i, severity: 'CRITICAL', message: '미래 예측 단정 금지' },
    { id: 'CG-010', pattern: /(보다|대비|비해)\s*(높|낮|좋|나쁘|우수|열등)/i, severity: 'MEDIUM', message: '비교 시 조건 명시 필요' },
    // ── 영어 ──
    { id: 'CG-E01', pattern: /(?:you\s+)?should\s+(?:definitely\s+)?(?:invest|buy|purchase|subscribe)/i, severity: 'CRITICAL', message: 'Investment solicitation prohibited' },
    { id: 'CG-E02', pattern: /(?:guaranteed?|certain|assured)\s+(?:return|profit|income|gain)/i, severity: 'CRITICAL', message: 'Guaranteed returns prohibited' },
    { id: 'CG-E03', pattern: /(?:no\s+)?(?:side\s*effects?|risks?|danger)\s*(?:at\s*all|whatsoever|guaranteed)/i, severity: 'CRITICAL', message: 'Risk/side-effect denial prohibited' },
    { id: 'CG-E04', pattern: /(?:will\s+)?(?:definitely|certainly|surely|absolutely)\s+(?:rise|fall|increase|decrease|grow|drop)/i, severity: 'CRITICAL', message: 'Definitive prediction prohibited' },
    { id: 'CG-E05', pattern: /(?:past|historical)\s+(?:performance|returns?).*(?:future|guarantee)/i, severity: 'HIGH', message: 'Past performance does not guarantee future results' },
    { id: 'CG-E06', pattern: /(?:everyone|anybody|always|all\s+cases?)\s+(?:can|will|eligible|qualify)/i, severity: 'MEDIUM', message: 'Unsubstantiated generalization' },
    { id: 'CG-E07', pattern: /\b(?:SSN|social\s*security)\s*(?:number|#)?\s*:?\s*\d{3}/i, severity: 'CRITICAL', message: 'Personal ID exposure prohibited' },
    { id: 'CG-E08', pattern: /(?:interest\s*rate|rate)\s+(?:is|was|stands?\s+at)\s+\d/i, severity: 'HIGH', message: 'Interest rate accuracy verification required' },
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

// ── 의료 도메인 가드레일 ──
const MEDICAL_GUARDRAILS = [
    { id: 'MG-001', pattern: /(복용|투여|투약)\s*(?:하세요|하시길|권합니다|추천)/i, severity: 'CRITICAL', message: '의약품 투여 권유 금지 — 반드시 전문의 상담 필요' },
    { id: 'MG-002', pattern: /(확실히|반드시|무조건)\s*(완치|치료|회복|낫)/i, severity: 'CRITICAL', message: '치료 결과 보장 금지' },
    { id: 'MG-003', pattern: /(부작용|금기)\s*(?:은|는)?\s*(?:없|안전|걱정\s*없)/i, severity: 'CRITICAL', message: '부작용·금기사항 축소 금지' },
    { id: 'MG-004', pattern: /(진단|검사\s*결과)\s*(?:은|는)?\s*(?:확실|분명|틀림없)/i, severity: 'HIGH', message: '진단 확정 표현 주의 — 전문의 확인 필요' },
    { id: 'MG-005', pattern: /(용량|용법|투여량)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '용량·투여량 정확성 검증 필요' },
    { id: 'MG-006', pattern: /(수술|시술)\s*(?:은|는)?\s*(?:안전|위험\s*없|간단)/i, severity: 'HIGH', message: '수술·시술 위험성 축소 주의' },
    { id: 'MG-007', pattern: /(모든|항상|누구나)\s*(환자|사람|경우).*(?:효과|치료|완치)/i, severity: 'HIGH', message: '치료 효과 일반화 주의' },
    { id: 'MG-008', pattern: /(민간요법|대체의학|자연치료)\s*(?:로|으로)?\s*(?:완치|치료|해결)/i, severity: 'HIGH', message: '비의학적 치료법 효과 왜곡 주의' },
    { id: 'MG-009', pattern: /(처방전|처방)\s*(?:없이|불필요|필요\s*없)/i, severity: 'CRITICAL', message: '처방 필요 의약품의 무처방 사용 권유 금지' },
    { id: 'MG-010', pattern: /(생존율|사망률|치료율|완치율)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '의료 통계 정확성 검증 필요' },
    // 영어
    { id: 'MG-E01', pattern: /(?:take|use|administer)\s+(?:this\s+)?(?:medicine|drug|medication)/i, severity: 'CRITICAL', message: 'Medication recommendation prohibited — consult physician' },
    { id: 'MG-E02', pattern: /(?:guaranteed?|certain)\s+(?:cure|recovery|remission)/i, severity: 'CRITICAL', message: 'Treatment outcome guarantee prohibited' },
    { id: 'MG-E03', pattern: /(?:no|without)\s+(?:side\s*effects?|contraindications?|adverse)/i, severity: 'CRITICAL', message: 'Denial of side effects prohibited' },
    { id: 'MG-E04', pattern: /(?:without|no)\s+(?:a\s+)?prescription/i, severity: 'CRITICAL', message: 'Prescription-free use recommendation prohibited' },
    { id: 'MG-E05', pattern: /(?:dosage|dose)\s+(?:is|should\s+be|of)\s+\d/i, severity: 'HIGH', message: 'Dosage accuracy verification required' },
];

// ── 교육 도메인 가드레일 ──
const EDUCATION_GUARDRAILS = [
    { id: 'EG-001', pattern: /(졸업|수료|이수)\s*(?:조건|요건|자격).*(?:없|불필요|면제)/i, severity: 'HIGH', message: '졸업·이수 요건 왜곡 주의' },
    { id: 'EG-002', pattern: /(합격|불합격|탈락)\s*(?:은|는|이|을)?\s*(?:확실|보장|무조건)/i, severity: 'CRITICAL', message: '합격 결과 보장 금지' },
    { id: 'EG-003', pattern: /(학점|성적|평점)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '학점·성적 수치 정확성 검증 필요' },
    { id: 'EG-004', pattern: /(모든|항상|누구나)\s*(학생|학교|교육기관).*(?:가능|해당|지원)/i, severity: 'MEDIUM', message: '교육 대상 일반화 주의' },
    { id: 'EG-005', pattern: /(교육과정|커리큘럼|교과)\s*(?:은|는)?\s*(?:항상|반드시|무조건)/i, severity: 'MEDIUM', message: '교육과정 일반화 주의' },
    { id: 'EG-006', pattern: /(장학금|등록금|학비)\s*(?:은|는|을|이)?\s*(?:무료|전액|면제|누구나|모두|항상)|(?:누구나|모두)\s*(?:전액)?\s*(?:면제|무료)/i, severity: 'HIGH', message: '장학금·학비 지원 조건 왜곡 주의' },
    { id: 'EG-007', pattern: /(?:누구나|쉽게|간단히)\s*(?:\S{0,10})?\s*(?:자격증|면허|인증)\s*(?:을|를)?\s*(?:취득|획득|발급)|(?:자격증|면허|인증)\s*(?:은|는|을)?\s*(?:누구나|쉽게|간단히)\s*(?:취득|획득|발급)/i, severity: 'HIGH', message: '자격 취득 난이도 왜곡 주의' },
    { id: 'EG-008', pattern: /(정원|모집\s*인원|선발\s*인원)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '모집 인원 수치 정확성 검증 필요' },
    // 영어
    { id: 'EG-E01', pattern: /(?:guaranteed?|assured)\s+(?:admission|acceptance|pass)/i, severity: 'CRITICAL', message: 'Admission guarantee prohibited' },
    { id: 'EG-E02', pattern: /(?:tuition|scholarship)\s+(?:is\s+)?(?:free|waived|exempt)\s+(?:for\s+)?(?:everyone|all)/i, severity: 'HIGH', message: 'Tuition/scholarship universality claim' },
];

// ── 국방 도메인 가드레일 ──
const DEFENSE_GUARDRAILS = [
    { id: 'DG-001', pattern: /(병력|전력|부대)\s*(?:규모|수|현황).*\d/i, severity: 'HIGH', message: '병력·전력 수치 정확성 검증 필요' },
    { id: 'DG-002', pattern: /(기밀|비밀|대외비|군사기밀)\s*(?:정보|내용|사항)/i, severity: 'CRITICAL', message: '군사 기밀 정보 노출 금지' },
    { id: 'DG-003', pattern: /(무기|미사일|탄두|핵)\s*(?:체계|성능|사양|제원).*\d/i, severity: 'HIGH', message: '무기 체계 제원 정확성 검증 필요' },
    { id: 'DG-004', pattern: /(작전|전투|전쟁)\s*(?:계획|일정|시기).*(?:확실|분명|예정)/i, severity: 'CRITICAL', message: '작전 계획 확정 표현 금지' },
    { id: 'DG-005', pattern: /(국방비|군사\s*예산|방위비)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '국방 예산 수치 정확성 검증 필요' },
    { id: 'DG-006', pattern: /(전사|사상|피해)\s*(?:자|자수|인원|규모)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '인명 피해 수치 정확성 검증 필요' },
    { id: 'DG-007', pattern: /(동맹|조약|협정)\s*(?:은|는)?\s*(?:\S{0,20})?\s*(?:무조건|항상|반드시)\s*(?:\S{0,10})?\s*(?:보장|적용|이행|지원)/i, severity: 'HIGH', message: '군사 동맹·조약 이행 보장 왜곡 주의' },
    { id: 'DG-008', pattern: /(군사\s*(?:\S{0,5})?\s*(?:위치|기지|시설)|기지\s*(?:의\s*)?(?:\S{0,10})?\s*위치|진지\s*(?:의\s*)?위치)\s*(?:\S{0,10})?\s*(?:위치|좌표|소재|서울|부산|대전|대구|인천|광주|용산)/i, severity: 'CRITICAL', message: '군사 시설 위치 정보 노출 금지' },
    // 영어
    { id: 'DG-E01', pattern: /(?:classified|secret|top\s*secret)\s+(?:information|data|intel)/i, severity: 'CRITICAL', message: 'Classified information exposure prohibited' },
    { id: 'DG-E02', pattern: /(?:military|base|installation)\s+(?:location|coordinates|position)/i, severity: 'CRITICAL', message: 'Military facility location exposure prohibited' },
    { id: 'DG-E03', pattern: /(?:troop|force|personnel)\s+(?:strength|size|count)\s*(?:is|was|of)\s*\d/i, severity: 'HIGH', message: 'Troop strength accuracy verification required' },
];

// ── 행정 도메인 가드레일 ──
const ADMIN_GUARDRAILS = [
    { id: 'AG-001', pattern: /(법률|법령|조례|시행령)\s*제?\s*\d+\s*조/i, severity: 'HIGH', message: '법령·조항 번호 정확성 검증 필요' },
    { id: 'AG-002', pattern: /(예산|세출|세입|재정)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '행정 예산 수치 정확성 검증 필요' },
    { id: 'AG-003', pattern: /(민원|신청|접수)\s*(?:은|는)?\s*(?:\S{0,10})?\s*(?:항상|무조건|반드시|모든)\s*(?:\S{0,5})?\s*(?:승인|허가|처리|보장)/i, severity: 'HIGH', message: '민원 처리 결과 보장 왜곡 주의' },
    { id: 'AG-004', pattern: /(공무원|공직자|관계자)\s*(?:은|는)?\s*(?:모두|항상|반드시)/i, severity: 'MEDIUM', message: '공무원 행위 일반화 주의' },
    { id: 'AG-005', pattern: /(주민등록|여권|운전면허|비자)\s*(?:번호|정보)/i, severity: 'CRITICAL', message: '개인 행정정보 노출 금지' },
    { id: 'AG-006', pattern: /(인구|세대|가구)\s*(?:수|현황)?\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '인구·세대 통계 정확성 검증 필요' },
    { id: 'AG-007', pattern: /(규제|허가|인가|면허)\s*(?:은|는)?\s*(?:없|불필요|면제).*(?:모두|누구나)/i, severity: 'HIGH', message: '행정 규제·허가 요건 왜곡 주의' },
    { id: 'AG-008', pattern: /(선거|투표|개표)\s*(?:결과|현황).*(?:확정|확실|분명)/i, severity: 'HIGH', message: '선거 결과 단정 표현 주의' },
    { id: 'AG-009', pattern: /(시행일|시행\s*시기|적용\s*시기)\s*(?:은|는)?\s*\d/i, severity: 'HIGH', message: '법령 시행일 정확성 검증 필요' },
    { id: 'AG-010', pattern: /(보조금|지원금|수당)\s*(?:은|는)?\s*(?:누구나|모두|항상)/i, severity: 'HIGH', message: '보조금·지원금 수급 자격 왜곡 주의' },
    // 영어
    { id: 'AG-E01', pattern: /(?:article|section|clause)\s+\d+/i, severity: 'HIGH', message: 'Legal article/section accuracy verification required' },
    { id: 'AG-E02', pattern: /(?:subsidy|grant|benefit)\s+(?:is\s+)?(?:available|eligible)\s+(?:for\s+)?(?:everyone|all)/i, severity: 'HIGH', message: 'Subsidy eligibility generalization' },
    { id: 'AG-E03', pattern: /(?:passport|visa|license)\s+(?:number|ID)/i, severity: 'CRITICAL', message: 'Personal administrative ID exposure prohibited' },
];

const SEVERITY_CONFIDENCE = { CRITICAL: 0.97, HIGH: 0.90, MEDIUM: 0.75 };

// 도메인별 가드레일 매핑
const DOMAIN_GUARDRAILS = {
    finance: FINANCE_GUARDRAILS,
    medical: MEDICAL_GUARDRAILS,
    education: EDUCATION_GUARDRAILS,
    defense: DEFENSE_GUARDRAILS,
    admin: ADMIN_GUARDRAILS,
};

/**
 * 가드레일 패턴 검사
 */
export function checkGuardrails(claim, domain = 'general') {
    const domainRules = DOMAIN_GUARDRAILS[domain] || [];
    // 도메인 전용 규칙을 먼저 평가 → 더 구체적인 규칙이 우선 매칭
    const rules = [...domainRules, ...COMMON_GUARDRAILS];

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
    // %p (퍼센트포인트)를 % 보다 먼저 매칭 — 변동폭과 절대값 구분
    { pattern: /(?:연\s*)?(\d+(?:\.\d+)?)\s*(%p|%P|퍼센트포인트|%\s*포인트|%\s*p)/gi, type: 'percent_point' },
    { pattern: /(?:연\s*)?(\d+(?:\.\d+)?)\s*(%|퍼센트)/gi, type: 'percent' },
    { pattern: /약?\s*(\d+(?:\.\d+)?)\s*(조)\s*(원|달러|위안)?/gi, type: 'trillion' },
    { pattern: /약?\s*(\d[\d,.]*)\s*(억)\s*(원|달러|위안)?/gi, type: 'billion' },
    { pattern: /약?\s*(\d[\d,.]*)\s*(만)\s*(원|달러|명|건|개)?/gi, type: 'ten_thousand' },
    { pattern: /(\d[\d,.]*)\s*(mmHg|bpm|mg|mL|mcg|μg|cc|IU)/g, type: 'medical_unit' },
    { pattern: /(\d[\d,.]*)\s*(명|건|개|회|년|월|일|세|개월|차원|kg|km|MB|GB|TB)/gi, type: 'count' },
    { pattern: /(\d{4})\s*년/g, type: 'year' },
    { pattern: /(\d{4})\s*년\s*(\d{1,2})\s*월/g, type: 'date' },
    // 영어 대규모 수치
    { pattern: /(\d[\d,.]*)\s*(trillion|billion|million)\s*(won|dollars?|USD|EUR|KRW)?/gi, type: 'en_large' },
    { pattern: /(\d+\.\d+)/g, type: 'decimal' },
];

// "대비 0.05% 상승" 처럼 %p 표기 없이도 변동폭인 경우를 감지하는 패턴
const CHANGE_CONTEXT_PATTERN = /(대비|변동|변화|증감|등락|상승|하락|인상|인하|축소|확대|증가|감소|increased?\s*by|decreased?\s*by|rose?\s*by|fell?\s*by|drop(?:ped)?\s*by|up\s+by|down\s+by|gain(?:ed)?\s*of|loss\s*of|chang(?:e|ed)\s*(?:of|by)|rising|declining|growth\s*of)\s*\S{0,10}$/i;

const CONTEXT_KEYWORDS = /(GDP|금리|이율|기준금리|인구|매출|수익|가격|비용|면적|거리|속도|무게|한도|세율|보험료|연금|대출|예산|수수료|연회비|보장|성장률|실업률|물가|환율|시가총액|자본금|부채|자산|이자율|수익률|연이율|배당률|배당금|순이익|영업이익|출생률|사망률|취업률|합격률|점유율|용량|투여량|혈압|혈당|체온|맥박|산소포화도|BMI|학점|정원|이수|학비|등록금|학년|합격률|병력|전력|국방비|방위비|사상자|예산|세입|세출|인구|세대수|조항|법률|interest\s*rate|deposit\s*rate|lending\s*rate|loan\s*rate|exchange\s*rate|growth\s*rate|inflation|revenue|expenditure|budget|population|mortality|survival\s*rate|blood\s*pressure|dosage|enrollment|tuition|personnel|troops|casualties)/gi;

// 세부 지표 패턴 — 도메인별 수치를 세분화하여 오탐 방지
const SUB_CONTEXT_PATTERNS = [
    // ── 금융 ──
    { pattern: /(저축성\s*수신|수신)\s*금리/g, subContext: '수신금리' },
    { pattern: /(대출|여신)\s*금리/g, subContext: '대출금리' },
    { pattern: /금리\s*차/g, subContext: '금리차' },
    { pattern: /총\s*수신\s*금리/g, subContext: '총수신금리' },
    { pattern: /총\s*대출\s*금리/g, subContext: '총대출금리' },
    { pattern: /총\s*금리\s*차/g, subContext: '총금리차' },
    { pattern: /예금\s*금리/g, subContext: '예금금리' },
    { pattern: /(상호저축|저축)\s*은행/g, subContext: '상호저축은행' },
    { pattern: /신용\s*협동\s*조합/g, subContext: '신용협동조합' },
    { pattern: /상호\s*금융/g, subContext: '상호금융' },
    { pattern: /새마을\s*금고/g, subContext: '새마을금고' },

    // ── 의료 ──
    { pattern: /수축기\s*혈압/g, subContext: '수축기혈압' },
    { pattern: /이완기\s*혈압/g, subContext: '이완기혈압' },
    { pattern: /공복\s*혈당/g, subContext: '공복혈당' },
    { pattern: /식후\s*혈당/g, subContext: '식후혈당' },
    { pattern: /당화\s*혈색소/g, subContext: '당화혈색소' },
    { pattern: /산소\s*포화도/g, subContext: '산소포화도' },
    { pattern: /(1일|1회|단회)\s*투여량/g, subContext: '1회투여량' },
    { pattern: /(최대|최소|권장)\s*투여량/g, subContext: '권장투여량' },
    { pattern: /(1일|1회|단회)\s*용량/g, subContext: '1회용량' },
    { pattern: /(최대|최소|권장)\s*용량/g, subContext: '권장용량' },
    { pattern: /생존율/g, subContext: '생존율' },
    { pattern: /사망률/g, subContext: '사망률' },
    { pattern: /치료율/g, subContext: '치료율' },
    { pattern: /완치율/g, subContext: '완치율' },
    { pattern: /재발률/g, subContext: '재발률' },
    { pattern: /감염률/g, subContext: '감염률' },

    // ── 교육 ──
    { pattern: /평균\s*학점/g, subContext: '평균학점' },
    { pattern: /졸업\s*학점/g, subContext: '졸업학점' },
    { pattern: /이수\s*학점/g, subContext: '이수학점' },
    { pattern: /취득\s*학점/g, subContext: '취득학점' },
    { pattern: /모집\s*정원/g, subContext: '모집정원' },
    { pattern: /입학\s*정원/g, subContext: '입학정원' },
    { pattern: /경쟁률/g, subContext: '경쟁률' },
    { pattern: /합격률/g, subContext: '합격률' },
    { pattern: /취업률/g, subContext: '취업률' },
    { pattern: /중도\s*탈락률/g, subContext: '중도탈락률' },
    { pattern: /등록금/g, subContext: '등록금' },
    { pattern: /장학금/g, subContext: '장학금' },

    // ── 국방 ──
    { pattern: /현역\s*병력/g, subContext: '현역병력' },
    { pattern: /예비\s*병력/g, subContext: '예비병력' },
    { pattern: /총\s*병력/g, subContext: '총병력' },
    { pattern: /국방\s*예산/g, subContext: '국방예산' },
    { pattern: /방위비/g, subContext: '방위비' },
    { pattern: /전사자/g, subContext: '전사자' },
    { pattern: /부상자/g, subContext: '부상자' },
    { pattern: /민간인\s*피해/g, subContext: '민간인피해' },
    { pattern: /사거리/g, subContext: '사거리' },
    { pattern: /탄두\s*중량/g, subContext: '탄두중량' },

    // ── 행정 ──
    { pattern: /세입\s*예산/g, subContext: '세입예산' },
    { pattern: /세출\s*예산/g, subContext: '세출예산' },
    { pattern: /총\s*예산/g, subContext: '총예산' },
    { pattern: /추경\s*예산/g, subContext: '추경예산' },
    { pattern: /주민\s*등록\s*인구/g, subContext: '주민등록인구' },
    { pattern: /등록\s*세대/g, subContext: '등록세대' },
    { pattern: /투표율/g, subContext: '투표율' },
    { pattern: /득표율/g, subContext: '득표율' },
    { pattern: /민원\s*건수/g, subContext: '민원건수' },
    { pattern: /처리\s*건수/g, subContext: '처리건수' },

    // ── 영어 금융 ──
    { pattern: /deposit\s*rate/gi, subContext: '수신금리' },
    { pattern: /savings?\s*rate/gi, subContext: '수신금리' },
    { pattern: /lending\s*rate/gi, subContext: '대출금리' },
    { pattern: /loan\s*rate/gi, subContext: '대출금리' },
    { pattern: /rate\s*spread/gi, subContext: '금리차' },
    { pattern: /interest\s*rate\s*gap/gi, subContext: '금리차' },

    // ── 영어 의료 ──
    { pattern: /systolic\s*(?:blood\s*)?(?:pressure|BP)/gi, subContext: '수축기혈압' },
    { pattern: /diastolic\s*(?:blood\s*)?(?:pressure|BP)/gi, subContext: '이완기혈압' },
    { pattern: /fasting\s*(?:blood\s*)?(?:glucose|sugar)/gi, subContext: '공복혈당' },
    { pattern: /postprandial\s*(?:blood\s*)?(?:glucose|sugar)/gi, subContext: '식후혈당' },
    { pattern: /(?:single|per)\s*dose/gi, subContext: '1회용량' },
    { pattern: /(?:max(?:imum)?|recommended)\s*dos(?:age|e)/gi, subContext: '권장용량' },
    { pattern: /survival\s*rate/gi, subContext: '생존율' },
    { pattern: /mortality\s*rate/gi, subContext: '사망률' },
    { pattern: /infection\s*rate/gi, subContext: '감염률' },
    { pattern: /recurrence\s*rate/gi, subContext: '재발률' },

    // ── 영어 교육 ──
    { pattern: /admission\s*(?:capacity|quota)/gi, subContext: '입학정원' },
    { pattern: /recruitment\s*(?:capacity|quota)/gi, subContext: '모집정원' },
    { pattern: /enrollment\s*(?:capacity|quota)/gi, subContext: '모집정원' },
    { pattern: /(?:graduation|required)\s*credits?/gi, subContext: '졸업학점' },
    { pattern: /tuition/gi, subContext: '등록금' },
    { pattern: /scholarship/gi, subContext: '장학금' },
    { pattern: /acceptance\s*rate/gi, subContext: '합격률' },
    { pattern: /employment\s*rate/gi, subContext: '취업률' },

    // ── 영어 국방 ──
    { pattern: /active\s*(?:duty\s*)?(?:troops|personnel|forces)/gi, subContext: '현역병력' },
    { pattern: /reserve\s*(?:troops|personnel|forces)/gi, subContext: '예비병력' },
    { pattern: /defense\s*budget/gi, subContext: '국방예산' },
    { pattern: /military\s*(?:spending|expenditure|budget)/gi, subContext: '국방예산' },
    { pattern: /(?:killed\s*in\s*action|KIA)/gi, subContext: '전사자' },
    { pattern: /(?:wounded|casualties)/gi, subContext: '부상자' },

    // ── 영어 행정 ──
    { pattern: /revenue\s*budget/gi, subContext: '세입예산' },
    { pattern: /expenditure\s*budget/gi, subContext: '세출예산' },
    { pattern: /total\s*budget/gi, subContext: '총예산' },
    { pattern: /voter\s*turnout/gi, subContext: '투표율' },
    { pattern: /vote\s*share/gi, subContext: '득표율' },
    { pattern: /registered\s*population/gi, subContext: '주민등록인구' },
];

const CONTEXT_CATEGORIES = {
    // ── 금융 (KR + EN) ──
    '금리': new Set(['금리', '이율', '기준금리', '이자율', '연이율', 'interest rate', 'deposit rate', 'lending rate', 'loan rate']),
    '수익': new Set(['수익', '수익률', '배당률', '배당금', '순이익', '영업이익', '매출', 'revenue', 'profit', 'earnings']),
    '가격': new Set(['가격', '비용', '수수료', '연회비', '보험료']),
    '자산': new Set(['자산', '부채', '자본금', '시가총액']),
    '환율': new Set(['환율', 'exchange rate']),
    'GDP': new Set(['GDP', '성장률', '물가', 'growth rate', 'inflation']),
    // ── 의료 (KR + EN) ──
    '혈압': new Set(['혈압', 'blood pressure']),
    '혈당': new Set(['혈당', '당화혈색소', 'glucose', 'blood sugar']),
    '활력징후': new Set(['체온', '맥박', '산소포화도']),
    '투여': new Set(['용량', '투여량', 'dosage', 'dose']),
    '의료통계': new Set(['생존율', '사망률', '치료율', '완치율', '재발률', '감염률', 'survival rate', 'mortality rate', 'infection rate']),
    // ── 교육 (KR + EN) ──
    '학점': new Set(['학점', '이수', 'credits', 'GPA']),
    '입학': new Set(['정원', '합격률', '경쟁률', 'enrollment', 'admission', 'acceptance rate']),
    '학비': new Set(['학비', '등록금', '장학금', 'tuition', 'scholarship']),
    // ── 국방 (KR + EN) ──
    '병력': new Set(['병력', '전력', 'troops', 'personnel', 'forces']),
    '국방비': new Set(['국방비', '방위비', '국방예산', 'defense budget', 'military spending']),
    '인명피해': new Set(['전사자', '부상자', '사상자', 'casualties', 'KIA']),
    // ── 행정 (KR + EN) ──
    '예산': new Set(['예산', '세율', '세입', '세출', 'budget', 'revenue', 'expenditure']),
    '인구': new Set(['인구', '출생률', '사망률', '세대수', 'population', 'mortality']),
    '고용': new Set(['실업률', '취업률', '합격률', 'employment rate', 'unemployment']),
    '선거': new Set(['투표율', '득표율', 'voter turnout', 'vote share']),
    '법률': new Set(['조항', '법률']),
};

// 날짜 역할 감지: 보고기간 vs 발표일 (한국어 + 영어)
const DATE_ROLE_REPORTING = /(보고|보고서|통계|데이터|자료|기준|실적|제목|제 목|월중|분기|반기|연간|대비|report(?:ing)?|data|statistics|quarter|fiscal|period|as\s*of)\s*$/i;
const DATE_ROLE_PUBLICATION = /(발표|공표|공보|조간|취급|보도|게시|배포|작성일|발행|publish(?:ed)?|released?|posted?|issued?|dated?)\s*$/i;

function contextsCompatible(ctx1, ctx2) {
    if (!ctx1 || !ctx2) return true;
    if (ctx1 === ctx2) return true;
    for (const words of Object.values(CONTEXT_CATEGORIES)) {
        if (words.has(ctx1) && words.has(ctx2)) return true;
    }
    return false;
}

function normalizeUnit(match, type) {
    if (type === 'percent_point') return '%p';
    if (type === 'percent') return '%';
    if (type === 'trillion') return '조' + (match[3] || '원');
    if (type === 'billion') return '억' + (match[3] || '원');
    if (type === 'ten_thousand') return '만' + (match[3] || '원');
    if (type === 'en_large') {
        const scale = (match[2] || '').toLowerCase();
        const curr = match[3] || '';
        return scale + (curr ? ' ' + curr : '');
    }
    if (type === 'medical_unit') return match[2];
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

            // "대비 0.05% 상승" 처럼 %p 표기 없이도 변동폭인 경우 → %p로 승격
            let finalUnit = unit;
            if (unit === '%') {
                const beforeNum = text.substring(Math.max(0, start - 30), start);
                if (CHANGE_CONTEXT_PATTERN.test(beforeNum)) {
                    finalUnit = '%p';
                }
            }

            // 날짜 역할 감지 (년/월/일/년월 단위일 때)
            let dateRole = null;
            if (unit === '년' || unit === '년월' || unit === '월' || unit === '일') {
                const beforeDate = text.substring(Math.max(0, start - 40), start);
                if (DATE_ROLE_REPORTING.test(beforeDate)) {
                    dateRole = 'reporting';
                } else if (DATE_ROLE_PUBLICATION.test(beforeDate)) {
                    dateRole = 'publication';
                }
            }

            // 세부 문맥 추출 (수신금리/대출금리/금리차 등 구분)
            // 수치 **앞에** 있으면서 가장 가까운 subContext 패턴을 찾음
            // "입학 정원 50명, 모집 정원 100명"에서 50명은 입학정원, 100명은 모집정원
            let subContext = null;
            let bestSubDist = Infinity;
            const subCtxSearchStart = Math.max(0, start - 120);
            const subCtxSearchEnd = Math.min(text.length, start + m[0].length + 30);
            const subCtxWindow = text.substring(subCtxSearchStart, subCtxSearchEnd);
            const numPosInSubWindow = start - subCtxSearchStart;
            for (const { pattern: sp, subContext: sc } of SUB_CONTEXT_PATTERNS) {
                sp.lastIndex = 0;
                let sm;
                while ((sm = sp.exec(subCtxWindow)) !== null) {
                    // subContext가 숫자 뒤에 있으면 가중 페널티 (앞에 있는 것이 우선)
                    const isBefore = sm.index < numPosInSubWindow;
                    const dist = Math.abs(sm.index - numPosInSubWindow) + (isBefore ? 0 : 200);
                    if (dist < bestSubDist) {
                        bestSubDist = dist;
                        subContext = sc;
                    }
                }
            }

            facts.push({ value, unit: finalUnit, context, raw, dateRole, subContext });
        }
    }
    return facts;
}

function valuesMatch(claimVal, evidenceVal, unit, tolerance = 0.05) {
    if (evidenceVal === 0) return claimVal === 0;
    if (unit === '%') return Math.abs(claimVal - evidenceVal) <= 0.5;
    if (unit === '%p') return Math.abs(claimVal - evidenceVal) <= 0.1; // 변동폭은 더 엄격
    if (unit === '년' || unit === '년월') return claimVal === evidenceVal;
    return Math.abs(claimVal - evidenceVal) / Math.abs(evidenceVal) <= tolerance;
}

function unitsCompatible(u1, u2) {
    // %와 %p는 절대값 vs 변동폭이므로 비교 불가
    if ((u1 === '%' && u2 === '%p') || (u1 === '%p' && u2 === '%')) return false;
    const groups = [
        new Set(['%']),
        new Set(['%p']),
        new Set(['조원', '억원', '만원', '조달러', '억달러', '만달러']),
        new Set(['명', '건', '개', '회', '만명', '만건', '만개']),
        new Set(['년', '월', '일', '개월', '세', '년월']),
        new Set(['mg', 'mcg', 'μg', 'IU']),      // 의료: 용량 단위
        new Set(['mL', 'cc']),                      // 의료: 부피 단위
        new Set(['trillion', 'trillion won', 'trillion dollars', 'trillion USD']),
        new Set(['billion', 'billion won', 'billion dollars', 'billion USD']),
        new Set(['million', 'million won', 'million dollars', 'million USD']),
    ];
    for (const g of groups) { if (g.has(u1) && g.has(u2)) return true; }
    return u1 === u2;
}

function findMatchingEvidenceFact(claimFact, evidenceFacts) {
    const candidates = [];
    for (const ef of evidenceFacts) {
        if (claimFact.context && ef.context && !contextsCompatible(claimFact.context, ef.context)) continue;

        // 날짜 역할이 서로 다르면 매칭 대상에서 제외
        // (보고기간 "2월"과 발표일 "3월 27일"을 비교하지 않음)
        if (claimFact.dateRole && ef.dateRole && claimFact.dateRole !== ef.dateRole) continue;

        // 세부 문맥이 모두 있고 다르면 제외 (수신금리 vs 대출금리)
        if (claimFact.subContext && ef.subContext && claimFact.subContext !== ef.subContext) continue;

        let score = 0;
        if (ef.unit === claimFact.unit) score += 3;
        if (claimFact.context && ef.context && claimFact.context === ef.context) score += 5;
        if (unitsCompatible(claimFact.unit, ef.unit)) score += 2;
        if (claimFact.context && ef.context && claimFact.context !== ef.context && contextsCompatible(claimFact.context, ef.context)) score += 3;
        // 세부 문맥이 일치하면 추가 점수
        if (claimFact.subContext && ef.subContext && claimFact.subContext === ef.subContext) score += 4;
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
// 5.5. 범위 불일치 감지 (전칭 vs 부분)
// ============================================================

const UNIVERSAL_QUANTIFIERS = /(?:모든|항상|전부|누구나|완전히|100%|all|every|always|entire|completely)/i;
const PARTIAL_QUANTIFIERS = /(?:일부|시범|부분|대부분|일부분|몇몇|약간|제한적|some|partial|pilot|limited|few|certain)/i;
const CERTAINTY_WORDS = /(?:완전히|확실히|반드시|분명히|definitely|certainly|fully|completely|absolutely)/i;
const UNCERTAINTY_WORDS = /(?:시범|검토|운영|예정|계획|추진|준비|진행|pilot|planned|reviewing|preparing|considering)/i;

function checkScopeMismatch(claim, evidenceText) {
    const claimHasUniversal = UNIVERSAL_QUANTIFIERS.test(claim);
    const evidenceHasPartial = PARTIAL_QUANTIFIERS.test(evidenceText);
    const claimHasCertainty = CERTAINTY_WORDS.test(claim);
    const evidenceHasUncertainty = UNCERTAINTY_WORDS.test(evidenceText);

    if (claimHasUniversal && evidenceHasPartial) {
        return `claim '${claim.match(UNIVERSAL_QUANTIFIERS)?.[0]}' vs evidence '${evidenceText.match(PARTIAL_QUANTIFIERS)?.[0]}'`;
    }
    if (claimHasCertainty && evidenceHasUncertainty) {
        return `claim 확정 표현 vs evidence 불확정 표현`;
    }
    return null;
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
        if (matched.length > 0 && matched[0].relevanceScore >= 0.38) {
            // 범위 불일치 검사: claim이 전칭(모든/항상)이고 evidence가 부분(일부/시범)이면 neutral
            const scopeMismatch = checkScopeMismatch(claim, matched[0].text);
            if (scopeMismatch) {
                verdict = 'neutral';
                confidence = 0.5;
                evidence = `[범위 불일치] ${scopeMismatch}: ${matched[0].text.substring(0, 150)}`;
                neutral++;
            } else {
                verdict = 'supported';
                confidence = Math.min(0.85, matched[0].relevanceScore + 0.1);
                evidence = matched[0].text.substring(0, 200);
                supported++;
            }
        } else if (guardrailHit && guardrailHit.severity === 'MEDIUM') {
            // MEDIUM 가드레일 → contradicted (neutral 과잉 방지)
            verdict = 'contradicted';
            confidence = guardrailHit.confidence;
            evidence = `[가드레일 ${guardrailHit.ruleId}] ${guardrailHit.message}`;
            contradicted++;
        } else {
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
