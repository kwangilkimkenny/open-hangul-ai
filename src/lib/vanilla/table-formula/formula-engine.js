/**
 * Formula Engine
 *
 * 한컴 한글 표 셀의 Excel-호환 수식을 평가합니다. 외부 의존성 없이
 * 자체 토크나이저 + Pratt 파서 + 평가기(visitor) 로 구성됩니다.
 *
 * 지원 기능:
 * - 셀 참조: A1, $A$1, AA10
 * - 범위: A1:B10
 * - 리터럴: 숫자, 문자열("..."), 불리언(TRUE, FALSE)
 * - 산술: + - * / ^
 * - 비교: = > < >= <= <>
 * - 단항: - +
 * - 함수: SUM, AVERAGE, AVG, MIN, MAX, COUNT, COUNTA, IF, AND, OR, NOT, ROUND, ABS, CONCAT
 *
 * 평가는 `context.getCellValue(addr)` 콜백을 호출하여 다른 셀 값을 읽습니다.
 *
 * @module table-formula/formula-engine
 */

import { expandRange, isCellAddr } from './cell-address.js';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/** @typedef {{type:string, value:string, pos:number}} Token */

/**
 * @param {string} input
 * @returns {Token[]}
 */
export function tokenize(input) {
  if (typeof input !== 'string') {
    throw new Error(`Invalid input: ${String(input)}`);
  }
  // strip leading '='
  let src = input.trim();
  if (src.startsWith('=')) src = src.slice(1);

  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // string literal "..."  (escape "" -> ")
    if (ch === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += src[j];
        j++;
      }
      if (j >= src.length) {
        throw new Error(`Unterminated string starting at position ${i}`);
      }
      tokens.push({ type: 'STRING', value: s, pos: i });
      i = j + 1;
      continue;
    }

    // number  (1, 1.5, .5)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === '.') {
        j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      tokens.push({ type: 'NUMBER', value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // identifier / cell / function  (allow leading $ for absolute refs)
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      const upper = raw.toUpperCase();
      // boolean literals
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'BOOL', value: upper, pos: i });
        i = j;
        continue;
      }
      // check if function call (next non-space char is '(')
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === '(') {
        tokens.push({ type: 'FUNC', value: upper, pos: i });
        i = j;
        continue;
      }
      // could be a cell address (A1) — strip $ markers and validate
      const stripped = raw.replace(/\$/g, '').toUpperCase();
      if (isCellAddr(stripped)) {
        // look ahead for range  :
        let m = j;
        while (m < src.length && /\s/.test(src[m])) m++;
        if (src[m] === ':') {
          let n = m + 1;
          while (n < src.length && /\s/.test(src[n])) n++;
          let p = n;
          while (p < src.length && /[A-Za-z0-9_$]/.test(src[p])) p++;
          const second = src.slice(n, p).replace(/\$/g, '').toUpperCase();
          if (isCellAddr(second)) {
            tokens.push({
              type: 'RANGE',
              value: `${stripped}:${second}`,
              pos: i,
            });
            i = p;
            continue;
          }
        }
        tokens.push({ type: 'CELL', value: stripped, pos: i });
        i = j;
        continue;
      }
      // unknown identifier — treat as name (will error during eval)
      tokens.push({ type: 'NAME', value: upper, pos: i });
      i = j;
      continue;
    }

    // operators / punctuation
    const two = src.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '<>') {
      tokens.push({ type: 'OP', value: two, pos: i });
      i += 2;
      continue;
    }
    if ('+-*/^=<>(),;'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch, pos: i });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push({ type: 'EOF', value: '', pos: src.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser  (Pratt style)
// ---------------------------------------------------------------------------

/**
 * @typedef {(
 *   {kind:'Num', value:number}
 *   | {kind:'Str', value:string}
 *   | {kind:'Bool', value:boolean}
 *   | {kind:'Cell', addr:string}
 *   | {kind:'Range', range:string}
 *   | {kind:'Bin', op:string, left:Ast, right:Ast}
 *   | {kind:'Unary', op:string, operand:Ast}
 *   | {kind:'Call', name:string, args:Ast[]}
 * )} Ast
 */

const PRECEDENCE = {
  '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
  '+': 2, '-': 2,
  '*': 3, '/': 3,
  '^': 4,
};

class Parser {
  /** @param {Token[]} tokens */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  expect(type, value) {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(
        `Expected ${type}${value ? ` "${value}"` : ''} but got ${t.type} "${t.value}" at ${t.pos}`,
      );
    }
    return this.consume();
  }

  /** @returns {Ast} */
  parseExpression(minPrec = 0) {
    let left = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (t.type !== 'OP') break;
      const prec = PRECEDENCE[t.value];
      if (prec === undefined || prec < minPrec) break;
      this.consume();
      // ^ is right-associative
      const nextMin = t.value === '^' ? prec : prec + 1;
      const right = this.parseExpression(nextMin);
      left = { kind: 'Bin', op: t.value, left, right };
    }
    return left;
  }

  /** @returns {Ast} */
  parsePrimary() {
    const t = this.peek();
    if (t.type === 'NUMBER') {
      this.consume();
      return { kind: 'Num', value: parseFloat(t.value) };
    }
    if (t.type === 'STRING') {
      this.consume();
      return { kind: 'Str', value: t.value };
    }
    if (t.type === 'BOOL') {
      this.consume();
      return { kind: 'Bool', value: t.value === 'TRUE' };
    }
    if (t.type === 'CELL') {
      this.consume();
      return { kind: 'Cell', addr: t.value };
    }
    if (t.type === 'RANGE') {
      this.consume();
      return { kind: 'Range', range: t.value };
    }
    if (t.type === 'FUNC') {
      this.consume();
      this.expect('OP', '(');
      const args = [];
      if (!(this.peek().type === 'OP' && this.peek().value === ')')) {
        args.push(this.parseExpression(0));
        while (this.peek().type === 'OP' && (this.peek().value === ',' || this.peek().value === ';')) {
          this.consume();
          args.push(this.parseExpression(0));
        }
      }
      this.expect('OP', ')');
      return { kind: 'Call', name: t.value, args };
    }
    if (t.type === 'OP' && (t.value === '-' || t.value === '+')) {
      this.consume();
      const operand = this.parsePrimary();
      return { kind: 'Unary', op: t.value, operand };
    }
    if (t.type === 'OP' && t.value === '(') {
      this.consume();
      const inner = this.parseExpression(0);
      this.expect('OP', ')');
      return inner;
    }
    throw new Error(`Unexpected token ${t.type} "${t.value}" at ${t.pos}`);
  }
}

/**
 * @param {string} input
 * @returns {Ast}
 */
export function parse(input) {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  const ast = parser.parseExpression(0);
  if (parser.peek().type !== 'EOF') {
    const t = parser.peek();
    throw new Error(`Unexpected trailing token ${t.type} "${t.value}" at ${t.pos}`);
  }
  return ast;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   getCellValue: (addr:string) => (number|string|boolean|null),
 *   trace?: Set<string>,
 * }} EvalContext
 */

/**
 * 다양한 값을 숫자로 강제 변환합니다. 변환 불가능하면 NaN.
 * Excel 호환: 빈 셀 = 0, "TRUE"/"FALSE" 문자열은 숫자로 변환하지 않음.
 * @param {*} v
 * @returns {number}
 */
export function coerceNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/**
 * 문자열 변환. null/undefined 는 빈 문자열.
 * @param {*} v
 * @returns {string}
 */
export function coerceString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

/**
 * 불리언 변환. Excel 호환: 0은 false, 그 외 숫자는 true, 빈 문자열은 false.
 * @param {*} v
 * @returns {boolean}
 */
export function coerceBoolean(v) {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const up = v.trim().toUpperCase();
    if (up === 'TRUE') return true;
    if (up === 'FALSE') return false;
    const n = Number(up);
    if (Number.isFinite(n)) return n !== 0;
    return up !== '';
  }
  return Boolean(v);
}

/**
 * 범위 함수에 전달할 셀 값들을 펼친 배열로 반환.
 * @param {Ast} node
 * @param {EvalContext} ctx
 * @returns {Array<number|string|boolean|null>}
 */
function flattenArg(node, ctx) {
  if (node.kind === 'Range') {
    return expandRange(node.range).map(addr => ctx.getCellValue(addr));
  }
  return [evalAst(node, ctx)];
}

const FUNCTIONS = {
  SUM(args, ctx) {
    let total = 0;
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        const n = coerceNumber(v);
        if (Number.isFinite(n)) total += n;
      }
    }
    return total;
  },
  AVERAGE(args, ctx) {
    let total = 0;
    let count = 0;
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (v === null || v === undefined || v === '') continue;
        const n = coerceNumber(v);
        if (Number.isFinite(n)) {
          total += n;
          count++;
        }
      }
    }
    if (count === 0) throw new Error('#DIV/0!');
    return total / count;
  },
  AVG(args, ctx) {
    return FUNCTIONS.AVERAGE(args, ctx);
  },
  MIN(args, ctx) {
    let min = Infinity;
    let seen = false;
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (v === null || v === undefined || v === '') continue;
        const n = coerceNumber(v);
        if (Number.isFinite(n)) {
          if (n < min) min = n;
          seen = true;
        }
      }
    }
    return seen ? min : 0;
  },
  MAX(args, ctx) {
    let max = -Infinity;
    let seen = false;
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (v === null || v === undefined || v === '') continue;
        const n = coerceNumber(v);
        if (Number.isFinite(n)) {
          if (n > max) max = n;
          seen = true;
        }
      }
    }
    return seen ? max : 0;
  },
  COUNT(args, ctx) {
    // count only numeric cells
    let n = 0;
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          n++;
        } else if (typeof v === 'string' && v.trim() !== '') {
          const num = Number(v.trim());
          if (Number.isFinite(num)) n++;
        }
      }
    }
    return n;
  },
  COUNTA(args, ctx) {
    // count non-empty cells
    let n = 0;
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'string' && v === '') continue;
        n++;
      }
    }
    return n;
  },
  IF(args, ctx) {
    if (args.length < 2 || args.length > 3) {
      throw new Error('IF requires 2 or 3 arguments');
    }
    const cond = coerceBoolean(evalAst(args[0], ctx));
    if (cond) return evalAst(args[1], ctx);
    return args.length === 3 ? evalAst(args[2], ctx) : false;
  },
  AND(args, ctx) {
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (!coerceBoolean(v)) return false;
      }
    }
    return true;
  },
  OR(args, ctx) {
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        if (coerceBoolean(v)) return true;
      }
    }
    return false;
  },
  NOT(args, ctx) {
    if (args.length !== 1) throw new Error('NOT requires 1 argument');
    return !coerceBoolean(evalAst(args[0], ctx));
  },
  ROUND(args, ctx) {
    if (args.length < 1 || args.length > 2) {
      throw new Error('ROUND requires 1 or 2 arguments');
    }
    const v = coerceNumber(evalAst(args[0], ctx));
    const digits = args.length === 2 ? Math.trunc(coerceNumber(evalAst(args[1], ctx))) : 0;
    const f = Math.pow(10, digits);
    return Math.round(v * f) / f;
  },
  ABS(args, ctx) {
    if (args.length !== 1) throw new Error('ABS requires 1 argument');
    return Math.abs(coerceNumber(evalAst(args[0], ctx)));
  },
  CONCAT(args, ctx) {
    let s = '';
    for (const a of args) {
      for (const v of flattenArg(a, ctx)) {
        s += coerceString(v);
      }
    }
    return s;
  },
};

/**
 * @param {Ast} node
 * @param {EvalContext} ctx
 * @returns {number|string|boolean|null}
 */
export function evalAst(node, ctx) {
  switch (node.kind) {
    case 'Num':
      return node.value;
    case 'Str':
      return node.value;
    case 'Bool':
      return node.value;
    case 'Cell': {
      const v = ctx.getCellValue(node.addr);
      return v === undefined ? null : v;
    }
    case 'Range':
      throw new Error('Range expression used outside a function call');
    case 'Unary': {
      const v = evalAst(node.operand, ctx);
      if (node.op === '-') return -coerceNumber(v);
      if (node.op === '+') return coerceNumber(v);
      throw new Error(`Unknown unary operator ${node.op}`);
    }
    case 'Bin': {
      const op = node.op;
      // short-circuit not applicable in arithmetic
      const l = evalAst(node.left, ctx);
      const r = evalAst(node.right, ctx);
      switch (op) {
        case '+': return coerceNumber(l) + coerceNumber(r);
        case '-': return coerceNumber(l) - coerceNumber(r);
        case '*': return coerceNumber(l) * coerceNumber(r);
        case '/': {
          const rn = coerceNumber(r);
          if (rn === 0) throw new Error('#DIV/0!');
          return coerceNumber(l) / rn;
        }
        case '^': return Math.pow(coerceNumber(l), coerceNumber(r));
        case '=': return compareValues(l, r) === 0;
        case '<>': return compareValues(l, r) !== 0;
        case '<': return compareValues(l, r) < 0;
        case '>': return compareValues(l, r) > 0;
        case '<=': return compareValues(l, r) <= 0;
        case '>=': return compareValues(l, r) >= 0;
        default:
          throw new Error(`Unknown operator ${op}`);
      }
    }
    case 'Call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`Unknown function: ${node.name}`);
      return fn(node.args, ctx);
    }
    default:
      throw new Error(`Unknown AST node`);
  }
}

/**
 * 두 값을 비교합니다. 둘 다 숫자처럼 보이면 숫자 비교, 아니면 문자열 비교.
 * @param {*} a
 * @param {*} b
 * @returns {number} -1 | 0 | 1
 */
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    const ab = coerceBoolean(a) ? 1 : 0;
    const bb = coerceBoolean(b) ? 1 : 0;
    return ab - bb;
  }
  // try numeric coercion
  const na = coerceNumber(a);
  const nb = coerceNumber(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && a !== '' && b !== ''
      && !(typeof a === 'string' && isNaN(Number(a.trim())))
      && !(typeof b === 'string' && isNaN(Number(b.trim())))) {
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = coerceString(a);
  const sb = coerceString(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * 수식 문자열을 평가합니다.
 *
 * @param {string} formula  '=SUM(A1:B2)' 또는 'SUM(A1:B2)'
 * @param {EvalContext} context
 * @returns {number|string|boolean|null}
 */
export function evaluateFormula(formula, context) {
  const ast = parse(formula);
  return evalAst(ast, context);
}

/**
 * 수식 안에서 직접 참조하는 셀 주소들을 수집합니다 (범위는 펼침).
 * @param {string} formula
 * @returns {string[]}
 */
export function extractDependencies(formula) {
  const ast = parse(formula);
  const deps = new Set();
  walk(ast, deps);
  return Array.from(deps);
}

/**
 * @param {Ast} node
 * @param {Set<string>} deps
 */
function walk(node, deps) {
  switch (node.kind) {
    case 'Cell':
      deps.add(node.addr);
      return;
    case 'Range':
      for (const addr of expandRange(node.range)) deps.add(addr);
      return;
    case 'Bin':
      walk(node.left, deps);
      walk(node.right, deps);
      return;
    case 'Unary':
      walk(node.operand, deps);
      return;
    case 'Call':
      for (const a of node.args) walk(a, deps);
      return;
    default:
      return;
  }
}
