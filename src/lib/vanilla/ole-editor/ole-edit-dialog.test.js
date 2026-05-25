/**
 * Unit tests for ole-edit-dialog.js
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { openOleEditDialog } from './ole-edit-dialog.js';

async function buildXlsxBytes() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.getCell('A1').value = 'hi';
  ws.getCell('B1').value = 1;
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

async function buildDocxBytes() {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>안녕</w:t></w:r></w:p><w:sectPr/></w:body></w:document>';
  const zip = new JSZip();
  zip.file('word/document.xml', xml);
  zip.file('[Content_Types].xml', '<Types xmlns="x"/>');
  return zip.generateAsync({ type: 'uint8array' });
}

describe('openOleEditDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('xlsx 입력 시 Excel 편집기를 마운트하고 saved 콜백을 호출한다', async () => {
    const bytes = await buildXlsxBytes();
    const onSave = vi.fn();
    const handle = await openOleEditDialog({
      oleData: bytes,
      filename: 'embed.xlsx',
      onSave,
    });
    expect(document.querySelector('.ole-edit-dialog')).toBeTruthy();
    expect(document.querySelector('.ole-excel-editor')).toBeTruthy();
    const saveBtn = document.querySelector('.ole-edit-dialog__btn--save');
    saveBtn.click();
    // saveBtn handler is async — wait until onSave fires or modal closes
    const deadline = Date.now() + 5000;
    while (onSave.mock.calls.length === 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 20));
      const err = document.querySelector('.ole-edit-dialog__error');
      if (err) throw new Error(`save reported error: ${err.textContent}`);
    }
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.extension).toBe('xlsx');
    expect(payload.bytes).toBeInstanceOf(Uint8Array);
    expect(payload.bytes.byteLength).toBeGreaterThan(0);
    expect(handle.getState()).toBe('saved');
  });

  it('docx 입력 시 Word 편집기를 마운트한다', async () => {
    const bytes = await buildDocxBytes();
    await openOleEditDialog({
      oleData: bytes,
      filename: 'embed.docx',
    });
    expect(document.querySelector('.ole-word-editor')).toBeTruthy();
  });

  it('취소 버튼을 누르면 onCancel 콜백 호출 + 모달 제거', async () => {
    const bytes = await buildDocxBytes();
    const onCancel = vi.fn();
    const handle = await openOleEditDialog({
      oleData: bytes,
      filename: 'embed.docx',
      onCancel,
    });
    document.querySelector('.ole-edit-dialog__btn--cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ole-edit-dialog')).toBeNull();
    expect(handle.getState()).toBe('cancelled');
  });

  it('ESC 키로 닫기', async () => {
    const bytes = await buildDocxBytes();
    const onCancel = vi.fn();
    await openOleEditDialog({
      oleData: bytes,
      filename: 'embed.docx',
      onCancel,
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ole-edit-dialog')).toBeNull();
  });

  it('지원하지 않는 OLE 는 unsupported 메시지를 표시하고 저장 버튼을 숨긴다', async () => {
    // CFB 시그니처만 가진 짧은 바이트 — 디코딩 실패 경로
    const bytes = new Uint8Array(64);
    bytes[0] = 0xd0;
    bytes[1] = 0xcf;
    bytes[2] = 0x11;
    bytes[3] = 0xe0;
    bytes[4] = 0xa1;
    bytes[5] = 0xb1;
    bytes[6] = 0x1a;
    bytes[7] = 0xe1;
    const handle = await openOleEditDialog({
      oleData: bytes,
      filename: 'legacy.xls',
    });
    const saveBtn = document.querySelector('.ole-edit-dialog__btn--save');
    expect(saveBtn.style.display).toBe('none');
    expect(document.querySelector('.ole-edit-dialog__unsupported')).toBeTruthy();
    expect(handle.getState()).toBe('unsupported');
  });

  it('오버레이 바깥 클릭으로 닫힌다', async () => {
    const bytes = await buildDocxBytes();
    const onCancel = vi.fn();
    await openOleEditDialog({
      oleData: bytes,
      filename: 'embed.docx',
      onCancel,
    });
    const overlay = document.querySelector('.ole-edit-dialog__overlay');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // overlay click handler triggers cancel
    expect(onCancel).toHaveBeenCalled();
  });
});
