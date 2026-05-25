/**
 * MathML <-> KaTeX/LaTeX Bridge
 *
 * - mathmlToLatex(xml):     MathML 트리를 KaTeX 호환 LaTeX 로 변환
 * - katexToMathml(latex):   KaTeX의 `output: 'mathml'` 렌더 결과에서 <math>...</math> 추출
 * - renderKaTeXFromMathML:  MathML → LaTeX → KaTeX HTML 렌더 (브라우저 환경)
 *
 * KaTeX 자체는 LaTeX 입력만 받기 때문에, "MathML → LaTeX" 부분은 자체 변환기를
 * 사용한다.  자주 쓰이는 표현식 위주 (frac, sqrt, sup/sub, sum/prod/int/lim,
 * 행렬, fenced, 그리스 문자) 만 지원하며, 그 외는 텍스트로 보존한다.
 *
 * @module lib/vanilla/math/mathml-katex-bridge
 * @version 1.0.0
 */

let katexModulePromise = null;

/**
 * KaTeX 모듈을 게으르게 로드 (ESM dynamic import).
 * 테스트/서버 환경에서 실패해도 throw 하지 않고 null 반환.
 * @returns {Promise<any|null>}
 */
export async function loadKaTeX() {
    if (katexModulePromise) return katexModulePromise;
    katexModulePromise = (async () => {
        try {
            const mod = await import('katex');
            return mod.default || mod;
        } catch {
            return null;
        }
    })();
    return katexModulePromise;
}

// ---------------------------------------------------------------------------
// 그리스/심볼 매핑 : 유니코드 → LaTeX 매크로
// ---------------------------------------------------------------------------

const UNICODE_TO_LATEX = Object.freeze({
    // 그리스 소문자
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
    'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
    'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
    'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
    'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
    'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    // 그리스 대문자
    'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
    'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Υ': '\\Upsilon',
    'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega',
    // 큰 연산자
    '∑': '\\sum', '∏': '\\prod', '∫': '\\int',
    // 관계 / 연산
    '×': '\\times', '÷': '\\div', '⋅': '\\cdot',
    '±': '\\pm', '∓': '\\mp',
    '≤': '\\le', '≥': '\\ge', '≠': '\\neq',
    '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla',
    '→': '\\to', '←': '\\leftarrow',
    '⇒': '\\Rightarrow', '⇐': '\\Leftarrow',
    '↔': '\\leftrightarrow',
    '⋯': '\\cdots', '…': '\\ldots',
});

function escapeLatexText(s) {
    return String(s).replace(/([\\{}$&#%_^~])/g, '\\$1');
}

function unicodeToLatex(s) {
    if (!s) return '';
    let out = '';
    for (const ch of s) {
        out += UNICODE_TO_LATEX[ch] || ch;
    }
    return out;
}

// ---------------------------------------------------------------------------
// MathML → LaTeX
// ---------------------------------------------------------------------------

/**
 * MathML XML 문자열을 KaTeX 가 이해하는 LaTeX 로 변환.
 * @param {string} xml
 * @returns {string} LaTeX 표기
 */
export function mathmlToLatex(xml) {
    if (typeof xml !== 'string' || xml.trim() === '') return '';
    if (typeof DOMParser === 'undefined') return '';
    let doc;
    try {
        doc = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        return '';
    }
    const root = doc?.documentElement;
    if (!root) return '';
    return mathmlElementToLatex(root).trim();
}

function mathmlElementToLatex(el) {
    if (!el) return '';
    const tag = (el.localName || '').toLowerCase();
    switch (tag) {
        case 'math':
        case 'mrow':
        case 'mstyle':
        case 'mpadded':
            return childrenLatex(el);
        case 'mi': {
            const text = (el.textContent || '').trim();
            if (UNICODE_TO_LATEX[text]) return UNICODE_TO_LATEX[text] + ' ';
            // 한 글자 이상이면 \mathrm{} 로 묶음
            if (text.length > 1) return `\\mathrm{${escapeLatexText(text)}}`;
            return escapeLatexText(text);
        }
        case 'mn':
            return (el.textContent || '').trim();
        case 'mo': {
            const text = (el.textContent || '').trim();
            if (UNICODE_TO_LATEX[text]) return UNICODE_TO_LATEX[text] + ' ';
            return text;
        }
        case 'mfrac': {
            const kids = childrenArray(el);
            const num = mathmlElementToLatex(kids[0]);
            const den = mathmlElementToLatex(kids[1]);
            return `\\frac{${num}}{${den}}`;
        }
        case 'msqrt':
            return `\\sqrt{${childrenLatex(el)}}`;
        case 'mroot': {
            const kids = childrenArray(el);
            return `\\sqrt[${mathmlElementToLatex(kids[1])}]{${mathmlElementToLatex(kids[0])}}`;
        }
        case 'msup': {
            const kids = childrenArray(el);
            return `{${mathmlElementToLatex(kids[0])}}^{${mathmlElementToLatex(kids[1])}}`;
        }
        case 'msub': {
            const kids = childrenArray(el);
            return `{${mathmlElementToLatex(kids[0])}}_{${mathmlElementToLatex(kids[1])}}`;
        }
        case 'msubsup': {
            const kids = childrenArray(el);
            return `{${mathmlElementToLatex(kids[0])}}_{${mathmlElementToLatex(kids[1])}}^{${mathmlElementToLatex(kids[2])}}`;
        }
        case 'munder': {
            const kids = childrenArray(el);
            const base = mathmlElementToLatex(kids[0]);
            const under = mathmlElementToLatex(kids[1]);
            if (looksLikeBigOp(base)) return `${base}_{${under}}`;
            return `\\underset{${under}}{${base}}`;
        }
        case 'mover': {
            const kids = childrenArray(el);
            const base = mathmlElementToLatex(kids[0]);
            const over = mathmlElementToLatex(kids[1]);
            if (looksLikeBigOp(base)) return `${base}^{${over}}`;
            return `\\overset{${over}}{${base}}`;
        }
        case 'munderover': {
            const kids = childrenArray(el);
            const base = mathmlElementToLatex(kids[0]);
            const under = mathmlElementToLatex(kids[1]);
            const over = mathmlElementToLatex(kids[2]);
            if (looksLikeBigOp(base)) return `${base}_{${under}}^{${over}}`;
            return `\\overset{${over}}{\\underset{${under}}{${base}}}`;
        }
        case 'mtable': {
            const rows = [];
            for (const tr of Array.from(el.children || [])) {
                if ((tr.localName || '').toLowerCase() !== 'mtr') continue;
                const cells = [];
                for (const td of Array.from(tr.children || [])) {
                    if ((td.localName || '').toLowerCase() !== 'mtd') continue;
                    cells.push(childrenLatex(td));
                }
                rows.push(cells.join(' & '));
            }
            // 단일 컬럼은 cases-스러운 PILE 로 별도 표기
            const isSingle = rows.every((r) => !r.includes('&'));
            if (isSingle) {
                return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
            }
            return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
        }
        case 'mfenced': {
            const open = el.getAttribute('open') || '(';
            const close = el.getAttribute('close') || ')';
            return `\\left${escapeBrace(open)} ${childrenLatex(el)} \\right${escapeBrace(close)}`;
        }
        case 'mtext':
            return `\\text{${(el.textContent || '').replace(/[{}\\]/g, '')}}`;
        default:
            return childrenLatex(el);
    }
}

function childrenArray(el) {
    return Array.from(el.children || []);
}

function childrenLatex(el) {
    const parts = [];
    for (const c of childrenArray(el)) {
        const piece = mathmlElementToLatex(c);
        if (piece) parts.push(piece);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function looksLikeBigOp(latex) {
    return /^(\\sum|\\prod|\\int|\\lim|lim)/.test(latex.trim());
}

function escapeBrace(ch) {
    if (ch === '{' || ch === '}') return '\\' + ch;
    return ch;
}

// ---------------------------------------------------------------------------
// KaTeX → MathML
// ---------------------------------------------------------------------------

/**
 * KaTeX 의 `output: 'mathml'` 옵션을 사용해 LaTeX 를 MathML 문자열로 변환.
 * 실패 시 빈 문자열 반환.
 * @param {string} latex
 * @param {{display?: boolean}} [opts]
 * @returns {Promise<string>} MathML XML
 */
export async function katexToMathml(latex, opts = {}) {
    if (typeof latex !== 'string' || latex.trim() === '') return '';
    const katex = await loadKaTeX();
    if (!katex || typeof katex.renderToString !== 'function') return '';
    try {
        const html = katex.renderToString(latex, {
            displayMode: !!opts.display,
            throwOnError: false,
            output: 'mathml',
        });
        // KaTeX 출력에서 첫 번째 <math ...>...</math> 추출
        const match = html.match(/<math[\s\S]*?<\/math>/);
        return match ? match[0] : '';
    } catch {
        return '';
    }
}

/**
 * MathML 을 받아 KaTeX 로 렌더링한 HTML 문자열을 반환.
 * 1) mathmlToLatex 로 LaTeX 추출
 * 2) KaTeX.renderToString
 * 둘 다 실패할 경우 MathML 원본을 반환 (브라우저 native MathML 렌더링 폴백).
 *
 * @param {string} mathml
 * @param {{display?: boolean}} [opts]
 * @returns {Promise<string>} HTML 또는 MathML 원본
 */
export async function renderKaTeXFromMathML(mathml, opts = {}) {
    const latex = mathmlToLatex(mathml);
    if (!latex) return mathml;
    const katex = await loadKaTeX();
    if (!katex || typeof katex.renderToString !== 'function') return mathml;
    try {
        return katex.renderToString(latex, {
            displayMode: !!opts.display,
            throwOnError: false,
            output: 'html',
        });
    } catch {
        return mathml;
    }
}

export default {
    loadKaTeX,
    mathmlToLatex,
    katexToMathml,
    renderKaTeXFromMathML,
};
