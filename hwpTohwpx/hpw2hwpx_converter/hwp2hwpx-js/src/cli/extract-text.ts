#!/usr/bin/env node
/**
 * HWP 파일에서 텍스트를 추출하는 CLI 도구
 *
 * Usage:
 *   npx ts-node src/cli/extract-text.ts <input.hwp> [-o output.txt] [--with-tables] [--json]
 */
import * as fs from 'fs';
import * as path from 'path';
import { Hwp2Hwpx } from '../core/Hwp2Hwpx';
import type { EnhancedSection } from '../adapters/IHwpParser';
import type { HWPControl, HWPTable, HWPParagraph, HWPTextBox } from '../models/hwp.types';

interface ExtractOptions {
    withTables: boolean;
    json: boolean;
    outputPath?: string;
}

/**
 * 문단 배열에서 텍스트를 재귀적으로 추출
 */
function extractFromParagraphs(paragraphs: HWPParagraph[], options: ExtractOptions): string[] {
    const lines: string[] = [];

    for (const para of paragraphs) {
        // 문단 텍스트
        if (para.text && para.text.trim().length > 0) {
            lines.push(para.text);
        }

        // 컨트롤 내부 텍스트 (테이블, 텍스트박스, 각주 등)
        if (para.controls) {
            for (const control of para.controls) {
                const controlLines = extractFromControl(control, options);
                lines.push(...controlLines);
            }
        }
    }

    return lines;
}

/**
 * 컨트롤(테이블, 텍스트박스 등)에서 텍스트 추출
 */
function extractFromControl(control: HWPControl, options: ExtractOptions): string[] {
    const lines: string[] = [];

    switch (control.type) {
        case 'TABLE': {
            if (!options.withTables) break;
            const table = control.obj as HWPTable | undefined;
            if (table?.rows) {
                lines.push('[표]');
                for (const row of table.rows) {
                    const cellTexts: string[] = [];
                    for (const cell of row.cells) {
                        const cellLines = extractFromParagraphs(cell.paragraphs || [], options);
                        cellTexts.push(cellLines.join(' '));
                    }
                    lines.push(cellTexts.join('\t|\t'));
                }
                lines.push('[/표]');
            }
            break;
        }
        case 'TEXTBOX': {
            const textbox = control.obj as HWPTextBox | undefined;
            if (textbox?.paragraphs) {
                const boxLines = extractFromParagraphs(textbox.paragraphs, options);
                lines.push(...boxLines);
            }
            break;
        }
        case 'FOOTNOTE':
        case 'ENDNOTE': {
            const note = control.obj as { paragraphs?: HWPParagraph[] } | undefined;
            if (note?.paragraphs) {
                const noteLines = extractFromParagraphs(note.paragraphs, options);
                if (noteLines.length > 0) {
                    const label = control.type === 'FOOTNOTE' ? '각주' : '미주';
                    lines.push(`[${label}: ${noteLines.join(' ')}]`);
                }
            }
            break;
        }
        case 'EQUATION': {
            const eq = control.obj as { script?: string } | undefined;
            if (eq?.script) {
                lines.push(`[수식: ${eq.script}]`);
            }
            break;
        }
        default:
            break;
    }

    return lines;
}

/**
 * JSON 형식으로 구조화된 텍스트 추출
 */
function extractAsJson(sections: EnhancedSection[], options: ExtractOptions): object {
    return {
        sectionCount: sections.length,
        sections: sections.map((section, idx) => ({
            index: idx,
            paragraphCount: section.paragraphs.length,
            paragraphs: section.paragraphs.map((para) => {
                const result: Record<string, unknown> = {};
                if (para.text) result.text = para.text;
                if (para.runs && para.runs.length > 0) {
                    result.runs = para.runs.map(r => r.text);
                }
                if (options.withTables && para.controls && para.controls.length > 0) {
                    result.controls = para.controls
                        .filter(c => c.type === 'TABLE' || c.type === 'TEXTBOX' || c.type === 'FOOTNOTE' || c.type === 'ENDNOTE')
                        .map(c => ({
                            type: c.type,
                            text: extractFromControl(c, options).join('\n')
                        }));
                }
                return result;
            }).filter(p => Object.keys(p).length > 0)
        }))
    };
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
HWP 텍스트 추출기

사용법:
  npx ts-node src/cli/extract-text.ts <input.hwp> [옵션]

옵션:
  -o, --output <파일>    출력 파일 경로 (기본: 콘솔 출력)
  --with-tables          테이블 내용도 추출 (기본: 본문만)
  --json                 JSON 형식으로 출력
  -h, --help             도움말 표시

예시:
  npx ts-node src/cli/extract-text.ts document.hwp
  npx ts-node src/cli/extract-text.ts document.hwp -o output.txt --with-tables
  npx ts-node src/cli/extract-text.ts document.hwp --json -o output.json
`);
        process.exit(0);
    }

    // 인자 파싱
    const inputPath = args[0];
    const options: ExtractOptions = {
        withTables: args.includes('--with-tables'),
        json: args.includes('--json'),
    };

    const outputIdx = args.indexOf('-o') !== -1 ? args.indexOf('-o') : args.indexOf('--output');
    if (outputIdx !== -1 && args[outputIdx + 1]) {
        options.outputPath = args[outputIdx + 1];
    }

    // 입력 파일 확인
    const resolvedInput = path.resolve(inputPath);
    if (!fs.existsSync(resolvedInput)) {
        console.error(`오류: 파일을 찾을 수 없습니다: ${resolvedInput}`);
        process.exit(1);
    }

    if (!resolvedInput.toLowerCase().endsWith('.hwp')) {
        console.error('오류: .hwp 파일만 지원합니다.');
        process.exit(1);
    }

    console.error(`파싱 중: ${path.basename(resolvedInput)}`);

    // HWP 파싱
    const hwpBuffer = fs.readFileSync(resolvedInput);
    const data = new Uint8Array(hwpBuffer);
    const parser = Hwp2Hwpx.createParser();
    const parsed = await parser.parse(data.buffer);

    console.error(`섹션 수: ${parsed.sections.length}`);

    let output: string;

    if (options.json) {
        const result = extractAsJson(parsed.sections, options);
        output = JSON.stringify(result, null, 2);
    } else {
        const allLines: string[] = [];

        for (let i = 0; i < parsed.sections.length; i++) {
            const section = parsed.sections[i];
            if (parsed.sections.length > 1) {
                allLines.push(`--- 섹션 ${i + 1} ---`);
            }
            const sectionLines = extractFromParagraphs(section.paragraphs, options);
            allLines.push(...sectionLines);
        }

        output = allLines.join('\n');
    }

    // 출력
    if (options.outputPath) {
        const resolvedOutput = path.resolve(options.outputPath);
        fs.writeFileSync(resolvedOutput, output, 'utf-8');
        console.error(`저장 완료: ${resolvedOutput}`);
        console.error(`추출된 텍스트 길이: ${output.length}자`);
    } else {
        console.log(output);
    }
}

main().catch(err => {
    console.error('오류:', err.message || err);
    process.exit(1);
});
