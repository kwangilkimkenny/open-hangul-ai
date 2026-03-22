/**
 * 진행률 추적 유틸리티
 *
 * 변환 과정의 진행률을 계산하고 콜백을 관리
 *
 * @module Utilities
 * @category Utilities
 */

import type {
    ConversionProgress,
    ConversionStage,
    ProgressCallback
} from '../core/ConversionOptions';

/**
 * 단계별 가중치 (전체 진행률 계산용)
 */
const STAGE_WEIGHTS: Record<ConversionStage, { start: number; weight: number }> = {
    parsing: { start: 0, weight: 20 },      // 0-20%
    docinfo: { start: 20, weight: 10 },     // 20-30%
    sections: { start: 30, weight: 40 },    // 30-70%
    bindata: { start: 70, weight: 15 },     // 70-85%
    packaging: { start: 85, weight: 15 },   // 85-100%
    complete: { start: 100, weight: 0 },    // 100%
};

/**
 * 진행률 추적기
 *
 * @example
 * ```typescript
 * const tracker = new ProgressTracker((progress) => {
 *     console.log(`${progress.stage}: ${progress.percent}%`);
 * });
 *
 * tracker.startStage('parsing');
 * tracker.updateStage(50, 'HWP 헤더 파싱 중...');
 * tracker.completeStage();
 * ```
 */
export class ProgressTracker {
    private callback?: ProgressCallback;
    private currentStage: ConversionStage = 'parsing';
    private totalBytes: number = 0;
    private bytesProcessed: number = 0;
    private aborted: boolean = false;
    private signal?: AbortSignal;

    /**
     * 진행률 추적기 생성
     *
     * @param callback - 진행률 콜백 함수
     * @param signal - 취소 신호 (선택적)
     */
    constructor(callback?: ProgressCallback, signal?: AbortSignal) {
        this.callback = callback;
        this.signal = signal;

        if (signal) {
            signal.addEventListener('abort', () => {
                this.aborted = true;
            });
        }
    }

    /**
     * 취소 여부 확인
     */
    isAborted(): boolean {
        return this.aborted || (this.signal?.aborted ?? false);
    }

    /**
     * 취소 시 에러 발생
     */
    checkAborted(): void {
        if (this.isAborted()) {
            throw new Error('Conversion aborted');
        }
    }

    /**
     * 전체 바이트 수 설정
     */
    setTotalBytes(bytes: number): void {
        this.totalBytes = bytes;
    }

    /**
     * 처리된 바이트 수 업데이트
     */
    addBytesProcessed(bytes: number): void {
        this.bytesProcessed += bytes;
    }

    /**
     * 새로운 단계 시작
     *
     * @param stage - 시작할 단계
     * @param message - 표시할 메시지 (선택적)
     */
    startStage(stage: ConversionStage, message?: string): void {
        this.currentStage = stage;
        this.report(0, message || this.getDefaultMessage(stage, 0));
    }

    /**
     * 현재 단계 진행률 업데이트
     *
     * @param stagePercent - 단계 내 진행률 (0-100)
     * @param message - 표시할 메시지
     */
    updateStage(stagePercent: number, message?: string): void {
        this.report(stagePercent, message || this.getDefaultMessage(this.currentStage, stagePercent));
    }

    /**
     * 현재 단계 완료
     *
     * @param message - 완료 메시지 (선택적)
     */
    completeStage(message?: string): void {
        this.report(100, message || this.getDefaultMessage(this.currentStage, 100));
    }

    /**
     * 변환 완료
     */
    complete(): void {
        this.currentStage = 'complete';
        this.report(100, '변환 완료');
    }

    /**
     * 진행률 리포트
     */
    private report(stagePercent: number, message: string): void {
        if (!this.callback) return;

        const stageInfo = STAGE_WEIGHTS[this.currentStage];
        const percent = Math.round(stageInfo.start + (stageInfo.weight * stagePercent / 100));

        const progress: ConversionProgress = {
            stage: this.currentStage,
            percent: Math.min(100, Math.max(0, percent)),
            message,
            stagePercent,
            bytesProcessed: this.bytesProcessed,
            totalBytes: this.totalBytes,
        };

        this.callback(progress);
    }

    /**
     * 기본 메시지 생성
     */
    private getDefaultMessage(stage: ConversionStage, percent: number): string {
        const messages: Record<ConversionStage, string> = {
            parsing: 'HWP 파일 파싱 중...',
            docinfo: '문서 정보 처리 중...',
            sections: '섹션 변환 중...',
            bindata: '바이너리 데이터 처리 중...',
            packaging: 'HWPX 패키징 중...',
            complete: '변환 완료',
        };

        if (percent === 100 && stage !== 'complete') {
            return `${messages[stage]} 완료`;
        }

        return messages[stage];
    }
}

/**
 * 진행률 없는 더미 추적기 (콜백이 없을 때 사용)
 */
export class NoOpProgressTracker extends ProgressTracker {
    constructor() {
        super(undefined);
    }

    override startStage(): void {}
    override updateStage(): void {}
    override completeStage(): void {}
    override complete(): void {}
}
