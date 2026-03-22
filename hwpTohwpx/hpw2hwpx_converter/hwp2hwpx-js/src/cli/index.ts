#!/usr/bin/env node
/* eslint-disable no-console */
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Hwp2Hwpx } from '../core/Hwp2Hwpx';
import { ConversionOptions, ConversionProgress } from '../core/ConversionOptions';
import type { PartialConversionResult } from '../errors';

/**
 * Enhanced HWP to HWPX CLI with additional options
 */
const program = new Command();

// Custom error codes for better error handling
export enum ErrorCode {
    SUCCESS = 0,
    FILE_NOT_FOUND = 1,
    CONVERSION_FAILED = 2,
    INVALID_INPUT = 3,
    OUTPUT_ERROR = 4,
    BATCH_PARTIAL_FAILURE = 5
}

// Verbosity levels
type VerbosityLevel = 'quiet' | 'normal' | 'verbose' | 'debug';

interface ConversionStats {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    totalTime: number;
}

/**
 * Log message based on verbosity level
 */
function log(message: string, level: VerbosityLevel, currentLevel: VerbosityLevel): void {
    const levels: VerbosityLevel[] = ['quiet', 'normal', 'verbose', 'debug'];
    if (levels.indexOf(currentLevel) >= levels.indexOf(level)) {
        console.log(message);
    }
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format conversion report for display
 */
function formatConversionReport(result: PartialConversionResult, verbose: VerbosityLevel): string {
    const lines: string[] = [];

    lines.push('\n=== 변환 결과 리포트 ===');
    lines.push(`상태: ${result.success ? '✅ 성공' : '⚠️  부분 성공'}`);
    lines.push(`섹션: ${result.successfulSections}/${result.totalSections} 변환 완료`);

    if (result.failedSections.length > 0) {
        lines.push(`\n❌ 실패한 섹션: ${result.failedSections.join(', ')}`);
    }

    if (result.failedBinData.length > 0) {
        lines.push(`❌ 실패한 BinData: ${result.failedBinData.join(', ')}`);
    }

    if (result.warnings.length > 0 && (verbose === 'verbose' || verbose === 'debug')) {
        lines.push('\n--- 경고 상세 ---');
        result.warnings.forEach((w, i) => {
            lines.push(`[${i + 1}] [${w.type}] ${w.message}`);
            if (w.recoveryAction) {
                lines.push(`    → 복구: ${w.recoveryAction}`);
            }
        });
    }

    lines.push('========================\n');
    return lines.join('\n');
}

/**
 * Save conversion report to JSON file
 */
function saveReportToFile(
    result: PartialConversionResult,
    inputPath: string,
    outputPath: string,
    duration: number
): void {
    const reportPath = outputPath.replace(/\.hwpx$/i, '.report.json');
    const report = {
        timestamp: new Date().toISOString(),
        input: inputPath,
        output: outputPath,
        duration: `${duration}ms`,
        success: result.success,
        statistics: {
            totalSections: result.totalSections,
            successfulSections: result.successfulSections,
            failedSections: result.failedSections.length,
            failedBinData: result.failedBinData.length,
            warningsCount: result.warnings.length
        },
        failedSections: result.failedSections,
        failedBinData: result.failedBinData,
        warnings: result.warnings
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

/**
 * Convert a single file
 */
async function convertFile(
    inputPath: string,
    outputPath: string,
    options: {
        verbose: VerbosityLevel;
        preserveMetadata?: boolean;
        validate?: boolean;
        recovery?: boolean;
        saveReport?: boolean;
    }
): Promise<{ success: boolean; duration: number; error?: string; partialResult?: PartialConversionResult }> {
    const startTime = Date.now();

    try {
        const fileBuffer = fs.readFileSync(inputPath);
        const data = new Uint8Array(fileBuffer);

        log(`  Reading: ${formatSize(data.length)}`, 'verbose', options.verbose);

        // Progress callback for verbose mode
        const progressCallback = options.verbose === 'debug'
            ? (progress: ConversionProgress) => {
                console.log(`    [${progress.stage}] ${progress.percent}%`);
            }
            : undefined;

        const conversionOptions: ConversionOptions = {
            onProgress: progressCallback,
            streaming: options.preserveMetadata ?? false
        };

        let hwpxData: Uint8Array;
        let partialResult: PartialConversionResult | undefined;

        if (options.recovery) {
            // 복구 모드: 부분 실패 허용
            partialResult = await Hwp2Hwpx.convertWithRecovery(data, conversionOptions);
            hwpxData = partialResult.data;

            const duration = Date.now() - startTime;

            // 리포트 출력
            log(formatConversionReport(partialResult, options.verbose), 'normal', options.verbose);

            // 리포트 파일 저장
            if (options.saveReport) {
                saveReportToFile(partialResult, inputPath, outputPath, duration);
                log(`  Report saved: ${outputPath.replace(/\.hwpx$/i, '.report.json')}`, 'verbose', options.verbose);
            }
        } else {
            // 일반 모드: 에러 발생 시 중단
            hwpxData = await Hwp2Hwpx.convert(data, conversionOptions);
        }

        fs.writeFileSync(outputPath, hwpxData);

        const duration = Date.now() - startTime;
        log(`  Output: ${formatSize(hwpxData.length)} (${duration}ms)`, 'verbose', options.verbose);

        // 복구 모드에서 부분 실패가 있으면 success는 false
        const success = partialResult ? partialResult.success : true;
        return { success, duration, partialResult };
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, duration, error: errorMessage };
    }
}

interface BatchStats extends ConversionStats {
    partialSuccess: number;
    totalWarnings: number;
}

/**
 * Batch convert multiple files
 */
async function batchConvert(
    inputDir: string,
    outputDir: string,
    options: {
        verbose: VerbosityLevel;
        recursive?: boolean;
        continueOnError?: boolean;
        recovery?: boolean;
        saveReport?: boolean;
    }
): Promise<BatchStats> {
    const stats: BatchStats = { total: 0, success: 0, failed: 0, skipped: 0, partialSuccess: 0, totalWarnings: 0, totalTime: 0 };

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Find all HWP files
    const findHwpFiles = (dir: string): string[] => {
        const files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && options.recursive) {
                files.push(...findHwpFiles(fullPath));
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.hwp')) {
                files.push(fullPath);
            }
        }
        return files;
    };

    const hwpFiles = findHwpFiles(inputDir);
    stats.total = hwpFiles.length;

    log(`Found ${hwpFiles.length} HWP file(s)`, 'normal', options.verbose);
    if (options.recovery) {
        log(`Recovery mode enabled - partial failures will be tolerated`, 'normal', options.verbose);
    }

    for (let i = 0; i < hwpFiles.length; i++) {
        const inputFile = hwpFiles[i];
        const relativePath = path.relative(inputDir, inputFile);
        const outputFile = path.join(outputDir, relativePath.replace(/\.hwp$/i, '.hwpx'));

        // Ensure output subdirectory exists
        const outputSubDir = path.dirname(outputFile);
        if (!fs.existsSync(outputSubDir)) {
            fs.mkdirSync(outputSubDir, { recursive: true });
        }

        log(`[${i + 1}/${hwpFiles.length}] ${relativePath}`, 'normal', options.verbose);

        const result = await convertFile(inputFile, outputFile, {
            verbose: options.verbose,
            recovery: options.recovery,
            saveReport: options.saveReport
        });

        if (result.success) {
            stats.success++;
            stats.totalTime += result.duration;
            log(`  ✅ Success (${result.duration}ms)`, 'normal', options.verbose);
        } else if (result.partialResult && result.partialResult.data.length > 0) {
            // 복구 모드에서 부분 성공
            stats.partialSuccess++;
            stats.totalWarnings += result.partialResult.warnings.length;
            stats.totalTime += result.duration;
            log(`  ⚠️  Partial (${result.duration}ms) - ${result.partialResult.warnings.length} warnings`, 'normal', options.verbose);
        } else {
            stats.failed++;
            log(`  ❌ Failed: ${result.error}`, 'normal', options.verbose);

            if (!options.continueOnError) {
                log('Stopping due to error (use --continue to keep going)', 'normal', options.verbose);
                break;
            }
        }
    }

    return stats;
}

// Main program
program
    .name('hwp2hwpx')
    .description('Convert HWP files to HWPX format - Enhanced CLI')
    .version('1.1.0');

// Single file conversion
program
    .command('convert <input>')
    .description('Convert a single HWP file to HWPX')
    .option('-o, --output <path>', 'Output HWPX file path')
    .option('-v, --verbose', 'Verbose output')
    .option('--debug', 'Debug output (very verbose)')
    .option('--quiet', 'Quiet mode (minimal output)')
    .option('--validate', 'Validate output HWPX structure')
    .option('--recovery', 'Enable recovery mode (continue on partial failures)')
    .option('--save-report', 'Save detailed conversion report as JSON')
    .action(async (input, options) => {
        const verbose: VerbosityLevel = options.debug ? 'debug' : options.verbose ? 'verbose' : options.quiet ? 'quiet' : 'normal';

        const inputPath = path.resolve(input);
        if (!fs.existsSync(inputPath)) {
            console.error(`Error: Input file not found: ${inputPath}`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
        }

        const outputPath = options.output
            ? path.resolve(options.output)
            : inputPath.replace(/\.hwp$/i, '.hwpx');

        log(`Converting: ${inputPath}`, 'normal', verbose);
        if (options.recovery) {
            log(`  Recovery mode enabled`, 'verbose', verbose);
        }

        const result = await convertFile(inputPath, outputPath, {
            verbose,
            recovery: options.recovery,
            saveReport: options.saveReport
        });

        if (result.success) {
            log(`✅ Successfully converted in ${result.duration}ms`, 'normal', verbose);
            log(`Output: ${outputPath}`, 'normal', verbose);
            process.exit(ErrorCode.SUCCESS);
        } else if (result.partialResult && result.partialResult.data.length > 0) {
            // 복구 모드에서 부분 성공
            log(`⚠️  Partially converted with warnings in ${result.duration}ms`, 'normal', verbose);
            log(`Output: ${outputPath}`, 'normal', verbose);
            process.exit(ErrorCode.BATCH_PARTIAL_FAILURE);
        } else {
            console.error(`❌ Conversion failed: ${result.error}`);
            process.exit(ErrorCode.CONVERSION_FAILED);
        }
    });

// Batch conversion
program
    .command('batch <inputDir>')
    .description('Batch convert all HWP files in a directory')
    .option('-o, --output <dir>', 'Output directory (default: same as input with _hwpx suffix)')
    .option('-r, --recursive', 'Process subdirectories recursively')
    .option('-c, --continue', 'Continue on error')
    .option('-v, --verbose', 'Verbose output')
    .option('--quiet', 'Quiet mode')
    .option('--recovery', 'Enable recovery mode (continue on partial failures)')
    .option('--save-report', 'Save detailed conversion reports as JSON')
    .action(async (inputDir, options) => {
        const verbose: VerbosityLevel = options.verbose ? 'verbose' : options.quiet ? 'quiet' : 'normal';

        const inputPath = path.resolve(inputDir);
        if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isDirectory()) {
            console.error(`Error: Input directory not found: ${inputPath}`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
        }

        const outputPath = options.output
            ? path.resolve(options.output)
            : `${inputPath}_hwpx`;

        log(`Batch converting: ${inputPath}`, 'normal', verbose);
        log(`Output directory: ${outputPath}`, 'normal', verbose);

        const stats = await batchConvert(inputPath, outputPath, {
            verbose,
            recursive: !!options.recursive,
            continueOnError: !!options.continue,
            recovery: !!options.recovery,
            saveReport: !!options.saveReport
        });

        // Print summary
        console.log('\n========== 변환 결과 요약 ==========');
        console.log(`총 파일 수:     ${stats.total}`);
        console.log(`완전 성공:      ${stats.success} ✅`);
        if (stats.partialSuccess > 0) {
            console.log(`부분 성공:      ${stats.partialSuccess} ⚠️  (${stats.totalWarnings} warnings)`);
        }
        console.log(`실패:           ${stats.failed} ❌`);
        console.log(`총 처리 시간:   ${(stats.totalTime / 1000).toFixed(2)}s`);

        const successCount = stats.success + stats.partialSuccess;
        if (successCount > 0) {
            console.log(`평균 처리 시간: ${Math.round(stats.totalTime / successCount)}ms`);
        }

        // 성공률 계산
        const successRate = stats.total > 0 ? ((successCount / stats.total) * 100).toFixed(1) : '0';
        console.log(`성공률:         ${successRate}%`);
        console.log('====================================\n');

        if (stats.failed > 0) {
            process.exit(ErrorCode.BATCH_PARTIAL_FAILURE);
        } else if (stats.partialSuccess > 0) {
            process.exit(ErrorCode.SUCCESS); // 부분 성공도 성공으로 간주
        } else {
            process.exit(ErrorCode.SUCCESS);
        }
    });

// Info command
program
    .command('info <input>')
    .description('Display information about an HWP file')
    .option('-j, --json', 'Output as JSON')
    .action(async (input, options) => {
        const inputPath = path.resolve(input);
        if (!fs.existsSync(inputPath)) {
            console.error(`Error: File not found: ${inputPath}`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
        }

        const stat = fs.statSync(inputPath);

        try {
            const fileBuffer = fs.readFileSync(inputPath);
            const data = new Uint8Array(fileBuffer);

            // Parse HWP file to extract metadata
            const parser = Hwp2Hwpx.createParser();
            const parsed = await parser.parse(data.buffer);

            const info = {
                file: {
                    name: path.basename(inputPath),
                    size: stat.size,
                    sizeFormatted: formatSize(stat.size),
                    modified: stat.mtime.toISOString()
                },
                document: {
                    title: parsed.summaryInfo?.title || '(없음)',
                    author: parsed.summaryInfo?.author || '(없음)',
                    subject: parsed.summaryInfo?.subject || '(없음)',
                    keywords: parsed.summaryInfo?.keywords || '(없음)',
                    comments: parsed.summaryInfo?.comments || '(없음)',
                    lastAuthor: parsed.summaryInfo?.lastAuthor || '(없음)',
                    appName: parsed.summaryInfo?.appName || '(없음)',
                    createDate: parsed.summaryInfo?.createDate?.toISOString() || '(없음)',
                    lastSaveDate: parsed.summaryInfo?.lastSaveDate?.toISOString() || '(없음)'
                },
                structure: {
                    sections: parsed.sections.length,
                    paragraphs: parsed.sections.reduce((sum, s) => sum + (s.paragraphs?.length || 0), 0),
                    binDataCount: parsed.binData.size
                }
            };

            if (options.json) {
                console.log(JSON.stringify(info, null, 2));
            } else {
                console.log('\n=== 파일 정보 ===');
                console.log(`파일명: ${info.file.name}`);
                console.log(`크기: ${info.file.sizeFormatted}`);
                console.log(`수정일: ${info.file.modified}`);

                console.log('\n=== 문서 속성 ===');
                console.log(`제목: ${info.document.title}`);
                console.log(`작성자: ${info.document.author}`);
                console.log(`주제: ${info.document.subject}`);
                console.log(`키워드: ${info.document.keywords}`);
                console.log(`설명: ${info.document.comments}`);
                console.log(`마지막 작성자: ${info.document.lastAuthor}`);
                console.log(`작성 프로그램: ${info.document.appName}`);
                console.log(`작성일: ${info.document.createDate}`);
                console.log(`마지막 저장일: ${info.document.lastSaveDate}`);

                console.log('\n=== 문서 구조 ===');
                console.log(`섹션 수: ${info.structure.sections}`);
                console.log(`문단 수: ${info.structure.paragraphs}`);
                console.log(`바이너리 데이터 수: ${info.structure.binDataCount}`);
                console.log('');
            }
        } catch (error) {
            console.error(`Error: Failed to parse HWP file: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(ErrorCode.CONVERSION_FAILED);
        }
    });

// Default behavior (single file conversion for backward compatibility)
program
    .argument('[input]', 'Input HWP file path')
    .option('-o, --output <path>', 'Output HWPX file path')
    .action(async (input, options) => {
        if (!input) {
            program.help();
            return;
        }

        // Delegate to convert command
        const inputPath = path.resolve(input);
        if (!fs.existsSync(inputPath)) {
            console.error(`Error: Input file not found: ${inputPath}`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
        }

        const outputPath = options.output
            ? path.resolve(options.output)
            : inputPath.replace(/\.hwp$/i, '.hwpx');

        console.log(`Converting: ${inputPath}`);

        const result = await convertFile(inputPath, outputPath, { verbose: 'normal' });

        if (result.success) {
            console.log(`✅ Successfully converted in ${result.duration}ms`);
            console.log(`Output: ${outputPath}`);
        } else {
            console.error(`❌ Conversion failed: ${result.error}`);
            process.exit(ErrorCode.CONVERSION_FAILED);
        }
    });

program.parse();
