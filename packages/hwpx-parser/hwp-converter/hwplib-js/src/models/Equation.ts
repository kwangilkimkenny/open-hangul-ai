/**
 * Equation (수식) 완벽 구현
 * HWP 수식을 MathML, LaTeX로 변환
 */

/**
 * 수식 객체
 */
export interface Equation {
  id: number;

  // 위치
  paragraphNo: number;
  charPos: number;

  // 수식 데이터
  hwpEquation: string;      // HWP 원본 수식 (Binary)
  mathML: string;           // MathML 형식
  latex?: string;           // LaTeX 형식
  text?: string;            // 플레인 텍스트 표현

  // 렌더링
  imageID?: number;         // 렌더링된 이미지 BinData 참조
  width: number;            // HWPUNIT
  height: number;           // HWPUNIT

  // 스타일
  fontSize: number;         // pt
  fontFamily: string;
  inline: boolean;          // 인라인 vs 블록
  alignment: EquationAlignment;

  // 기타
  color: number;            // RGB
  backgroundColor?: number;
  baseline: number;         // 베이스라인 오프셋
}

/**
 * 수식 정렬
 */
export enum EquationAlignment {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
}

/**
 * HWP 수식 토큰 타입
 */
/**
 * HWP 수식 토큰 타입 (Text Based)
 */
export enum HWPEquationTokenType {
  COMMAND = 'COMMAND',      // sqrt, sin, ...
  LBRACE = 'LBRACE',        // {
  RBRACE = 'RBRACE',        // }
  SUPERSCRIPT = 'SUP',      // ^
  SUBSCRIPT = 'SUB',        // _
  KEYWORD = 'KEYWORD',      // over (special infix)
  TEXT = 'TEXT',            // plain text/numbers
  OPERATOR = 'OP',          // +, -, =
  SPACE = 'SPACE',          // Whitespace
  EOF = 'EOF'
}

export interface HWPEquationToken {
  type: HWPEquationTokenType;
  value: string;
}

export const SYMBOL_MAP: { [key: string]: string } = {
  // Greek lowercase
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  // Greek uppercase
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ', Eta: 'Η', Theta: 'Θ',
  Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν', Xi: 'Ξ', Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ',
  Tau: 'Τ', Upsilon: 'Υ', Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',

  // 적분 및 합계 기호 (확장)
  sum: '∑', prod: '∏', int: '∫', oint: '∮', iint: '∬', iiint: '∭',
  coprod: '∐', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂',

  // 무한대 및 특수 기호
  inf: '∞', infty: '∞', partial: '∂', nabla: '∇', hbar: 'ℏ', ell: 'ℓ',

  // 집합 기호
  forall: '∀', exists: '∃', nexists: '∄', empty: '∅', emptyset: '∅',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃',
  subseteq: '⊆', supseteq: '⊇', nsubset: '⊄', nsupset: '⊅',
  union: '∪', intersection: '∩', cup: '∪', cap: '∩',
  setminus: '∖', complement: '∁',

  // 관계 연산자
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
  approx: '≈', equiv: '≡', cong: '≅', sim: '∼', simeq: '≃',
  ll: '≪', gg: '≫', prec: '≺', succ: '≻',

  // 화살표
  arrow: '→', rightarrow: '→', to: '→', larrow: '←', leftarrow: '←',
  lrarrow: '↔', leftrightarrow: '↔',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔',
  uparrow: '↑', downarrow: '↓', updownarrow: '↕',
  mapsto: '↦', hookrightarrow: '↪', hookleftarrow: '↩',

  // 이항 연산자
  times: '×', div: '÷', cdot: '⋅', ast: '∗', star: '⋆',
  pm: '±', mp: '∓', oplus: '⊕', ominus: '⊖', otimes: '⊗', oslash: '⊘',

  // 논리 연산자
  land: '∧', lor: '∨', lnot: '¬', neg: '¬',

  // 기타 기호
  prime: '′', dprime: '″', angle: '∠', perp: '⊥', parallel: '∥',
  therefore: '∴', because: '∵', propto: '∝',
  aleph: 'ℵ', beth: 'ℶ', gimel: 'ℷ',

  // 괄호
  langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋'
};

/**
 * 수식 파서 헬퍼 (Text Based for HWML)
 */
export class EquationHelper {
  /**
   * HWML 스크립트를 MathML로 변환
   */
  static convert(script: string, inline: boolean = false): string {
    if (!script || script.trim() === '') return '';

    // 1. 토큰화
    const tokens = this.tokenize(script);

    // 2. 파싱 (AST 생성)
    const parser = new HWMLParser(tokens);
    const root = parser.parse();

    // 3. MathML 생성
    const tag = inline ? 'math' : 'math display="block"';
    return `<${tag} xmlns="http://www.w3.org/1998/Math/MathML">${root.toMathML()}</${tag}>`;
  }

  /**
   * 간단한 토크나이저
   */
  private static tokenize(script: string): HWPEquationToken[] {
    const tokens: HWPEquationToken[] = [];
    let i = 0;

    while (i < script.length) {
      const char = script[i];

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      if (char === '{') {
        tokens.push({ type: HWPEquationTokenType.LBRACE, value: '{' });
        i++;
      } else if (char === '}') {
        tokens.push({ type: HWPEquationTokenType.RBRACE, value: '}' });
        i++;
      } else if (char === '^') {
        tokens.push({ type: HWPEquationTokenType.SUPERSCRIPT, value: '^' });
        i++;
      } else if (char === '_') {
        tokens.push({ type: HWPEquationTokenType.SUBSCRIPT, value: '_' });
        i++;
      } else if (/[a-zA-Z]/.test(char)) {
        // 단어 파싱 (명령어 또는 변수)
        let word = '';
        while (i < script.length && /[a-zA-Z]/.test(script[i])) {
          word += script[i];
          i++;
        }

        if (word === 'over') {
          tokens.push({ type: HWPEquationTokenType.KEYWORD, value: word });
        } else if (this.isCommand(word)) {
          tokens.push({ type: HWPEquationTokenType.COMMAND, value: word });
        } else {
          tokens.push({ type: HWPEquationTokenType.TEXT, value: word });
        }
      } else if (/[0-9]/.test(char)) {
        // 숫자 파싱
        let num = '';
        while (i < script.length && /[0-9.]/.test(script[i])) {
          num += script[i];
          i++;
        }
        tokens.push({ type: HWPEquationTokenType.TEXT, value: num });
      } else {
        // 기타 연산자/특수문자
        tokens.push({ type: HWPEquationTokenType.OPERATOR, value: char });
        i++;
      }
    }

    tokens.push({ type: HWPEquationTokenType.EOF, value: '' });
    return tokens;
  }

  private static isCommand(word: string): boolean {
    const commands = [
      // 기본 수식
      'sqrt', 'root', 'sin', 'cos', 'tan', 'log', 'ln', 'lim', 'sum', 'int', 'frac',
      // 그리스 문자
      'alpha', 'beta', 'gamma', 'theta', 'pi', 'mu', 'sigma', 'omega', 'delta', 'epsilon',
      'lambda', 'phi', 'psi', 'rho', 'tau', 'nu', 'xi', 'eta', 'zeta', 'kappa', 'chi',
      'Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Pi', 'Sigma', 'Omega', 'Lambda', 'Phi', 'Psi',
      // 연산자
      'times', 'div', 'cdot', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx', 'equiv',
      // 고급 수식 (새로 추가)
      'oint', 'iint', 'iiint', 'prod', 'coprod', 'bigcup', 'bigcap',
      'lim', 'sup', 'inf', 'min', 'max', 'gcd', 'lcm', 'det', 'exp',
      'vec', 'hat', 'bar', 'dot', 'ddot', 'tilde', 'overline', 'underline',
      'matrix', 'pmatrix', 'bmatrix', 'cases',
      'left', 'right', 'partial', 'nabla', 'infty', 'forall', 'exists',
      'in', 'notin', 'subset', 'supset', 'cup', 'cap',
      'to', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow',
      'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot'
    ];
    return commands.includes(word);
  }

  /**
   * HWML 스크립트를 LaTeX로 변환
   */
  static convertToLatex(script: string, inline: boolean = true): string {
    if (!script || script.trim() === '') return '';

    // 기본 변환 규칙 적용
    let latex = script;

    // 그리스 문자 변환
    Object.entries(SYMBOL_MAP).forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      latex = latex.replace(regex, `\\${key}`);
    });

    // 명령어 변환
    latex = latex.replace(/\bsqrt\s*\{/g, '\\sqrt{');
    latex = latex.replace(/\bfrac\s*\{/g, '\\frac{');
    latex = latex.replace(/\bover\b/g, '}{');  // A over B -> {A}{B} for \frac
    latex = latex.replace(/\bsum\b/g, '\\sum');
    latex = latex.replace(/\bint\b/g, '\\int');
    latex = latex.replace(/\bprod\b/g, '\\prod');
    latex = latex.replace(/\blim\b/g, '\\lim');
    latex = latex.replace(/\binfty\b/g, '\\infty');
    latex = latex.replace(/\bpartial\b/g, '\\partial');
    latex = latex.replace(/\bnabla\b/g, '\\nabla');
    latex = latex.replace(/\btimes\b/g, '\\times');
    latex = latex.replace(/\bdiv\b/g, '\\div');
    latex = latex.replace(/\bcdot\b/g, '\\cdot');
    latex = latex.replace(/\bpm\b/g, '\\pm');
    latex = latex.replace(/\bleq\b/g, '\\leq');
    latex = latex.replace(/\bgeq\b/g, '\\geq');
    latex = latex.replace(/\bneq\b/g, '\\neq');
    latex = latex.replace(/\bapprox\b/g, '\\approx');
    latex = latex.replace(/\brightarrow\b/g, '\\rightarrow');
    latex = latex.replace(/\bleftarrow\b/g, '\\leftarrow');
    latex = latex.replace(/\bforall\b/g, '\\forall');
    latex = latex.replace(/\bexists\b/g, '\\exists');
    latex = latex.replace(/\bin\b/g, '\\in');
    latex = latex.replace(/\bnotin\b/g, '\\notin');

    // 삼각함수
    latex = latex.replace(/\bsin\b/g, '\\sin');
    latex = latex.replace(/\bcos\b/g, '\\cos');
    latex = latex.replace(/\btan\b/g, '\\tan');
    latex = latex.replace(/\blog\b/g, '\\log');
    latex = latex.replace(/\bln\b/g, '\\ln');
    latex = latex.replace(/\bexp\b/g, '\\exp');

    // 인라인/디스플레이 모드
    if (inline) {
      return `$${latex}$`;
    } else {
      return `$$${latex}$$`;
    }
  }
}

// === 내부 Parser 클래스 ===

abstract class ASTNode {
  abstract toMathML(): string;
}

class BlockNode extends ASTNode {
  children: ASTNode[] = [];

  add(node: ASTNode) {
    this.children.push(node);
  }

  toMathML(): string {
    // 단일 자식이면 그냥 반환, 아니면 mrow로 감쌈
    if (this.children.length === 0) return '';
    // if (this.children.length === 1) return this.children[0].toMathML();
    return this.children.map(c => c.toMathML()).join('');
  }
}

class TextNode extends ASTNode {
  constructor(public text: string, public isIdentifier: boolean = false) { super(); }

  toMathML(): string {
    if (SYMBOL_MAP[this.text]) {
      // Greeks and symbols usually <mi> or <mo>. 
      // Single char Greeks are mi. Sum/Int are mo via OpNode but here they can come as text if not tokenized as command?
      // Actually my tokenizer handles 'sum' as COMMAND but TextNode handles COMMAND text?
      // Yes, parseItem returns TextNode for unknown commands.
      return `<mi>${SYMBOL_MAP[this.text]}</mi>`;
    }
    if (this.isIdentifier) {
      return `<mi>${this.text}</mi>`;
    }
    // 숫자는 mn
    if (/^[0-9.]+$/.test(this.text)) {
      return `<mn>${this.text}</mn>`;
    }
    return `<mi>${this.text}</mi>`;
  }
}

class OperatorNode extends ASTNode {
  constructor(public op: string) { super(); }

  toMathML(): string {
    let mapped = opMap[this.op] || this.op;
    return `<mo>${mapped}</mo>`;
  }
}

class FracNode extends ASTNode {
  constructor(public num: ASTNode, public den: ASTNode) { super(); }

  toMathML(): string {
    return `<mfrac><mrow>${this.num.toMathML()}</mrow><mrow>${this.den.toMathML()}</mrow></mfrac>`;
  }
}

class SqrtNode extends ASTNode {
  constructor(public content: ASTNode) { super(); }

  toMathML(): string {
    return `<msqrt>${this.content.toMathML()}</msqrt>`;
  }
}

class ScriptNode extends ASTNode {
  constructor(public base: ASTNode, public sub?: ASTNode, public sup?: ASTNode) { super(); }

  toMathML(): string {
    // Special handling for limit operators (sum, int, prod, lim)
    const limitOps = ['sum', 'int', 'prod', 'lim', 'oint', 'iint', 'iiint', 'coprod', 'bigcup', 'bigcap'];
    const baseText = this.base instanceof TextNode ? (this.base as TextNode).text : '';
    const isLimitOp = this.base instanceof TextNode && limitOps.includes(baseText);

    if (isLimitOp && (this.sub || this.sup)) {
      const symbol = SYMBOL_MAP[baseText] || baseText;
      // Use munderover for display-style limits
      if (this.sub && this.sup) {
        return `<munderover><mo>${symbol}</mo><mrow>${this.sub.toMathML()}</mrow><mrow>${this.sup.toMathML()}</mrow></munderover>`;
      } else if (this.sub) {
        return `<munder><mo>${symbol}</mo><mrow>${this.sub.toMathML()}</mrow></munder>`;
      } else if (this.sup) {
        return `<mover><mo>${symbol}</mo><mrow>${this.sup.toMathML()}</mrow></mover>`;
      }
    }

    if (this.sub && this.sup) {
      return `<msubsup><mrow>${this.base.toMathML()}</mrow><mrow>${this.sub.toMathML()}</mrow><mrow>${this.sup.toMathML()}</mrow></msubsup>`;
    } else if (this.sub) {
      return `<msub><mrow>${this.base.toMathML()}</mrow><mrow>${this.sub.toMathML()}</mrow></msub>`;
    } else if (this.sup) {
      return `<msup><mrow>${this.base.toMathML()}</mrow><mrow>${this.sup.toMathML()}</mrow></msup>`;
    }
    return this.base.toMathML();
  }
}

/**
 * n차 근 노드 (sqrt, root)
 */
class RootNode extends ASTNode {
  constructor(public radicand: ASTNode, public index?: ASTNode) { super(); }

  toMathML(): string {
    if (this.index) {
      return `<mroot><mrow>${this.radicand.toMathML()}</mrow><mrow>${this.index.toMathML()}</mrow></mroot>`;
    }
    return `<msqrt>${this.radicand.toMathML()}</msqrt>`;
  }
}

/**
 * 행렬 노드
 */
class MatrixNode extends ASTNode {
  constructor(
    public rows: ASTNode[][],
    public delimiters: { left: string; right: string } = { left: '', right: '' }
  ) { super(); }

  toMathML(): string {
    const tableContent = this.rows.map(row => {
      const cells = row.map(cell => `<mtd>${cell.toMathML()}</mtd>`).join('');
      return `<mtr>${cells}</mtr>`;
    }).join('');

    const table = `<mtable>${tableContent}</mtable>`;

    if (this.delimiters.left || this.delimiters.right) {
      return `<mrow><mo>${this.delimiters.left}</mo>${table}<mo>${this.delimiters.right}</mo></mrow>`;
    }
    return table;
  }
}

/**
 * Accent 노드 (vec, hat, bar, dot, etc.)
 */
class AccentNode extends ASTNode {
  constructor(public content: ASTNode, public accentType: string) { super(); }

  private static ACCENT_MAP: { [key: string]: string } = {
    'vec': '→',
    'hat': '^',
    'bar': '¯',
    'dot': '˙',
    'ddot': '¨',
    'tilde': '˜',
    'overline': '¯',
    'underline': '_',
    'overrightarrow': '→',
    'overleftarrow': '←'
  };

  toMathML(): string {
    const accent = AccentNode.ACCENT_MAP[this.accentType] || this.accentType;

    if (this.accentType === 'underline') {
      return `<munder><mrow>${this.content.toMathML()}</mrow><mo>${accent}</mo></munder>`;
    }
    return `<mover><mrow>${this.content.toMathML()}</mrow><mo>${accent}</mo></mover>`;
  }
}

/**
 * Cases 노드 (조건부 함수)
 */
class CasesNode extends ASTNode {
  constructor(public cases: Array<{ condition: ASTNode; value: ASTNode }>) { super(); }

  toMathML(): string {
    const rows = this.cases.map(c =>
      `<mtr><mtd>${c.value.toMathML()}</mtd><mtd>${c.condition.toMathML()}</mtd></mtr>`
    ).join('');

    return `<mrow><mo>{</mo><mtable columnalign="left left">${rows}</mtable></mrow>`;
  }
}

const opMap: { [key: string]: string } = {
  '+': '+', '-': '-', '*': '&#xD7;', '/': '&#xF7;', '=': '=',
  '<': '&lt;', '>': '&gt;', 'times': '&#xD7;', 'div': '&#xF7;'
};

class HWMLParser {
  private pos = 0;

  constructor(private tokens: HWPEquationToken[]) { }

  parse(): ASTNode {
    return this.parseBlock(false);
  }

  private peek(): HWPEquationToken {
    return this.tokens[this.pos];
  }

  private consume(): HWPEquationToken {
    return this.tokens[this.pos++];
  }

  // Parse a block of expressions until end or '}' or 'over'
  // 'over' handling needs care.
  private parseBlock(isBraced: boolean): ASTNode {
    const nodes = this.parseBlockContent(isBraced);
    const block = new BlockNode();
    block.children = nodes;
    return this.handleOver(block);
  }



  private handleOver(block: BlockNode): ASTNode {
    return this.processFractions(block.children);
  }

  // Re-process block to handle 'over'
  // Iterate children. If we find 'OverMarker' (not implemented in AST), split.
  // Actually, let's just make 'over' parsing part of parseBlock loop via recursion trick
  // BUT the simple way: 'over' has lowest precedence in the group.
  // So { A over B } parses A, then over, then B.
  // We can just parse list of items, then scan for 'over'.

  // Simplified parseBlock:
  // 1. Parse all items until '}' or EOF.
  // 2. Look for 'over' tokens (which I need to preserve or mark).
  // 3. Construct fraction.

  // To do this, I need 'over' to be returned as an AST node temporarily?
  // Let's add specific logic in main loop.
  // Re-write parseBlock above is messy.

  private parseBlockContent(stopAtBrace: boolean): ASTNode[] {
    const nodes: ASTNode[] = [];
    while (this.pos < this.tokens.length) {
      const t = this.peek();
      if (t.type === HWPEquationTokenType.EOF) break;
      if (t.type === HWPEquationTokenType.RBRACE) {
        if (stopAtBrace) {
          this.consume();
          return nodes;
        }
        break; // Unmatched RBRACE, stop this block
      }

      if (t.type === HWPEquationTokenType.KEYWORD && t.value === 'over') {
        this.consume();
        nodes.push(new OperatorNode('over')); // Placeholder
        continue;
      }

      let node = this.parseItem();
      // Handle sub/sup immediately attaching to node
      // When both _ and ^ are present, combine them into a single ScriptNode
      while (true) {
        const nx = this.peek();
        if (nx.type === HWPEquationTokenType.SUPERSCRIPT) {
          this.consume();
          const sup = this.parseItem(); // Parse next atom/group as sup
          if (node instanceof ScriptNode && !node.sup) {
            // Add sup to existing ScriptNode that only has sub
            node.sup = sup;
          } else {
            node = new ScriptNode(node, undefined, sup);
          }
        } else if (nx.type === HWPEquationTokenType.SUBSCRIPT) {
          this.consume();
          const sub = this.parseItem();
          if (node instanceof ScriptNode && !node.sub) {
            // Add sub to existing ScriptNode that only has sup
            node.sub = sub;
          } else {
            node = new ScriptNode(node, sub, undefined);
          }
        } else {
          break;
        }
      }
      nodes.push(node);
    }
    return nodes;
  }

  // Parse Single Item (Atom, Group, specific Command)
  private parseItem(): ASTNode {
    const t = this.peek();

    // Group { ... }
    if (t.type === HWPEquationTokenType.LBRACE) {
      this.consume();
      const children = this.parseBlockContent(true); // Consumes RBRACE
      return this.processFractions(children);
    }

    // Variables / Numbers
    if (t.type === HWPEquationTokenType.TEXT) {
      this.consume();
      return new TextNode(t.value, /[a-zA-Z]/.test(t.value));
    }

    // Operators
    if (t.type === HWPEquationTokenType.OPERATOR) {
      this.consume();
      return new OperatorNode(t.value);
    }

    // Commands
    if (t.type === HWPEquationTokenType.COMMAND) {
      this.consume();

      // sqrt - 제곱근
      if (t.value === 'sqrt') {
        const arg = this.parseItem();
        return new RootNode(arg);
      }

      // root - n차 근 (root[n]{x} 형식)
      if (t.value === 'root') {
        let index: ASTNode | undefined;
        // Check for optional index [n]
        const next = this.peek();
        if (next.type === HWPEquationTokenType.OPERATOR && next.value === '[') {
          this.consume(); // consume '['
          const indexNodes: ASTNode[] = [];
          while (this.peek().type !== HWPEquationTokenType.EOF &&
            !(this.peek().type === HWPEquationTokenType.OPERATOR && this.peek().value === ']')) {
            indexNodes.push(this.parseItem());
          }
          if (this.peek().value === ']') this.consume();
          const indexBlock = new BlockNode();
          indexBlock.children = indexNodes;
          index = indexBlock;
        }
        const radicand = this.parseItem();
        return new RootNode(radicand, index);
      }

      // frac - 분수 (frac{num}{den} 형식)
      if (t.value === 'frac') {
        const num = this.parseItem();
        const den = this.parseItem();
        return new FracNode(num, den);
      }

      // Accent commands (vec, hat, bar, dot, etc.)
      if (['vec', 'hat', 'bar', 'dot', 'ddot', 'tilde', 'overline', 'underline', 'overrightarrow', 'overleftarrow'].includes(t.value)) {
        const content = this.parseItem();
        return new AccentNode(content, t.value);
      }

      // Matrix commands
      if (['matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix'].includes(t.value)) {
        return this.parseMatrix(t.value);
      }

      // Cases
      if (t.value === 'cases') {
        return this.parseCases();
      }

      // Limit operators (lim, sum, int, etc.) - handled specially for sub/sup
      if (['lim', 'sum', 'int', 'prod', 'oint', 'iint', 'iiint', 'coprod', 'bigcup', 'bigcap', 'min', 'max', 'sup', 'inf'].includes(t.value)) {
        return new TextNode(t.value, true);
      }

      // Function names (sin, cos, tan, etc.)
      if (['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot', 'det', 'gcd', 'lcm'].includes(t.value)) {
        return new TextNode(t.value, true);
      }

      // Other commands (Greek letters, symbols) - treat as text node
      return new TextNode(t.value, true);
    }

    // Fallback
    this.consume();
    return new TextNode(t.value);
  }

  /**
   * Parse matrix structure: matrix { a & b \\ c & d }
   */
  private parseMatrix(matrixType: string): ASTNode {
    const delimiters: { [key: string]: { left: string; right: string } } = {
      'matrix': { left: '', right: '' },
      'pmatrix': { left: '(', right: ')' },
      'bmatrix': { left: '[', right: ']' },
      'vmatrix': { left: '|', right: '|' },
      'Vmatrix': { left: '‖', right: '‖' }
    };

    const rows: ASTNode[][] = [];
    let currentRow: ASTNode[] = [];
    let currentCell: ASTNode[] = [];

    // Expect { ... }
    if (this.peek().type !== HWPEquationTokenType.LBRACE) {
      return new MatrixNode([[new TextNode('')]], delimiters[matrixType] || { left: '', right: '' });
    }
    this.consume(); // consume '{'

    while (this.peek().type !== HWPEquationTokenType.EOF && this.peek().type !== HWPEquationTokenType.RBRACE) {
      const t = this.peek();

      // Column separator '&'
      if (t.type === HWPEquationTokenType.OPERATOR && t.value === '&') {
        this.consume();
        const cellBlock = new BlockNode();
        cellBlock.children = currentCell;
        currentRow.push(cellBlock);
        currentCell = [];
        continue;
      }

      // Row separator '\\'  (두 개의 백슬래시 또는 '#' 문자로 처리)
      if (t.type === HWPEquationTokenType.OPERATOR && (t.value === '\\' || t.value === '#')) {
        this.consume();
        // Check for second backslash
        if (this.peek().type === HWPEquationTokenType.OPERATOR && this.peek().value === '\\') {
          this.consume();
        }
        const cellBlock = new BlockNode();
        cellBlock.children = currentCell;
        currentRow.push(cellBlock);
        rows.push(currentRow);
        currentRow = [];
        currentCell = [];
        continue;
      }

      currentCell.push(this.parseItem());
    }

    // Handle last cell/row
    if (currentCell.length > 0 || currentRow.length > 0) {
      const cellBlock = new BlockNode();
      cellBlock.children = currentCell;
      currentRow.push(cellBlock);
      rows.push(currentRow);
    }

    if (this.peek().type === HWPEquationTokenType.RBRACE) {
      this.consume();
    }

    return new MatrixNode(rows, delimiters[matrixType] || { left: '', right: '' });
  }

  /**
   * Parse cases structure
   */
  private parseCases(): ASTNode {
    const cases: Array<{ condition: ASTNode; value: ASTNode }> = [];

    if (this.peek().type !== HWPEquationTokenType.LBRACE) {
      return new CasesNode([]);
    }
    this.consume(); // consume '{'

    let currentValue: ASTNode[] = [];
    let currentCondition: ASTNode[] = [];
    let inCondition = false;

    while (this.peek().type !== HWPEquationTokenType.EOF && this.peek().type !== HWPEquationTokenType.RBRACE) {
      const t = this.peek();

      // Condition separator 'if' or ','
      if (t.type === HWPEquationTokenType.TEXT && t.value === 'if') {
        this.consume();
        inCondition = true;
        continue;
      }

      // Row separator
      if (t.type === HWPEquationTokenType.OPERATOR && (t.value === '\\' || t.value === '#')) {
        this.consume();
        if (this.peek().type === HWPEquationTokenType.OPERATOR && this.peek().value === '\\') {
          this.consume();
        }

        const valueBlock = new BlockNode();
        valueBlock.children = currentValue;
        const condBlock = new BlockNode();
        condBlock.children = currentCondition;

        cases.push({ value: valueBlock, condition: condBlock });
        currentValue = [];
        currentCondition = [];
        inCondition = false;
        continue;
      }

      if (inCondition) {
        currentCondition.push(this.parseItem());
      } else {
        currentValue.push(this.parseItem());
      }
    }

    // Handle last case
    if (currentValue.length > 0) {
      const valueBlock = new BlockNode();
      valueBlock.children = currentValue;
      const condBlock = new BlockNode();
      condBlock.children = currentCondition;
      cases.push({ value: valueBlock, condition: condBlock });
    }

    if (this.peek().type === HWPEquationTokenType.RBRACE) {
      this.consume();
    }

    return new CasesNode(cases);
  }

  // sub/sup logic moved to parseBlockContent to bind tight to left content

  private processFractions(nodes: ASTNode[]): ASTNode {
    // Scan for 'over' operator node
    // A over B over C -> (A/B)/C ? Or A/(B/C)? 
    // HWP/TeX is left associative usually: 1 over 2 over 3 -> (1/2)/3

    // Find LAST 'over' for right-associative? No.
    // Find FIRST 'over'.
    // A B C over D E 
    // Numerator: A B C
    // Denominator: D E

    // Loop through nodes
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] instanceof OperatorNode && (nodes[i] as OperatorNode).op === 'over') {
        const numNodes = nodes.slice(0, i);
        const denNodes = nodes.slice(i + 1);

        // Recursively process fractions in num/den if any (though 'over' splits the group so unlikely unless nested)
        // Actually 'over' applies to the whole group context.
        // If we have "1 over 2 over 3", our list is [1, over, 2, over, 3]
        // index 1 is 'over'. Num=[1], Den=[2, over, 3].
        // Den processes to Fraction(2,3).
        // So Fraction(1, Fraction(2,3)).
        // This means Right-Associative?
        // TeX: 1 \over 2 \over 3 -> Error "Ambiguous". 
        // HWP: 1 over 2 over 3 -> 1 / (2/3).

        const numBlock = new BlockNode();
        numBlock.children = numNodes; // Flat list needs processing? No, 'over' splits at top level.
        // Wait, if numNodes contains 'over', we missed it.
        // So we should find the split point?
        // If we recurse on DenNodes, we handle the right side.
        // What about left side?
        // "1 over 2" -> Num=[1], Den=[2].
        // "1 over 2 over 3". i=1. Num=[1]. Den=[2, over, 3].
        // Den processed -> Fraction(2,3).
        // Result Fraction(1, Fraction(2,3)).

        // If HWP is Left Associative: (1/2)/3.
        // Then we should find LAST 'over'?
        // Let's assume Left Associative for safety or Right.
        // Actually `over` should be unique in a group usually.

        const num = this.processFractions(numNodes);
        const den = this.processFractions(denNodes);
        return new FracNode(num, den);
      }
    }

    // No over
    const block = new BlockNode();
    block.children = nodes;
    return block;
  }

  // Wrapper for internal parse
  private parseSubSup(base: ASTNode): ASTNode {
    return base; // handled in loop
  }
}

/**
 * HWP 수식 레코드 TagID
 */
export enum EquationTagID {
  HWPTAG_EQEDIT = 111,
  HWPTAG_EQUATION_INLINE = 112,
  HWPTAG_EQUATION_BLOCK = 113,
}

