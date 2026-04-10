/**
 * Landing Page
 * 한컴 스타일 메인 랜딩 페이지
 */
import { Link } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';

export function LandingPage() {
  return (
    <div className="landing-page">
      <PublicHeader />

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <span className="hero-badge">차세대 AI 문서 편집 플랫폼 v4.0</span>
            <h1 className="hero-title">
              하나의 편집기로<br />
              <span className="gradient-text">모든 문서를 다루다</span>
            </h1>
            <p className="hero-subtitle">
              HWPX, DOCX, PDF, Excel, PowerPoint까지 — 9개 포맷을 하나의 웹 편집기에서.
              <br />AI가 문서를 이해하고 편집하며, 변경 추적·댓글·보안·컴플라이언스까지 모두 지원합니다.
            </p>
            <div className="hero-cta">
              <Link to="/editor" className="cta-primary">무료로 시작하기</Link>
              <Link to="/pricing" className="cta-secondary">요금제 보기</Link>
            </div>
            <div className="hero-trust">
              <span>EU AI Act 준수</span> · <span>OWASP LLM Top 10</span> · <span>1,200+ 테스트 통과</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-mock">
              <div className="mock-toolbar">
                <span className="mock-dot red"></span>
                <span className="mock-dot yellow"></span>
                <span className="mock-dot green"></span>
                <span className="mock-title">제안서.hwpx</span>
              </div>
              <div className="mock-body">
                <div className="mock-line w-80"></div>
                <div className="mock-line w-60"></div>
                <div className="mock-table">
                  <div className="mock-cell header"></div>
                  <div className="mock-cell header"></div>
                  <div className="mock-cell header"></div>
                  <div className="mock-cell"></div>
                  <div className="mock-cell"></div>
                  <div className="mock-cell"></div>
                </div>
                <div className="mock-line w-90"></div>
                <div className="mock-line w-70"></div>
              </div>
              <div className="mock-ai-bubble">
                <span className="ai-icon">AI</span>
                <span className="ai-text">문서를 분석하고 있습니다...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Format Support Section */}
      <section className="formats">
        <div className="section-inner">
          <p className="section-eyebrow">멀티포맷 지원</p>
          <h2 className="section-title">9개 포맷을 하나의 편집기에서</h2>
          <div className="format-grid">
            {[
              { ext: 'HWP', name: '한글', color: '#2b579a' },
              { ext: 'HWPX', name: '한글 X', color: '#2b579a' },
              { ext: 'DOCX', name: 'Word', color: '#185abd' },
              { ext: 'XLSX', name: 'Excel', color: '#107c41' },
              { ext: 'PDF', name: 'PDF', color: '#c7252a' },
              { ext: 'PPTX', name: 'PowerPoint', color: '#c43e1c' },
              { ext: 'ODT', name: 'OpenDocument', color: '#1c8b69' },
              { ext: 'ODS', name: 'OpenSheet', color: '#1c8b69' },
              { ext: 'MD', name: 'Markdown', color: '#444' },
            ].map(fmt => (
              <div key={fmt.ext} className="format-card">
                <div className="format-icon" style={{ background: fmt.color }}>{fmt.ext}</div>
                <span className="format-name">{fmt.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="section-inner">
          <p className="section-eyebrow">핵심 기능</p>
          <h2 className="section-title">전문 문서 작업의 모든 것</h2>
          <div className="feature-grid">
            {features.map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon" style={{ background: f.color }}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="ai-section">
        <div className="section-inner">
          <div className="ai-grid">
            <div>
              <p className="section-eyebrow light">AI 안전성</p>
              <h2 className="section-title light">신뢰할 수 있는 AI 편집</h2>
              <p className="ai-description">
                AEGIS 보안 게이트웨이가 프롬프트 인젝션과 PII 유출을 차단하고,
                TruthAnchor가 할루시네이션을 97% 정확도로 탐지합니다.
                EU AI Act, K-AI Act, NIST AI RMF, OWASP LLM Top 10을 준수합니다.
              </p>
              <div className="ai-stats">
                <div>
                  <strong>97%</strong>
                  <span>할루시네이션 탐지</span>
                </div>
                <div>
                  <strong>4종</strong>
                  <span>컴플라이언스</span>
                </div>
                <div>
                  <strong>6개</strong>
                  <span>언어 방어</span>
                </div>
              </div>
            </div>
            <div className="ai-flow">
              <div className="flow-step"><span>1</span> 사용자 입력</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-step danger"><span>2</span> AEGIS 입력 검사 (PII/인젝션)</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-step"><span>3</span> LLM 호출</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-step danger"><span>4</span> AEGIS 출력 검사</div>
              <div className="flow-arrow">↓</div>
              <div className="flow-step success"><span>5</span> TruthAnchor 검증</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-inner cta-inner">
          <h2>지금 바로 시작하세요</h2>
          <p>회원가입 없이 무료로 편집기를 사용할 수 있습니다.</p>
          <div className="hero-cta">
            <Link to="/editor" className="cta-primary">편집기 시작하기</Link>
            <Link to="/signup" className="cta-secondary dark">계정 만들기</Link>
          </div>
        </div>
      </section>

      <PublicFooter />

      <style>{`
        .landing-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
          color: #111;
          background: #fff;
          min-height: 100vh;
        }
        .section-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 80px 32px;
        }
        .section-eyebrow {
          font-size: 12px;
          font-weight: 700;
          color: #2b579a;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin: 0 0 12px;
        }
        .section-eyebrow.light { color: #93c5fd; }
        .section-title {
          font-size: 36px;
          font-weight: 800;
          margin: 0 0 48px;
          color: #111;
          letter-spacing: -0.5px;
        }
        .section-title.light { color: #fff; }

        /* Hero */
        .hero {
          background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
          padding: 80px 0 60px;
          overflow: hidden;
        }
        .hero-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .hero-badge {
          display: inline-block;
          padding: 6px 14px;
          background: #dbeafe;
          color: #1e40af;
          font-size: 12px;
          font-weight: 600;
          border-radius: 100px;
          margin-bottom: 24px;
          letter-spacing: 0.3px;
        }
        .hero-title {
          font-size: 56px;
          font-weight: 800;
          line-height: 1.15;
          margin: 0 0 24px;
          letter-spacing: -1.5px;
        }
        .gradient-text {
          background: linear-gradient(135deg, #2b579a 0%, #4f46e5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-subtitle {
          font-size: 17px;
          line-height: 1.7;
          color: #4b5563;
          margin: 0 0 36px;
        }
        .hero-cta {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
        }
        .cta-primary {
          background: #2b579a;
          color: #fff;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s;
          box-shadow: 0 4px 14px rgba(43, 87, 154, 0.25);
        }
        .cta-primary:hover {
          background: #1e3f73;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(43, 87, 154, 0.35);
        }
        .cta-secondary {
          background: #fff;
          color: #2b579a;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          border: 1.5px solid #d1d5db;
          transition: all 0.15s;
        }
        .cta-secondary:hover {
          border-color: #2b579a;
          background: #f0f7ff;
        }
        .cta-secondary.dark {
          background: transparent;
          color: #fff;
          border-color: rgba(255,255,255,0.3);
        }
        .cta-secondary.dark:hover {
          background: rgba(255,255,255,0.1);
          border-color: #fff;
        }
        .hero-trust {
          font-size: 12px;
          color: #6b7280;
          letter-spacing: 0.3px;
        }

        /* Mock editor */
        .hero-mock {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.12);
          overflow: hidden;
          position: relative;
          transform: rotate(-1deg);
          transition: transform 0.3s;
        }
        .hero-mock:hover { transform: rotate(0deg) scale(1.02); }
        .mock-toolbar {
          background: #f3f4f6;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid #e5e7eb;
        }
        .mock-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .mock-dot.red { background: #ff5f57; }
        .mock-dot.yellow { background: #febc2e; }
        .mock-dot.green { background: #28c840; }
        .mock-title {
          margin-left: 12px;
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }
        .mock-body {
          padding: 32px;
          min-height: 260px;
        }
        .mock-line {
          height: 12px;
          background: #e5e7eb;
          border-radius: 4px;
          margin-bottom: 12px;
        }
        .mock-line.w-90 { width: 90%; }
        .mock-line.w-80 { width: 80%; }
        .mock-line.w-70 { width: 70%; }
        .mock-line.w-60 { width: 60%; }
        .mock-table {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #d1d5db;
          margin: 16px 0;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          overflow: hidden;
        }
        .mock-cell {
          background: #fff;
          height: 24px;
        }
        .mock-cell.header { background: #f3f4f6; }
        .mock-ai-bubble {
          position: absolute;
          bottom: 16px;
          right: 16px;
          background: #2b579a;
          color: #fff;
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(43, 87, 154, 0.3);
          animation: pulse 2s infinite;
        }
        .ai-icon {
          background: rgba(255,255,255,0.2);
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 700;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }

        /* Formats */
        .formats { background: #fafafa; }
        .format-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 16px;
        }
        .format-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px 8px;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          transition: all 0.2s;
        }
        .format-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          border-color: #2b579a;
        }
        .format-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .format-name {
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
        }

        /* Features */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .feature-card {
          padding: 32px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          transition: all 0.2s;
        }
        .feature-card:hover {
          border-color: #2b579a;
          box-shadow: 0 12px 32px rgba(43, 87, 154, 0.1);
          transform: translateY(-2px);
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 16px;
        }
        .feature-card h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px;
        }
        .feature-card p {
          font-size: 14px;
          line-height: 1.6;
          color: #6b7280;
          margin: 0;
        }

        /* AI Section */
        .ai-section {
          background: linear-gradient(180deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
        }
        .ai-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .ai-description {
          font-size: 16px;
          line-height: 1.7;
          color: #cbd5e1;
          margin: 0 0 32px;
        }
        .ai-stats {
          display: flex;
          gap: 32px;
        }
        .ai-stats > div {
          display: flex;
          flex-direction: column;
        }
        .ai-stats strong {
          font-size: 36px;
          font-weight: 800;
          color: #fff;
        }
        .ai-stats span {
          font-size: 12px;
          color: #93c5fd;
          margin-top: 4px;
        }
        .ai-flow {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .flow-step {
          background: rgba(255,255,255,0.08);
          padding: 14px 20px;
          border-radius: 8px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .flow-step span {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }
        .flow-step.danger { border-left: 3px solid #ef4444; }
        .flow-step.success { border-left: 3px solid #10b981; }
        .flow-arrow {
          text-align: center;
          color: #64748b;
          font-size: 18px;
        }

        /* CTA */
        .cta-section {
          background: #f8fafc;
        }
        .cta-inner {
          text-align: center;
        }
        .cta-inner h2 {
          font-size: 36px;
          font-weight: 800;
          margin: 0 0 12px;
        }
        .cta-inner p {
          font-size: 16px;
          color: #6b7280;
          margin: 0 0 32px;
        }
        .cta-inner .hero-cta {
          justify-content: center;
        }

        @media (max-width: 968px) {
          .hero-inner, .ai-grid { grid-template-columns: 1fr; }
          .hero-title { font-size: 40px; }
          .format-grid { grid-template-columns: repeat(3, 1fr); }
          .feature-grid { grid-template-columns: 1fr; }
          .section-inner { padding: 60px 20px; }
        }
      `}</style>
    </div>
  );
}

const features = [
  { icon: 'AI', title: 'AI 문서 편집', description: 'GPT-4 기반 요약, 번역, 메일 작성 등 15개 AI 어시스턴트가 문서 작업을 자동화합니다.', color: '#2b579a' },
  { icon: 'TC', title: '변경 추적 & 댓글', description: '편집 이력을 추적하고 팀원과 댓글로 협업하세요. 수락/거부/스레드 답글을 지원합니다.', color: '#7c3aed' },
  { icon: 'OCR', title: 'OCR & 수식', description: 'Tesseract.js 한/영 OCR로 이미지에서 텍스트를 추출하고 KaTeX로 LaTeX 수식을 렌더링합니다.', color: '#059669' },
  { icon: '🔒', title: 'AI 보안', description: 'AEGIS 게이트웨이가 PII 유출과 프롬프트 인젝션을 차단합니다.', color: '#dc2626' },
  { icon: '✓', title: '컴플라이언스', description: 'EU AI Act, K-AI Act, NIST AI RMF, OWASP LLM Top 10 4종 컴플라이언스를 자동 평가합니다.', color: '#0891b2' },
  { icon: 'A11y', title: '접근성', description: 'ARIA 속성, 키보드 네비게이션, 고대비 모드, 스크린리더 지원으로 누구나 사용할 수 있습니다.', color: '#ea580c' },
];

export default LandingPage;
