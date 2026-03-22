/**
 * HWP 바이너리 쓰기 모듈
 *
 * HWPX → HWP 역변환을 위한 바이너리 직렬화 도구
 *
 * @module WriterBinary
 */

// 기본 바이너리 쓰기
export { RecordDataWriter } from './RecordDataWriter';
export { RecordWriter, parseRecordHeader } from './RecordWriter';

// 스트림 생성
export {
    FileHeaderWriter,
    DEFAULT_HWP_VERSION,
    DEFAULT_HWP_FLAGS,
    type HwpVersion,
    type HwpFlags
} from './FileHeaderWriter';

// 압축
export { CompressionHelper, type CompressionOptions } from './CompressionHelper';

// DocInfo 생성
export { DocInfoWriter } from './DocInfoWriter';

// Section 생성
export { SectionWriter, generateSectionStreams } from './SectionWriter';

// OLE 조립
export {
    OleAssembler,
    buildHwpFile,
    type BinDataEntry,
    type OleAssemblerOptions
} from './OleAssembler';
