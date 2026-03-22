/**
 * Picture (그림) 객체 모델
 * 
 * HWP 그림은 BinData(이미지 파일)와 Picture(배치 정보)로 구성됩니다.
 * - HWPTAG_SHAPE_COMPONENT (76): 공통 도형 속성
 * - HWPTAG_SHAPE_COMPONENT_PICTURE (85): 그림 전용 속성
 */

/**
 * 그림 객체
 */
export interface Picture {
  id: number;
  binDataIDRef: number;    // BinData 참조
  
  // 위치 (HWPUNIT)
  x: number;
  y: number;
  
  // 크기 (HWPUNIT)
  width: number;
  height: number;
  
  // 회전
  rotation: number;        // degree
  
  // 반전
  flipHorizontal: boolean;
  flipVertical: boolean;
  
  // 자르기 (%)
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  
  // 기타
  zOrder: number;          // 앞으로/뒤로
  opacity: number;         // 투명도 (0-100)
  
  // 배치
  wrapType: WrapType;
  anchor: AnchorType;
  
  // 컨트롤 ID
  ctrlId: number;
}

/**
 * 도형 공통 속성 (SHAPE_COMPONENT)
 */
export interface ShapeComponent {
  ctrlId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zOrder: number;
  flags: number;
}

/**
 * 그림 전용 속성 (SHAPE_COMPONENT_PICTURE)
 */
export interface ShapeComponentPicture {
  binDataIDRef: number;
  rotation: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  effects?: PictureEffect[];
}

/**
 * 그림 효과
 */
export interface PictureEffect {
  type: EffectType;
  intensity: number;
}

export enum EffectType {
  NONE = 0,
  SHADOW = 1,
  REFLECTION = 2,
  GLOW = 3,
  SOFT_EDGE = 4,
  BLUR = 5,
}

/**
 * 텍스트 배치 방식
 */
export enum WrapType {
  SQUARE = 0,         // 사각형
  TOP_AND_BOTTOM = 1, // 위아래만
  TIGHT = 2,          // 어울림
  THROUGH = 3,        // 투과
  NONE = 4,           // 없음 (본문과 겹침)
}

/**
 * 앵커 타입
 */
export enum AnchorType {
  PARAGRAPH = 0,      // 문단
  CHAR = 1,           // 글자
  PAGE = 2,           // 페이지
}

/**
 * HWP 레코드 TagID
 */
export enum HWPTag {
  HWPTAG_SHAPE_COMPONENT = 76,
  HWPTAG_SHAPE_COMPONENT_PICTURE = 85,
}

