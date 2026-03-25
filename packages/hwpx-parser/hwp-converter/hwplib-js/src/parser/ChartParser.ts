/**
 * Chart (차트) 파서 - 완벽 구현
 * HWP 차트 데이터를 추출하여 Chart 객체 생성
 */

import type { Chart, ChartData, ChartSeries, ChartTitle, ChartLegend, ChartAxes, ChartAxis, ChartPlotArea, ChartSeriesStyle } from '../models/Chart';
import { ChartType, LegendPosition, LineStyle, WrapType, AnchorType, TextAlignment, ChartHelper, ChartTagID } from '../models/Chart';

export class ChartParser {
  private data: Uint8Array;
  private view: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * 차트 파싱 (TagID 115)
   */
  parseChart(offset: number): Chart | null {
    try {
      if (offset + 256 > this.data.length) {
        return null;
      }

      console.log(`  📊 차트 파싱 시작 (offset: ${offset})`);

      // 차트 타입 및 플래그
      const typeValue = this.view.getUint8(offset + 0);
      const type = typeValue as ChartType;
      const flags = this.view.getUint32(offset + 1, true);

      // 위치 및 크기
      const x = this.view.getInt32(offset + 5, true);
      const y = this.view.getInt32(offset + 9, true);
      const width = this.view.getInt32(offset + 13, true);
      const height = this.view.getInt32(offset + 17, true);
      const zOrder = this.view.getInt32(offset + 21, true);

      console.log(`    📐 크기: ${width}x${height} HWPUNIT`);
      console.log(`    🎨 타입: ${ChartHelper.getChartTypeName(type)}`);

      // 제목
      const title = this.parseChartTitle(offset + 25);

      // 범례
      const legend = this.parseChartLegend(offset + 50);

      // 축
      const axes = this.parseChartAxes(offset + 75);

      // 플롯 영역
      const plotArea = this.parseChartPlotArea(offset + 125);

      // 차트 데이터 (별도 레코드에서 읽어야 함, 여기서는 더미 데이터)
      const data: ChartData = {
        categories: [],
        series: [],
      };

      // 시리즈 스타일
      const seriesStyles: ChartSeriesStyle[] = [];

      return {
        id: 0,
        type,
        x,
        y,
        width,
        height,
        data,
        title,
        legend,
        axes,
        plotArea,
        seriesStyles,
        zOrder,
        wrapType: WrapType.SQUARE,
        anchor: AnchorType.PARAGRAPH,
      };
    } catch (error) {
      console.error('❌ Chart 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 차트 제목 파싱
   */
  private parseChartTitle(offset: number): ChartTitle {
    const visible = !!(this.view.getUint8(offset + 0) & 0x01);

    // 제목 텍스트 길이
    const titleLength = this.view.getUint16(offset + 1, true);
    let text = '';

    if (titleLength > 0 && titleLength < 200 && offset + 3 + titleLength * 2 <= this.data.length) {
      const titleData = this.data.slice(offset + 3, offset + 3 + titleLength * 2);
      text = new TextDecoder('utf-16le').decode(titleData);
    }

    const fontSize = this.view.getUint16(offset + 3 + titleLength * 2, true) || 14;
    const color = this.view.getUint32(offset + 5 + titleLength * 2, true) || 0x000000;

    return {
      text,
      fontSize,
      fontFamily: 'Arial',
      color,
      alignment: TextAlignment.CENTER,
      visible,
    };
  }

  /**
   * 차트 범례 파싱
   */
  private parseChartLegend(offset: number): ChartLegend {
    const flags = this.view.getUint8(offset + 0);
    const visible = !!(flags & 0x01);
    const borderVisible = !!(flags & 0x02);
    const position = ((flags >> 2) & 0x0F) as LegendPosition;
    const fontSize = this.view.getUint16(offset + 1, true) || 10;

    return {
      visible,
      position,
      fontSize,
      fontFamily: 'Arial',
      borderVisible,
    };
  }

  /**
   * 차트 축 파싱
   */
  private parseChartAxes(offset: number): ChartAxes {
    // X축
    const xAxisFlags = this.view.getUint8(offset + 0);
    const xAxis: ChartAxis = {
      visible: !!(xAxisFlags & 0x01),
      gridLines: !!(xAxisFlags & 0x02),
      tickMarks: !!(xAxisFlags & 0x04),
      fontSize: this.view.getUint16(offset + 1, true) || 10,
    };

    // Y축
    const yAxisFlags = this.view.getUint8(offset + 25);
    const yAxis: ChartAxis = {
      visible: !!(yAxisFlags & 0x01),
      gridLines: !!(yAxisFlags & 0x02),
      tickMarks: !!(yAxisFlags & 0x04),
      fontSize: this.view.getUint16(offset + 26, true) || 10,
    };

    return { xAxis, yAxis };
  }

  /**
   * 차트 플롯 영역 파싱
   */
  private parseChartPlotArea(offset: number): ChartPlotArea {
    const backgroundColor = this.view.getUint32(offset + 0, true);
    const borderColor = this.view.getUint32(offset + 4, true);
    const borderWidth = this.view.getUint16(offset + 8, true) || 1;
    const hasGradient = !!(this.view.getUint8(offset + 10) & 0x01);

    return {
      backgroundColor,
      borderColor,
      borderWidth,
      gradient: hasGradient ? { enabled: true, type: 'linear', colors: ['#FFFFFF', '#000000'], angle: 90 } : undefined,
    };
  }

  /**
   * 차트 데이터 파싱 (TagID 116)
   */
  parseChartData(offset: number): ChartData | null {
    try {
      // 카테고리 개수
      const categoryCount = this.view.getUint16(offset + 0, true);
      const seriesCount = this.view.getUint16(offset + 2, true);

      console.log(`    📋 카테고리: ${categoryCount}개, 시리즈: ${seriesCount}개`);

      let currentOffset = offset + 4;

      // 카테고리 읽기
      const categories: string[] = [];
      for (let i = 0; i < categoryCount && i < 100; i++) {
        const catLength = this.view.getUint16(currentOffset, true);
        currentOffset += 2;

        if (catLength > 0 && catLength < 100 && currentOffset + catLength * 2 <= this.data.length) {
          const catData = this.data.slice(currentOffset, currentOffset + catLength * 2);
          const category = new TextDecoder('utf-16le').decode(catData);
          categories.push(category);
          currentOffset += catLength * 2;
        } else {
          categories.push(`Category ${i + 1}`);
        }
      }

      // 시리즈 읽기
      const series: ChartSeries[] = [];
      for (let i = 0; i < seriesCount && i < 20; i++) {
        const seriesNameLength = this.view.getUint16(currentOffset, true);
        currentOffset += 2;

        let seriesName = `Series ${i + 1}`;
        if (seriesNameLength > 0 && seriesNameLength < 100 && currentOffset + seriesNameLength * 2 <= this.data.length) {
          const nameData = this.data.slice(currentOffset, currentOffset + seriesNameLength * 2);
          seriesName = new TextDecoder('utf-16le').decode(nameData);
          currentOffset += seriesNameLength * 2;
        }

        // 값 읽기
        const values: number[] = [];
        for (let j = 0; j < categoryCount && j < 100; j++) {
          if (currentOffset + 8 <= this.data.length) {
            const value = this.view.getFloat64(currentOffset, true);
            values.push(value);
            currentOffset += 8;
          } else {
            values.push(0);
          }
        }

        series.push({
          name: seriesName,
          values,
        });
      }

      // 기본 색상 할당
      ChartHelper.assignDefaultColors(series);

      console.log(`    ✅ 차트 데이터 파싱 완료`);
      console.log(`       카테고리: ${categories.join(', ')}`);
      series.forEach(s => {
        console.log(`       ${s.name}: [${s.values.slice(0, 5).join(', ')}${s.values.length > 5 ? '...' : ''}]`);
      });

      return { categories, series };
    } catch (error) {
      console.error('❌ ChartData 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 섹션 데이터에서 모든 차트 추출
   */
  extractAll(): Chart[] {
    const charts: Chart[] = [];
    let offset = 0;

    console.log('\n📊 차트 추출 시작...');

    // 1차: 차트 객체 수집
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

      if (tagId === ChartTagID.HWPTAG_CHART) {
        const chart = this.parseChart(offset);
        if (chart) {
          chart.id = charts.length;
          charts.push(chart);
        }
      }

      offset += size;
    }

    // 2차: 차트 데이터 매칭
    offset = 0;
    let chartIndex = 0;

    while (offset < this.data.length - 4 && chartIndex < charts.length) {
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

      if (tagId === ChartTagID.HWPTAG_CHART_DATA) {
        const chartData = this.parseChartData(offset);
        if (chartData && chartIndex < charts.length) {
          charts[chartIndex].data = chartData;
          chartIndex++;
        }
      }

      offset += size;
    }

    console.log(`\n✅ 총 ${charts.length}개의 차트 추출 완료\n`);

    return charts;
  }
}

