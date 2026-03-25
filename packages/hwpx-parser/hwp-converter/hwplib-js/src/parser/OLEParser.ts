/**
 * OLE Compound Document Parser
 * HWP 파일은 OLE Compound Document 형식을 사용합니다
 */

import { logger } from '../utils/Logger';
import { OLE, HWP_ENTRIES, LIMITS, isEndOfChain, isSpecialFatValue } from '../utils/Constants';

export interface OLEHeader {
  signature: number[];
  clsid: Uint8Array;
  minorVersion: number;
  majorVersion: number;
  byteOrder: number;
  sectorShift: number;
  miniSectorShift: number;
  totalSectors: number;
  fatSectors: number;
  firstDirSector: number;
  minStreamSize: number;
  firstMiniFatSector: number;
  totalMiniFatSectors: number;
  firstDifatSector: number;
  totalDifatSectors: number;
  difat: number[];
}

export interface DirectoryEntry {
  name: string;
  type: number;
  color: number;
  leftSiblingId: number;
  rightSiblingId: number;
  childId: number;
  clsid: Uint8Array;
  stateBits: number;
  creationTime: bigint;
  modifiedTime: bigint;
  startSector: number;
  size: number;
}

export class OLEParser {
  private buffer: ArrayBuffer;
  private view: DataView;
  private header: OLEHeader | null = null;
  private fat: number[] = [];
  private miniFat: number[] = [];
  private directory: DirectoryEntry[] = [];
  private miniStreamData: Uint8Array | null = null;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  /**
   * OLE 파일 파싱
   */
  parse(): void {
    this.parseHeader();
    this.parseFAT();
    this.parseDirectory();
    this.parseMiniFAT();
  }

  /**
   * OLE 헤더 파싱
   */
  private parseHeader(): void {
    // OLE 시그니처 확인
    const signature = [
      this.view.getUint8(0),
      this.view.getUint8(1),
      this.view.getUint8(2),
      this.view.getUint8(3)
    ];

    if (!this.isValidSignature(signature)) {
      throw new Error('Invalid OLE file signature');
    }

    this.header = {
      signature,
      clsid: new Uint8Array(this.buffer, 8, 16),
      minorVersion: this.view.getUint16(OLE.HEADER_OFFSET.MINOR_VERSION, true),
      majorVersion: this.view.getUint16(OLE.HEADER_OFFSET.MAJOR_VERSION, true),
      byteOrder: this.view.getUint16(OLE.HEADER_OFFSET.BYTE_ORDER, true),
      sectorShift: this.view.getUint16(OLE.HEADER_OFFSET.SECTOR_SHIFT, true),
      miniSectorShift: this.view.getUint16(OLE.HEADER_OFFSET.MINI_SECTOR_SHIFT, true),
      totalSectors: 0,
      fatSectors: this.view.getUint32(OLE.HEADER_OFFSET.FAT_SECTORS, true),
      firstDirSector: this.view.getUint32(OLE.HEADER_OFFSET.FIRST_DIR_SECTOR, true),
      minStreamSize: this.view.getUint32(OLE.HEADER_OFFSET.MIN_STREAM_SIZE, true),
      firstMiniFatSector: this.view.getUint32(OLE.HEADER_OFFSET.FIRST_MINI_FAT_SECTOR, true),
      totalMiniFatSectors: this.view.getUint32(OLE.HEADER_OFFSET.TOTAL_MINI_FAT_SECTORS, true),
      firstDifatSector: this.view.getUint32(OLE.HEADER_OFFSET.FIRST_DIFAT_SECTOR, true),
      totalDifatSectors: this.view.getUint32(OLE.HEADER_OFFSET.TOTAL_DIFAT_SECTORS, true),
      difat: []
    };

    logger.debug(`OLE 헤더: v${this.header.majorVersion}.${this.header.minorVersion}, 섹터 크기: ${1 << this.header.sectorShift}`);

    // DIFAT 읽기 (헤더의 109개 엔트리)
    for (let i = 0; i < OLE.DIFAT_ENTRIES_IN_HEADER; i++) {
      const sector = this.view.getUint32(OLE.HEADER_OFFSET.DIFAT_START + i * 4, true);
      if (!isEndOfChain(sector) && sector !== OLE.FAT.FREE_SECTOR) {
        this.header.difat.push(sector);
      }
    }

    logger.debug(`DIFAT 엔트리 ${this.header.difat.length}개 발견`);
  }

  /**
   * 시그니처 유효성 검사
   */
  private isValidSignature(signature: number[]): boolean {
    return (
      signature[0] === OLE.SIGNATURE[0] &&
      signature[1] === OLE.SIGNATURE[1] &&
      signature[2] === OLE.SIGNATURE[2] &&
      signature[3] === OLE.SIGNATURE[3]
    );
  }

  /**
   * FAT (File Allocation Table) 파싱
   */
  private parseFAT(): void {
    if (!this.header) throw new Error('Header not parsed');

    const sectorSize = 1 << this.header.sectorShift;
    const entriesPerSector = sectorSize / 4;

    // 모든 DIFAT 엔트리 수집 (헤더 + 확장 DIFAT)
    const allDifatEntries: number[] = [...this.header.difat];

    // 확장 DIFAT 처리 (대용량 파일)
    if (this.header.totalDifatSectors > 0 && !isEndOfChain(this.header.firstDifatSector)) {
      logger.debug(`확장 DIFAT 처리: ${this.header.totalDifatSectors}개 섹터`);

      let currentDifatSector = this.header.firstDifatSector;
      let difatIterations = 0;
      const maxDifatIterations = this.header.totalDifatSectors + 10;
      const difatEntriesPerSector = entriesPerSector - 1; // 마지막 엔트리는 다음 DIFAT 섹터 포인터

      while (!isEndOfChain(currentDifatSector) && difatIterations < maxDifatIterations) {
        if (currentDifatSector < 0) {
          logger.warn(`유효하지 않은 DIFAT 섹터: ${currentDifatSector}`);
          break;
        }

        const difatOffset = OLE.HEADER_SIZE + currentDifatSector * sectorSize;

        if (difatOffset < 0 || difatOffset + sectorSize > this.buffer.byteLength) {
          logger.warn(`DIFAT 섹터 ${currentDifatSector} 범위 초과`);
          break;
        }

        // DIFAT 엔트리 읽기 (마지막 엔트리 제외 - 다음 DIFAT 섹터 포인터)
        for (let i = 0; i < difatEntriesPerSector; i++) {
          const entryOffset = difatOffset + i * 4;
          if (entryOffset + 4 > this.buffer.byteLength) break;

          const fatSectorIndex = this.view.getUint32(entryOffset, true);
          if (!isEndOfChain(fatSectorIndex) && fatSectorIndex !== OLE.FAT.FREE_SECTOR) {
            allDifatEntries.push(fatSectorIndex);
          }
        }

        // 다음 DIFAT 섹터 포인터 (마지막 4바이트)
        const nextDifatOffset = difatOffset + difatEntriesPerSector * 4;
        if (nextDifatOffset + 4 <= this.buffer.byteLength) {
          const nextSector = this.view.getUint32(nextDifatOffset, true);
          if (nextSector === currentDifatSector) {
            logger.warn(`DIFAT 순환 참조 감지: ${currentDifatSector}`);
            break;
          }
          currentDifatSector = nextSector;
        } else {
          break;
        }

        difatIterations++;
      }

      logger.debug(`확장 DIFAT에서 ${allDifatEntries.length - this.header.difat.length}개 FAT 섹터 추가 발견`);
    }

    logger.debug(`FAT 파싱: 총 ${allDifatEntries.length}개 DIFAT 엔트리, 섹터 크기 ${sectorSize}`);

    // FAT 엔트리 로드
    for (const sector of allDifatEntries) {
      if (sector < 0 || isSpecialFatValue(sector)) continue;

      const offset = OLE.HEADER_SIZE + sector * sectorSize;

      if (offset < 0 || offset + sectorSize > this.buffer.byteLength) {
        logger.warn(`FAT 섹터 ${sector} 범위 초과, 스킵`);
        continue;
      }

      for (let i = 0; i < entriesPerSector; i++) {
        const entryOffset = offset + i * 4;
        if (entryOffset + 4 > this.buffer.byteLength) break;
        this.fat.push(this.view.getUint32(entryOffset, true));
      }
    }

    logger.debug(`FAT 엔트리 ${this.fat.length}개 로드 완료`);
  }

  /**
   * 디렉토리 엔트리 파싱
   */
  private parseDirectory(): void {
    if (!this.header) throw new Error('Header not parsed');
    if (this.fat.length === 0) {
      logger.error('FAT이 비어있습니다');
      return;
    }

    const sectorSize = 1 << this.header.sectorShift;
    let currentSector = this.header.firstDirSector;
    let iterations = 0;

    // firstDirSector 유효성 확인
    currentSector = this.findValidDirectorySector(currentSector, sectorSize);
    if (currentSector === -1) {
      logger.error('디렉토리를 찾을 수 없습니다');
      return;
    }

    logger.debug(`디렉토리 섹터 파싱 시작: 섹터 ${currentSector}`);

    // FAT 체인을 따라 디렉토리 읽기
    while (currentSector >= 0 && !isEndOfChain(currentSector)) {
      if (++iterations > LIMITS.MAX_ITERATIONS) {
        logger.warn('디렉토리 파싱 무한루프 방지');
        break;
      }

      const offset = OLE.HEADER_SIZE + currentSector * sectorSize;
      if (offset < 0 || offset + sectorSize > this.buffer.byteLength) {
        logger.warn(`디렉토리 섹터 ${currentSector} 범위 초과`);
        break;
      }

      // 각 섹터는 4개의 디렉토리 엔트리 포함
      for (let i = 0; i < OLE.ENTRIES_PER_SECTOR; i++) {
        const entryOffset = offset + i * OLE.DIRECTORY_ENTRY_SIZE;
        if (entryOffset + OLE.DIRECTORY_ENTRY_SIZE > this.buffer.byteLength) break;

        const entry = this.parseDirectoryEntry(entryOffset);
        if (entry && entry.type !== OLE.ENTRY_TYPE.EMPTY) {
          this.directory.push(entry);
        }
      }

      const nextSector = this.fat[currentSector];
      if (isEndOfChain(nextSector)) {
        // 연속 섹터 스캔 (HWP 특수 처리)
        this.scanContinuousSectors(currentSector, sectorSize);
        break;
      }
      currentSector = nextSector;
    }

    logger.debug(`디렉토리 ${this.directory.length}개 엔트리 발견`);
  }

  /**
   * 유효한 디렉토리 섹터 찾기
   */
  private findValidDirectorySector(startSector: number, sectorSize: number): number {
    const testOffset = OLE.HEADER_SIZE + startSector * sectorSize;

    if (testOffset >= 0 && testOffset + OLE.DIRECTORY_ENTRY_SIZE <= this.buffer.byteLength) {
      const testData = new Uint8Array(this.buffer, testOffset, 64);
      const ffCount = Array.from(testData).filter(b => b === 0xFF).length;
      const first4 = this.view.getUint32(testOffset, true);
      const isFatSector = isSpecialFatValue(first4);

      if (ffCount <= 50 && !isFatSector) {
        return startSector;
      }

      logger.warn('firstDirSector가 빈 섹터, 디렉토리 검색 중...');

      // Root Entry 시그니처 검색
      for (let sector = 1; sector < Math.min(100, this.fat.length); sector++) {
        const offset = OLE.HEADER_SIZE + sector * sectorSize;
        if (offset + OLE.DIRECTORY_ENTRY_SIZE > this.buffer.byteLength) continue;

        const nameBytes = new Uint8Array(this.buffer, offset, 20);
        const entryType = this.view.getUint8(offset + 66);

        // Root Entry 시그니처: 'R', 'o', 'o', 't'
        if (entryType === OLE.ENTRY_TYPE.ROOT &&
            nameBytes[0] === 0x52 && nameBytes[2] === 0x6F &&
            nameBytes[4] === 0x6F && nameBytes[6] === 0x74) {
          logger.debug(`디렉토리 발견: 섹터 ${sector}`);
          return sector;
        }
      }
    }

    return startSector;
  }

  /**
   * 연속 섹터 스캔 (HWP 특수 처리)
   */
  private scanContinuousSectors(lastSector: number, sectorSize: number): void {
    const existingNames = new Set(this.directory.map(e => e.name));
    let scanSector = lastSector + 1;
    let consecutiveEmpty = 0;

    while (scanSector < this.fat.length && scanSector < lastSector + LIMITS.MAX_SECTOR_SCAN) {
      const scanOffset = OLE.HEADER_SIZE + scanSector * sectorSize;
      if (scanOffset + sectorSize > this.buffer.byteLength) break;

      let foundValidEntry = false;

      for (let i = 0; i < OLE.ENTRIES_PER_SECTOR; i++) {
        const entryOffset = scanOffset + i * OLE.DIRECTORY_ENTRY_SIZE;
        if (entryOffset + OLE.DIRECTORY_ENTRY_SIZE > this.buffer.byteLength) break;

        const entry = this.parseDirectoryEntry(entryOffset);

        if (entry &&
            entry.type >= OLE.ENTRY_TYPE.STORAGE &&
            entry.type <= OLE.ENTRY_TYPE.ROOT &&
            entry.name.length > 0 &&
            entry.name.length < 32 &&
            !existingNames.has(entry.name) &&
            this.isValidEntryName(entry.name)) {
          this.directory.push(entry);
          existingNames.add(entry.name);
          foundValidEntry = true;
          logger.trace(`연속 스캔: "${entry.name}" (섹터 ${scanSector})`);
        }
      }

      if (foundValidEntry) {
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
        if (consecutiveEmpty >= LIMITS.CONSECUTIVE_EMPTY_THRESHOLD) break;
      }

      scanSector++;
    }
  }

  /**
   * 유효한 디렉토리 엔트리 이름인지 확인
   */
  private isValidEntryName(name: string): boolean {
    if (!name || name.length === 0) return false;

    // 알려진 HWP 엔트리 이름
    const knownNames = Object.values(HWP_ENTRIES);
    if (knownNames.includes(name as typeof knownNames[number])) return true;

    // Section 패턴
    if (/^Section\d+$/i.test(name)) return true;

    // BIN 패턴
    if (/^BIN\d{4}\.\w+$/i.test(name)) return true;

    // 유효한 문자 검사
    const firstChar = name.charCodeAt(0);
    if (firstChar < 0x20 || firstChar === 0xFFFF) return false;

    // 비정상적인 반복 패턴 필터링
    const charSet = new Set(name.split(''));
    if (charSet.size <= 3 && name.length > 10) return false;

    return true;
  }

  /**
   * 개별 디렉토리 엔트리 파싱
   */
  private parseDirectoryEntry(offset: number): DirectoryEntry | null {
    if (offset < 0 || offset + OLE.DIRECTORY_ENTRY_SIZE > this.buffer.byteLength) {
      return null;
    }

    try {
      const nameLength = this.view.getUint16(offset + 64, true);
      let name = '';
      const maxNameBytes = Math.min(nameLength - 2, 64);

      for (let i = 0; i < maxNameBytes; i += 2) {
        if (offset + i + 2 > this.buffer.byteLength) break;
        const charCode = this.view.getUint16(offset + i, true);
        if (charCode !== 0) {
          name += String.fromCharCode(charCode);
        }
      }

      let clsid: Uint8Array;
      if (offset + 80 + 16 <= this.buffer.byteLength) {
        clsid = new Uint8Array(this.buffer, offset + 80, 16);
      } else {
        clsid = new Uint8Array(16);
      }

      return {
        name,
        type: this.view.getUint8(offset + 66),
        color: this.view.getUint8(offset + 67),
        leftSiblingId: this.view.getUint32(offset + 68, true),
        rightSiblingId: this.view.getUint32(offset + 72, true),
        childId: this.view.getUint32(offset + 76, true),
        clsid,
        stateBits: this.view.getUint32(offset + 96, true),
        creationTime: this.view.getBigUint64(offset + 100, true),
        modifiedTime: this.view.getBigUint64(offset + 108, true),
        startSector: this.view.getUint32(offset + 116, true),
        size: this.view.getUint32(offset + 120, true)
      };
    } catch (error) {
      logger.warn(`디렉토리 엔트리 파싱 실패 (offset: ${offset})`);
      return null;
    }
  }

  /**
   * Mini FAT 파싱
   */
  private parseMiniFAT(): void {
    if (!this.header) throw new Error('Header not parsed');

    const sectorSize = 1 << this.header.sectorShift;
    let currentSector = this.header.firstMiniFatSector;
    let iterations = 0;
    const maxMiniFatEntries = LIMITS.MAX_MINI_FAT_ENTRIES || 1000000; // 최대 MiniFAT 엔트리 수

    // 유효하지 않은 시작 섹터 체크
    if (currentSector < 0 || currentSector >= this.fat.length) {
      if (!isEndOfChain(currentSector)) {
        logger.warn(`MiniFAT 시작 섹터가 유효하지 않음: ${currentSector}`);
      }
      currentSector = OLE.FAT.END_OF_CHAIN; // 종료 처리
    }

    while (!isEndOfChain(currentSector) && iterations < LIMITS.MAX_ITERATIONS) {
      // 섹터 범위 검사
      if (currentSector < 0 || currentSector >= this.fat.length) {
        logger.warn(`MiniFAT 섹터 범위 초과: ${currentSector}`);
        break;
      }

      const offset = OLE.HEADER_SIZE + currentSector * sectorSize;

      // 버퍼 범위 검사
      if (offset < 0 || offset + sectorSize > this.buffer.byteLength) {
        logger.warn(`MiniFAT 오프셋 범위 초과: ${offset}`);
        break;
      }

      const entriesPerSector = sectorSize / 4;

      for (let i = 0; i < entriesPerSector; i++) {
        // 최대 엔트리 수 제한
        if (this.miniFat.length >= maxMiniFatEntries) {
          logger.warn(`MiniFAT 엔트리 수 제한 도달: ${this.miniFat.length}`);
          break;
        }

        const entryOffset = offset + i * 4;
        if (entryOffset + 4 > this.buffer.byteLength) break;

        const entry = this.view.getUint32(entryOffset, true);
        this.miniFat.push(entry);
      }

      // 다음 섹터로 이동
      const nextSector = this.fat[currentSector];

      // 무한 루프 방지: 자기 자신을 가리키는 경우
      if (nextSector === currentSector) {
        logger.warn(`MiniFAT 순환 참조 감지: 섹터 ${currentSector}`);
        break;
      }

      currentSector = nextSector;
      iterations++;
    }

    if (iterations >= LIMITS.MAX_ITERATIONS) {
      logger.warn(`MiniFAT 파싱 반복 제한 도달: ${iterations}회`);
    }

    logger.debug(`MiniFAT 엔트리 ${this.miniFat.length}개 로드 완료`);

    // Mini Stream 데이터 읽기
    if (this.directory.length > 0) {
      const rootEntry = this.directory[0];

      if (rootEntry.size <= LIMITS.MAX_MINI_STREAM_SIZE) {
        try {
          this.miniStreamData = this.readStream(rootEntry);
        } catch (error) {
          logger.warn('Mini Stream 로드 실패');
          this.miniStreamData = null;
        }
      } else {
        logger.warn(`Mini Stream이 너무 큽니다 (${rootEntry.size} bytes)`);
        this.miniStreamData = null;
      }
    }
  }

  /**
   * 스트림 데이터 읽기
   */
  readStream(entry: DirectoryEntry): Uint8Array {
    if (!this.header) throw new Error('Header not parsed');

    // 크기 검증 (음수 또는 너무 큰 경우)
    if (entry.size < 0) {
      logger.warn(`스트림 크기가 음수: ${entry.size}`);
      return new Uint8Array(0);
    }

    if (entry.size > LIMITS.MAX_STREAM_SIZE) {
      logger.warn(`스트림이 너무 큼: ${entry.size} bytes, 최대 ${LIMITS.MAX_STREAM_SIZE}`);
      return new Uint8Array(0);
    }

    const sectorSize = 1 << this.header.sectorShift;

    // 작은 스트림
    if (entry.size < this.header.minStreamSize && entry.type !== OLE.ENTRY_TYPE.ROOT) {
      return this.readMiniStream(entry);
    }

    // 시작 섹터 검증
    if (entry.startSector < 0 || (entry.startSector >= this.fat.length && !isEndOfChain(entry.startSector))) {
      logger.warn(`유효하지 않은 시작 섹터: ${entry.startSector}`);
      return new Uint8Array(0);
    }

    // 일반 스트림
    const result = new Uint8Array(entry.size);
    let currentSector = entry.startSector;
    let bytesRead = 0;
    let sectorCount = 0;
    const maxSectors = Math.ceil(entry.size / sectorSize) + 100;

    while (!isEndOfChain(currentSector) && bytesRead < entry.size && sectorCount < maxSectors) {
      // 섹터 범위 검사
      if (currentSector < 0 || currentSector >= this.fat.length) {
        logger.warn(`섹터 인덱스 범위 초과: ${currentSector}`);
        break;
      }

      const offset = OLE.HEADER_SIZE + currentSector * sectorSize;
      if (offset < 0 || offset >= this.buffer.byteLength) {
        logger.warn(`유효하지 않은 섹터 오프셋: ${offset}`);
        break;
      }

      const bytesToRead = Math.min(sectorSize, entry.size - bytesRead);
      const safeEnd = Math.min(offset + bytesToRead, this.buffer.byteLength);

      try {
        const sectorData = new Uint8Array(this.buffer, offset, safeEnd - offset);
        result.set(sectorData, bytesRead);
        bytesRead += sectorData.length;
      } catch (error) {
        logger.error(`섹터 읽기 실패 (오프셋 ${offset})`);
        break;
      }

      // 다음 섹터
      const nextSector = this.fat[currentSector];

      // 순환 참조 방지
      if (nextSector === currentSector) {
        logger.warn(`스트림 순환 참조 감지: 섹터 ${currentSector}`);
        break;
      }

      currentSector = nextSector;
      sectorCount++;
    }

    return result;
  }

  /**
   * Mini Stream 데이터 읽기
   */
  private readMiniStream(entry: DirectoryEntry): Uint8Array {
    if (!this.header || !this.miniStreamData) {
      throw new Error('Mini stream not initialized');
    }

    // 크기 검증
    if (entry.size < 0 || entry.size > LIMITS.MAX_STREAM_SIZE) {
      logger.warn(`Mini Stream 크기가 유효하지 않음: ${entry.size}`);
      return new Uint8Array(0);
    }

    const miniSectorSize = 1 << this.header.miniSectorShift;
    const result = new Uint8Array(entry.size);
    let currentSector = entry.startSector;
    let bytesRead = 0;
    let iterations = 0;
    const maxIterations = Math.ceil(entry.size / miniSectorSize) + 100;

    while (!isEndOfChain(currentSector) && bytesRead < entry.size && iterations < maxIterations) {
      // 섹터 범위 검사
      if (currentSector < 0 || currentSector >= this.miniFat.length) {
        logger.warn(`Mini Stream 섹터 범위 초과: ${currentSector}`);
        break;
      }

      const offset = currentSector * miniSectorSize;

      // miniStreamData 범위 검사
      if (offset < 0 || offset >= this.miniStreamData.length) {
        logger.warn(`Mini Stream 오프셋 범위 초과: ${offset}`);
        break;
      }

      const bytesToRead = Math.min(miniSectorSize, entry.size - bytesRead);
      const safeEnd = Math.min(offset + bytesToRead, this.miniStreamData.length);

      const sectorData = this.miniStreamData.slice(offset, safeEnd);
      result.set(sectorData, bytesRead);

      bytesRead += sectorData.length;

      // 다음 섹터 가져오기
      const nextSector = this.miniFat[currentSector];

      // 순환 참조 방지
      if (nextSector === currentSector) {
        logger.warn(`Mini Stream 순환 참조 감지: 섹터 ${currentSector}`);
        break;
      }

      currentSector = nextSector;
      iterations++;
    }

    return result;
  }

  /**
   * 이름으로 디렉토리 엔트리 찾기
   */
  findEntry(name: string): DirectoryEntry | null {
    if (this.directory.length === 0) return null;

    // 경로 처리
    const parts = name.split('/');
    if (parts.length > 1) {
      let currentEntry = this.directory[0];

      for (const part of parts) {
        if (currentEntry.childId === OLE.INVALID_ENTRY_ID) return null;
        const found = this._findEntryInTree(part, currentEntry.childId);
        if (!found) return null;
        currentEntry = found;
      }
      return currentEntry;
    }

    // 단일 이름 탐색
    const rootChildId = this.directory[0].childId;
    if (rootChildId !== OLE.INVALID_ENTRY_ID) {
      const found = this._findEntryInTree(name, rootChildId);
      if (found) return found;
    }

    // 전체 배열 검색 (폴백)
    const lowerName = name.toLowerCase();
    return this.directory.find(entry =>
      entry.name.toLowerCase() === lowerName
    ) || null;
  }

  /**
   * 트리에서 재귀적으로 엔트리 찾기
   */
  private _findEntryInTree(name: string, entryId: number): DirectoryEntry | null {
    if (entryId === OLE.INVALID_ENTRY_ID || entryId >= this.directory.length) return null;

    const entry = this.directory[entryId];

    // 대소문자 무시 비교
    if (entry.name.toLowerCase() === name.toLowerCase()) {
      return entry;
    }

    // 양쪽 형제 탐색
    const leftResult = this._findEntryInTree(name, entry.leftSiblingId);
    if (leftResult) return leftResult;

    const rightResult = this._findEntryInTree(name, entry.rightSiblingId);
    if (rightResult) return rightResult;

    return null;
  }

  /**
   * 모든 디렉토리 엔트리 가져오기
   */
  getDirectory(): DirectoryEntry[] {
    return this.directory;
  }

  /**
   * OLE 헤더 정보 가져오기
   */
  getHeader(): OLEHeader | null {
    return this.header;
  }
}
