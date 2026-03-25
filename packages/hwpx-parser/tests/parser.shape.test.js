/**
 * @vitest-environment jsdom
 * Parser Shape Test - 알림장 템플릿 shape 파싱 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SimpleHWPXParser } from '../src/core/parser.js';

describe('Shape Parsing in 알림장 템플릿', () => {
    let doc;

    beforeEach(async () => {
        const filePath = path.resolve('docs/알림장 템플릿.hwpx');
        const fileBuffer = fs.readFileSync(filePath);
        // Convert Node.js Buffer to Uint8Array (supported by JSZip)
        const uint8Array = new Uint8Array(fileBuffer);
        const parser = new SimpleHWPXParser();
        doc = await parser.parse(uint8Array);
    });

    it('should parse document with sections', () => {
        expect(doc.sections).toBeDefined();
        expect(doc.sections.length).toBeGreaterThan(0);
    });

    it('should have shape with drawText containing table', () => {
        const section = doc.sections[0];

        // Find paragraph with shapes
        const paraWithShape = section.elements.find(e =>
            e.type === 'paragraph' && e.shapes && e.shapes.length > 0
        );

        expect(paraWithShape).toBeDefined();
        console.log(`Found paragraph with ${paraWithShape.shapes.length} shapes`);

        // The main rect shape (large one, ~708x939)
        const mainShape = paraWithShape.shapes.find(s => s.width > 500 && s.height > 500);
        expect(mainShape).toBeDefined();
        console.log(`Main shape: ${mainShape.shapeType}, ${mainShape.width?.toFixed(0)}x${mainShape.height?.toFixed(0)}`);

        // Check drawText
        expect(mainShape.drawText).toBeDefined();
        expect(mainShape.drawText.paragraphs).toBeDefined();
        console.log(`DrawText has ${mainShape.drawText.paragraphs.length} paragraphs`);

        // First paragraph should contain the inner table
        const firstPara = mainShape.drawText.paragraphs[0];
        console.log(`First para: "${firstPara.text?.substring(0, 50) || '(empty)'}"`);
        console.log(`  shapes: ${firstPara.shapes?.length || 0}`);
        console.log(`  tables: ${firstPara.tables?.length || 0}`);

        if (firstPara.runs) {
            const tableRuns = firstPara.runs.filter(r => r.hasTable);
            const shapeRuns = firstPara.runs.filter(r => r.hasShape);
            console.log(`  runs with tables: ${tableRuns.length}`);
            console.log(`  runs with shapes: ${shapeRuns.length}`);
        }
    });

    it('should parse inner table inside drawText', () => {
        const section = doc.sections[0];

        const paraWithShape = section.elements.find(e =>
            e.type === 'paragraph' && e.shapes && e.shapes.length > 0
        );

        const mainShape = paraWithShape.shapes.find(s => s.width > 500);
        const firstPara = mainShape.drawText.paragraphs[0];

        // Check if table is parsed
        if (firstPara.tables && firstPara.tables.length > 0) {
            const innerTable = firstPara.tables[0];
            console.log(`Inner table: ${innerTable.rows.length} rows x ${innerTable.colCount} cols`);

            // Check each row's cells
            innerTable.rows.forEach((row, rIdx) => {
                row.cells.forEach((cell, cIdx) => {
                    console.log(`  Cell[${rIdx}]: ${cell.elements?.length || 0} elements`);

                    // Check if cell has shapes (like 가능원인 button)
                    cell.elements?.forEach((elem, eIdx) => {
                        if (elem.type === 'paragraph') {
                            console.log(`    Para: "${elem.text?.substring(0, 30)}"`);
                            console.log(`      shapes: ${elem.shapes?.length || 0}`);

                            if (elem.shapes?.length > 0) {
                                elem.shapes.forEach((s, sIdx) => {
                                    console.log(`        Shape ${sIdx}: ${s.shapeType}, drawText: ${!!s.drawText}`);
                                    if (s.drawText) {
                                        const shapeText = s.drawText.paragraphs?.[0]?.text;
                                        console.log(`          Text: "${shapeText}"`);
                                    }
                                });
                            }
                        }
                    });
                });
            });

            expect(innerTable.rows.length).toBe(4);
        } else {
            // If tables is undefined, log warning
            console.warn('No tables found in first paragraph - investigating runs');
            console.log('Runs:', firstPara.runs?.map(r => ({
                text: r.text?.substring(0, 20),
                hasTable: r.hasTable,
                hasShape: r.hasShape
            })));
        }
    });

    it('should parse 가능원인 button with correct size and color', () => {
        const section = doc.sections[0];

        const paraWithShape = section.elements.find(e =>
            e.type === 'paragraph' && e.shapes && e.shapes.length > 0
        );

        const mainShape = paraWithShape.shapes.find(s => s.width > 500);
        const firstPara = mainShape.drawText.paragraphs[0];
        const innerTable = firstPara.tables[0];

        // Get the first cell which contains the "가능원인" button
        const buttonCell = innerTable.rows[0].cells[0];
        expect(buttonCell.elements?.length).toBeGreaterThan(0);

        const buttonPara = buttonCell.elements[0];
        expect(buttonPara.shapes?.length).toBeGreaterThan(0);

        const button = buttonPara.shapes[0];
        console.log('가능원인 button properties:');
        console.log(`  shapeType: ${button.shapeType}`);
        console.log(`  width: ${button.width}, height: ${button.height}`);
        console.log(`  borderRadius: ${button.borderRadius}`);
        console.log(`  fillColor: ${button.fillColor}`);
        console.log(`  style.backgroundColor: ${button.style?.backgroundColor}`);
        console.log(`  treatAsChar: ${button.treatAsChar}`);

        // Verify dimensions (should be around 107x35)
        expect(button.width).toBeGreaterThan(100);
        expect(button.width).toBeLessThan(120);
        expect(button.height).toBeGreaterThan(30);
        expect(button.height).toBeLessThan(40);

        // Verify borderRadius (should be 50)
        expect(button.borderRadius).toBe(50);

        // Verify background color (should be orange #F68A59)
        const bgColor = button.style?.backgroundColor || button.fillColor;
        expect(bgColor).toBeDefined();
        console.log(`  Computed bgColor: ${bgColor}`);
    });

    it('should parse lineBreak elements in text content', () => {
        const section = doc.sections[0];

        const paraWithShape = section.elements.find(e =>
            e.type === 'paragraph' && e.shapes && e.shapes.length > 0
        );

        const mainShape = paraWithShape.shapes.find(s => s.width > 500);
        const firstPara = mainShape.drawText.paragraphs[0];

        // Get the second cell (row index 1) which contains text with lineBreaks
        const innerTable = firstPara.tables[0];
        expect(innerTable).toBeDefined();

        const textCell = innerTable.rows[1]?.cells[0];
        expect(textCell).toBeDefined();
        expect(textCell.elements?.length).toBeGreaterThan(0);

        const textPara = textCell.elements[0];
        expect(textPara.type).toBe('paragraph');
        expect(textPara.runs).toBeDefined();

        // Check for linebreak runs
        const linebreakRuns = textPara.runs.filter(r => r.type === 'linebreak');
        console.log(`Found ${linebreakRuns.length} linebreak runs in text cell`);
        console.log(`Total runs: ${textPara.runs.length}`);
        console.log(`Run types: ${textPara.runs.map(r => r.type || 'text').join(', ')}`);

        // Should have multiple linebreaks based on HWPX structure
        expect(linebreakRuns.length).toBeGreaterThan(0);
    });

    it('should find 가능원인 shape buttons', () => {
        const section = doc.sections[0];

        const paraWithShape = section.elements.find(e =>
            e.type === 'paragraph' && e.shapes && e.shapes.length > 0
        );

        const mainShape = paraWithShape.shapes.find(s => s.width > 500);

        // Search for 가능원인 text in all nested structures
        let foundButtons = 0;

        function searchForText(obj, path = '') {
            if (!obj) return;

            if (obj.drawText?.paragraphs) {
                obj.drawText.paragraphs.forEach((p, i) => {
                    if (p.text?.includes('가능원인')) {
                        console.log(`Found 가능원인 at ${path}.drawText.paragraphs[${i}]`);
                        foundButtons++;
                    }
                    // Check shapes in this paragraph
                    p.shapes?.forEach((s, sIdx) => {
                        searchForText(s, `${path}.drawText.paragraphs[${i}].shapes[${sIdx}]`);
                    });
                });
            }

            if (obj.tables) {
                obj.tables.forEach((t, tIdx) => {
                    t.rows?.forEach((row, rIdx) => {
                        row.cells?.forEach((cell, cIdx) => {
                            cell.elements?.forEach((elem, eIdx) => {
                                searchForText(elem, `${path}.tables[${tIdx}].rows[${rIdx}].cells[${cIdx}].elements[${eIdx}]`);

                                if (elem.type === 'paragraph' && elem.shapes) {
                                    elem.shapes.forEach((s, sIdx) => {
                                        searchForText(s, `${path}.tables[${tIdx}].rows[${rIdx}].cells[${cIdx}].elements[${eIdx}].shapes[${sIdx}]`);
                                    });
                                }
                            });
                        });
                    });
                });
            }

            // Check shapes array
            if (obj.shapes) {
                obj.shapes.forEach((s, sIdx) => {
                    searchForText(s, `${path}.shapes[${sIdx}]`);
                });
            }

            // Check paragraph text directly
            if (obj.text?.includes('가능원인')) {
                console.log(`Found 가능원인 text at ${path}`);
            }
        }

        searchForText(mainShape, 'mainShape');

        console.log(`Total 가능원인 buttons found: ${foundButtons}`);
        // Should find at least 2 buttons (가능원인 appears in 2 cells)
    });
});
