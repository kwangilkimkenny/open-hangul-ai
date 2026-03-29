// ============================================================
// AEGIS Credential Detection Patterns
// ============================================================

export interface CredentialPatternEntry {
  id: string;
  pattern: RegExp;
  type: string;
  description: string;
  severity: number;
}

export const CREDENTIAL_PATTERNS: CredentialPatternEntry[] = [
  {
    id: 'CRED_AWS_ACCESS_KEY',
    pattern: /AKIA[0-9A-Z]{16}/,
    type: 'aws_access_key',
    description: 'AWS access key ID',
    severity: 9,
  },
  {
    id: 'CRED_AWS_SECRET_KEY',
    pattern: /(?:aws_secret_access_key|AWS_SECRET)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i,
    type: 'aws_secret_key',
    description: 'AWS secret access key',
    severity: 10,
  },
  {
    id: 'CRED_GITHUB_TOKEN',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/,
    type: 'github_token',
    description: 'GitHub personal access token',
    severity: 9,
  },
  {
    id: 'CRED_GITHUB_CLASSIC',
    pattern: /github_pat_[A-Za-z0-9_]{22,}/,
    type: 'github_token',
    description: 'GitHub fine-grained personal access token',
    severity: 9,
  },
  {
    id: 'CRED_GENERIC_API_KEY',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?[A-Za-z0-9\-_]{20,}["']?/i,
    type: 'api_key',
    description: 'Generic API key assignment',
    severity: 8,
  },
  {
    id: 'CRED_GENERIC_SECRET',
    pattern: /(?:secret|token|password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/i,
    type: 'secret',
    description: 'Generic secret/password assignment',
    severity: 8,
  },
  {
    id: 'CRED_BEARER_TOKEN',
    pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/,
    type: 'bearer_token',
    description: 'Bearer authentication token',
    severity: 9,
  },
  {
    id: 'CRED_PRIVATE_KEY',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    type: 'private_key',
    description: 'Private key header',
    severity: 10,
  },
  {
    id: 'CRED_CONNECTION_STRING',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]{10,}/i,
    type: 'connection_string',
    description: 'Database connection string with potential credentials',
    severity: 9,
  },
  {
    id: 'CRED_SLACK_TOKEN',
    pattern: /xox[bpras]-[0-9]{10,}-[A-Za-z0-9]{10,}/,
    type: 'slack_token',
    description: 'Slack API token',
    severity: 9,
  },
  {
    id: 'CRED_STRIPE_KEY',
    pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/,
    type: 'stripe_key',
    description: 'Stripe API key',
    severity: 9,
  },
  {
    id: 'CRED_GOOGLE_API',
    pattern: /AIza[0-9A-Za-z\-_]{35}/,
    type: 'google_api_key',
    description: 'Google API key',
    severity: 8,
  },
  {
    id: 'CRED_JWT',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-+/=]{10,}/,
    type: 'jwt',
    description: 'JSON Web Token',
    severity: 8,
  },
  {
    id: 'CRED_HEROKU_API',
    pattern: /(?:heroku_api_key|HEROKU_API_KEY)\s*[=:]\s*["']?[0-9a-f\-]{36}["']?/i,
    type: 'heroku_api_key',
    description: 'Heroku API key',
    severity: 9,
  },
  {
    id: 'CRED_OPENAI_KEY',
    pattern: /sk-[A-Za-z0-9]{20,}/,
    type: 'openai_key',
    description: 'OpenAI API key',
    severity: 9,
  },
  {
    id: 'CRED_ANTHROPIC_KEY',
    pattern: /sk-ant-[A-Za-z0-9\-_]{20,}/,
    type: 'anthropic_key',
    description: 'Anthropic API key',
    severity: 9,
  },
];
