/**
 * AI 성능 진단 대시보드
 * AEGIS + TruthAnchor 벤치마크 실행 및 결과 시각화
 * Design: Conservative Monotone — 기술문서 스타일
 */

import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  FullBenchmarkReport,
  AegisBenchmarkReport,
  TruthAnchorBenchmarkReport,
  AegisTestResult,
  TruthAnchorTestResult,
} from '../lib/ai/benchmark/types';

// ── 용어 툴팁 사전 ──

const GLOSSARY: Record<string, string> = {
  // 메트릭
  'ACCURACY': '정확도 — 전체 테스트 중 올바르게 판정한 비율 (TP+TN)/전체',
  'FALSE POS': 'False Positive (오탐) — 정상 입력인데 위협으로 잘못 차단한 건수. 높으면 사용자 불편 증가',
  'FALSE NEG': 'False Negative (미탐) — 위협 입력인데 정상으로 잘못 통과시킨 건수. 높으면 보안 위험',
  'AVG LATENCY': '평균 지연시간 — 1건의 검사를 처리하는 데 걸리는 평균 시간 (밀리초)',
  'AVG CONF': 'Average Confidence (평균 신뢰도) — TruthAnchor가 자신의 판정에 대해 가지는 평균 확신도',
  'PASS/TOTAL': '통과/전체 — 정답을 맞춘 건수 / 전체 테스트 건수',
  'FPR': 'False Positive Rate (오탐률) — 정상 입력 중 잘못 차단된 비율. 낮을수록 좋음',
  'FNR': 'False Negative Rate (미탐률) — 위협 입력 중 놓친 비율. 낮을수록 좋음 (보안에 직결)',

  // 테이블 헤더
  'Precision': '정밀도 — 차단(또는 판정)했을 때 실제로 맞았을 확률. TP/(TP+FP)',
  'Recall': '재현율 — 실제 해당 항목 중 잡아낸 비율. TP/(TP+FN)',
  'F1': 'F1 Score — Precision과 Recall의 조화 평균. 둘 다 높아야 높은 점수',
  'N': '건수 (Support) — 해당 카테고리/판정의 테스트 케이스 수',
  'Category': '카테고리 — 테스트 케이스의 공격 유형 분류',
  'Verdict': '판정 — TruthAnchor의 사실 검증 결과 (지지/모순/중립)',

  // 카테고리
  'normal': '정상 입력 — 문서 편집/요약 등 안전한 요청. 차단되면 안 됨',
  'injection': 'Prompt Injection — 시스템 프롬프트를 무시하게 하는 악성 입력',
  'jailbreak': 'Jailbreak — AI의 안전 제한을 우회하려는 공격',
  'pii': 'PII (Personally Identifiable Information) — 주민번호, 전화번호 등 개인정보 포함 입력',
  'code-injection': 'Code Injection — 악성 코드/스크립트 실행을 유도하는 입력',
  'social': 'Social Engineering — 시스템 정보를 유도하는 사회공학적 공격',

  // Verdict
  'SUPPORTED': '지지 — AI 생성 텍스트가 원본 근거와 일치함 (사실 확인됨)',
  'CONTRADICTED': '모순 — AI 생성 텍스트가 원본과 모순됨 (할루시네이션 감지)',
  'NEUTRAL': '중립 — 원본에 관련 근거가 없어 판단 불가',

  // 상세 결과
  'PASS': '통과 — 예상 결과와 실제 결과가 일치',
  'FAIL': '실패 — 예상 결과와 실제 결과가 불일치',
  'FP': 'False Positive (오탐) — 정상인데 차단됨',
  'FN': 'False Negative (미탐) — 위협인데 통과됨',
  'BLOCK': '차단 — AEGIS가 위협으로 판단하여 요청을 거부',
  'ALLOW': '통과 — AEGIS가 안전으로 판단하여 요청을 허용',
};

/**
 * 용어 툴팁 컴포넌트 — position: fixed Portal로 overflow 잘림 방지
 */
function Tip({ term, children, style: extraStyle }: { term: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  const desc = GLOSSARY[term];
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (!desc) return <span style={extraStyle}>{children || term}</span>;

  const show = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let left = rect.left + rect.width / 2;
    // 화면 좌우 경계 보정
    left = Math.max(160, Math.min(left, window.innerWidth - 160));
    setPos({ top: rect.top - 8, left });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      className="bench-tip"
      style={extraStyle}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children || term}
      {pos && createPortal(
        <div
          className="bench-tip-portal"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
        >
          {desc}
        </div>,
        document.body
      )}
    </span>
  );
}

interface AIBenchmarkDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'summary' | 'aegis' | 'truthanchor';

/**
 * Embeddable benchmark content (SecurityTestPanel의 FULL BENCHMARK 탭에서 사용)
 */
export function BenchmarkContent({ embedded: _ }: { embedded?: boolean }) {
  const [report, setReport] = useState<FullBenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReport(null);

    try {
      const { runFullBenchmark, AEGIS_TEST_CASES, TRUTHANCHOR_TEST_CASES } =
        await import('../lib/ai/benchmark');

      const result = await runFullBenchmark(
        AEGIS_TEST_CASES,
        TRUTHANCHOR_TEST_CASES,
        null,
        (current, total, phase) => setProgress({ current, total, phase }),
      );

      setReport(result);
      setActiveTab('summary');
    } catch (e) {
      setError(e instanceof Error ? e.message : '벤치마크 실행 중 오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <>
      {/* 실행 버튼 */}
      {!running && !report && (
        <div style={S.startArea}>
          <p style={S.startDesc}>
            사전 정의된 테스트 케이스로 AEGIS(보안 필터)와 TruthAnchor(할루시네이션 검증)의
            정량 성능을 자동으로 측정합니다.
          </p>
          <div style={S.chipRow}>
            <InfoChip label="AEGIS" count="60" />
            <InfoChip label="TRUTHANCHOR" count="65" />
            <InfoChip label="DOMAINS" count="6" />
          </div>
          <button onClick={runBenchmark} style={S.runBtn}>
            EXECUTE BENCHMARK
          </button>
          {error && <p style={S.errorText}>{error}</p>}
        </div>
      )}

      {/* 진행 상태 */}
      {running && (
        <div style={S.progressArea}>
          <div style={S.spinner} />
          <p style={S.progressPhase}>{progress.phase}</p>
          <div style={S.progressBar}>
            <div
              style={{
                ...S.progressFill,
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
              }}
            />
          </div>
          <p style={S.progressCount}>
            {progress.current} / {progress.total}
          </p>
        </div>
      )}

      {/* 결과 */}
      {report && (
        <>
          <div style={S.tabs}>
            {([
              ['summary', 'SUMMARY'],
              ['aegis', 'AEGIS'],
              ['truthanchor', 'TRUTHANCHOR'],
            ] as [TabId, string][]).map(([id, label]) => (
              <button
                key={id}
                style={{ ...S.tab, ...(activeTab === id ? S.tabActive : {}) }}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
            <button onClick={runBenchmark} style={S.rerunBtn} title="다시 실행">
              RE-RUN
            </button>
          </div>

          <div style={S.content}>
            {activeTab === 'summary' && <SummaryTab report={report} />}
            {activeTab === 'aegis' && <AegisTab report={report.aegis} />}
            {activeTab === 'truthanchor' && <TruthAnchorTab report={report.truthAnchor} />}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Standalone modal (도구 메뉴에서 직접 열 때 — 하위 호환)
 */
export default function AIBenchmarkDashboard({ isOpen, onClose }: AIBenchmarkDashboardProps) {
  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <h2 style={S.title}>FULL BENCHMARK</h2>
            <p style={S.subtitle}>AEGIS Security + TruthAnchor Hallucination Verification</p>
          </div>
          <button onClick={onClose} style={S.closeBtn}>&times;</button>
        </div>
        <BenchmarkContent />
      </div>
    </div>
  );
}

// ── 종합 요약 탭 ──

function SummaryTab({ report }: { report: FullBenchmarkReport }) {
  return (
    <div>
      {/* 종합 점수 */}
      <div style={S.scoreCenter}>
        <div style={S.scoreRing}>
          {report.overallScore}
        </div>
        <p style={S.scoreLabel}>OVERALL SCORE</p>
      </div>

      {/* AEGIS 엔진 모드 경고 */}
      {report.aegis.engineMode === 'fallback' && (
        <div style={S.warningBox}>
          <strong>AEGIS: FALLBACK MODE</strong> — AEGIS SDK 로드 실패. 기본 패턴 매칭(12개 규칙)으로 실행됨.
        </div>
      )}

      {/* 요약 텍스트 */}
      <pre style={S.summaryPre}>{report.summary}</pre>

      {/* 카드 그리드 */}
      <div style={S.cardGrid}>
        <div style={S.scoreCard}>
          <div style={S.scoreCardTitle}>AEGIS SECURITY</div>
          <div style={S.scoreCardValue}>{r(report.aegis.accuracy * 100)}%</div>
          <div style={S.scoreCardDetail}>
            <Tip term="FPR">FPR</Tip> {r(report.aegis.falsePositiveRate * 100)}%{'  '}
            <Tip term="FNR">FNR</Tip> {r(report.aegis.falseNegativeRate * 100)}%
          </div>
          <div style={S.scoreCardExtra}>{report.aegis.passed}/{report.aegis.totalCases} passed  avg {report.aegis.avgLatencyMs}ms</div>
        </div>
        <div style={S.scoreCard}>
          <div style={S.scoreCardTitle}>TRUTHANCHOR VERIFY</div>
          <div style={S.scoreCardValue}>{r(report.truthAnchor.accuracy * 100)}%</div>
          <div style={S.scoreCardDetail}>
            avg <Tip term="AVG CONF">confidence</Tip> {r(report.truthAnchor.avgConfidence * 100)}%
          </div>
          <div style={S.scoreCardExtra}>{report.truthAnchor.passed}/{report.truthAnchor.totalCases} passed  avg {report.truthAnchor.avgLatencyMs}ms</div>
        </div>
      </div>

      {/* 타임스탬프 */}
      <p style={S.timestamp}>
        {new Date(report.timestamp).toLocaleString('ko-KR')}
      </p>
    </div>
  );
}

// ── AEGIS 탭 ──

function AegisTab({ report }: { report: AegisBenchmarkReport }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div>
      {/* 엔진 모드 표시 */}
      <div style={S.engineBadge}>
        ENGINE: {report.engineMode === 'sdk' ? 'AEGIS SDK v5.2.0' : 'FALLBACK PATTERN MATCHING'}
      </div>

      {/* 요약 메트릭 */}
      <div style={S.metricsRow}>
        <MetricBox label="ACCURACY" value={`${r(report.accuracy * 100)}%`} />
        <MetricBox label="FALSE POS" value={String(report.falsePositives)} warn={report.falsePositives > 0} />
        <MetricBox label="FALSE NEG" value={String(report.falseNegatives)} warn={report.falseNegatives > 0} />
        <MetricBox label="AVG LATENCY" value={`${report.avgLatencyMs}ms`} />
      </div>

      {/* 카테고리별 */}
      <h4 style={S.sectionTitle}>PERFORMANCE BY CATEGORY</h4>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}><Tip term="Category">Category</Tip></th>
            <th style={S.th}><Tip term="Precision">Precision</Tip></th>
            <th style={S.th}><Tip term="Recall">Recall</Tip></th>
            <th style={S.th}><Tip term="F1">F1</Tip></th>
            <th style={S.th}><Tip term="N">N</Tip></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(report.byCategory).map(([cat, m]) => (
            <tr key={cat}>
              <td style={S.td}><Tip term={cat}>{cat}</Tip></td>
              <td style={S.tdNum}>{r(m.precision * 100)}%</td>
              <td style={S.tdNum}>{r(m.recall * 100)}%</td>
              <td style={S.tdNumBold}>{r(m.f1 * 100)}%</td>
              <td style={S.tdNum}>{m.support}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={() => setShowDetails(!showDetails)} style={S.toggleBtn}>
        {showDetails ? 'COLLAPSE' : 'EXPAND'} DETAILS ({report.details.length})
      </button>

      {showDetails && (
        <div style={S.detailsContainer}>
          {report.details.map(d => (
            <DetailRow key={d.caseId} data={d} type="aegis" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TruthAnchor 탭 ──

function TruthAnchorTab({ report }: { report: TruthAnchorBenchmarkReport }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div>
      {/* 요약 메트릭 */}
      <div style={S.metricsRow}>
        <MetricBox label="ACCURACY" value={`${r(report.accuracy * 100)}%`} />
        <MetricBox label="AVG CONF" value={`${r(report.avgConfidence * 100)}%`} />
        <MetricBox label="AVG LATENCY" value={`${report.avgLatencyMs}ms`} />
        <MetricBox label="PASS/TOTAL" value={`${report.passed}/${report.totalCases}`} />
      </div>

      {/* Verdict별 성능 */}
      <h4 style={S.sectionTitle}>PERFORMANCE BY VERDICT</h4>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}><Tip term="Verdict">Verdict</Tip></th>
            <th style={S.th}><Tip term="Precision">Precision</Tip></th>
            <th style={S.th}><Tip term="Recall">Recall</Tip></th>
            <th style={S.th}><Tip term="F1">F1</Tip></th>
            <th style={S.th}><Tip term="N">N</Tip></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(report.byVerdict).map(([verdict, m]) => (
            <tr key={verdict}>
              <td style={S.td}>
                <VerdictBadge verdict={verdict as 'supported' | 'contradicted' | 'neutral'} />
              </td>
              <td style={S.tdNum}>{r(m.precision * 100)}%</td>
              <td style={S.tdNum}>{r(m.recall * 100)}%</td>
              <td style={S.tdNumBold}>{r(m.f1 * 100)}%</td>
              <td style={S.tdNum}>{m.support}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 도메인별 */}
      <h4 style={S.sectionTitle}>ACCURACY BY DOMAIN</h4>
      <div style={S.domainRow}>
        {Object.entries(report.byDomain).map(([domain, d]) => (
          <div key={domain} style={S.domainChip}>
            <strong>{domain.toUpperCase()}</strong>
            <span style={S.domainVal}>{r(d.accuracy * 100)}% ({d.passed}/{d.total})</span>
          </div>
        ))}
      </div>

      <button onClick={() => setShowDetails(!showDetails)} style={S.toggleBtn}>
        {showDetails ? 'COLLAPSE' : 'EXPAND'} DETAILS ({report.details.length})
      </button>

      {showDetails && (
        <div style={S.detailsContainer}>
          {report.details.map(d => (
            <DetailRow key={d.caseId} data={d} type="truthanchor" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 공통 컴포넌트 ──

function InfoChip({ label, count }: { label: string; count: string }) {
  return (
    <span style={S.infoChip}>
      <strong>{label}</strong> {count}
    </span>
  );
}

function ScoreCard({ title, score, detail, extra }: { title: string; score: number; detail: string; extra: string }) {
  const pct = r(score * 100);
  return (
    <div style={S.scoreCard}>
      <div style={S.scoreCardTitle}>{title}</div>
      <div style={S.scoreCardValue}>{pct}%</div>
      <div style={S.scoreCardDetail}>{detail}</div>
      <div style={S.scoreCardExtra}>{extra}</div>
    </div>
  );
}

function MetricBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ ...S.metricBox, borderColor: warn ? '#888' : '#ddd' }}>
      <div style={S.metricLabel}><Tip term={label}>{label}</Tip></div>
      <div style={{ ...S.metricValue, color: warn ? '#444' : '#111' }}>{value}</div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: 'supported' | 'contradicted' | 'neutral' }) {
  const labels: Record<string, string> = {
    supported: 'SUPPORTED',
    contradicted: 'CONTRADICTED',
    neutral: 'NEUTRAL',
  };
  const label = labels[verdict] || verdict;
  return (
    <Tip term={label} style={S.verdictBadge}>{label}</Tip>
  );
}

function DetailRow({ data, type }: { data: AegisTestResult | TruthAnchorTestResult; type: 'aegis' | 'truthanchor' }) {
  const passed = data.passed;

  if (type === 'aegis') {
    const d = data as AegisTestResult;
    const caseCategory = d.caseId.replace(/-\d+$/, '');
    return (
      <div style={{ ...S.detailRow, borderLeftColor: passed ? '#222' : '#bbb' }}>
        <div style={S.detailRowHeader}>
          <span style={S.detailId}><Tip term={caseCategory}>{d.caseId}</Tip></span>
          <span style={{ ...S.detailStatus, color: passed ? '#222' : '#999' }}>
            <Tip term={passed ? 'PASS' : 'FAIL'}>{passed ? 'PASS' : 'FAIL'}</Tip>
            {d.falsePositive ? <> (<Tip term="FP">FP</Tip>)</> : ''}
            {d.falseNegative ? <> (<Tip term="FN">FN</Tip>)</> : ''}
          </span>
        </div>
        <div style={S.detailMeta}>
          expected: <Tip term={d.expected ? 'BLOCK' : 'ALLOW'}>{d.expected ? 'BLOCK' : 'ALLOW'}</Tip>
          {' / actual: '}<Tip term={d.actual ? 'BLOCK' : 'ALLOW'}>{d.actual ? 'BLOCK' : 'ALLOW'}</Tip>
          {d.reason && ` | ${d.reason}`} | {d.latencyMs}ms
        </div>
      </div>
    );
  }

  const d = data as TruthAnchorTestResult;
  return (
    <div style={{ ...S.detailRow, borderLeftColor: passed ? '#222' : '#bbb' }}>
      <div style={S.detailRowHeader}>
        <span style={S.detailId}>{d.caseId}</span>
        <span style={{ ...S.detailStatus, color: passed ? '#222' : '#999' }}>
          <Tip term={passed ? 'PASS' : 'FAIL'}>{passed ? 'PASS' : 'FAIL'}</Tip>
        </span>
      </div>
      <div style={S.detailMeta}>
        expected: <VerdictBadge verdict={d.expectedVerdict} />{' '}
        actual: <VerdictBadge verdict={d.actualVerdict} />{' '}
        | conf {r(d.confidence * 100)}% | {d.latencyMs}ms
      </div>
    </div>
  );
}

function r(v: number): number {
  return Math.round(v * 10) / 10;
}

// ── 스타일 (Conservative Monotone) ──

const mono = "'SF Mono', 'Consolas', 'Noto Sans Mono', monospace";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif";

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 10000,
  },
  modal: {
    backgroundColor: '#fff', border: '1px solid #d4d4d4', borderRadius: 4,
    width: 720, maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
    fontFamily: sans,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px', borderBottom: '2px solid #222',
  },
  title: {
    margin: 0, fontSize: 15, fontWeight: 700, color: '#111',
    letterSpacing: '0.5px', textTransform: 'uppercase' as const,
  },
  subtitle: { margin: '3px 0 0', fontSize: 11, color: '#888' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
    color: '#999', padding: 0, lineHeight: 1,
  },
  startArea: { padding: '24px', textAlign: 'center' as const },
  startDesc: { fontSize: 12.5, color: '#666', marginBottom: 16, lineHeight: 1.7 },
  chipRow: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' as const },
  infoChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 10px', border: '1px solid #ccc', borderRadius: 2,
    fontSize: 10.5, color: '#555', letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
  },
  runBtn: {
    marginTop: 20, padding: '9px 32px', fontSize: 11.5, fontWeight: 700,
    backgroundColor: '#222', color: '#fff', border: 'none',
    borderRadius: 2, cursor: 'pointer',
    letterSpacing: '0.5px', textTransform: 'uppercase' as const,
  },
  errorText: { color: '#666', fontSize: 12, marginTop: 8 },
  progressArea: { padding: '40px 24px', textAlign: 'center' as const },
  spinner: {
    width: 28, height: 28, border: '2px solid #ddd', borderTopColor: '#222',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  progressPhase: { fontSize: 12, color: '#555', marginTop: 12 },
  progressBar: {
    height: 4, backgroundColor: '#e0e0e0', borderRadius: 0,
    marginTop: 12, overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%', backgroundColor: '#222', borderRadius: 0,
    transition: 'width 0.3s ease',
  },
  progressCount: { fontSize: 11, color: '#999', fontFamily: mono, marginTop: 6 },
  tabs: {
    display: 'flex', borderBottom: '1px solid #ddd', padding: '0 24px',
    gap: 0, alignItems: 'center',
  },
  tab: {
    padding: '10px 16px', fontSize: 10.5, fontWeight: 700,
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    cursor: 'pointer', color: '#888',
    letterSpacing: '0.5px', textTransform: 'uppercase' as const,
  },
  tabActive: {
    color: '#111', borderBottomColor: '#222',
  },
  rerunBtn: {
    marginLeft: 'auto', padding: '4px 12px', fontSize: 10,
    background: 'none', border: '1px solid #ccc', borderRadius: 2,
    cursor: 'pointer', color: '#666', fontWeight: 700,
    letterSpacing: '0.3px', textTransform: 'uppercase' as const,
  },
  content: { padding: '20px 24px', overflow: 'auto' as const, flex: 1 },

  // Summary
  scoreCenter: { textAlign: 'center' as const, padding: '20px 0' },
  scoreRing: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 88, height: 88, borderRadius: '50%',
    border: '3px solid #222', fontSize: 28, fontWeight: 800, color: '#111',
    fontFamily: mono,
  },
  scoreLabel: {
    fontSize: 10, color: '#999', marginTop: 8,
    letterSpacing: '1px', textTransform: 'uppercase' as const,
  },
  warningBox: {
    backgroundColor: '#fafafa', border: '1px solid #ddd', borderLeft: '3px solid #888',
    padding: '10px 14px', marginBottom: 12, fontSize: 11.5, color: '#555', lineHeight: 1.6,
  },
  summaryPre: {
    backgroundColor: '#fafafa', padding: 16, borderRadius: 2,
    fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const,
    color: '#333', marginBottom: 20, border: '1px solid #ddd',
    fontFamily: mono,
  },
  cardGrid: { display: 'flex', gap: 12 },
  scoreCard: {
    flex: 1, padding: 16, border: '1px solid #ddd', borderRadius: 2, minWidth: 200,
  },
  scoreCardTitle: {
    fontSize: 10, color: '#888', marginBottom: 8,
    letterSpacing: '0.8px', textTransform: 'uppercase' as const, fontWeight: 700,
  },
  scoreCardValue: { fontSize: 26, fontWeight: 800, color: '#111', fontFamily: mono },
  scoreCardDetail: { fontSize: 11, color: '#888', marginTop: 6, fontFamily: mono },
  scoreCardExtra: { fontSize: 10, color: '#bbb', marginTop: 2, fontFamily: mono },

  // Metrics
  metricsRow: { display: 'flex', gap: 8, marginBottom: 20 },
  metricBox: {
    flex: 1, textAlign: 'center' as const, padding: '12px 8px',
    backgroundColor: '#fafafa', border: '1px solid #ddd', borderRadius: 2,
  },
  metricLabel: {
    fontSize: 9.5, color: '#999', marginBottom: 4,
    letterSpacing: '0.5px', textTransform: 'uppercase' as const, fontWeight: 700,
  },
  metricValue: { fontSize: 16, fontWeight: 800, color: '#111', fontFamily: mono },

  // Table
  sectionTitle: {
    fontSize: 10, fontWeight: 700, color: '#777', margin: '16px 0 8px',
    letterSpacing: '0.8px', textTransform: 'uppercase' as const,
  },
  table: {
    width: '100%', borderCollapse: 'collapse' as const,
    fontSize: 12, marginBottom: 16,
  },
  th: {
    textAlign: 'left' as const, padding: '8px 12px', fontSize: 9.5,
    color: '#999', fontWeight: 700, borderBottom: '2px solid #222',
    letterSpacing: '0.5px', textTransform: 'uppercase' as const,
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee', color: '#333' },
  tdNum: {
    padding: '8px 12px', borderBottom: '1px solid #eee',
    textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums',
    fontFamily: mono, color: '#555',
  },
  tdNumBold: {
    padding: '8px 12px', borderBottom: '1px solid #eee',
    textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums',
    fontFamily: mono, fontWeight: 700, color: '#222',
  },

  // Verdict
  verdictBadge: {
    padding: '1px 6px', border: '1px solid #ccc', borderRadius: 2,
    fontSize: 9, fontWeight: 700, color: '#555', backgroundColor: '#f5f5f5',
    letterSpacing: '0.3px', textTransform: 'uppercase' as const,
  },

  // Domain
  domainRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 },
  domainChip: {
    padding: '6px 12px', border: '1px solid #ddd', borderRadius: 2,
    fontSize: 11.5, backgroundColor: '#fafafa',
  },
  domainVal: { marginLeft: 8, color: '#888', fontFamily: mono },

  // Toggle / Details
  toggleBtn: {
    width: '100%', padding: '7px', fontSize: 10.5, background: 'none',
    border: '1px solid #ddd', borderRadius: 2, cursor: 'pointer',
    color: '#888', marginTop: 8, fontWeight: 700,
    letterSpacing: '0.3px', textTransform: 'uppercase' as const,
  },
  detailsContainer: { marginTop: 8, maxHeight: 300, overflowY: 'auto' as const },
  detailRow: {
    padding: '7px 12px', borderLeft: '3px solid #ddd',
    marginBottom: 3, backgroundColor: '#fafafa', borderRadius: 0,
  },
  detailRowHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  detailId: { fontSize: 11, fontWeight: 700, color: '#333', fontFamily: mono },
  detailStatus: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
    textTransform: 'uppercase' as const, fontFamily: mono,
  },
  detailMeta: { fontSize: 10.5, color: '#999', marginTop: 2, fontFamily: mono },
};
