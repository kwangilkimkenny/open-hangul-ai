#!/usr/bin/env python3
"""Patent figure generator for Integrated AI Document Editing System"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
import os

# Korean font setup
plt.rcParams['font.family'] = 'AppleGothic'
plt.rcParams['axes.unicode_minus'] = False

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'figures')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Color palette - professional patent style (grayscale + muted blue)
C_BG = '#FFFFFF'
C_BOX = '#F5F5F5'
C_BORDER = '#333333'
C_TEXT = '#1A1A1A'
C_ACCENT = '#4A6FA5'
C_ACCENT2 = '#6B8CBF'
C_LIGHT = '#E8EDF2'
C_WARN = '#D4A574'
C_GREEN = '#7BA37B'
C_RED = '#B07070'

def lighten(color, factor=0.85):
    """Create a lightened version of a hex color"""
    import matplotlib.colors as mcolors
    rgb = mcolors.to_rgb(color)
    return tuple(min(1, c + (1 - c) * factor) for c in rgb)

def save_fig(fig, name):
    path = os.path.join(OUTPUT_DIR, name)
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor=C_BG, pad_inches=0.3)
    plt.close(fig)
    print(f"  Saved: {path}")


def draw_box(ax, x, y, w, h, text, color=C_BOX, border=C_BORDER, fontsize=9, bold=False, number=None):
    """Draw a rounded box with text"""
    box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                          facecolor=color, edgecolor=border, linewidth=1.2)
    ax.add_patch(box)
    label = text
    if number:
        label = f"({number}) {text}"
    weight = 'bold' if bold else 'normal'
    ax.text(x + w/2, y + h/2, label, ha='center', va='center',
            fontsize=fontsize, fontweight=weight, color=C_TEXT, wrap=True)
    return box


def draw_arrow(ax, x1, y1, x2, y2, style='->', color=C_BORDER):
    """Draw an arrow between two points"""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=1.5))


# ============================================================
# Figure 1: System Architecture Block Diagram
# ============================================================
def fig1_system_architecture():
    fig, ax = plt.subplots(1, 1, figsize=(14, 10))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_title('【도 1】 지능형 문서 편집 시스템 전체 아키텍처', fontsize=13, fontweight='bold', pad=15)

    # Title box
    draw_box(ax, 0.5, 9.2, 13, 0.6, '지능형 문서 편집 시스템 (100)', C_LIGHT, C_ACCENT, 11, True)

    # User Interface Layer (180)
    draw_box(ax, 0.8, 8.2, 12.4, 0.8, '사용자 인터페이스 계층 (180)\n리본 UI | AI 채팅 패널 | 컨텍스트 메뉴 | 컴플라이언스 대시보드', '#E8EDF2', C_ACCENT2, 8)

    # Integrated Control Module (160)
    draw_box(ax, 0.8, 7.0, 12.4, 0.9, '통합 제어 모듈 (160)\n입력 보안검증 → AI 생성 → 출력 보안검증 → 할루시네이션 검증 → 인간 감독 → 문서 반영 → 컴플라이언스 로깅',
             '#DDE5EF', C_ACCENT, 8, True)

    # Main modules row
    mw = 3.8
    mh = 2.8
    gap = 0.3

    # Module 110
    draw_box(ax, 0.8, 3.8, mw, mh, '', C_BOX, C_BORDER)
    ax.text(0.8 + mw/2, 6.3, '문서 파싱 및 편집 모듈 (110)', ha='center', fontsize=9, fontweight='bold', color=C_ACCENT)
    items_110 = ['문서 파서 (111)', '문서 객체 모델 관리부 (112)', '인라인 편집기 (113)',
                 '이력 관리부 (114)', '문서 내보내기부 (115)']
    for i, item in enumerate(items_110):
        ax.text(1.0, 5.9 - i*0.4, f'• {item}', fontsize=7.5, color=C_TEXT)

    # Module 120 + 130
    x2 = 0.8 + mw + gap
    draw_box(ax, x2, 3.8, mw, mh, '', C_BOX, C_BORDER)
    ax.text(x2 + mw/2, 6.3, 'AI 콘텐츠 생성 모듈 (120)', ha='center', fontsize=9, fontweight='bold', color=C_ACCENT)
    items_120 = ['문서 구조 분석부 (121)', '프롬프트 빌더 (122)', 'LLM API 통신부 (123)',
                 '콘텐츠 병합부 (124)']
    for i, item in enumerate(items_120):
        ax.text(x2 + 0.2, 5.9 - i*0.4, f'• {item}', fontsize=7.5, color=C_TEXT)

    # Module 130 + 140
    x3 = x2 + mw + gap
    draw_box(ax, x3, 5.2, mw/2 - 0.1, 1.4, '', '#FFF5E6', C_WARN)
    ax.text(x3 + mw/4 - 0.05, 6.35, 'AEGIS (130)', ha='center', fontsize=8, fontweight='bold', color='#8B6914')
    ax.text(x3 + 0.15, 5.9, '6계층 PALADIN\n보안 방어', fontsize=7, color=C_TEXT)

    draw_box(ax, x3 + mw/2 + 0.1, 5.2, mw/2 - 0.1, 1.4, '', '#E6F5E6', C_GREEN)
    ax.text(x3 + 3*mw/4 + 0.05, 6.35, 'TruthAnchor (140)', ha='center', fontsize=8, fontweight='bold', color='#2E6B2E')
    ax.text(x3 + mw/2 + 0.25, 5.9, '4계층 할루시네이션\n검증', fontsize=7, color=C_TEXT)

    # Compliance Module (150)
    draw_box(ax, x3, 3.8, mw, 1.2, '', '#F0E6F5', '#7B5EA7')
    ax.text(x3 + mw/2, 4.7, '규제 준수 평가 모듈 (150)', ha='center', fontsize=8, fontweight='bold', color='#5B3E87')
    ax.text(x3 + 0.15, 4.25, 'EU AI Act | K-AI Act | NIST AI RMF | OWASP LLM Top 10', fontsize=6.5, color=C_TEXT)
    ax.text(x3 + 0.15, 3.95, '활동 로그 → 75+ 평가규칙 → 증거기반 리포트', fontsize=6.5, color=C_TEXT)

    # State Management Store (170)
    draw_box(ax, 0.8, 2.8, 12.4, 0.7, '상태 관리 저장소 (170)\ndocumentStore | editingStore | aiStore | uiStore | complianceStore | cellSelectionStore | templateStore',
             '#F0F0F0', '#888888', 7.5)

    # External systems
    draw_box(ax, 2.0, 1.5, 3, 0.7, 'HWPX/HWP 문서 파일', '#F5F5F5', '#999', 8)
    draw_box(ax, 6.0, 1.5, 3, 0.7, 'LLM API\n(GPT-4o, Claude, DeepSeek)', '#F5F5F5', '#999', 7)
    draw_box(ax, 10.0, 1.5, 3, 0.7, 'NLI 모델\n(DeBERTa-v3)', '#F5F5F5', '#999', 7.5)

    # Arrows
    draw_arrow(ax, 3.5, 2.2, 2.7, 2.8, color='#888')
    draw_arrow(ax, 7.5, 2.2, 7.0, 2.8, color='#888')
    draw_arrow(ax, 11.5, 2.2, 11.5, 2.8, color='#888')

    # Vertical flow arrows
    draw_arrow(ax, 7, 8.2, 7, 7.95)
    draw_arrow(ax, 7, 7.0, 7, 6.7)

    save_fig(fig, 'fig01_system_architecture.png')


# ============================================================
# Figure 2: AI Content Generation & Verification Pipeline
# ============================================================
def fig2_pipeline():
    fig, ax = plt.subplots(1, 1, figsize=(14, 8))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis('off')
    ax.set_title('【도 2】 AI 콘텐츠 생성 및 검증 파이프라인 데이터 흐름도', fontsize=13, fontweight='bold', pad=15)

    steps = [
        ('S1', '입력 보안 검증', '프롬프트 인젝션 탐지\nPII 가명처리', C_WARN),
        ('S2', 'AI 콘텐츠 생성', '문서 구조 분석\nLLM API 호출', C_ACCENT),
        ('S3', '출력 보안 검증', '유해 콘텐츠 필터\nPII 노출 검사', C_WARN),
        ('S4', '할루시네이션 검증', '4계층 파이프라인\n5차원 스코어링', C_GREEN),
        ('S5', '인간 감독', '결과 제시\n검토/승인/수정', '#8B6914'),
        ('S6', '문서 반영', '문서 객체 모델 갱신\n서식 보존 병합', C_ACCENT2),
        ('S7', '컴플라이언스 로깅', '활동 로그 기록\n규제 준수 평가', '#7B5EA7'),
    ]

    # User icon
    draw_box(ax, 0.3, 6.0, 1.5, 1.0, '사용자\n(프롬프트 입력)', '#E8EDF2', C_ACCENT, 8, True)

    bw = 1.4
    bh = 1.4
    y_top = 6.0
    x_start = 2.5
    x_gap = 1.55

    for i, (code, title, desc, color) in enumerate(steps):
        x = x_start + i * x_gap
        # Main box
        lc = color if isinstance(color, str) else C_BORDER
        draw_box(ax, x, y_top, bw, bh, '', f'{lc}15', lc, 7)
        ax.text(x + bw/2, y_top + bh - 0.2, f'{code}', ha='center', fontsize=8, fontweight='bold', color=lc)
        ax.text(x + bw/2, y_top + bh - 0.55, title, ha='center', fontsize=7, fontweight='bold', color=C_TEXT)
        ax.text(x + bw/2, y_top + 0.3, desc, ha='center', fontsize=6, color='#555')

        # Arrow
        if i < len(steps) - 1:
            draw_arrow(ax, x + bw, y_top + bh/2, x + x_gap, y_top + bh/2, color='#666')

    # Arrow from user
    draw_arrow(ax, 1.8, 6.5, 2.5, 6.5, color='#666')

    # Output arrow
    draw_box(ax, 12.9, 6.0, 0.8, 1.0, '문서\n출력', '#E8EDF2', C_ACCENT, 7, True)
    draw_arrow(ax, 12.65, 6.5, 12.9, 6.5, color='#666')

    # Lower section: Module mapping
    ax.text(7, 4.8, '각 단계별 담당 모듈', ha='center', fontsize=10, fontweight='bold', color=C_TEXT)

    mappings = [
        ('S1, S3', 'AEGIS\n다계층 보안 방어 모듈 (130)', C_WARN),
        ('S2', 'AI 콘텐츠 생성 모듈 (120)', C_ACCENT),
        ('S4', 'TruthAnchor\n할루시네이션 검증 모듈 (140)', C_GREEN),
        ('S5, S6', '문서 파싱 및 편집 모듈 (110)', C_ACCENT2),
        ('S7', '규제 준수 평가 모듈 (150)', '#7B5EA7'),
    ]

    for i, (code, module, color) in enumerate(mappings):
        x = 0.5 + i * 2.7
        draw_box(ax, x, 3.2, 2.4, 1.2, '', lighten(color), color, 7)
        ax.text(x + 1.2, 4.15, code, ha='center', fontsize=9, fontweight='bold', color=color)
        ax.text(x + 1.2, 3.6, module, ha='center', fontsize=6.5, color=C_TEXT)

    # Data flow note
    ax.text(7, 2.5, '※ 전체 파이프라인은 통합 제어 모듈(160)에 의해 자동 오케스트레이션됨',
            ha='center', fontsize=8, style='italic', color='#777')

    save_fig(fig, 'fig02_pipeline_dataflow.png')


# ============================================================
# Figure 3: AEGIS 6-Layer PALADIN Architecture
# ============================================================
def fig3_paladin():
    fig, ax = plt.subplots(1, 1, figsize=(12, 10))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_title('【도 3】 다계층 보안 방어 모듈(AEGIS) 6계층 PALADIN 아키텍처', fontsize=12, fontweight='bold', pad=15)

    # Input
    draw_box(ax, 4.5, 9.2, 3, 0.6, '입력 텍스트 (사용자 프롬프트)', '#E8EDF2', C_ACCENT, 9, True)

    layers = [
        ('L0', '신뢰 경계 검증부 (131)', '유니코드 정규화 | 제로폭 문자 제거 | 동형 문자 탐지', '#F5E6D8'),
        ('L1', '의도 분석부 (132)', '탈옥 패턴 | 프롬프트 인젝션 | 사회공학 | 코드 인젝션', '#F5E6D8'),
        ('L2', 'RA 가드 (133)', '검색증강생성 공격 | 간접 인젝션 | 악성 컨텍스트', '#F5E6D8'),
        ('L3', 'ClassRAG (134)', '문맥 기반 분류 | 컨텍스트 일관성 검증', '#F5E6D8'),
        ('L4', '회로 차단기 (135)', '비율 제한 | 누적 위험 점수 | 연속 의심 요청 차단', '#F5E6D8'),
        ('L5', '행동 분석부 (136)', '크레센도 공격 탐지 | 세션 기반 위험도 누적 | 감쇠 함수', '#F5E6D8'),
    ]

    y = 8.3
    for i, (code, name, desc, color) in enumerate(layers):
        draw_box(ax, 1.0, y, 10, 0.9, '', color, C_BORDER)
        ax.text(1.3, y + 0.55, f'제{i}계층', fontsize=8, fontweight='bold', color=C_WARN)
        ax.text(3.0, y + 0.55, name, fontsize=8.5, fontweight='bold', color=C_TEXT)
        ax.text(3.0, y + 0.2, desc, fontsize=7, color='#666')

        # θ=0 badge
        ax.text(10.5, y + 0.45, 'θ=0', fontsize=7, fontweight='bold', color=C_RED,
                ha='center', bbox=dict(boxstyle='round,pad=0.15', facecolor='#FFE0E0', edgecolor=C_RED, linewidth=0.8))

        if i < len(layers) - 1:
            draw_arrow(ax, 6, y, 6, y - 0.25, color='#999')
        y -= 1.15

    # Korean module sidebar
    draw_box(ax, 0.2, 1.3, 4.5, 1.2, '', '#FFF5E6', '#CC8800')
    ax.text(2.45, 2.3, '한국어 탐지 서브모듈 (137)', ha='center', fontsize=8, fontweight='bold', color='#8B6914')
    ax.text(2.45, 1.85, '12개 탐지기 (횡단 적용)', ha='center', fontsize=7, color='#666')
    ax.text(2.45, 1.55, '자모 | 초성 | 고어 | 동형문자 | 음절역순 | ...', ha='center', fontsize=6.5, color='#888')

    # Risk score
    draw_box(ax, 5.2, 1.3, 3, 1.2, '', '#FFE0E0', C_RED)
    ax.text(6.7, 2.3, '위험 점수 산출', ha='center', fontsize=8, fontweight='bold', color=C_RED)
    ax.text(6.7, 1.85, 'raw = layer + korean + pii', ha='center', fontsize=7, color='#666', family='monospace')
    ax.text(6.7, 1.55, 'final = raw × sensitivity', ha='center', fontsize=7, color='#666', family='monospace')

    # Decision
    draw_box(ax, 8.7, 1.3, 3, 1.2, '', '#E6F5E6', C_GREEN)
    ax.text(10.2, 2.3, '판정', ha='center', fontsize=8, fontweight='bold', color=C_GREEN)
    ax.text(10.2, 1.85, '≥ 임계값 → 차단 (BLOCK)', ha='center', fontsize=7, color=C_RED)
    ax.text(10.2, 1.55, '< 임계값 → 통과 (APPROVE)', ha='center', fontsize=7, color=C_GREEN)

    draw_arrow(ax, 4.7, 1.9, 5.2, 1.9, color='#888')
    draw_arrow(ax, 8.2, 1.9, 8.7, 1.9, color='#888')
    draw_arrow(ax, 6, 2.15, 6, 2.5, color='#888')

    save_fig(fig, 'fig03_paladin_architecture.png')


# ============================================================
# Figure 4: Korean Linguistic Attack Detection Submodules
# ============================================================
def fig4_korean_modules():
    fig, ax = plt.subplots(1, 1, figsize=(14, 9))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis('off')
    ax.set_title('【도 4】 한국어 언어학적 우회 공격 탐지 서브모듈 구성도', fontsize=12, fontweight='bold', pad=15)

    modules = [
        ('137-1', '키보드 매핑\n탐지기', '자판 배열 인코딩'),
        ('137-2', '고어(古語)\n탐지기', '고대 한국어 문자'),
        ('137-3', '동형 문자\n탐지기', '시각적 동일 문자'),
        ('137-4', '한자\n탐지기', '한자 주입 우회'),
        ('137-5', '토크나이저\n취약점 탐지기', '토큰 경계 악용'),
        ('137-6', '자모\n정규화기', '한글 자모 분해'),
        ('137-7', '은어\n탐지기', '은어/속어 유해표현'),
        ('137-8', '조사\n탐지기', '형태소 조사 변조'),
        ('137-9', '음절 역순\n탐지기', '문자 순서 역전'),
        ('137-10', '음운 변이\n탐지기', '유사 발음 대체'),
        ('137-11', '초성\n디코더', '초성 약어 (ㅈㅅ)'),
        ('137-12', '코드 스위칭\n탐지기', '혼합 언어 공격'),
    ]

    # Input
    draw_box(ax, 5.5, 8.2, 3, 0.6, '입력 텍스트', '#E8EDF2', C_ACCENT, 9, True)
    draw_arrow(ax, 7, 8.2, 7, 7.8)

    # Grid layout 4x3
    cols = 4
    bw = 2.8
    bh = 1.4
    xgap = 0.35
    ygap = 0.4
    xstart = 0.7
    ystart = 6.0

    for i, (num, name, desc) in enumerate(modules):
        col = i % cols
        row = i // cols
        x = xstart + col * (bw + xgap)
        y = ystart - row * (bh + ygap)

        draw_box(ax, x, y, bw, bh, '', '#FFF5E6', '#CC8800')
        ax.text(x + bw/2, y + bh - 0.25, num, ha='center', fontsize=7, fontweight='bold', color='#8B6914')
        ax.text(x + bw/2, y + bh/2 - 0.05, name, ha='center', fontsize=8, fontweight='bold', color=C_TEXT)
        ax.text(x + bw/2, y + 0.2, desc, ha='center', fontsize=6.5, color='#888')

    # Harmful keywords box
    draw_box(ax, 2.0, 0.8, 10, 1.0, '', '#FFE0E0', C_RED)
    ax.text(7, 1.55, '유해 키워드 데이터베이스 (29개)', ha='center', fontsize=9, fontweight='bold', color=C_RED)
    ax.text(7, 1.1, '폭탄 | 마약 | 해킹 | 테러 | 자살 | 살인 | 무기 | ... (연동 판별)', ha='center', fontsize=8, color='#888')

    # Arrow from grid to keywords
    draw_arrow(ax, 7, 2.7, 7, 1.8, color='#CC8800')

    save_fig(fig, 'fig04_korean_submodules.png')


# ============================================================
# Figure 5: TruthAnchor 4-Layer Verification Pipeline
# ============================================================
def fig5_truthanchor():
    fig, ax = plt.subplots(1, 1, figsize=(13, 10))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_title('【도 5】 할루시네이션 검증 모듈(TruthAnchor) 4계층 검증 파이프라인', fontsize=12, fontweight='bold', pad=15)

    # Inputs
    draw_box(ax, 0.5, 9.0, 3.5, 0.7, 'AI 생성 텍스트', '#E6F5E6', C_GREEN, 9, True)
    draw_box(ax, 5.0, 9.0, 3.5, 0.7, '원본 문서 텍스트', '#E8EDF2', C_ACCENT, 9, True)

    # Claim Extraction
    draw_box(ax, 0.5, 7.8, 3.5, 0.9, '주장 추출부 (141)\n한국어 문장분리 + 복합문 분할', '#F0F5F0', C_GREEN, 7.5)

    # Evidence Matching
    draw_box(ax, 5.0, 7.8, 3.5, 0.9, '증거 매칭부 (142)\n키워드50% + n-그램30% + 시퀀스20%', '#E8EDF2', C_ACCENT, 7.5)

    draw_arrow(ax, 2.25, 9.0, 2.25, 8.7, color='#666')
    draw_arrow(ax, 6.75, 9.0, 6.75, 8.7, color='#666')

    # 4-Layer Pipeline
    layers = [
        ('제0계층', '가드레일 검증부 (143-0)', '38개 도메인 규칙\nCRITICAL/HIGH/MEDIUM 심각도', '<1ms', '#FFF5E6'),
        ('제0.5계층', '수치 교차검증부 (143-1)', '백분율/통화/건수/연도 추출\n문맥 카테고리 기반 비교', '<1ms', '#FFF5E6'),
        ('제1계층', 'NLI 검증부 (143-2)', 'DeBERTa-v3 cross-encoder\n3-class softmax → 함의/모순/중립', '~50ms', '#E6EEF5'),
        ('제2계층', 'LLM 재검증부 (143-3)', '중립 판정 → GPT-4 재검증\ntemperature 0.1', '~2s', '#E6EEF5'),
    ]

    y = 6.5
    for i, (layer, name, desc, latency, color) in enumerate(layers):
        draw_box(ax, 1.0, y, 8.5, 1.1, '', color, C_BORDER)
        ax.text(1.3, y + 0.7, layer, fontsize=8, fontweight='bold', color='#8B6914')
        ax.text(3.5, y + 0.7, name, fontsize=8.5, fontweight='bold', color=C_TEXT)
        ax.text(3.5, y + 0.25, desc, fontsize=7, color='#666')
        ax.text(9.2, y + 0.55, latency, fontsize=8, fontweight='bold', color=C_ACCENT,
                bbox=dict(boxstyle='round,pad=0.1', facecolor='white', edgecolor='#ccc', linewidth=0.5))
        if i < len(layers) - 1:
            draw_arrow(ax, 5.25, y, 5.25, y - 0.3, color='#999')
        y -= 1.45

    # Output section
    draw_arrow(ax, 5.25, 2.3, 5.25, 2.0, color='#999')

    # Verdicts
    verdicts = [
        ('지지\n(Supported)', C_GREEN, 1.0),
        ('반박\n(Contradicted)', C_RED, 4.0),
        ('중립\n(Neutral)', '#888', 7.0),
    ]
    for label, color, x in verdicts:
        draw_box(ax, x, 1.0, 2.5, 0.8, label, lighten(color), color, 8, True)

    # Correction arrow from contradicted
    draw_box(ax, 10.0, 3.5, 2.5, 1.5, '교정 생성부\n(145)\n\nLLM 기반\n대안 텍스트 생성', '#FFE0E0', C_RED, 7.5)
    ax.annotate('반박 주장', xy=(10.0, 4.25), xytext=(9.5, 3.0),
                arrowprops=dict(arrowstyle='->', color=C_RED, lw=1.2),
                fontsize=7, color=C_RED)

    # Scoring arrow
    draw_box(ax, 10.0, 5.5, 2.5, 1.2, '5차원 스코어링\n(144)\n\n도 6 참조', '#E6F5E6', C_GREEN, 7.5)

    save_fig(fig, 'fig05_truthanchor_pipeline.png')


# ============================================================
# Figure 6: 5-Dimension Hallucination Scoring Model
# ============================================================
def fig6_scoring():
    fig, ax = plt.subplots(1, 1, figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis('off')
    ax.set_title('【도 6】 5차원 할루시네이션 신뢰도 스코어링 모델', fontsize=12, fontweight='bold', pad=15)

    dims = [
        ('사실 정확도\nFactual Accuracy', '35%', '지지 주장 / 전체 주장', C_GREEN),
        ('수치 정확도\nNumerical Accuracy', '15%', '수치 지지 / 수치 전체', C_ACCENT),
        ('증거 신뢰도\nEvidence Reliability', '20%', '신뢰도 가중 평균\n(중립 패널티)', C_WARN),
        ('일관성\nConsistency', '15%', '1.0 − (모순비율 × 0.5)', '#7B5EA7'),
        ('불확실성 보정\nUncertainty Cal.', '15%', '(확정 + 정보중립×0.5)\n/ 전체', C_RED),
    ]

    # Input
    draw_box(ax, 4.5, 7.2, 3, 0.6, '4계층 검증 결과', '#E8EDF2', C_ACCENT, 9, True)
    draw_arrow(ax, 6, 7.2, 6, 6.8)

    y = 5.7
    for i, (name, weight, formula, color) in enumerate(dims):
        x = 0.5
        draw_box(ax, x, y, 2.5, 0.8, name, lighten(color), color, 7.5, True)
        # Weight badge
        ax.text(3.3, y + 0.4, weight, fontsize=10, fontweight='bold', color=color,
                bbox=dict(boxstyle='round,pad=0.15', facecolor='white', edgecolor=color, linewidth=1))
        # Formula
        ax.text(4.3, y + 0.4, formula, fontsize=7.5, color='#555', va='center')
        # Bar representation
        bar_w = float(weight.replace('%','')) / 100 * 5
        ax.barh(y + 0.4, bar_w, height=0.25, left=7.5, color=color, alpha=0.4, edgecolor=color, linewidth=0.8)
        ax.text(7.5 + bar_w + 0.1, y + 0.4, weight, fontsize=7, color=color, va='center')

        y -= 1.1

    # Sum arrow
    draw_arrow(ax, 6, 1.2, 6, 0.9, color='#333')

    # Final score
    draw_box(ax, 3.5, 0.2, 5, 0.6, '종합 신뢰도 점수 = Σ (차원별 점수 × 가중치)', '#333', '#111', 9, True)
    ax.texts[-1].set_color('white')

    # Neutral segmentation note
    draw_box(ax, 9.0, 2.0, 2.8, 1.5, '', '#F5F0FA', '#7B5EA7')
    ax.text(10.4, 3.2, '중립 분류 세분화', ha='center', fontsize=7.5, fontweight='bold', color='#5B3E87')
    ax.text(10.4, 2.7, '정보 중립\n(신뢰도>0.5, 증거 존재)', ha='center', fontsize=6.5, color=C_GREEN)
    ax.text(10.4, 2.15, '비정보 중립\n(증거 부재)', ha='center', fontsize=6.5, color=C_RED)

    save_fig(fig, 'fig06_5d_scoring.png')


# ============================================================
# Figure 7: Compliance Evaluation System
# ============================================================
def fig7_compliance():
    fig, ax = plt.subplots(1, 1, figsize=(13, 9))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 9)
    ax.axis('off')
    ax.set_title('【도 7】 다중 규제 프레임워크 컴플라이언스 평가 시스템', fontsize=12, fontweight='bold', pad=15)

    # Activity Log input
    draw_box(ax, 0.5, 7.8, 4, 0.8, '활동 로그 관리부 (151)\nAI 동작 이력 + 보안 결과 + 검증 결과', '#F0F0F0', '#888', 7.5)

    draw_box(ax, 5.5, 7.8, 3, 0.8, '시스템 구성 정보\n(AppComplianceConfig)', '#F0F0F0', '#888', 7.5)

    draw_box(ax, 9.5, 7.8, 3, 0.8, '프레임워크 규칙 엔진 (152)\n75+ 선언적 평가 규칙', '#E8EDF2', C_ACCENT, 7.5)

    # Arrow down to evaluator
    draw_arrow(ax, 2.5, 7.8, 6.5, 7.0, color='#888')
    draw_arrow(ax, 7, 7.8, 6.5, 7.0, color='#888')
    draw_arrow(ax, 11, 7.8, 6.5, 7.0, color='#888')

    # Evaluator
    draw_box(ax, 4.0, 6.0, 5, 0.8, '평가 수행부 (153)\npass(100) | warn(60) | fail(0) | n/a → 가중 평균 산출', '#DDE5EF', C_ACCENT, 8, True)

    draw_arrow(ax, 6.5, 6.0, 6.5, 5.5)

    # 4 Frameworks
    frameworks = [
        ('EU AI Act', '2024/1689', '투명성 | 위험관리\n데이터 거버넌스 | 인간 감독\n기술적 강건성', '#4A6FA5'),
        ('K-AI Act', '한국 AI 기본법', '안전성 | 투명성\n공정성 | 책임성\n프라이버시', '#6B8CBF'),
        ('NIST AI RMF', 'AI RMF 1.0', 'Govern | Map\nMeasure | Manage', '#7BA37B'),
        ('OWASP LLM\nTop 10', 'v1.1 (2024)', '프롬프트 인젝션 | DoS\n민감정보 | 과도한 의존\n+ 7 카테고리', '#B07070'),
    ]

    for i, (name, ver, cats, color) in enumerate(frameworks):
        x = 0.3 + i * 3.2
        draw_box(ax, x, 3.2, 2.9, 2.1, '', lighten(color), color)
        ax.text(x + 1.45, 5.05, name, ha='center', fontsize=9, fontweight='bold', color=color)
        ax.text(x + 1.45, 4.65, ver, ha='center', fontsize=7, color='#888')
        ax.text(x + 1.45, 3.9, cats, ha='center', fontsize=6.5, color='#555')

    # Report output
    draw_arrow(ax, 6.5, 3.2, 6.5, 2.7, color='#333')

    draw_box(ax, 2.5, 1.2, 8, 1.3, '', '#F5F0FA', '#5B3E87')
    ax.text(6.5, 2.3, '리포트 생성부 (154) — 컴플라이언스 리포트', ha='center', fontsize=9, fontweight='bold', color='#5B3E87')
    ax.text(6.5, 1.85, '전체 점수 + 카테고리별 점수 + 개별 항목 판정 + 증거 + 교정 지침', ha='center', fontsize=7.5, color='#666')
    ax.text(6.5, 1.5, 'AI 사용 요약 (총 동작, 모델, 승인율, 할루시네이션 점수) | PDF/JSON 내보내기', ha='center', fontsize=7, color='#888')

    # Status badges
    for i, (label, color) in enumerate([('≥80 준수', C_GREEN), ('50~79 부분준수', C_WARN), ('<50 미준수', C_RED)]):
        ax.text(3.5 + i * 2.5, 0.7, label, ha='center', fontsize=8, fontweight='bold', color=color,
                bbox=dict(boxstyle='round,pad=0.2', facecolor=lighten(color), edgecolor=color, linewidth=1))

    save_fig(fig, 'fig07_compliance_system.png')


# ============================================================
# Figure 8: Online-Offline Hybrid Mode
# ============================================================
def fig8_hybrid():
    fig, ax = plt.subplots(1, 1, figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis('off')
    ax.set_title('【도 8】 온라인-오프라인 하이브리드 운용 모드 전환 흐름도', fontsize=12, fontweight='bold', pad=15)

    # Health check
    draw_box(ax, 4.5, 7.0, 3, 0.7, '서버 상태 감시\n(Health Check)', '#E8EDF2', C_ACCENT, 8, True)

    # Decision diamond (simulate with rotated box)
    diamond_x, diamond_y = 6, 5.8
    diamond = plt.Polygon([[diamond_x, diamond_y + 0.5], [diamond_x + 1, diamond_y],
                           [diamond_x, diamond_y - 0.5], [diamond_x - 1, diamond_y]],
                          facecolor='#FFF5E6', edgecolor=C_WARN, linewidth=1.5)
    ax.add_patch(diamond)
    ax.text(diamond_x, diamond_y, '서버\n가용?', ha='center', va='center', fontsize=8, fontweight='bold', color='#8B6914')

    draw_arrow(ax, 6, 7.0, 6, 6.3, color='#888')

    # Online mode (left)
    draw_box(ax, 0.5, 3.5, 4.5, 1.8, '', '#E6F5E6', C_GREEN)
    ax.text(2.75, 5.0, '온라인 모드', ha='center', fontsize=10, fontweight='bold', color=C_GREEN)
    ax.text(2.75, 4.55, '전체 4계층 파이프라인 (서버 측)', ha='center', fontsize=7.5, color='#555')
    layers_on = ['L0: 가드레일 (38규칙)', 'L0.5: 수치 교차검증', 'L1: NLI (DeBERTa)', 'L2: LLM 재검증']
    for i, l in enumerate(layers_on):
        ax.text(1.0, 4.1 - i * 0.35, f'✓ {l}', fontsize=7, color=C_GREEN)

    # Offline mode (right)
    draw_box(ax, 7.0, 3.5, 4.5, 1.8, '', '#FFF5E6', C_WARN)
    ax.text(9.25, 5.0, '오프라인 모드', ha='center', fontsize=10, fontweight='bold', color='#CC8800')
    ax.text(9.25, 4.55, '클라이언트 측 JS 엔진 (자동 전환)', ha='center', fontsize=7.5, color='#555')
    layers_off = [('✓ L0: 가드레일 (38규칙)', C_GREEN), ('✓ L0.5: 수치 교차검증', C_GREEN),
                  ('✗ L1: NLI (생략)', '#CCC'), ('✗ L2: LLM 재검증 (생략)', '#CCC')]
    for i, (l, c) in enumerate(layers_off):
        ax.text(7.5, 4.1 - i * 0.35, l, fontsize=7, color=c)

    # Arrows from diamond
    ax.annotate('예', xy=(2.75, 5.3), xytext=(5.0, 5.8),
                arrowprops=dict(arrowstyle='->', color=C_GREEN, lw=1.5),
                fontsize=9, fontweight='bold', color=C_GREEN)
    ax.annotate('아니오', xy=(9.25, 5.3), xytext=(7.0, 5.8),
                arrowprops=dict(arrowstyle='->', color=C_WARN, lw=1.5),
                fontsize=9, fontweight='bold', color=C_WARN)

    # Recovery arrow
    draw_box(ax, 3.5, 1.5, 5, 1.2, '', '#F0F0F0', '#888')
    ax.text(6, 2.5, '서버 복구 시', ha='center', fontsize=8, fontweight='bold', color='#555')
    ax.text(6, 2.1, '자동 온라인 전환', ha='center', fontsize=7.5, color=C_GREEN)
    ax.text(6, 1.7, '미검증 항목 일괄 재검증 가능', ha='center', fontsize=7, color='#888')

    draw_arrow(ax, 9.25, 3.5, 6.5, 2.7, color='#888', style='->')

    save_fig(fig, 'fig08_hybrid_mode.png')


# ============================================================
# Figure 9: Orchestration Sequence Diagram
# ============================================================
def fig9_sequence():
    fig, ax = plt.subplots(1, 1, figsize=(14, 10))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_title('【도 9】 통합 제어 모듈 오케스트레이션 시퀀스 다이어그램', fontsize=12, fontweight='bold', pad=15)

    # Actors
    actors = [
        ('사용자', 1.5),
        ('통합 제어\n(160)', 3.5),
        ('AEGIS\n(130)', 5.5),
        ('AI 생성\n(120)', 7.5),
        ('TruthAnchor\n(140)', 9.5),
        ('컴플라이언스\n(150)', 11.5),
    ]

    for name, x in actors:
        draw_box(ax, x - 0.6, 9.0, 1.2, 0.7, name, '#E8EDF2', C_ACCENT, 7, True)
        ax.plot([x, x], [0.5, 9.0], '--', color='#CCC', linewidth=0.8)

    # Messages
    messages = [
        (1.5, 3.5, 8.5, 'AI 콘텐츠 생성 요청 + 프롬프트', '#333'),
        (3.5, 5.5, 7.8, '입력 보안 검증 요청', C_WARN),
        (5.5, 3.5, 7.3, '검증 결과 (통과/차단)', C_WARN),
        (3.5, 7.5, 6.8, '문서 구조 분석 + LLM 호출', C_ACCENT),
        (7.5, 3.5, 6.3, '생성된 콘텐츠 반환', C_ACCENT),
        (3.5, 5.5, 5.8, '출력 보안 검증 요청', C_WARN),
        (5.5, 3.5, 5.3, '검증 결과 (통과/차단)', C_WARN),
        (3.5, 9.5, 4.8, '할루시네이션 검증 요청', C_GREEN),
        (9.5, 3.5, 4.3, '검증 결과 (점수, 판정, 교정)', C_GREEN),
        (3.5, 1.5, 3.8, '결과 제시 (검토 요청)', '#333'),
        (1.5, 3.5, 3.3, '승인/수정 응답', '#333'),
        (3.5, 11.5, 2.5, '활동 로그 기록', '#7B5EA7'),
        (11.5, 3.5, 2.0, '컴플라이언스 평가 완료', '#7B5EA7'),
        (3.5, 1.5, 1.3, '문서 반영 완료 통지', '#333'),
    ]

    for x1, x2, y, msg, color in messages:
        ax.annotate('', xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.2))
        mid = (x1 + x2) / 2
        ax.text(mid, y + 0.15, msg, ha='center', fontsize=6.5, color=color,
                bbox=dict(boxstyle='round,pad=0.08', facecolor='white', edgecolor='none'))

    save_fig(fig, 'fig09_sequence_diagram.png')


# ============================================================
# Figure 10: Document Structure Analysis Flowchart
# ============================================================
def fig10_structure_analysis():
    fig, ax = plt.subplots(1, 1, figsize=(12, 9))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 9)
    ax.axis('off')
    ax.set_title('【도 10】 문서 구조 분석 기반 문맥 인식 프롬프트 구성 흐름도', fontsize=12, fontweight='bold', pad=15)

    # Start
    draw_box(ax, 4.5, 8.2, 3, 0.6, '문서 객체 모델 입력', '#E8EDF2', C_ACCENT, 9, True)
    draw_arrow(ax, 6, 8.2, 6, 7.8)

    steps = [
        ('S121-1', '반복 패턴 탐지', '번호 매기기, 날짜 형식, 제목 서식\n반복 구조 인식', 7.0),
        ('S121-2', '헤더-데이터 셀 구분', '서식 기반 구분 (볼드, 배경색)\n위치 기반 구분 (첫 행/열)\n내용 기반 구분 (키워드)', 5.6),
        ('S121-3', '테이블 교차참조 분석', '테이블 간 공유 헤더 탐지\n열/행 의미 관계 매핑', 4.2),
        ('S121-4', '문서 유형 판별', '월간보고서 | 주간보고서 | 교안\n회의록 | 기획서 | 기타', 2.8),
    ]

    for code, name, desc, y in steps:
        draw_box(ax, 1.5, y, 4, 0.9, '', '#F0F5FF', C_ACCENT)
        ax.text(1.8, y + 0.6, code, fontsize=7, fontweight='bold', color=C_ACCENT)
        ax.text(3.5, y + 0.6, name, fontsize=8.5, fontweight='bold', color=C_TEXT)
        ax.text(3.5, y + 0.2, desc, fontsize=6.5, color='#666')
        if y > 2.8:
            draw_arrow(ax, 3.5, y, 3.5, y - 0.45, color='#999')

    # Prompt builder
    draw_arrow(ax, 3.5, 2.8, 3.5, 2.3, color='#333')

    draw_box(ax, 1.5, 1.2, 4, 0.9, '', '#FFF5E6', '#CC8800')
    ax.text(3.5, 1.85, '프롬프트 빌더 (122)', ha='center', fontsize=9, fontweight='bold', color='#8B6914')
    ax.text(3.5, 1.45, '시스템 메시지 + 문서 유형 + 헤더-콘텐츠 맵 + 서식 패턴', ha='center', fontsize=7, color='#666')

    # Right side: Prompt structure
    draw_box(ax, 7.0, 4.0, 4.5, 4.5, '', '#F5F5F5', '#999')
    ax.text(9.25, 8.2, '구성된 프롬프트 구조', ha='center', fontsize=9, fontweight='bold', color='#555')

    prompt_parts = [
        ('시스템 메시지', '"문서 구조를 보존하면서\n내용만 변경하는 전문가"', '#E8EDF2'),
        ('문서 유형 컨텍스트', '"월간 업무보고서 형식"', '#E6F5E6'),
        ('헤더-콘텐츠 매핑', '{"추진실적": "...",\n "향후계획": "..."}', '#FFF5E6'),
        ('서식 패턴 샘플', '"- 항목별 불릿 사용\n  날짜: YYYY.MM.DD"', '#F5E6F5'),
    ]

    py = 7.5
    for name, content, color in prompt_parts:
        draw_box(ax, 7.3, py, 4, 0.85, '', color, '#CCC')
        ax.text(7.5, py + 0.55, name, fontsize=7.5, fontweight='bold', color='#555')
        ax.text(7.5, py + 0.15, content, fontsize=6.5, color='#888')
        py -= 1.05

    # Arrow to LLM
    draw_arrow(ax, 5.5, 1.65, 7.0, 1.65, color='#CC8800')
    draw_box(ax, 7.0, 1.2, 4.5, 0.9, 'LLM API 호출 (123)\nGPT-4o | Claude | DeepSeek\nJSON 응답 → 콘텐츠 병합', '#E6EEF5', C_ACCENT, 7.5)

    save_fig(fig, 'fig10_structure_analysis.png')


# ============================================================
# Main
# ============================================================
if __name__ == '__main__':
    print("Generating patent figures...")
    fig1_system_architecture()
    fig2_pipeline()
    fig3_paladin()
    fig4_korean_modules()
    fig5_truthanchor()
    fig6_scoring()
    fig7_compliance()
    fig8_hybrid()
    fig9_sequence()
    fig10_structure_analysis()
    print("\nAll 10 figures generated successfully!")
