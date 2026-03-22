/**
 * BinDataParser.ts
 * HWP 파일에서 BinData (이미지/OLE) 파싱
 */

import type { BinData, BinDataType, CompressionType, ImageFormat } from '../models/BinData';
import { identifyImageFormat, getExtensionFromName, getExtensionFromFormat } from '../models/BinData';
import { OLEParser } from './OLEParser';

// HWP 레코드 태그 ID
const HWPTAG_BIN_DATA = 18;
const HWPTAG_BIN_DATA_OLD = 26;

/**
 * BinData 파서
 */
export class BinDataParser {
  private oleParser: OLEParser;

  constructor(oleParser: OLEParser) {
    this.oleParser = oleParser;
  }

  /**
   * 모든 BinData 추출
   */
  extractAll(): BinData[] {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 BinData 추출 시작');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const binDataList: BinData[] = [];
    const directory = this.oleParser.getDirectory();

    // BinData 폴더 찾기
    const binDataFolder = directory.find(entry => 
      entry.name.toLowerCase() === 'bindata' && entry.type === 1
    );

    if (!binDataFolder) {
      console.log('⚠️  BinData 폴더를 찾을 수 없습니다.\n');
      return binDataList;
    }

    console.log(`✅ BinData 폴더 발견\n`);

    // BinData 폴더 내 모든 파일 찾기
    let binDataId = 0;
    directory.forEach((entry) => {
      // BIN0001.JPG, BIN0002.PNG 등
      if (entry.type === 2 && entry.name.match(/^BIN\d+\./i)) {
        console.log(`📄 처리 중: ${entry.name} (${entry.size} bytes)`);

        try {
          // 스트림 데이터 읽기
          let data = this.oleParser.readStream(entry);

          // 압축 해제 시도
          const { decompressed, wasCompressed } = this.tryDecompress(data);
          
          if (wasCompressed) {
            console.log(`   🔄 압축 해제: ${data.length} → ${decompressed.length} bytes`);
          }

          // 이미지 포맷 식별
          const format = identifyImageFormat(decompressed);
          console.log(`   🖼️  포맷: ${format}`);

          // 확장자 추출
          const extension = getExtensionFromName(entry.name) || getExtensionFromFormat(format);

          // BinData 객체 생성
          const binData: BinData = {
            id: binDataId++,
            type: 1, // EMBEDDING
            compression: wasCompressed ? 1 : 0, // ZLIB or NONE
            format: format,
            extension: extension,
            data: decompressed,
            compressedData: wasCompressed ? data : undefined,
            size: decompressed.length,
            compressedSize: wasCompressed ? data.length : undefined,
            name: entry.name,
          };

          binDataList.push(binData);
          console.log(`   ✅ BinData #${binData.id} 추출 완료\n`);

        } catch (error) {
          console.error(`   ❌ 오류: ${error}\n`);
        }
      }
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 총 ${binDataList.length}개 BinData 추출 완료`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return binDataList;
  }

  /**
   * DocInfo에서 BinData 메타데이터 파싱
   */
  parseFromDocInfo(docInfoData: Uint8Array): Map<number, BinData> {
    const binDataMap = new Map<number, BinData>();
    const view = new DataView(docInfoData.buffer, docInfoData.byteOffset, docInfoData.byteLength);
    let offset = 0;

    console.log('\n📋 DocInfo에서 BinData 메타데이터 파싱...\n');

    while (offset < docInfoData.length - 4) {
      const header = view.getUint32(offset, true);
      offset += 4;

      const tagId = header & 0x3FF;
      let size = (header >> 20) & 0xFFF;

      if (size === 0xFFF) {
        if (offset + 4 > docInfoData.length) break;
        size = view.getUint32(offset, true);
        offset += 4;
      }

      if (offset + size > docInfoData.length) break;

      // HWPTAG_BIN_DATA (18 or 26)
      if (tagId === HWPTAG_BIN_DATA || tagId === HWPTAG_BIN_DATA_OLD) {
        const binData = this.parseBinDataRecord(
          docInfoData.slice(offset, offset + size),
          binDataMap.size
        );

        if (binData) {
          binDataMap.set(binData.id, binData);
          console.log(`  ✅ BinData #${binData.id}: ${binData.extension}, ${binData.type === 0 ? 'LINK' : 'EMBEDDING'}`);
        }
      }

      offset += size;
    }

    console.log(`\n✅ DocInfo BinData 메타데이터 ${binDataMap.size}개 파싱 완료\n`);

    return binDataMap;
  }

  /**
   * BinData 레코드 파싱
   */
  private parseBinDataRecord(data: Uint8Array, id: number): BinData | null {
    if (data.length < 16) return null;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // 속성 (2 bytes)
    const flags = view.getUint16(offset, true);
    offset += 2;

    // 타입 추출 (flags의 하위 2비트)
    const type = (flags & 0x03) as BinDataType;

    // 압축 타입 (flags의 3-4비트)
    const compression = ((flags >> 2) & 0x03) as CompressionType;

    // 확장자 (UTF-16LE, NULL-terminated)
    let extension = '';
    for (let i = 0; i < 16; i++) {
      if (offset + 2 > data.length) break;
      const charCode = view.getUint16(offset, true);
      offset += 2;
      if (charCode === 0) break;
      if (charCode >= 32 && charCode < 127) {
        extension += String.fromCharCode(charCode);
      }
    }

    return {
      id,
      type,
      compression,
      format: 'UNKNOWN' as ImageFormat,
      extension: extension.toLowerCase() || 'bin',
      data: new Uint8Array(0), // 실제 데이터는 extractAll()에서
      size: 0,
    };
  }

  /**
   * 압축 해제 시도 (zlib)
   */
  private tryDecompress(data: Uint8Array): { decompressed: Uint8Array; wasCompressed: boolean } {
    try {
      // 동적 import를 피하고 직접 pako 사용
      // @ts-ignore
      const pako = require('pako');
      
      // zlib 압축 해제 시도
      const decompressed = pako.inflateRaw(data);
      return { decompressed: new Uint8Array(decompressed), wasCompressed: true };
    } catch (error) {
      // 압축 해제 실패 = 압축되지 않은 데이터
      return { decompressed: data, wasCompressed: false };
    }
  }
}

