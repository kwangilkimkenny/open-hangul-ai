// ============================================================
// AEGIS Acoustic Attack Patterns — 13 patterns
// ============================================================

import type { PatternEntry } from './index';

export const ACOUSTIC_PATTERNS: PatternEntry[] = [
  {
    id: 'AA_KO_VOICE_RECOG',
    pattern: /\[음성인식\].*(?:무시|계좌|이체)/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Voice recognition hijack (Korean)',
  },
  {
    id: 'AA_KO_ADMIN_VOICE',
    pattern: /\[관리자\s*음성\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Admin voice impersonation (Korean)',
  },
  {
    id: 'AA_KO_CLONED_VOICE',
    pattern: /\[복제된?\s*음성\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Cloned voice attack (Korean)',
  },
  {
    id: 'AA_KO_PANIC_VOICE',
    pattern: /\[공황.*음성\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Panic voice manipulation (Korean)',
  },
  {
    id: 'AA_KO_AUTHORITY_VOICE',
    pattern: /\[권위적.*음성\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Authority voice manipulation (Korean)',
  },
  {
    id: 'AA_KO_COMMAND_TONE',
    pattern: /\[명령조\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Command tone marker (Korean)',
  },
  {
    id: 'AA_KO_WHISPER',
    pattern: /\[속삭임\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Whisper attack marker (Korean)',
  },
  {
    id: 'AA_KO_FAST_VOICE',
    pattern: /\[빠른\s*음성\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Fast voice evasion marker (Korean)',
  },
  {
    id: 'AA_KO_URGENT_TRANSFER',
    pattern: /긴급\s*송금/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Urgent transfer via voice (Korean)',
  },
  {
    id: 'AA_KO_CEO_TRANSFER',
    pattern: /CEO.*이체/i,
    category: 'acoustic_attack',
    severity: 8,
    description: 'CEO voice fraud transfer (Korean)',
  },
  {
    id: 'AA_KO_POLICE_THREAT',
    pattern: /경찰.*협조.*처벌/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Police threat voice scam (Korean)',
  },
  {
    id: 'AA_KO_BACKGROUND_NOISE',
    pattern: /배경소음/,
    category: 'acoustic_attack',
    severity: 7,
    description: 'Background noise injection (Korean)',
  },
  {
    id: 'AA_KO_BACKGROUND_SPEAKER',
    pattern: /\[배경.*화자\]/,
    category: 'acoustic_attack',
    severity: 8,
    description: 'Background speaker injection (Korean)',
  },
];
