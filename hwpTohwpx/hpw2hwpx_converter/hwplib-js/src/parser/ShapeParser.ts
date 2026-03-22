/**
 * Shape (도형) 파서
 * 
 * HWP 도형 레코드를 파싱하여 Shape 객체 생성
 */

import type { Shape, ShapeLine, ShapeRectangle, ShapeEllipse, ShapePolygon, ShapeCurve, ShapeConnector, Point, ShapeCommon } from '../models/Shape';
import { ShapeTagID, LineStyle, FillType, ArrowType, ArcType, ConnectorType } from '../models/Shape';

export class ShapeParser {
  private data: Uint8Array;
  private view: DataView;
  
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  
  /**
   * 도형 파싱 (SHAPE_COMPONENT + 특정 도형 타입 레코드 통합)
   */
  parseShape(shapeComponentOffset: number, shapeTypeOffset: number, tagId: number): Shape | null {
    try {
      // 1. SHAPE_COMPONENT (76) 공통 속성 파싱
      const common = this.parseShapeComponent(shapeComponentOffset);
      if (!common) {
        console.warn('⚠️ SHAPE_COMPONENT 파싱 실패');
        return null;
      }
      
      // 2. 특정 도형 타입별 파싱
      let shape: Shape | null = null;
      
      switch (tagId) {
        case ShapeTagID.HWPTAG_SHAPE_COMPONENT_LINE:
          shape = this.parseLine(shapeTypeOffset, common);
          break;
        case ShapeTagID.HWPTAG_SHAPE_COMPONENT_RECTANGLE:
          shape = this.parseRectangle(shapeTypeOffset, common);
          break;
        case ShapeTagID.HWPTAG_SHAPE_COMPONENT_ELLIPSE:
          shape = this.parseEllipse(shapeTypeOffset, common);
          break;
        case ShapeTagID.HWPTAG_SHAPE_COMPONENT_POLYGON:
          shape = this.parsePolygon(shapeTypeOffset, common);
          break;
        case ShapeTagID.HWPTAG_SHAPE_COMPONENT_CURVE:
          shape = this.parseCurve(shapeTypeOffset, common);
          break;
        default:
          console.warn(`⚠️ 지원하지 않는 도형 타입: TagID ${tagId}`);
          return null;
      }
      
      return shape;
      
    } catch (error) {
      console.error('❌ Shape 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * SHAPE_COMPONENT (76) 공통 속성 파싱
   */
  private parseShapeComponent(offset: number): ShapeCommon | null {
    try {
      if (offset + 32 > this.data.length) {
        return null;
      }
      
      const ctrlId = this.view.getUint32(offset + 0, true);
      const zOrder = this.view.getInt32(offset + 4, true);
      const flags = this.view.getUint32(offset + 8, true);
      const x = this.view.getInt32(offset + 12, true);
      const y = this.view.getInt32(offset + 16, true);
      const width = this.view.getInt32(offset + 20, true);
      const height = this.view.getInt32(offset + 24, true);
      const rotation = this.view.getInt32(offset + 28, true) / 100;
      
      // 기본값 설정
      return {
        id: 0, // 외부에서 할당
        type: 'LINE' as any, // 나중에 덮어씀
        ctrlId,
        x,
        y,
        width,
        height,
        rotation,
        zOrder,
        lineColor: 0x000000,    // 검은색
        lineWidth: 10,          // 기본 선 두께
        lineStyle: LineStyle.SOLID,
        fillColor: 0xFFFFFF,    // 흰색
        fillType: FillType.NONE,
        fillOpacity: 100,
        flags,
      };
    } catch (error) {
      console.error('❌ SHAPE_COMPONENT 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * LINE (78) 파싱
   */
  private parseLine(offset: number, common: ShapeCommon): ShapeLine | null {
    try {
      if (offset + 24 > this.data.length) {
        return null;
      }
      
      const startX = this.view.getInt32(offset + 0, true);
      const startY = this.view.getInt32(offset + 4, true);
      const endX = this.view.getInt32(offset + 8, true);
      const endY = this.view.getInt32(offset + 12, true);
      
      // 선 스타일 (추정)
      const lineColor = offset + 16 <= this.data.length - 4 ? this.view.getUint32(offset + 16, true) : 0x000000;
      const lineWidth = offset + 20 <= this.data.length - 4 ? this.view.getUint32(offset + 20, true) : 10;
      
      return {
        ...common,
        type: 'LINE',
        startX,
        startY,
        endX,
        endY,
        arrowStart: ArrowType.NONE,
        arrowEnd: ArrowType.NONE,
        lineColor,
        lineWidth,
      };
    } catch (error) {
      console.error('❌ LINE 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * RECTANGLE (79) 파싱
   */
  private parseRectangle(offset: number, common: ShapeCommon): ShapeRectangle | null {
    try {
      // 모서리 둥글기 (추정, 첫 4 bytes)
      const cornerRadius = offset + 4 <= this.data.length ? this.view.getUint32(offset, true) : 0;
      
      return {
        ...common,
        type: 'RECTANGLE',
        cornerRadius,
        round: cornerRadius > 0,
      };
    } catch (error) {
      console.error('❌ RECTANGLE 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * ELLIPSE (80) 파싱
   */
  private parseEllipse(offset: number, common: ShapeCommon): ShapeEllipse | null {
    try {
      // 호 타입, 시작/끝 각도 (추정)
      const arcType = offset + 4 <= this.data.length ? this.view.getUint32(offset, true) : ArcType.NORMAL;
      const startAngle = offset + 8 <= this.data.length ? this.view.getInt32(offset + 4, true) / 100 : undefined;
      const sweepAngle = offset + 12 <= this.data.length ? this.view.getInt32(offset + 8, true) / 100 : undefined;
      
      return {
        ...common,
        type: 'ELLIPSE',
        arcType,
        startAngle,
        sweepAngle,
      };
    } catch (error) {
      console.error('❌ ELLIPSE 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * POLYGON (82) 파싱
   */
  private parsePolygon(offset: number, common: ShapeCommon): ShapePolygon | null {
    try {
      // 꼭짓점 개수 (첫 4 bytes, 추정)
      const pointCount = this.view.getUint32(offset, true);
      
      if (pointCount < 2 || pointCount > 1000) {
        console.warn(`⚠️ 비정상적인 꼭짓점 개수: ${pointCount}`);
        return null;
      }
      
      // 꼭짓점 좌표 읽기 (각 점은 8 bytes: x, y)
      const points: Point[] = [];
      for (let i = 0; i < pointCount; i++) {
        const pointOffset = offset + 4 + (i * 8);
        if (pointOffset + 8 > this.data.length) break;
        
        const x = this.view.getInt32(pointOffset + 0, true);
        const y = this.view.getInt32(pointOffset + 4, true);
        points.push({ x, y });
      }
      
      // 닫힌 다각형 여부 판별
      const closed = points.length >= 3 && (
        Math.abs(points[0].x - points[points.length - 1].x) < 10 &&
        Math.abs(points[0].y - points[points.length - 1].y) < 10
      );
      
      return {
        ...common,
        type: 'POLYGON',
        points,
        closed,
      };
    } catch (error) {
      console.error('❌ POLYGON 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * CURVE (83) 파싱
   */
  private parseCurve(offset: number, common: ShapeCommon): ShapeCurve | null {
    try {
      // 제어점 개수 (첫 4 bytes, 추정)
      const pointCount = this.view.getUint32(offset, true);
      
      if (pointCount < 2 || pointCount > 1000) {
        console.warn(`⚠️ 비정상적인 제어점 개수: ${pointCount}`);
        return null;
      }
      
      // 제어점 좌표 읽기
      const controlPoints: Point[] = [];
      for (let i = 0; i < pointCount; i++) {
        const pointOffset = offset + 4 + (i * 8);
        if (pointOffset + 8 > this.data.length) break;
        
        const x = this.view.getInt32(pointOffset + 0, true);
        const y = this.view.getInt32(pointOffset + 4, true);
        controlPoints.push({ x, y });
      }
      
      return {
        ...common,
        type: 'CURVE',
        controlPoints,
        smooth: true,
      };
    } catch (error) {
      console.error('❌ CURVE 파싱 오류:', error);
      return null;
    }
  }
  
  /**
   * 섹션 데이터에서 모든 도형 추출
   */
  extractAll(): Shape[] {
    const shapes: Shape[] = [];
    let offset = 0;
    
    // SHAPE_COMPONENT와 도형 타입 레코드 위치 수집
    const shapeComponentOffsets: number[] = [];
    const shapeTypeRecords: Array<{ offset: number, tagId: number }> = [];
    
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
      
      if (tagId === ShapeTagID.HWPTAG_SHAPE_COMPONENT) {
        shapeComponentOffsets.push(offset);
      } else if (
        tagId === ShapeTagID.HWPTAG_SHAPE_COMPONENT_LINE ||
        tagId === ShapeTagID.HWPTAG_SHAPE_COMPONENT_RECTANGLE ||
        tagId === ShapeTagID.HWPTAG_SHAPE_COMPONENT_ELLIPSE ||
        tagId === ShapeTagID.HWPTAG_SHAPE_COMPONENT_POLYGON ||
        tagId === ShapeTagID.HWPTAG_SHAPE_COMPONENT_CURVE
      ) {
        shapeTypeRecords.push({ offset, tagId });
      }
      
      offset += size;
    }
    
    console.log(`🔍 발견: SHAPE_COMPONENT ${shapeComponentOffsets.length}개, 도형 타입 레코드 ${shapeTypeRecords.length}개`);
    
    // SHAPE_COMPONENT와 도형 타입 레코드 쌍 매칭
    for (let i = 0; i < Math.min(shapeComponentOffsets.length, shapeTypeRecords.length); i++) {
      const shape = this.parseShape(shapeComponentOffsets[i], shapeTypeRecords[i].offset, shapeTypeRecords[i].tagId);
      if (shape) {
        shape.id = shapes.length;
        shapes.push(shape);
        console.log(`✅ ${shape.type} #${shape.id} 파싱 완료: ${shape.width}x${shape.height} HWPUNIT`);
      }
    }
    
    return shapes;
  }
}

