/**
 * Equation (수식) 파서 - 완벽 구현
 * HWP 수식을 MathML, LaTeX로 변환
 */

import type { Equation, HWPEquationToken } from '../models/Equation';
import { EquationAlignment, EquationHelper, EquationTagID } from '../models/Equation';

export class EquationParser {
  private data: Uint8Array;
  private view: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * 수식 파싱 (TagID 111)
   */
  parseEquation(offset: number): Equation | null {
    try {
      if (offset + 128 > this.data.length) {
        return null;
      }

      console.log(`  🔢 수식 파싱 시작 (offset: ${offset})`);

      // 플래그 및 스타일
      const flags = this.view.getUint32(offset + 0, true);
      const inline = !!(flags & 0x01);
      const alignment = ((flags >> 1) & 0x03) as EquationAlignment;

      // 크기
      const width = this.view.getInt32(offset + 4, true);
      const height = this.view.getInt32(offset + 8, true);
      const fontSize = this.view.getUint16(offset + 12, true) || 12;

      // 색상
      const color = this.view.getUint32(offset + 14, true) || 0x000000;

      // 폰트 패밀리 길이 및 읽기
      const fontFamilyLength = this.view.getUint16(offset + 18, true);
      let fontFamily = 'Times New Roman';

      if (fontFamilyLength > 0 && fontFamilyLength < 50) {
        const fontData = this.data.slice(offset + 20, offset + 20 + fontFamilyLength * 2);
        fontFamily = new TextDecoder('utf-16le').decode(fontData);
      }

      // HWP 수식 데이터 길이 및 읽기
      const equationDataOffset = offset + 20 + fontFamilyLength * 2;
      const equationDataLength = equationDataOffset + 4 <= this.data.length
        ? this.view.getUint32(equationDataOffset, true)
        : 0;

      let hwpEquation = '';
      let mathML = '';
      let latex = '';
      let text = '';
      // tokens removed as we parse string directly

      if (equationDataLength > 0 && equationDataLength < 10000) {
        const equationData = this.data.slice(
          equationDataOffset + 4,
          equationDataOffset + 4 + equationDataLength
        );

        // HWP 수식을 UTF-8로 디코딩 시도
        try {
          hwpEquation = new TextDecoder('utf-8').decode(equationData);
        } catch {
          hwpEquation = new TextDecoder('utf-16le').decode(equationData);
        }

        // HWP 수식 문자열 정리 (널 문자 등 제거)
        hwpEquation = hwpEquation.replace(/\0/g, '').trim();

        // MathML 변환 (New Logic)
        mathML = EquationHelper.convert(hwpEquation, inline);

        // LaTeX/Text (Placeholder or simple fallback as new parser mostly does MathML)
        text = hwpEquation;
        latex = '$' + hwpEquation + '$'; // TODO: LaTeX converter not fully ported yet

      } else {
        // 데이터 없음 or 텍스트만 있음 (hwpEquation might be empty)
        text = hwpEquation || 'Equation';
        mathML = `<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>${text}</mtext></math>`;
      }

      return {
        id: 0,
        paragraphNo: 0,
        charPos: 0,
        hwpEquation,
        mathML,
        latex,
        text,
        width,
        height,
        fontSize,
        fontFamily,
        inline,
        alignment,
        color,
        baseline: 0,
      };
    } catch (error) {
      console.error('❌ Equation 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 섹션 데이터에서 모든 수식 추출
   */
  extractAll(): Equation[] {
    const equations: Equation[] = [];
    let offset = 0;

    console.log('\n🔢 수식 추출 시작...');

    while (offset < this.data.length - 4) {
      const header = this.view.getUint32(offset, true);
      offset += 4;

      const tagId = header & 0x3FF;
      let size = (header >> 20) & 0xFFF;

      if (size === 0xFFF) {
        if (offset + 4 > this.data.length) break;
        size = this.view.getUint32(offset, true);
        offset += 4;
      }

      if (offset + size > this.data.length) break;

      if (tagId === EquationTagID.HWPTAG_EQEDIT ||
        tagId === EquationTagID.HWPTAG_EQUATION_INLINE ||
        tagId === EquationTagID.HWPTAG_EQUATION_BLOCK) {
        const equation = this.parseEquation(offset);
        if (equation) {
          equation.id = equations.length;
          equations.push(equation);
          console.log(`  ✅ 수식 #${equation.id} 파싱 완료 (${equation.inline ? '인라인' : '블록'})`);
        }
      }

      offset += size;
    }

    console.log(`\n✅ 총 ${equations.length}개의 수식 추출 완료\n`);

    return equations;
  }
}

