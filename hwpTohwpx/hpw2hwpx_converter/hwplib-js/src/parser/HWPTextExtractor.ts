/**
 * HWP 텍스트 추출기
 * BodyText 스트림에서 실제 텍스트를 추출합니다
 */

import { OLEParser } from './OLEParser';
import { TableParser } from './TableParser';
import { PictureParser } from './PictureParser';
import { ShapeParser } from './ShapeParser';
import { EquationParser } from './EquationParser';
import { ChartParser } from './ChartParser';
import { logger } from '../utils/Logger';
import { HWPTAG, RECORD } from '../utils/Constants';
import {
  parseRecordHeader,
  parseParaHeader,
  parseCharShapeChange,
  parsePageDef,
  parseCtrlHeader,
  finalizeParagraph,
  decodeHWPText,
  type HWPParagraph,
  type PageDef,
  type ColumnDef,
  type HeaderFooter,
  type CharShapeChange,
  type ControlItem
} from './TagHandlers';

import type { Table } from '../models/Table';
import type { Picture } from '../models/Picture';
import type { Shape } from '../models/Shape';
import type { Equation } from '../models/Equation';
import type { Chart } from '../models/Chart';

export { HWPParagraph, PageDef, ColumnDef, HeaderFooter };

export interface TextRun {
  text: string;
  charShapeID: number;
  start: number;
  length: number;
}

export interface HWPSection {
  index: number;
  text: string;
  paragraphs: HWPParagraph[];
  pageDef?: PageDef;
  columnDefs?: ColumnDef[];
  headerFooters?: HeaderFooter[];
  tables?: Table[];
  pageBorderFillID?: number;
  pictures?: Picture[];
  shapes?: Shape[];
  equations?: Equation[];
  charts?: Chart[];
}

export class HWPTextExtractor {
  private oleParser: OLEParser;

  constructor(buffer: ArrayBuffer) {
    this.oleParser = new OLEParser(buffer);
  }

  /**
   * HWP 파일에서 모든 텍스트 추출
   */
  async extract(): Promise<HWPSection[]> {
    this.oleParser.parse();

    const directory = this.oleParser.getDirectory();
    const sections: HWPSection[] = [];
    let sectionIndex = 0;

    const bodyTextEntry = directory.find(e => e.name.toLowerCase() === 'bodytext');

    if (bodyTextEntry) {
      const sectionEntries: typeof directory = [];

      if (bodyTextEntry.childId !== 0xFFFFFFFF && bodyTextEntry.childId < directory.length) {
        this.collectSectionEntries(directory, bodyTextEntry.childId, sectionEntries);
      }

      if (sectionEntries.length === 0) {
        directory.forEach(entry => {
          if (/^Section\d+$/i.test(entry.name) && entry.type === 2) {
            sectionEntries.push(entry);
          }
        });
      }

      sectionEntries.sort((a, b) => {
        const numA = parseInt(a.name.replace(/\D/g, ''), 10);
        const numB = parseInt(b.name.replace(/\D/g, ''), 10);
        return numA - numB;
      });

      for (const entry of sectionEntries) {
        try {
          let data = this.oleParser.readStream(entry);
          data = await this.decompress(data);
          const section = this.parseSection(sectionIndex, data);
          sections.push(section);
          sectionIndex++;
        } catch (error) {
          logger.error(`${entry.name} 처리 실패:`, error);
        }
      }
    } else {
      while (true) {
        const sectionName = `Section${sectionIndex}`;
        const entry = this.oleParser.findEntry(sectionName);

        if (!entry) break;

        let data = this.oleParser.readStream(entry);
        data = await this.decompress(data);
        const section = this.parseSection(sectionIndex, data);
        sections.push(section);
        sectionIndex++;
      }
    }

    logger.info(`총 ${sections.length}개 섹션 추출 완료`);
    return sections;
  }

  /**
   * Red-Black Tree에서 Section 엔트리 수집
   */
  private collectSectionEntries(directory: { name: string; type: number; leftSiblingId: number; rightSiblingId: number }[], entryId: number, result: typeof directory): void {
    if (entryId === 0xFFFFFFFF || entryId >= directory.length) return;

    const entry = directory[entryId];

    if (/^Section\d+$/i.test(entry.name) && entry.type === 2) {
      result.push(entry);
    }

    if (entry.leftSiblingId !== 0xFFFFFFFF) {
      this.collectSectionEntries(directory, entry.leftSiblingId, result);
    }

    if (entry.rightSiblingId !== 0xFFFFFFFF) {
      this.collectSectionEntries(directory, entry.rightSiblingId, result);
    }
  }

  /**
   * zlib 압축 해제
   */
  private async decompress(data: Uint8Array): Promise<Uint8Array> {
    try {
      const pako = await import('pako');

      try {
        return pako.inflateRaw(data);
      } catch {
        try {
          return pako.inflate(data);
        } catch {
          return data;
        }
      }
    } catch {
      logger.warn('압축 해제 실패, 원본 데이터 사용');
      return data;
    }
  }

  /**
   * 섹션 파싱 (메인 루프)
   */
  private parseSection(index: number, data: Uint8Array): HWPSection {
    if (!data || !data.buffer) {
      logger.warn(`섹션 ${index} 데이터 없음`);
      return this.createEmptySection(index);
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const paragraphs: HWPParagraph[] = [];
    const tables: Table[] = [];
    let pictures: Picture[] = [];
    let shapes: Shape[] = [];
    let equations: Equation[] = [];
    let charts: Chart[] = [];
    let pageDef: PageDef | undefined;
    const columnDefs: ColumnDef[] = [];
    const headerFooters: HeaderFooter[] = [];
    let pageBorderFillID: number | undefined;
    let offset = 0;

    let currentPara: HWPParagraph | null = null;
    let currentCharShapes: CharShapeChange[] = [];

    let activeContainer: {
      target: HWPParagraph[];
      remaining: number;
      obj?: HeaderFooter;
    } | null = null;

    let pendingShapeComponentOffset: number | null = null;
    let pendingHeaderFooter: Partial<HeaderFooter> | null = null;

    while (offset < data.length - 4) {
      const recordHeader = parseRecordHeader(view, offset, data.length);
      if (!recordHeader) break;

      offset += recordHeader.totalHeaderSize;
      const { tagId, level, size } = recordHeader;

      if (offset + size > data.length) {
        logger.warn(`레코드 크기 초과: offset=${offset}, size=${size}`);
        break;
      }

      try {
        // 태그별 처리
        switch (tagId) {
          case HWPTAG.PARA_HEADER:
            this.handleParaHeader(
              data, offset, size,
              currentPara, currentCharShapes, paragraphs,
              activeContainer, headerFooters
            );
            currentPara = { text: '', charShapeID: 0, paraShapeID: 0, styleID: 0, runs: [] };
            currentCharShapes = [];
            parseParaHeader(data.slice(offset, offset + size), currentPara);

            if (activeContainer && activeContainer.remaining === 0) {
              if (activeContainer.obj) {
                headerFooters.push(activeContainer.obj);
              }
              activeContainer = null;
            }
            break;

          case HWPTAG.LIST_HEADER:
            if (pendingHeaderFooter) {
              const paraCount = view.getInt32(offset, true);
              const obj: HeaderFooter = {
                type: pendingHeaderFooter.type as 'HEADER' | 'FOOTER',
                index: pendingHeaderFooter.index!,
                applyPage: pendingHeaderFooter.applyPage!,
                paragraphs: []
              };

              if (currentPara && currentPara.text) {
                finalizeParagraph(currentPara, currentCharShapes);
                if (activeContainer) activeContainer.target.push(currentPara);
                else paragraphs.push(currentPara);
                currentPara = null;
              }

              activeContainer = { target: obj.paragraphs, remaining: paraCount, obj };
              pendingHeaderFooter = null;
            }
            break;

          case HWPTAG.PARA_TEXT:
            if (currentPara) {
              const textData = data.slice(offset, offset + size);
              currentPara.text += decodeHWPText(textData);
            }
            break;

          case HWPTAG.PARA_CHAR_SHAPE:
            if (currentPara) {
              parseCharShapeChange(data.slice(offset, offset + size), currentCharShapes);
            }
            break;

          case HWPTAG.TABLE:
            try {
              const tableParser = new TableParser(data);
              const table = tableParser.parseTable(offset - recordHeader.totalHeaderSize);

              if (table) {
                if (currentPara) {
                  if (!currentPara.controls) currentPara.controls = [];
                  currentPara.controls.push({ type: 'TABLE', obj: table });
                  currentPara.text += '\u000b';
                }

                if (activeContainer && activeContainer.obj) {
                  if (!activeContainer.obj.tables) activeContainer.obj.tables = [];
                  activeContainer.obj.tables.push(table);
                } else {
                  tables.push(table);
                }

                if (tableParser.getOffset() > offset) {
                  offset = tableParser.getOffset();
                  continue;
                }
              }
            } catch (error) {
              logger.error('테이블 파싱 오류:', error);
            }
            break;

          case HWPTAG.SHAPE_COMPONENT:
          case HWPTAG.SHAPE_COMPONENT_V1:
            pendingShapeComponentOffset = offset;
            break;

          case HWPTAG.SHAPE_COMPONENT_PICTURE:
          case HWPTAG.SHAPE_COMPONENT_PICTURE_V1:
            if (pendingShapeComponentOffset !== null) {
              try {
                const pictureParser = new PictureParser(data);
                const picture = pictureParser.parsePicture(pendingShapeComponentOffset, offset);

                if (picture) {
                  picture.id = pictures.length;
                  picture.binDataIDRef = pictures.length + 1;

                  if (activeContainer && activeContainer.obj) {
                    if (!activeContainer.obj.pictures) activeContainer.obj.pictures = [];
                    activeContainer.obj.pictures.push(picture);
                  } else {
                    pictures.push(picture);
                  }

                  if (currentPara) {
                    if (!currentPara.controls) currentPara.controls = [];
                    currentPara.controls.push({ type: 'PICTURE', obj: picture });
                    if (!currentPara.text.includes('\u000b')) {
                      currentPara.text += '\u000b';
                    }
                  }
                }
              } catch (error) {
                logger.error('그림 파싱 오류:', error);
              }
              pendingShapeComponentOffset = null;
            }
            break;

          case HWPTAG.SHAPE_COMPONENT_LINE:
          case HWPTAG.SHAPE_COMPONENT_RECTANGLE:
          case HWPTAG.SHAPE_COMPONENT_ELLIPSE:
          case HWPTAG.SHAPE_COMPONENT_POLYGON:
          case HWPTAG.SHAPE_COMPONENT_CURVE:
            try {
              const shapeParser = new ShapeParser(data);
              const shape = shapeParser.parseShape(offset - size - 200, offset, tagId);

              if (shape) {
                shape.id = shapes.length;
                shapes.push(shape);

                if (currentPara) {
                  if (!currentPara.controls) currentPara.controls = [];
                  currentPara.controls.push({ type: 'SHAPE', obj: shape });
                  if (!currentPara.text.includes('\u000b')) {
                    currentPara.text += '\u000b';
                  }
                }
              }
            } catch (error) {
              logger.error('도형 파싱 오류:', error);
            }
            break;

          case HWPTAG.EQEDIT:
            try {
              const equationParser = new EquationParser(data);
              const equation = equationParser.parseEquation(offset);

              if (equation) {
                equation.id = equations.length;
                equations.push(equation);

                if (currentPara) {
                  if (!currentPara.controls) currentPara.controls = [];
                  currentPara.controls.push({ type: 'EQUATION', obj: equation });
                  if (!currentPara.text.includes('\u000b')) {
                    currentPara.text += '\u000b';
                  }
                }
              }
            } catch (error) {
              logger.error('수식 파싱 오류:', error);
            }
            break;

          case HWPTAG.CHART:
            try {
              const chartParser = new ChartParser(data);
              const chart = chartParser.parseChart(offset);

              if (chart) {
                chart.id = charts.length;
                charts.push(chart);

                if (currentPara) {
                  if (!currentPara.controls) currentPara.controls = [];
                  currentPara.controls.push({ type: 'CHART', obj: chart });
                  if (!currentPara.text.includes('\u000b')) {
                    currentPara.text += '\u000b';
                  }
                }
              }
            } catch (error) {
              logger.error('차트 파싱 오류:', error);
            }
            break;

          case HWPTAG.PAGE_DEF:
            pageDef = parsePageDef(view, offset, size);
            break;

          case HWPTAG.PAGE_BORDER_FILL:
            if (data.byteLength >= 14) {
              pageBorderFillID = view.getUint16(offset + 12, true);
            }
            break;

          case HWPTAG.FIELD_BEGIN:
            if (currentPara && data.byteLength >= 4) {
              const property = view.getUint32(offset, true);
              if (!currentPara.controls) currentPara.controls = [];
              currentPara.text += '\u000b';
              currentPara.controls.push({ type: 'FIELD_BEGIN', property });
            }
            break;

          case HWPTAG.FIELD_END:
            if (currentPara) {
              if (!currentPara.controls) currentPara.controls = [];
              currentPara.text += '\u000b';
              currentPara.controls.push({ type: 'FIELD_END' });
            }
            break;

          case HWPTAG.CTRL_HEADER:
            const ctrlResult = parseCtrlHeader(view, data, offset, size, columnDefs.length);

            if (ctrlResult.type === 'header' || ctrlResult.type === 'footer') {
              pendingHeaderFooter = ctrlResult.headerFooter!;
            } else if (ctrlResult.type === 'column' && ctrlResult.columnDef) {
              columnDefs.push(ctrlResult.columnDef);
            }
            break;
        }

        offset += size;
      } catch (error) {
        logger.error(`레코드 파싱 오류 at offset ${offset}:`, error);
        break;
      }
    }

    // 마지막 문단 저장
    if (currentPara && currentPara.text) {
      finalizeParagraph(currentPara, currentCharShapes);
      paragraphs.push(currentPara);
    }

    const allText = paragraphs.map(p => p.text).join('\n\n');
    logger.info(`섹션 ${index}: ${paragraphs.length}개 문단, ${allText.length}자`);

    return {
      index,
      text: allText,
      paragraphs,
      tables: tables.length > 0 ? tables : undefined,
      pictures: pictures.length > 0 ? pictures : undefined,
      shapes: shapes.length > 0 ? shapes : undefined,
      equations: equations.length > 0 ? equations : undefined,
      charts: charts.length > 0 ? charts : undefined,
      pageDef,
      columnDefs: columnDefs.length > 0 ? columnDefs : undefined,
      headerFooters: headerFooters.length > 0 ? headerFooters : undefined,
      pageBorderFillID
    };
  }

  /**
   * PARA_HEADER 처리 헬퍼
   */
  private handleParaHeader(
    data: Uint8Array,
    offset: number,
    size: number,
    currentPara: HWPParagraph | null,
    currentCharShapes: CharShapeChange[],
    paragraphs: HWPParagraph[],
    activeContainer: { target: HWPParagraph[]; remaining: number; obj?: HeaderFooter } | null,
    headerFooters: HeaderFooter[]
  ): void {
    if (currentPara && currentPara.text) {
      finalizeParagraph(currentPara, currentCharShapes);
      if (activeContainer) {
        activeContainer.target.push(currentPara);
      } else {
        paragraphs.push(currentPara);
      }
    }

    if (activeContainer) {
      activeContainer.remaining--;
      if (activeContainer.remaining < 0 && activeContainer.obj) {
        headerFooters.push(activeContainer.obj);
      }
    }
  }

  /**
   * 빈 섹션 생성
   */
  private createEmptySection(index: number): HWPSection {
    return {
      index,
      text: '',
      paragraphs: [],
      tables: [],
      pictures: [],
      shapes: [],
      equations: [],
      charts: []
    };
  }

  /**
   * 텍스트 디코딩 (public API)
   */
  public decodeText(data: Uint8Array): string {
    return decodeHWPText(data);
  }
}

/**
 * 간단한 텍스트 추출 헬퍼
 */
export async function extractHWPText(buffer: ArrayBuffer): Promise<string> {
  const extractor = new HWPTextExtractor(buffer);
  const sections = await extractor.extract();
  return sections.map(section => section.text).join('\n\n=== 섹션 구분 ===\n\n');
}
