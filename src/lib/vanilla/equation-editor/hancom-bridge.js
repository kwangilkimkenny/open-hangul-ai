/**
 * Hancom Bridge
 *
 * 한컴 수식 표기 ↔ LaTeX 의 양방향 변환을 책임지는 얇은 브리지 모듈.
 * 트랙 J 의 `lib/vanilla/math/` 의 변환기를 합성한다:
 *
 *   Hancom Script  ──hancomToMathML──▶  MathML  ──mathmlToLatex──▶  LaTeX
 *   LaTeX          ──katexToMathml ──▶  MathML  ──mathMLToHancom──▶  Hancom Script
 *
 * 두 번째 방향은 `katexToMathml` 이 `katex.renderToString({output:'mathml'})` 에
 * 의존하므로 비동기이다. 동기적인 fallback 도 제공해 LaTeX → 한컴 표기를
 * 토큰 단위로 다이렉트 변환한다 (간단한 케이스 한정).
 *
 * @module lib/vanilla/equation-editor/hancom-bridge
 * @version 1.0.0
 */

import {
    hancomToMathML,
    mathMLToHancom,
} from '../math/hancom-math-converter.js';
import {
    mathmlToLatex,
    katexToMathml,
} from '../math/mathml-katex-bridge.js';

/**
 * 한컴 수식 스크립트를 LaTeX 로 변환한다.
 * 1) Hancom → MathML  (트랙 J)
 * 2) MathML → LaTeX   (트랙 J)
 *
 * @param {string} script
 * @returns {string} LaTeX
 */
export function hancomScriptToLatex(script) {
    if (typeof script !== 'string' || script.trim() === '') return '';
    const mathml = hancomToMathML(script);
    if (!mathml) return '';
    return mathmlToLatex(mathml);
}

/**
 * LaTeX → 한컴 수식 스크립트 (비동기, KaTeX 가 필요).
 *
 * @param {string} latex
 * @returns {Promise<string>}
 */
export async function latexToHancomScriptAsync(latex) {
    if (typeof latex !== 'string' || latex.trim() === '') return '';
    const mathml = await katexToMathml(latex);
    if (!mathml) return latexToHancomScriptSync(latex);
    return mathMLToHancom(mathml);
}

/**
 * LaTeX → 한컴 수식 스크립트 (동기 fallback).
 * KaTeX 가 사용 불가능한 환경(테스트/SSR)에서도 동작하도록 자주 쓰이는
 * 명령만 단순 치환한다. 100% 의미보존을 보장하지 않으며 비동기 버전이
 * 우선 사용되어야 한다.
 *
 * @param {string} latex
 * @returns {string}
 */
export function latexToHancomScriptSync(latex) {
    if (typeof latex !== 'string' || latex.trim() === '') return '';
    let out = latex;

    // 1) \frac{a}{b}  → FRAC {a} {b}
    out = out.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, 'FRAC {$1} {$2}');
    // 2) \sqrt[n]{a}  → ROOT {n} OF {a}
    out = out.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, 'ROOT {$1} OF {$2}');
    // 3) \sqrt{a}     → SQRT {a}
    out = out.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'SQRT {$1}');
    // 4) ^{...}/_{...} 위치 표기는 그대로 두되 그룹 외 단일 토큰도 대비
    //    (mathlive 가 항상 그룹을 씌우므로 안전한 변환이 가능하다)

    // 5) 큰 연산자 매핑 — \sum_{...}^{...}, \prod, \int, \lim
    out = out.replace(/\\sum/g, 'SUM');
    out = out.replace(/\\prod/g, 'PROD');
    out = out.replace(/\\int/g, 'INT');
    out = out.replace(/\\lim/g, 'LIM');

    // 6) 그리스 / 기호 매핑 — UNICODE_TO_LATEX 의 역인덱스
    const greekMap = {
        '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', '\\delta': 'delta',
        '\\epsilon': 'epsilon', '\\zeta': 'zeta', '\\eta': 'eta', '\\theta': 'theta',
        '\\iota': 'iota', '\\kappa': 'kappa', '\\lambda': 'lambda', '\\mu': 'mu',
        '\\nu': 'nu', '\\xi': 'xi', '\\pi': 'pi', '\\rho': 'rho',
        '\\sigma': 'sigma', '\\tau': 'tau', '\\upsilon': 'upsilon', '\\phi': 'phi',
        '\\chi': 'chi', '\\psi': 'psi', '\\omega': 'omega',
        '\\Gamma': 'Gamma', '\\Delta': 'Delta', '\\Theta': 'Theta', '\\Lambda': 'Lambda',
        '\\Xi': 'Xi', '\\Pi': 'Pi', '\\Sigma': 'Sigma', '\\Upsilon': 'Upsilon',
        '\\Phi': 'Phi', '\\Psi': 'Psi', '\\Omega': 'Omega',
        '\\times': 'times', '\\div': 'div', '\\cdot': 'cdot',
        '\\pm': 'pm', '\\mp': 'mp',
        '\\le': 'le', '\\leq': 'leq', '\\ge': 'ge', '\\geq': 'geq', '\\neq': 'neq', '\\ne': 'ne',
        '\\infty': 'infty', '\\partial': 'partial', '\\nabla': 'nabla',
        '\\to': 'to', '\\rightarrow': 'rightarrow', '\\leftarrow': 'leftarrow',
        '\\Rightarrow': 'Rightarrow', '\\Leftarrow': 'Leftarrow',
        '\\leftrightarrow': 'leftrightarrow',
        '\\cdots': 'cdots', '\\ldots': 'ldots',
    };
    // 긴 매크로부터 매핑 (\Leftarrow 가 \le 보다 먼저)
    const macroKeys = Object.keys(greekMap).sort((a, b) => b.length - a.length);
    for (const k of macroKeys) {
        const re = new RegExp(escapeRegex(k) + '(?=[^A-Za-z]|$)', 'g');
        out = out.replace(re, ' ' + greekMap[k] + ' ');
    }

    // 7) \left( … \right) → LEFT ( … RIGHT )
    out = out.replace(/\\left\s*([(\[{|])/g, 'LEFT $1 ');
    out = out.replace(/\\right\s*([)\]}|])/g, ' RIGHT $1');

    // 8) \begin{matrix} a & b \\ c & d \end{matrix}  → MATRIX { a # b ## c # d }
    out = out.replace(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/g, (_, body) => {
        const rows = body.split(/\\\\/).map((r) => r.trim()).filter(Boolean);
        const cells = rows.map((r) => r.split('&').map((c) => c.trim()).join(' # '));
        return 'MATRIX {' + cells.join(' ## ') + '}';
    });

    // 9) 잔여 백슬래시 매크로 — 알 수 없는 매크로는 텍스트로 유지
    out = out.replace(/\\([A-Za-z]+)/g, '$1');

    // 10) 중복 공백 정리
    out = out.replace(/\s+/g, ' ').trim();
    return out;
}

/**
 * 동기 호환 alias — `latexToHancomScript(latex)` 는 fallback 변환을 즉시 반환한다.
 * 비동기 (정확한) 변환은 `latexToHancomScriptAsync` 를 사용하세요.
 *
 * @param {string} latex
 * @returns {string}
 */
export function latexToHancomScript(latex) {
    return latexToHancomScriptSync(latex);
}

/**
 * 라운드트립 검사: 한컴 → LaTeX → 한컴 의 결과를 함께 반환.
 * 결과의 `equivalent` 는 공백/대소문자 정규화 후 비교한 동치 여부.
 *
 * @param {string} script
 * @returns {{ latex: string, restored: string, equivalent: boolean }}
 */
export function roundTrip(script) {
    const latex = hancomScriptToLatex(script);
    const restored = latexToHancomScript(latex);
    return {
        latex,
        restored,
        equivalent: normalize(script) === normalize(restored),
    };
}

function normalize(s) {
    return String(s || '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}#])\s*/g, '$1')
        .trim()
        .toLowerCase();
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
    hancomScriptToLatex,
    latexToHancomScript,
    latexToHancomScriptSync,
    latexToHancomScriptAsync,
    roundTrip,
};
