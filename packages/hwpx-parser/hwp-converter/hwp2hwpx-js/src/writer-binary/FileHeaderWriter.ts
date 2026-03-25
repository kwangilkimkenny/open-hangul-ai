/**
 * HWP FileHeader 스트림 생성
 *
 * FileHeader는 HWP 파일의 첫 번째 스트림으로,
 * 파일 시그니처, 버전, 속성 플래그를 포함
 *
 * @module WriterBinary
 */

/**
 * HWP 버전 정보
 */
export interface HwpVersion {
    major: number;   // 주 버전 (5)
    minor: number;   // 부 버전 (0, 1, 2...)
    patch: number;   // 패치 버전
    build: number;   // 빌드 번호
}

/**
 * HWP 파일 속성 플래그
 */
export interface HwpFlags {
    /** 압축 여부 (DocInfo, BodyText) */
    compressed: boolean;
    /** 암호화 여부 */
    encrypted: boolean;
    /** 배포용 문서 */
    distributable: boolean;
    /** 스크립트 포함 */
    hasScript: boolean;
    /** DRM 보호 */
    hasDrm: boolean;
    /** XML 템플릿 */
    isXmlTemplate: boolean;
    /** 문서 이력 */
    hasHistory: boolean;
    /** 전자 서명 정보 */
    hasSignInfo: boolean;
    /** 인증서 암호화 */
    certEncrypted: boolean;
    /** 전자 서명 예비 */
    signatureReserved: boolean;
    /** 인증서 서명 */
    certSigned: boolean;
    /** CCL 문서 */
    isCcl: boolean;
    /** 모바일 최적화 */
    mobileOptimized: boolean;
    /** 개인 정보 보안 */
    personalInfoSecured: boolean;
    /** 변경 추적 */
    trackChanges: boolean;
    /** 공인 전자 문서 */
    kogsDocformat: boolean;
    /** 비디오 컨트롤 포함 */
    hasVideoControl: boolean;
    /** 주석 필드 순서 변경 */
    orderFieldsChanged: boolean;
}

/**
 * FileHeader 기본값
 */
export const DEFAULT_HWP_VERSION: HwpVersion = {
    major: 5,
    minor: 1,
    patch: 0,
    build: 0
};

export const DEFAULT_HWP_FLAGS: HwpFlags = {
    compressed: true,
    encrypted: false,
    distributable: false,
    hasScript: false,
    hasDrm: false,
    isXmlTemplate: false,
    hasHistory: false,
    hasSignInfo: false,
    certEncrypted: false,
    signatureReserved: false,
    certSigned: false,
    isCcl: false,
    mobileOptimized: false,
    personalInfoSecured: false,
    trackChanges: false,
    kogsDocformat: false,
    hasVideoControl: false,
    orderFieldsChanged: false
};

/**
 * HWP 파일 시그니처
 * "HWP Document File" (32바이트, 나머지 0으로 패딩)
 */
const HWP_SIGNATURE = 'HWP Document File';

/**
 * FileHeader 스트림 생성
 */
export class FileHeaderWriter {
    /**
     * FileHeader 스트림 생성 (40바이트)
     *
     * 구조:
     * - 0-31: 시그니처 "HWP Document File" (32바이트)
     * - 32-35: 버전 (4바이트)
     * - 36-39: 속성 플래그 (4바이트)
     *
     * @param version - HWP 버전 (기본값: 5.1.0.0)
     * @param flags - 속성 플래그 (기본값: 압축만 활성화)
     * @returns FileHeader 바이너리 (40바이트)
     */
    static generate(
        version: Partial<HwpVersion> = {},
        flags: Partial<HwpFlags> = {}
    ): Uint8Array {
        const buffer = new Uint8Array(40);
        const view = new DataView(buffer.buffer);

        // 1. 시그니처 (0-31, 32바이트)
        const encoder = new TextEncoder();
        const signature = encoder.encode(HWP_SIGNATURE);
        buffer.set(signature, 0);
        // 나머지는 이미 0으로 초기화됨

        // 2. 버전 (32-35, 4바이트)
        const ver = { ...DEFAULT_HWP_VERSION, ...version };
        // HWP 버전 형식: 0xMMmmrBBB (major.minor.patch.build)
        // 실제로는 각 바이트가 별도로 저장됨
        buffer[32] = ver.build & 0xFF;
        buffer[33] = ver.patch & 0xFF;
        buffer[34] = ver.minor & 0xFF;
        buffer[35] = ver.major & 0xFF;

        // 3. 속성 플래그 (36-39, 4바이트)
        const fl = { ...DEFAULT_HWP_FLAGS, ...flags };
        const flagValue = this.encodeFlags(fl);
        view.setUint32(36, flagValue, true);

        return buffer;
    }

    /**
     * 플래그 객체를 비트 필드로 인코딩
     */
    private static encodeFlags(flags: HwpFlags): number {
        let value = 0;

        if (flags.compressed) value |= 0x0001;
        if (flags.encrypted) value |= 0x0002;
        if (flags.distributable) value |= 0x0004;
        if (flags.hasScript) value |= 0x0008;
        if (flags.hasDrm) value |= 0x0010;
        if (flags.isXmlTemplate) value |= 0x0020;
        if (flags.hasHistory) value |= 0x0040;
        if (flags.hasSignInfo) value |= 0x0080;
        if (flags.certEncrypted) value |= 0x0100;
        if (flags.signatureReserved) value |= 0x0200;
        if (flags.certSigned) value |= 0x0400;
        if (flags.isCcl) value |= 0x0800;
        if (flags.mobileOptimized) value |= 0x1000;
        if (flags.personalInfoSecured) value |= 0x2000;
        if (flags.trackChanges) value |= 0x4000;
        if (flags.kogsDocformat) value |= 0x8000;
        if (flags.hasVideoControl) value |= 0x10000;
        if (flags.orderFieldsChanged) value |= 0x20000;

        return value;
    }

    /**
     * 플래그 비트 필드를 객체로 디코딩 (검증용)
     */
    static decodeFlags(value: number): HwpFlags {
        return {
            compressed: (value & 0x0001) !== 0,
            encrypted: (value & 0x0002) !== 0,
            distributable: (value & 0x0004) !== 0,
            hasScript: (value & 0x0008) !== 0,
            hasDrm: (value & 0x0010) !== 0,
            isXmlTemplate: (value & 0x0020) !== 0,
            hasHistory: (value & 0x0040) !== 0,
            hasSignInfo: (value & 0x0080) !== 0,
            certEncrypted: (value & 0x0100) !== 0,
            signatureReserved: (value & 0x0200) !== 0,
            certSigned: (value & 0x0400) !== 0,
            isCcl: (value & 0x0800) !== 0,
            mobileOptimized: (value & 0x1000) !== 0,
            personalInfoSecured: (value & 0x2000) !== 0,
            trackChanges: (value & 0x4000) !== 0,
            kogsDocformat: (value & 0x8000) !== 0,
            hasVideoControl: (value & 0x10000) !== 0,
            orderFieldsChanged: (value & 0x20000) !== 0
        };
    }

    /**
     * FileHeader 검증
     */
    static validate(buffer: Uint8Array): boolean {
        if (buffer.length < 40) {
            return false;
        }

        // 시그니처 검증
        const decoder = new TextDecoder();
        const signature = decoder.decode(buffer.slice(0, HWP_SIGNATURE.length));
        if (signature !== HWP_SIGNATURE) {
            return false;
        }

        return true;
    }
}
