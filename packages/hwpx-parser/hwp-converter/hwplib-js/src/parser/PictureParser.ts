/**
 * Picture (그림) 파서
 * 
 * HWP 그림 레코드를 파싱하여 Picture 객체 생성
 */

import type { Picture, ShapeComponent, ShapeComponentPicture } from '../models/Picture';

export class PictureParser {
  private data: Uint8Array;
  private view: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * Picture 레코드 파싱 (SHAPE_COMPONENT + SHAPE_COMPONENT_PICTURE 통합)
   * 
   * @param shapeComponentDataOffset SHAPE_COMPONENT (76) 레코드 **데이터** 시작 오프셋
   * @param shapePictureDataOffset SHAPE_COMPONENT_PICTURE (85) 레코드 **데이터** 시작 오프셋 (선택)
   * @returns Picture 객체 또는 null
   */
  parsePicture(shapeComponentDataOffset: number, shapePictureDataOffset?: number): Picture | null {
    try {
      // 1. SHAPE_COMPONENT (76) 파싱 - 데이터 오프셋에서 직접 파싱
      const shapeComponent = this.parseShapeComponent(shapeComponentDataOffset);
      if (!shapeComponent) {
        console.warn('⚠️ SHAPE_COMPONENT 파싱 실패');
        return null;
      }

      // 2. SHAPE_COMPONENT_PICTURE (85) 파싱
      // shapePictureDataOffset가 제공되면 직접 사용
      // 제공되지 않으면 저장된 pictureDataOffsets에서 가장 가까운 것 찾기
      let pictureOffset = shapePictureDataOffset;

      if (!pictureOffset) {
        // 이 SHAPE_COMPONENT 이후에서 SHAPE_COMPONENT_PICTURE 검색
        // (HWPTextExtractor가 별도로 감지했어야 함)
        console.warn('⚠️ SHAPE_COMPONENT_PICTURE 오프셋이 제공되지 않음');
        return null;
      }

      const shapePicture = this.parseShapeComponentPicture(pictureOffset);
      if (!shapePicture) {
        console.warn('⚠️ SHAPE_COMPONENT_PICTURE 파싱 실패');
        return null;
      }

      // 3. Picture 객체 생성
      const picture: Picture = {
        id: 0, // ID는 외부에서 할당
        ctrlId: shapeComponent.ctrlId,
        binDataIDRef: shapePicture.binDataIDRef,
        x: shapeComponent.x,
        y: shapeComponent.y,
        width: shapeComponent.width,
        height: shapeComponent.height,
        rotation: shapePicture.rotation || shapeComponent.rotation,
        flipHorizontal: shapePicture.flipHorizontal,
        flipVertical: shapePicture.flipVertical,
        cropLeft: shapePicture.cropLeft,
        cropRight: shapePicture.cropRight,
        cropTop: shapePicture.cropTop,
        cropBottom: shapePicture.cropBottom,
        zOrder: shapeComponent.zOrder,
        opacity: 100, // 기본값
        wrapType: 0, // WrapType.SQUARE
        anchor: 0, // AnchorType.PARAGRAPH
      };

      console.log(`    ✅ Picture 생성: BinData=${picture.binDataIDRef}, 크기=${picture.width}x${picture.height}`);

      return picture;

    } catch (error) {
      console.error('❌ Picture 파싱 오류:', error);
      return null;
    }
  }

  /**
   * SHAPE_COMPONENT (76) 레코드 파싱
   */
  private parseShapeComponent(offset: number): ShapeComponent | null {
    try {
      if (offset + 32 > this.data.length) {
        return null;
      }

      // analyze_picture_structure.js에서 확인된 구조 기반
      const ctrlId = this.view.getUint32(offset + 0, true);
      const zOrder = this.view.getInt32(offset + 4, true);
      const flags = this.view.getUint32(offset + 8, true);
      const x = this.view.getInt32(offset + 12, true);
      const y = this.view.getInt32(offset + 16, true);
      const width = this.view.getInt32(offset + 20, true);
      const height = this.view.getInt32(offset + 24, true);
      const rotation = this.view.getInt32(offset + 28, true) / 100; // 1/100 degree

      return {
        ctrlId,
        x,
        y,
        width,
        height,
        rotation,
        zOrder,
        flags,
      };
    } catch (error) {
      console.error('❌ SHAPE_COMPONENT 파싱 오류:', error);
      return null;
    }
  }

  /**
   * SHAPE_COMPONENT_PICTURE (85) 레코드 파싱
   */
  private parseShapeComponentPicture(offset: number): ShapeComponentPicture | null {
    try {
      if (offset + 30 > this.data.length) {
        return null;
      }

      // Debug: Print first 40 bytes at this offset
      const debugBytes = Array.from(this.data.slice(offset, offset + 40))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`    🔍 SHAPE_COMPONENT_PICTURE 데이터 (offset=${offset}): ${debugBytes}`);

      // HWP SHAPE_COMPONENT_PICTURE 구조 (HWPX 2.0 기준):
      // 오프셋 0-3: BorderColor (4 bytes)
      // 오프셋 4-7: BorderThickness (4 bytes)
      // 오프셋 8-11: BorderAttr (4 bytes)
      // 오프셋 12-15: BorderType? (4 bytes)
      // 오프셋 16-17 or other: binDataIDRef (2 bytes)

      // 여러 오프셋에서 binDataIDRef 후보 수집
      const candidates: { offset: number, value: number }[] = [];
      for (let i = 0; i <= 32; i += 2) {
        const val = this.view.getUint16(offset + i, true);
        if (val >= 1 && val <= 5000) { // 유효한 BinData ID 범위 (확장)
          candidates.push({ offset: i, value: val });
        }
      }

      console.log(`    📌 BinDataIDRef 후보: ${candidates.map(c => `offset+${c.offset}=${c.value}`).join(', ') || '없음'}`);

      let binDataIDRef = 0;

      // 우선순위: 1-10 범위의 작은 값 (일반적인 BinData ID)
      const smallCandidates = candidates.filter(c => c.value >= 1 && c.value <= 10);
      if (smallCandidates.length > 0) {
        // 가장 앞에 있는 유효한 값 선택
        binDataIDRef = smallCandidates[0].value;
        console.log(`    ✅ 선택된 binDataIDRef: ${binDataIDRef} (offset+${smallCandidates[0].offset})`);
      } else if (candidates.length > 0) {
        // 작은 값이 없으면 첫 번째 후보 사용
        binDataIDRef = candidates[0].value;
        console.log(`    ⚠️  대체 binDataIDRef: ${binDataIDRef} (offset+${candidates[0].offset})`);
      } else {
        // 후보가 없으면 순차적으로 할당 (1, 2, 3...)
        // 이 값은 호출측에서 덮어씌워야 할 수 있음
        console.log(`    ⚠️  binDataIDRef 찾을 수 없음, 기본값 0 사용`);
      }

      // 기타 속성 파싱 (추정 오프셋)
      const rotation = 0;  // 나중에 정확한 오프셋 확인 필요
      const cropLeft = 0;
      const cropTop = 0;
      const cropRight = 0;
      const cropBottom = 0;
      const flipHorizontal = false;
      const flipVertical = false;

      return {
        binDataIDRef,
        rotation,
        cropLeft,
        cropRight,
        cropTop,
        cropBottom,
        flipHorizontal,
        flipVertical,
      };
    } catch (error) {
      console.error('❌ SHAPE_COMPONENT_PICTURE 파싱 오류:', error);
      return null;
    }
  }

  /**
   * SHAPE_COMPONENT 이후에서 SHAPE_COMPONENT_PICTURE 레코드 검색
   * 
   * @param startOffset SHAPE_COMPONENT 오프셋
   * @returns SHAPE_COMPONENT_PICTURE 오프셋 또는 null
   */
  private findShapeComponentPicture(startOffset: number): number | null {
    const HWPTAG_SHAPE_COMPONENT_PICTURE = 85;
    const MAX_SEARCH_DISTANCE = 1024; // 최대 검색 거리

    let offset = startOffset;

    while (offset < this.data.length - 4 && offset < startOffset + MAX_SEARCH_DISTANCE) {
      // 레코드 헤더 읽기
      const header = this.view.getUint32(offset, true);
      offset += 4;

      const tagId = header & 0x3FF;
      let size = (header >> 20) & 0xFFF;

      if (size === 0xFFF) {
        if (offset + 4 > this.data.length) break;
        size = this.view.getUint32(offset, true);
        offset += 4;
      }

      if (tagId === HWPTAG_SHAPE_COMPONENT_PICTURE) {
        return offset; // 데이터 시작 오프셋 반환
      }

      offset += size;
    }

    return null;
  }

  /**
   * 섹션 데이터에서 모든 Picture 추출
   * 
   * @returns Picture 배열
   */
  extractAll(): Picture[] {
    const pictures: Picture[] = [];
    const HWPTAG_SHAPE_COMPONENT = 76;
    const HWPTAG_SHAPE_COMPONENT_PICTURE = 85;

    let offset = 0;
    const shapeComponentOffsets: number[] = [];
    const shapePictureOffsets: number[] = [];

    // 1. 모든 SHAPE_COMPONENT와 SHAPE_COMPONENT_PICTURE 레코드 위치 수집
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

      if (tagId === HWPTAG_SHAPE_COMPONENT) {
        shapeComponentOffsets.push(offset);
      } else if (tagId === HWPTAG_SHAPE_COMPONENT_PICTURE) {
        shapePictureOffsets.push(offset);
      }

      offset += size;
    }

    console.log(`🔍 발견: SHAPE_COMPONENT ${shapeComponentOffsets.length}개, SHAPE_COMPONENT_PICTURE ${shapePictureOffsets.length}개`);

    // 2. SHAPE_COMPONENT와 SHAPE_COMPONENT_PICTURE 쌍 매칭
    for (let i = 0; i < shapeComponentOffsets.length && i < shapePictureOffsets.length; i++) {
      const picture = this.parsePicture(shapeComponentOffsets[i], shapePictureOffsets[i]);
      if (picture) {
        picture.id = pictures.length;
        pictures.push(picture);
        console.log(`✅ Picture #${picture.id} 파싱 완료: BinData ${picture.binDataIDRef}, ${picture.width}x${picture.height} HWPUNIT`);
      }
    }

    return pictures;
  }
}

