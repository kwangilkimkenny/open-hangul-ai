import { describe, it, expect } from 'vitest';
import * as ext from './parser-extensions.js';

describe('parser-extensions barrel', () => {
  it('re-exports all parser dependencies', () => {
    const required = [
      'hancomToMathML',
      'parseChart',
      'parseFormControl',
      'isFormControlTag',
      'parseOle',
      'isOleBinData',
      'detectMacrosFromEntries',
      'detectEncryption',
      'decryptHwpxStream',
      'derivePbkdf2Key',
      'SALT_SIZE',
      'IV_SIZE',
      'DEFAULT_PBKDF2_PARAMS',
      'promptPassword',
      'showHwp5EncryptionNotice',
      'isHwp5EncryptionError',
    ];
    for (const name of required) {
      expect(ext[name], `missing barrel export: ${name}`).toBeDefined();
    }
  });

  it('crypto size constants are positive integers', () => {
    expect(typeof ext.SALT_SIZE).toBe('number');
    expect(ext.SALT_SIZE).toBeGreaterThan(0);
    expect(typeof ext.IV_SIZE).toBe('number');
    expect(ext.IV_SIZE).toBeGreaterThan(0);
  });

  it('PBKDF2 params shape', () => {
    expect(ext.DEFAULT_PBKDF2_PARAMS).toMatchObject({
      iterations: expect.any(Number),
      keyLength: expect.any(Number),
      hash: expect.any(String),
    });
  });
});
