/**
 * Hancom Math <-> MathML Converter
 *
 * 한컴 수식(HWP 5.0 Equation Script)을 MathML (Presentation) 로 변환하고,
 * 그 역방향(MathML → 한컴 표기, AST → 양방향) 변환을 지원한다.
 *
 * 지원 범위 (한컴 수식 명세에서 자주 쓰이는 ~50% 표현):
 *   - 분수: FRAC / OVER {a} {b}
 *   - 제곱근: SQRT {a},   ROOT {n} OF {a}
 *   - 위/아래 첨자: a SUP b, a SUB b (a^{b}, a_{b} 단축 표기 포함)
 *   - 합/곱/적분: SUM_{i=0}^{n}, PROD_{...}, INT_{...}^{...} (LIMITS 변형)
 *   - 극한: LIM_{x→0}
 *   - 그리스 문자: alpha .. omega (대문자 Alpha..Omega)
 *   - 연산자 키워드: cdot, times, pm, mp, le, ge, ne, leq, geq, neq, infty
 *   - 그룹: { ... }
 *   - 행렬: MATRIX { a # b ## c # d }  (행 ##, 열 #)
 *   - PILE { a # b }  (세로 정렬)
 *   - LEFT ( ... RIGHT )  → \left(...\right)
 *
 * AST 표현 (간단한 JSON 트리):
 *   { type: 'seq', items: [Node, ...] }                  // 시퀀스(병렬)
 *   { type: 'text', value: 'abc' }                       // 문자(식별자/숫자/연산자)
 *   { type: 'op', value: '+' }                           // 명시적 연산자
 *   { type: 'sym', name: 'alpha' }                       // 심볼 (그리스/특수)
 *   { type: 'frac', num: Node, den: Node }               // 분수
 *   { type: 'sqrt', radicand: Node, index?: Node }       // 제곱/N제곱근
 *   { type: 'sup', base: Node, sup: Node }               // 위첨자
 *   { type: 'sub', base: Node, sub: Node }               // 아래첨자
 *   { type: 'subsup', base: Node, sub: Node, sup: Node } // 동시
 *   { type: 'bigop', op: 'sum'|'prod'|'int'|'lim',
 *     sub?: Node, sup?: Node, body?: Node }              // ∑/∏/∫/lim
 *   { type: 'matrix', rows: Node[][] }                   // MATRIX
 *   { type: 'pile', rows: Node[] }                       // PILE
 *   { type: 'fenced', open: '(', close: ')', body: Node }// LEFT...RIGHT
 *
 * @module lib/vanilla/math/hancom-math-converter
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Symbol catalog
// ---------------------------------------------------------------------------

/** 한컴 수식 키워드 → MathML 엔터티(또는 유니코드) */
const SYMBOLS = Object.freeze({
    // 그리스 소문자
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
    epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
    iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
    nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π',
    rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
    phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    // 그리스 대문자
    Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ',
    Epsilon: 'Ε', Zeta: 'Ζ', Eta: 'Η', Theta: 'Θ',
    Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ',
    Nu: 'Ν', Xi: 'Ξ', Omicron: 'Ο', Pi: 'Π',
    Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ', Upsilon: 'Υ',
    Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
    // 연산자 / 관계
    cdot: '⋅', times: '×', div: '÷',
    pm: '±', mp: '∓',
    le: '≤', leq: '≤', ge: '≥', geq: '≥',
    ne: '≠', neq: '≠',
    infty: '∞', infinity: '∞', inf: '∞',
    partial: '∂', nabla: '∇',
    rightarrow: '→', leftarrow: '←',
    Rightarrow: '⇒', Leftarrow: '⇐',
    leftrightarrow: '↔',
    to: '→',
    cdots: '⋯', ldots: '…',
    // 큰 연산자 (display)
    sum: '∑', prod: '∏', int: '∫',
});

/** 한컴 키워드 (소문자 비교용) – 토큰 종류 판별 시 사용 */
const KEYWORDS = Object.freeze(new Set([
    'over', 'under', 'left', 'right',
    'sum', 'prod', 'int', 'lim',
    'root', 'sup', 'sub', 'frac', 'sqrt',
    'matrix', 'pile', 'of',
    'cdot', 'times', 'div', 'pm', 'mp',
    'le', 'leq', 'ge', 'geq', 'ne', 'neq',
    'infty', 'infinity', 'inf', 'partial', 'nabla',
    'rightarrow', 'leftarrow', 'rightarrow', 'leftarrow',
    'leftrightarrow', 'to', 'cdots', 'ldots',
    // 그리스
    ...Object.keys(SYMBOLS).map((s) => s.toLowerCase()),
]));

const BIG_OPS = Object.freeze(new Set(['sum', 'prod', 'int', 'lim']));

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * @typedef {{type: string, value?: string}} Token
 */

/**
 * 한컴 수식 스크립트를 토큰 배열로 변환한다.
 * @param {string} src
 * @returns {Token[]}
 */
export function tokenize(src) {
    const tokens = [];
    if (typeof src !== 'string' || src.length === 0) return tokens;

    let i = 0;
    const n = src.length;

    while (i < n) {
        const ch = src[i];

        // 공백 스킵
        if (/\s/.test(ch)) { i++; continue; }

        // 행 구분자 (matrix) — '##' 먼저
        if (ch === '#' && src[i + 1] === '#') { tokens.push({ type: 'rowsep' }); i += 2; continue; }
        if (ch === '#') { tokens.push({ type: 'colsep' }); i++; continue; }

        // 그룹 / 괄호
        if (ch === '{') { tokens.push({ type: 'lbrace' }); i++; continue; }
        if (ch === '}') { tokens.push({ type: 'rbrace' }); i++; continue; }
        if (ch === '(' || ch === '[') { tokens.push({ type: 'lparen', value: ch }); i++; continue; }
        if (ch === ')' || ch === ']') { tokens.push({ type: 'rparen', value: ch }); i++; continue; }

        // 위/아래 첨자 단축
        if (ch === '^') { tokens.push({ type: 'kw', value: 'sup' }); i++; continue; }
        if (ch === '_') { tokens.push({ type: 'kw', value: 'sub' }); i++; continue; }

        // 연산자
        if ('+-*/=<>,;:!|'.includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
        }

        // 숫자
        if (/[0-9]/.test(ch)) {
            let j = i;
            while (j < n && /[0-9.]/.test(src[j])) j++;
            tokens.push({ type: 'num', value: src.slice(i, j) });
            i = j;
            continue;
        }

        // 식별자 / 키워드 (영문/한글 모두 식별자로 취급, 영어만 키워드 매칭)
        if (/[A-Za-zÀ-￿]/.test(ch)) {
            let j = i;
            while (j < n && /[A-Za-z0-9À-￿]/.test(src[j])) j++;
            const word = src.slice(i, j);
            const lower = word.toLowerCase();
            if (KEYWORDS.has(lower)) {
                // 그리스 대소문자는 원형 유지(SYMBOLS 키 매칭용)
                tokens.push({ type: 'kw', value: SYMBOLS[word] ? word : lower });
            } else {
                tokens.push({ type: 'ident', value: word });
            }
            i = j;
            continue;
        }

        // 알 수 없는 문자는 op 으로 흘려보냄
        tokens.push({ type: 'op', value: ch });
        i++;
    }

    return tokens;
}

// ---------------------------------------------------------------------------
// Parser : Tokens → AST
// ---------------------------------------------------------------------------

class HancomParser {
    /** @param {Token[]} tokens */
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek(offset = 0) { return this.tokens[this.pos + offset]; }
    consume() { return this.tokens[this.pos++]; }
    eof() { return this.pos >= this.tokens.length; }
    /** 특정 종류/값 토큰이면 소비 */
    eat(type, value) {
        const t = this.peek();
        if (!t) return null;
        if (t.type !== type) return null;
        if (value !== undefined && t.value !== value) return null;
        return this.consume();
    }

    /**
     * 종료 조건이 충족될 때까지 항을 누적
     * @param {(t: Token) => boolean} stop
     */
    parseSequence(stop) {
        const items = [];
        while (!this.eof()) {
            const t = this.peek();
            if (stop && stop(t)) break;

            const node = this.parsePostfix();
            if (node) items.push(node);
            else break;
        }
        if (items.length === 0) return { type: 'seq', items: [] };
        if (items.length === 1) return items[0];
        return { type: 'seq', items };
    }

    /** 한 개의 atom + 후위 연산자(SUP/SUB/OVER) 처리 */
    parsePostfix() {
        let base = this.parseAtom();
        if (!base) return null;

        // SUP / SUB / OVER 가 이어지는 경우 누적
        while (!this.eof()) {
            const t = this.peek();
            if (!t) break;

            if (t.type === 'kw' && t.value === 'sup') {
                this.consume();
                const sup = this.parseAtom();
                base = mergeSupSub(base, { sup });
                continue;
            }
            if (t.type === 'kw' && t.value === 'sub') {
                this.consume();
                const sub = this.parseAtom();
                base = mergeSupSub(base, { sub });
                continue;
            }
            if (t.type === 'kw' && t.value === 'over') {
                // a OVER b → frac
                this.consume();
                const den = this.parseAtom();
                base = { type: 'frac', num: base, den: den || textNode('') };
                continue;
            }
            break;
        }
        return base;
    }

    parseAtom() {
        const t = this.peek();
        if (!t) return null;

        // 그룹
        if (t.type === 'lbrace') {
            this.consume();
            const inner = this.parseSequence((tk) => tk.type === 'rbrace');
            this.eat('rbrace');
            return inner;
        }

        // 키워드
        if (t.type === 'kw') {
            const kw = t.value;

            if (kw === 'frac') {
                this.consume();
                const num = this.parseAtom() || textNode('');
                const den = this.parseAtom() || textNode('');
                return { type: 'frac', num, den };
            }
            if (kw === 'sqrt') {
                this.consume();
                const radicand = this.parseAtom() || textNode('');
                return { type: 'sqrt', radicand };
            }
            if (kw === 'root') {
                // ROOT {n} OF {a}
                this.consume();
                const index = this.parseAtom() || textNode('');
                this.eat('kw', 'of');
                const radicand = this.parseAtom() || textNode('');
                return { type: 'sqrt', radicand, index };
            }
            if (BIG_OPS.has(kw)) {
                this.consume();
                let sub, sup;
                // 후행 sub/sup
                while (true) {
                    const nt = this.peek();
                    if (!nt) break;
                    if (nt.type === 'kw' && nt.value === 'sub') { this.consume(); sub = this.parseAtom(); continue; }
                    if (nt.type === 'kw' && nt.value === 'sup') { this.consume(); sup = this.parseAtom(); continue; }
                    break;
                }
                return { type: 'bigop', op: kw, sub, sup };
            }
            if (kw === 'left') {
                this.consume();
                const openTok = this.consume(); // ( [ { 등
                const open = openTok ? (openTok.value || '(') : '(';
                const body = this.parseSequence((tk) => tk.type === 'kw' && tk.value === 'right');
                this.eat('kw', 'right');
                const closeTok = this.consume();
                const close = closeTok ? (closeTok.value || ')') : ')';
                return { type: 'fenced', open, close, body };
            }
            if (kw === 'matrix') {
                this.consume();
                // 다음은 { ... }
                if (!this.eat('lbrace')) return textNode('');
                const rows = [[]];
                let cur = [];
                while (!this.eof()) {
                    const nt = this.peek();
                    if (!nt) break;
                    if (nt.type === 'rbrace') { this.consume(); break; }
                    if (nt.type === 'colsep') {
                        this.consume();
                        rows[rows.length - 1].push(seqOf(cur));
                        cur = [];
                        continue;
                    }
                    if (nt.type === 'rowsep') {
                        this.consume();
                        rows[rows.length - 1].push(seqOf(cur));
                        cur = [];
                        rows.push([]);
                        continue;
                    }
                    const node = this.parsePostfix();
                    if (node) cur.push(node); else break;
                }
                rows[rows.length - 1].push(seqOf(cur));
                return { type: 'matrix', rows };
            }
            if (kw === 'pile') {
                this.consume();
                if (!this.eat('lbrace')) return textNode('');
                const rows = [];
                let cur = [];
                while (!this.eof()) {
                    const nt = this.peek();
                    if (!nt) break;
                    if (nt.type === 'rbrace') { this.consume(); break; }
                    if (nt.type === 'colsep' || nt.type === 'rowsep') {
                        this.consume();
                        rows.push(seqOf(cur));
                        cur = [];
                        continue;
                    }
                    const node = this.parsePostfix();
                    if (node) cur.push(node); else break;
                }
                rows.push(seqOf(cur));
                return { type: 'pile', rows };
            }

            // 심볼 (그리스 등)
            if (SYMBOLS[kw] !== undefined) {
                this.consume();
                return { type: 'sym', name: kw };
            }

            // 알 수 없는 키워드 → 텍스트로 폴백
            this.consume();
            return { type: 'text', value: kw };
        }

        if (t.type === 'ident') { this.consume(); return { type: 'text', value: t.value }; }
        if (t.type === 'num') { this.consume(); return { type: 'text', value: t.value }; }
        if (t.type === 'op') { this.consume(); return { type: 'op', value: t.value }; }
        if (t.type === 'lparen') {
            // 일반 괄호 — 토큰 그대로 op 처럼 다루되 fenced 가 아님
            this.consume();
            const body = this.parseSequence((tk) => tk.type === 'rparen');
            this.eat('rparen');
            return { type: 'fenced', open: t.value || '(', close: ')', body };
        }
        // 외톨이 rbrace / rparen / rowsep / colsep → 종료
        return null;
    }
}

function textNode(v) { return { type: 'text', value: v }; }

function seqOf(items) {
    if (items.length === 0) return { type: 'seq', items: [] };
    if (items.length === 1) return items[0];
    return { type: 'seq', items };
}

function mergeSupSub(base, partial) {
    // 이미 sub 만 있으면 subsup 으로, 반대도 마찬가지
    if (base.type === 'sub' && partial.sup !== undefined) {
        return { type: 'subsup', base: base.base, sub: base.sub, sup: partial.sup };
    }
    if (base.type === 'sup' && partial.sub !== undefined) {
        return { type: 'subsup', base: base.base, sub: partial.sub, sup: base.sup };
    }
    if (partial.sup !== undefined) return { type: 'sup', base, sup: partial.sup };
    if (partial.sub !== undefined) return { type: 'sub', base, sub: partial.sub };
    return base;
}

// ---------------------------------------------------------------------------
// Public API : Hancom script → AST
// ---------------------------------------------------------------------------

/**
 * @param {string} src 한컴 수식 표기 문자열
 * @returns {object} AST root
 */
export function hancomToAst(src) {
    const tokens = tokenize(src);
    const parser = new HancomParser(tokens);
    return parser.parseSequence(() => false);
}

// ---------------------------------------------------------------------------
// AST → MathML
// ---------------------------------------------------------------------------

function xmlEscape(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function mathmlIdentifier(value) {
    // 숫자만이면 <mn>, 그 외는 <mi>
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(value)) return `<mn>${xmlEscape(value)}</mn>`;
    return `<mi>${xmlEscape(value)}</mi>`;
}

/**
 * @param {object} node
 * @returns {string} MathML 조각
 */
export function astToMathml(node) {
    if (!node) return '';
    switch (node.type) {
        case 'seq':
            return (node.items || []).map(astToMathml).join('');
        case 'text': {
            const v = String(node.value ?? '');
            if (v === '') return '';
            return mathmlIdentifier(v);
        }
        case 'op':
            return `<mo>${xmlEscape(String(node.value ?? ''))}</mo>`;
        case 'sym': {
            const char = SYMBOLS[node.name] || node.name;
            // 그리스 문자는 mi, 큰 연산자/관계는 mo
            const bigOps = ['sum', 'prod', 'int'];
            if (bigOps.includes(node.name)) return `<mo>${xmlEscape(char)}</mo>`;
            // 관계/기호
            const opLike = ['cdot', 'times', 'div', 'pm', 'mp', 'le', 'leq', 'ge', 'geq',
                'ne', 'neq', 'rightarrow', 'leftarrow', 'leftrightarrow', 'to',
                'cdots', 'ldots'];
            if (opLike.includes(node.name)) return `<mo>${xmlEscape(char)}</mo>`;
            return `<mi>${xmlEscape(char)}</mi>`;
        }
        case 'frac':
            return `<mfrac>${wrapRow(astToMathml(node.num))}${wrapRow(astToMathml(node.den))}</mfrac>`;
        case 'sqrt':
            if (node.index) {
                return `<mroot>${wrapRow(astToMathml(node.radicand))}${wrapRow(astToMathml(node.index))}</mroot>`;
            }
            return `<msqrt>${astToMathml(node.radicand)}</msqrt>`;
        case 'sup':
            return `<msup>${wrapRow(astToMathml(node.base))}${wrapRow(astToMathml(node.sup))}</msup>`;
        case 'sub':
            return `<msub>${wrapRow(astToMathml(node.base))}${wrapRow(astToMathml(node.sub))}</msub>`;
        case 'subsup':
            return `<msubsup>${wrapRow(astToMathml(node.base))}${wrapRow(astToMathml(node.sub))}${wrapRow(astToMathml(node.sup))}</msubsup>`;
        case 'bigop': {
            const opChar = SYMBOLS[node.op] || node.op;
            let opML;
            if (node.op === 'lim') {
                opML = `<mo>lim</mo>`;
            } else {
                opML = `<mo>${xmlEscape(opChar)}</mo>`;
            }
            if (node.sub && node.sup) {
                return `<munderover>${opML}${wrapRow(astToMathml(node.sub))}${wrapRow(astToMathml(node.sup))}</munderover>`;
            }
            if (node.sub) {
                return `<munder>${opML}${wrapRow(astToMathml(node.sub))}</munder>`;
            }
            if (node.sup) {
                return `<mover>${opML}${wrapRow(astToMathml(node.sup))}</mover>`;
            }
            return opML;
        }
        case 'matrix': {
            const rows = (node.rows || []).map((row) => {
                const cells = row.map((cell) => `<mtd>${astToMathml(cell)}</mtd>`).join('');
                return `<mtr>${cells}</mtr>`;
            }).join('');
            return `<mtable>${rows}</mtable>`;
        }
        case 'pile': {
            const rows = (node.rows || []).map((cell) => `<mtr><mtd>${astToMathml(cell)}</mtd></mtr>`).join('');
            return `<mtable>${rows}</mtable>`;
        }
        case 'fenced': {
            const open = `<mo>${xmlEscape(node.open || '(')}</mo>`;
            const close = `<mo>${xmlEscape(node.close || ')')}</mo>`;
            return `<mrow>${open}${astToMathml(node.body)}${close}</mrow>`;
        }
        default:
            return '';
    }
}

function wrapRow(inner) {
    if (!inner) return '<mrow></mrow>';
    // 이미 단일 원소면 mrow 로 감싸기
    return `<mrow>${inner}</mrow>`;
}

/**
 * AST를 <math> 루트로 감싼 MathML 문자열을 만든다.
 * @param {object} ast
 * @param {{display?: boolean}} [opts]
 */
export function toMathML(ast, opts = {}) {
    const display = opts.display ? ' display="block"' : '';
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"${display}>${astToMathml(ast)}</math>`;
}

// ---------------------------------------------------------------------------
// MathML → AST (역변환)
// ---------------------------------------------------------------------------

/** SYMBOLS 의 역인덱스 (문자→이름) */
const CHAR_TO_NAME = (() => {
    const map = new Map();
    for (const [name, ch] of Object.entries(SYMBOLS)) {
        if (!map.has(ch)) map.set(ch, name);
    }
    return map;
})();

/**
 * MathML XML 문자열 → AST.
 * 브라우저 DOMParser 가 가능한 환경(jsdom 포함)에서 동작한다.
 * @param {string} xml
 * @returns {object} AST
 */
export function fromMathML(xml) {
    if (typeof xml !== 'string' || xml.trim() === '') {
        return { type: 'seq', items: [] };
    }
    let doc;
    try {
        if (typeof DOMParser === 'undefined') {
            return { type: 'seq', items: [] };
        }
        doc = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        return { type: 'seq', items: [] };
    }
    const root = doc?.documentElement;
    if (!root) return { type: 'seq', items: [] };
    return mathmlElementToAst(root);
}

function mathmlElementToAst(el) {
    if (!el) return { type: 'seq', items: [] };
    const tag = (el.localName || '').toLowerCase();

    switch (tag) {
        case 'math':
        case 'mrow':
        case 'mstyle':
        case 'mpadded': {
            const items = childrenToAst(el);
            if (items.length === 1) return items[0];
            return { type: 'seq', items };
        }
        case 'mi': {
            const text = (el.textContent || '').trim();
            const name = CHAR_TO_NAME.get(text);
            if (name) return { type: 'sym', name };
            return { type: 'text', value: text };
        }
        case 'mn':
            return { type: 'text', value: (el.textContent || '').trim() };
        case 'mo': {
            const text = (el.textContent || '').trim();
            const name = CHAR_TO_NAME.get(text);
            if (name) return { type: 'sym', name };
            return { type: 'op', value: text };
        }
        case 'mfrac': {
            const kids = childrenToAst(el);
            return { type: 'frac', num: kids[0] || textNode(''), den: kids[1] || textNode('') };
        }
        case 'msqrt': {
            const kids = childrenToAst(el);
            return { type: 'sqrt', radicand: kids.length === 1 ? kids[0] : seqOf(kids) };
        }
        case 'mroot': {
            const kids = childrenToAst(el);
            return { type: 'sqrt', radicand: kids[0] || textNode(''), index: kids[1] || textNode('') };
        }
        case 'msup': {
            const kids = childrenToAst(el);
            return { type: 'sup', base: kids[0] || textNode(''), sup: kids[1] || textNode('') };
        }
        case 'msub': {
            const kids = childrenToAst(el);
            return { type: 'sub', base: kids[0] || textNode(''), sub: kids[1] || textNode('') };
        }
        case 'msubsup': {
            const kids = childrenToAst(el);
            return {
                type: 'subsup',
                base: kids[0] || textNode(''),
                sub: kids[1] || textNode(''),
                sup: kids[2] || textNode(''),
            };
        }
        case 'munder':
        case 'mover':
        case 'munderover': {
            const kids = childrenToAst(el);
            const base = kids[0];
            // base 가 큰 연산자(sym) 이면 bigop
            const opName = base && base.type === 'sym' ? base.name : null;
            const op = BIG_OPS.has(opName) ? opName : (base && base.type === 'op' && base.value === 'lim' ? 'lim' : null);
            if (op) {
                if (tag === 'munder') return { type: 'bigop', op, sub: kids[1] };
                if (tag === 'mover') return { type: 'bigop', op, sup: kids[1] };
                return { type: 'bigop', op, sub: kids[1], sup: kids[2] };
            }
            // 큰 연산자가 아니면 그대로 시퀀스로 폴백
            return { type: 'seq', items: kids };
        }
        case 'mtable': {
            const rows = [];
            for (const tr of Array.from(el.children || [])) {
                if ((tr.localName || '').toLowerCase() !== 'mtr') continue;
                const cells = [];
                for (const td of Array.from(tr.children || [])) {
                    if ((td.localName || '').toLowerCase() !== 'mtd') continue;
                    const inner = childrenToAst(td);
                    cells.push(inner.length === 1 ? inner[0] : seqOf(inner));
                }
                rows.push(cells);
            }
            // 단일 컬럼이면 pile, 아니면 matrix
            if (rows.every((r) => r.length === 1)) {
                return { type: 'pile', rows: rows.map((r) => r[0]) };
            }
            return { type: 'matrix', rows };
        }
        case 'mfenced': {
            const open = el.getAttribute('open') || '(';
            const close = el.getAttribute('close') || ')';
            const body = seqOf(childrenToAst(el));
            return { type: 'fenced', open, close, body };
        }
        default: {
            // 알려지지 않은 태그 → 자식 시퀀스
            const items = childrenToAst(el);
            if (items.length === 1) return items[0];
            return { type: 'seq', items };
        }
    }
}

function childrenToAst(el) {
    const out = [];
    for (const c of Array.from(el.children || [])) {
        out.push(mathmlElementToAst(c));
    }
    return out;
}

// ---------------------------------------------------------------------------
// AST → Hancom Script (역방향)
// ---------------------------------------------------------------------------

/**
 * @param {object} node
 * @returns {string}
 */
export function toHancomScript(node) {
    if (!node) return '';
    switch (node.type) {
        case 'seq':
            return (node.items || []).map(toHancomScript).join(' ').replace(/\s+/g, ' ').trim();
        case 'text':
            return String(node.value ?? '');
        case 'op':
            return String(node.value ?? '');
        case 'sym':
            return node.name;
        case 'frac':
            return `FRAC {${toHancomScript(node.num)}} {${toHancomScript(node.den)}}`;
        case 'sqrt':
            if (node.index) return `ROOT {${toHancomScript(node.index)}} OF {${toHancomScript(node.radicand)}}`;
            return `SQRT {${toHancomScript(node.radicand)}}`;
        case 'sup':
            return `{${toHancomScript(node.base)}} SUP {${toHancomScript(node.sup)}}`;
        case 'sub':
            return `{${toHancomScript(node.base)}} SUB {${toHancomScript(node.sub)}}`;
        case 'subsup':
            return `{${toHancomScript(node.base)}} SUB {${toHancomScript(node.sub)}} SUP {${toHancomScript(node.sup)}}`;
        case 'bigop': {
            const op = node.op.toUpperCase();
            let s = op;
            if (node.sub) s += ` SUB {${toHancomScript(node.sub)}}`;
            if (node.sup) s += ` SUP {${toHancomScript(node.sup)}}`;
            if (node.body) s += ` {${toHancomScript(node.body)}}`;
            return s;
        }
        case 'matrix': {
            const rows = (node.rows || [])
                .map((row) => row.map(toHancomScript).join(' # '))
                .join(' ## ');
            return `MATRIX {${rows}}`;
        }
        case 'pile': {
            const rows = (node.rows || []).map(toHancomScript).join(' # ');
            return `PILE {${rows}}`;
        }
        case 'fenced':
            return `LEFT ${node.open || '('} ${toHancomScript(node.body)} RIGHT ${node.close || ')'}`;
        default:
            return '';
    }
}

// ---------------------------------------------------------------------------
// 한컴 ↔ MathML 단축 헬퍼
// ---------------------------------------------------------------------------

/**
 * 한컴 수식 표기 → MathML 문자열
 * @param {string} src
 * @param {{display?: boolean}} [opts]
 * @returns {string} MathML
 */
export function hancomToMathML(src, opts) {
    const ast = hancomToAst(src);
    return toMathML(ast, opts);
}

/**
 * MathML 문자열 → 한컴 수식 표기
 * @param {string} xml
 * @returns {string}
 */
export function mathMLToHancom(xml) {
    const ast = fromMathML(xml);
    return toHancomScript(ast);
}

export const __test__ = { SYMBOLS, CHAR_TO_NAME };

export default {
    tokenize,
    hancomToAst,
    toMathML,
    astToMathml,
    fromMathML,
    toHancomScript,
    hancomToMathML,
    mathMLToHancom,
};
