import { describe, it, expect } from 'vitest';
import { detectOleMacroStreams } from './ole-parser.js';
import {
  detectMacrosInOleObjects,
  mergeMacroResults,
  detectMacrosFromEntries,
} from '../security/macro-detector.js';

describe('detectOleMacroStreams', () => {
  it('detects VBA storage', () => {
    const r = detectOleMacroStreams(['Workbook', 'VBA/Module1', 'VBA/_VBA_PROJECT']);
    expect(r.present).toBe(true);
    expect(r.streams).toContain('VBA/Module1');
    expect(r.indicators.some(s => s.startsWith('vba'))).toBe(true);
  });

  it('detects Excel 4.0 macro sheets', () => {
    const r = detectOleMacroStreams(['Workbook', 'Excel 4.0 Macros']);
    expect(r.present).toBe(true);
    expect(r.indicators.some(s => s.startsWith('xl4-macros'))).toBe(true);
  });

  it('detects OOXML vbaProject.bin', () => {
    const r = detectOleMacroStreams(['xl/workbook.xml', 'xl/vbaProject.bin']);
    expect(r.present).toBe(true);
    expect(r.streams).toContain('xl/vbaProject.bin');
  });

  it('returns empty result for clean documents', () => {
    const r = detectOleMacroStreams(['Workbook', 'CompObj', 'EMF']);
    expect(r.present).toBe(false);
    expect(r.streams).toEqual([]);
    expect(r.indicators).toEqual([]);
  });

  it('handles non-array input gracefully', () => {
    expect(detectOleMacroStreams(null).present).toBe(false);
    expect(detectOleMacroStreams(undefined).present).toBe(false);
    expect(detectOleMacroStreams('not-array').present).toBe(false);
  });
});

describe('detectMacrosInOleObjects', () => {
  const oleWithMacro = {
    type: 'excel',
    macroInfo: {
      present: true,
      streams: ['VBA/Module1'],
      indicators: ['vba (VBA project storage)'],
    },
    metadata: { className: 'Excel.Sheet.12', originalName: 'data.xls' },
  };
  const oleClean = {
    type: 'word',
    macroInfo: { present: false, streams: [], indicators: [] },
    metadata: { className: 'Word.Document.8', originalName: 'doc.doc' },
  };

  it('converts Map of OLE objects to macro result', () => {
    const map = new Map([
      ['1', oleWithMacro],
      ['2', oleClean],
    ]);
    const r = detectMacrosInOleObjects(map);
    expect(r.present).toBe(true);
    expect(r.count).toBe(1);
    expect(r.details[0].source).toBe('ole');
    expect(r.details[0].oleClassName).toBe('Excel.Sheet.12');
    expect(r.details[0].path).toContain('data.xls');
  });

  it('handles array input', () => {
    const r = detectMacrosInOleObjects([oleWithMacro, oleClean]);
    expect(r.present).toBe(true);
    expect(r.count).toBe(1);
  });

  it('handles plain object input', () => {
    const r = detectMacrosInOleObjects({ first: oleWithMacro, second: oleClean });
    expect(r.present).toBe(true);
    expect(r.count).toBe(1);
  });

  it('returns empty for no OLE input', () => {
    expect(detectMacrosInOleObjects(null).present).toBe(false);
    expect(detectMacrosInOleObjects(new Map()).present).toBe(false);
  });

  it('does not decode or execute any OLE content', () => {
    // 함수가 ole.macroInfo 만 보고 코드 자체는 절대 디코딩하지 않는다는 사실을
    // 시그니처로 단언 — macroInfo.streams 가 비어 있으면 항상 무시.
    const oleWithRawButNoMacroInfo = {
      type: 'excel',
      previewImage: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      metadata: { className: 'Excel.Sheet.12', originalName: 'x.xls' },
    };
    const r = detectMacrosInOleObjects(new Map([['1', oleWithRawButNoMacroInfo]]));
    expect(r.present).toBe(false);
  });
});

describe('mergeMacroResults with OLE + ZIP', () => {
  it('merges ZIP and OLE detection results', () => {
    const fakeEntries = new Map([
      ['Scripts/DefaultJScript', new Uint8Array([0x66, 0x6f, 0x6f])], // "foo"
    ]);
    const zipR = detectMacrosFromEntries(fakeEntries);
    const oleR = detectMacrosInOleObjects([
      {
        type: 'excel',
        macroInfo: {
          present: true,
          streams: ['VBA/Module1'],
          indicators: ['vba'],
        },
        metadata: { className: 'Excel.Sheet.12', originalName: 'x.xls' },
      },
    ]);
    const merged = mergeMacroResults(zipR, oleR);
    expect(merged.present).toBe(true);
    expect(merged.count).toBeGreaterThanOrEqual(2);
    const sources = new Set(merged.details.map(d => d.source).filter(Boolean));
    expect(sources.has('ole')).toBe(true);
  });
});
