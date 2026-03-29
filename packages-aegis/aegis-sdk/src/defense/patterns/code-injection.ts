// ============================================================
// AEGIS Code Injection Patterns — 14 patterns
// ============================================================

import type { PatternEntry } from './index';

export const CODE_INJECTION_PATTERNS: PatternEntry[] = [
  {
    id: 'SQL_DESTRUCTIVE',
    pattern: /;\s*(drop\s+(table|database|schema|index)|delete\s+from|truncate|alter)/i,
    category: 'code_injection',
    severity: 9,
    description: 'SQL destructive statement (DROP/DELETE/TRUNCATE/ALTER)',
  },
  {
    id: 'SQL_UNION_SELECT',
    pattern: /union\s+(all\s+)?select\s/i,
    category: 'code_injection',
    severity: 9,
    description: 'SQL UNION SELECT injection',
  },
  {
    id: 'SQL_OR_BYPASS',
    pattern: /['"]?\s*or\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
    category: 'code_injection',
    severity: 9,
    description: 'SQL OR bypass (tautology injection)',
  },
  {
    id: 'SQL_COMMENT_INJECTION',
    pattern: /(--|\/\*).*(drop|delete|truncate|alter|select|insert)/i,
    category: 'code_injection',
    severity: 8,
    description: 'SQL comment-based injection',
  },
  {
    id: 'SQL_EXEC_INJECTION',
    pattern: /(exec|execute)\s+(sp_|xp_|master\.)/i,
    category: 'code_injection',
    severity: 9,
    description: 'SQL EXEC stored procedure injection',
  },
  {
    id: 'SQL_STACKED_QUERIES',
    pattern: /;\s*(select|insert|update|delete|drop|create|alter)/i,
    category: 'code_injection',
    severity: 8,
    description: 'SQL stacked queries injection',
  },
  {
    id: 'XSS_SCRIPT_TAG',
    pattern: /<\s*script[^>]*>/i,
    category: 'code_injection',
    severity: 8,
    description: 'XSS script tag injection',
  },
  {
    id: 'XSS_EVENT_HANDLER',
    pattern: /\bon(error|load|click|mouseover|focus|submit)\s*=/i,
    category: 'code_injection',
    severity: 8,
    description: 'XSS event handler injection',
  },
  {
    id: 'XSS_JS_PROTOCOL',
    pattern: /javascript\s*:/i,
    category: 'code_injection',
    severity: 8,
    description: 'XSS javascript: protocol injection',
  },
  {
    id: 'OS_CMD_INJECTION',
    pattern: /(;|\||&&|\$\(|`)\s*(cat|ls|rm|wget|curl|nc|bash|sh|python)\s/i,
    category: 'code_injection',
    severity: 9,
    description: 'OS command injection via shell operators',
  },
  {
    id: 'PATH_TRAVERSAL',
    pattern: /(\.\.\/){2,}(etc\/passwd|etc\/shadow|windows\/system32)/i,
    category: 'code_injection',
    severity: 8,
    description: 'Path traversal attack targeting sensitive files',
  },
  {
    id: 'SSTI_INJECTION',
    pattern: /\{\{.*?(__|import|eval|exec|system|popen)\s*\}\}/i,
    category: 'code_injection',
    severity: 8,
    description: 'Server-side template injection (SSTI)',
  },
  {
    id: 'LDAP_INJECTION',
    pattern: /\(\|?\([\w]+=\*\)\)|\(\&\(/i,
    category: 'code_injection',
    severity: 7,
    description: 'LDAP injection via filter manipulation',
  },
  {
    id: 'MULTI_VECTOR',
    pattern: /(select\s.*from\s|drop\s+table).*(;|&&|\|).*(rm\s|cat\s|wget\s)/i,
    category: 'code_injection',
    severity: 10,
    description: 'Multi-vector combined SQL + OS injection',
  },
];
