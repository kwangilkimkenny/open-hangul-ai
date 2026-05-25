/**
 * Headless CLI 테스트.
 *
 * `node bin/hwpx-cli.mjs` 를 child_process 로 호출해 출력/종료코드를 검증한다.
 * 첫 실행 시 jsdom 로딩 + 파싱으로 ~1-2초 걸리므로 testTimeout 을 넉넉히 잡는다.
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const CLI = resolve(ROOT, 'bin/hwpx-cli.mjs');
const FIXTURE = resolve(ROOT, 'tests/golden/01-paragraph/fixture.hwpx');
const TABLE_FIXTURE = resolve(ROOT, 'tests/golden/02-table/fixture.hwpx');

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], opts: { timeoutMs?: number } = {}): Promise<CliResult> {
  return new Promise((resolve_, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d.toString()));
    child.stderr.on('data', d => (stderr += d.toString()));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('hwpx-cli timed out'));
    }, opts.timeoutMs ?? 30000);
    child.on('close', code => {
      clearTimeout(timer);
      resolve_({ code, stdout, stderr });
    });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('hwpx-cli', { timeout: 60000 }, () => {
  it('--help 가 사용법을 출력하고 종료코드 0', async () => {
    const r = await runCli(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('hwpx-cli');
    expect(r.stdout).toContain('Usage:');
  });

  it('--version 이 semver 형식 버전을 출력', async () => {
    const r = await runCli(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('인자 없이 호출하면 사용법 출력 + 종료코드 1', async () => {
    const r = await runCli([]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Usage:');
  });

  it('convert --to text 가 단락 텍스트를 stdout 으로 출력', async () => {
    const r = await runCli(['convert', FIXTURE, '--to', 'text']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('가운데 정렬');
    expect(r.stdout).toContain('빨강');
  });

  it('convert --to html 가 HTML5 문서를 출력', async () => {
    const r = await runCli(['convert', FIXTURE, '--to', 'html']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('<!DOCTYPE html>');
    expect(r.stdout).toContain('<html');
    expect(r.stdout).toContain('가운데 정렬');
  });

  it('convert --to json 이 sections 키를 가진 JSON 을 출력', async () => {
    const r = await runCli(['convert', FIXTURE, '--to', 'json']);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections.length).toBeGreaterThan(0);
  });

  it('convert --to json --pretty 가 들여쓰기된 JSON 을 출력', async () => {
    const r = await runCli(['convert', FIXTURE, '--to', 'json', '--pretty']);
    expect(r.code).toBe(0);
    // pretty-print 는 2-space 들여쓰기 라인을 가진다
    expect(r.stdout).toMatch(/\n {2}"sections":/);
  });

  it('info 가 메타데이터 JSON 을 출력', async () => {
    const r = await runCli(['info', FIXTURE]);
    expect(r.code).toBe(0);
    const summary = JSON.parse(r.stdout);
    expect(summary.sections).toBe(1);
    expect(summary.paragraphs).toBe(3);
    expect(summary.parserVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('잘못된 --to 값은 종료코드 2 (변환 실패)', async () => {
    const r = await runCli(['convert', FIXTURE, '--to', 'pdf']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('지원하지 않는');
  });

  it('존재하지 않는 파일은 종료코드 2', async () => {
    const r = await runCli(['convert', '/nonexistent/path.hwpx', '--to', 'text']);
    expect(r.code).toBe(2);
  });

  it('table fixture: HTML 출력에 colspan/rowspan 포함', async () => {
    const r = await runCli(['convert', TABLE_FIXTURE, '--to', 'html']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/colspan="2"/);
    expect(r.stdout).toMatch(/rowspan="2"/);
  });
});
