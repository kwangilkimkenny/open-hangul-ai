# AEGIS & TruthAnchor 기술 명세서

**OpenHangul AI 에디터 보안·검증 통합 아키텍처**

| 항목 | 내용 |
|------|------|
| 문서 버전 | 2.0.0 |
| 최종 갱신일 | 2026-03-29 |
| 대상 애플리케이션 | OpenHangul AI (hanview-react-app v2.0.0) |

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [AEGIS — AI 보안 게이트웨이](#2-aegis--ai-보안-게이트웨이)
3. [TruthAnchor — 할루시네이션 검증 엔진](#3-truthanchor--할루시네이션-검증-엔진)
4. [통합 파이프라인](#4-통합-파이프라인)
5. [도메인별 가드레일 상세](#5-도메인별-가드레일-상세)
6. [수치 교차검증 상세](#6-수치-교차검증-상세)
7. [검증 리포트 및 교정 적용](#7-검증-리포트-및-교정-적용)
8. [설정 및 환경변수](#8-설정-및-환경변수)
9. [파일 구조 및 버전](#9-파일-구조-및-버전)

---

## 1. 시스템 개요

OpenHangul AI 에디터는 **AEGIS**(AI 보안)와 **TruthAnchor**(할루시네이션 검증) 두 시스템을 통합하여, 사용자가 참조 문서를 기반으로 AI 콘텐츠를 생성할 때 **입출력 보안**과 **사실 정확성**을 동시에 보장합니다.

```
사용자 입력
    │
    ▼
┌─────────────────────────────────┐
│  AEGIS 입력 검사                │
│  - 프롬프트 인젝션 탐지         │
│  - PII 자동 마스킹              │
│  - 위험도 점수 산출              │
├─────────────────────────────────┤
│  결과: APPROVE / BLOCK          │
└──────────────┬──────────────────┘
               │ APPROVE
               ▼
┌─────────────────────────────────┐
│  LLM API 호출 (OpenAI 등)       │
│  - 마스킹된 프롬프트 전달        │
│  - AI 응답 수신                  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  AEGIS 출력 검사                │
│  - 응답 내 PII 노출 확인        │
│  - 유해 콘텐츠 차단             │
│  - PII 복원 (역마스킹)          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  TruthAnchor 검증               │
│  - 할루시네이션 감지 (97%+)      │
│  - 문장별 신뢰도 점수            │
│  - 인용 출처 첨부               │
│  - 수치 교차검증                │
│  - 교정 제안 생성               │
└──────────────┬──────────────────┘
               │
               ▼
        브라우저에 결과 표시
        - 신뢰도 인디케이터
        - 인용 사이드 패널
        - 위반 항목 하이라이트
```

---

## 2. AEGIS — AI 보안 게이트웨이

### 2.1 개요

| 항목 | 값 |
|------|-----|
| SDK 버전 | 5.2.0 |
| 통합 래퍼 | SecurityGateway v1.0.0 |
| 동작 모드 | Offline (로컬 패턴 기반) |
| 위치 | `packages-aegis/aegis-sdk/` |
| 래퍼 | `src/lib/vanilla/ai/security-gateway.js` |

### 2.2 핵심 기능

#### 2.2.1 프롬프트 인젝션 탐지

다층 방어 체계로 AI 시스템에 대한 공격을 차단합니다.

| 방어 계층 | 모듈 | 역할 |
|-----------|------|------|
| Trust Boundary | `trust-boundary.ts` | 신뢰 경계 검증 |
| Intent Verification | `intent-verification.ts` | 사용자 의도 분석 |
| Circuit Breaker | `circuit-breaker.ts` | 장애 격리 |
| Behavioral Analysis | `behavioral-analysis.ts` | 행동 이상 탐지 |
| Paladin | `paladin.ts` | 다층 방어 오케스트레이터 |

**탐지 대상 패턴 (11개 카테고리):**
- 프롬프트 인젝션 (`prompt-injection.ts`)
- 탈옥 시도 (`jailbreak.ts`)
- 코드 인젝션 (`code-injection.ts`)
- 사회공학 (`social-engineering.ts`)
- 정보 추출 (`info-extraction.ts`)
- 인코딩 우회 (`encoding.ts`)
- 롤플레이 조작 (`roleplay.ts`)
- 음향 기반 공격 (`acoustic.ts`)
- 유니코드 호모글리프 (`homoglyphs.ts`)
- 자격 증명 패턴 (`credentials.ts`)
- 한국어/CJK 전용 방어 (16개 모듈: 자모 분해, 키보드 매핑, 코드 스위칭 등)

#### 2.2.2 PII 마스킹 및 의사난수화

| 기능 | 설명 |
|------|------|
| PII 스캐너 | 주민번호, 전화번호, 이메일, 주소 등 자동 탐지 |
| 의사난수화 | 형식 보존 암호화 (Format-Preserving Encryption) |
| 세션 기반 복원 | LLM 응답 수신 후 원본 PII 자동 복원 |
| DLP 게이트웨이 | 데이터 유출 방지 |

```
원본: "김지은 차장 (759-4315)"
  ↓ 마스킹
전송: "이OO 차장 (000-0000)"
  ↓ LLM 처리
  ↓ 복원
결과: "김지은 차장 (759-4315)"
```

#### 2.2.3 출력 필터링

- **자격 증명 누출 탐지** — API 키, 토큰, 비밀번호 패턴 감지
- **유해 콘텐츠 차단** — 부적절한 콘텐츠 필터링
- **스트리밍 필터** — 실시간 스트림 응답에서도 보안 적용

### 2.3 SecurityGateway API

```javascript
class SecurityGateway {
    // 입력 스캔 (LLM 전송 전)
    scanInput(text) → {
        allowed: boolean,    // 허용 여부
        score: number,       // 위험도 점수 (0-100)
        reason: string,      // 차단 사유
        categories: string[] // 탐지 카테고리
    }

    // 출력 필터링 (LLM 응답 후)
    filterOutput(text) → {
        safe: boolean,       // 안전 여부
        filtered: string,    // 필터링된 텍스트
        detections: object[] // 탐지 항목
    }

    // PII 의사난수화
    pseudonymize(text) → {
        pseudonymized: string, // 마스킹된 텍스트
        sessionId: string,     // 복원용 세션 ID
        changed: boolean       // 변경 여부
    }

    // PII 복원
    restore(text, sessionId) → string
}
```

---

## 3. TruthAnchor — 할루시네이션 검증 엔진

### 3.1 개요

| 항목 | 값 |
|------|-----|
| 엔진 버전 | 2.0.0 |
| 동작 모드 | Online (서버) / Offline (JS 자동 폴백) |
| 지원 언어 | 한국어 + 영어 (이중 언어) |
| 지원 도메인 | general, finance, medical, education, defense, admin |
| 위치 | `src/lib/vanilla/ai/truthanchor-offline.js` |
| 클라이언트 | `src/lib/vanilla/ai/truthanchor-client.js` |

### 3.2 검증 파이프라인

```
AI 생성 텍스트
    │
    ├─ 1. 클레임 추출 (extractClaims)
    │   - 한국어 문장 분리 (다/요/죠/니다 등)
    │   - 복합문 분해 (고/며/으며 접속)
    │   - 비사실적 문장 필터링 (인사/질문/요청)
    │
    ├─ 2. 원본 문서 청킹 (chunkText)
    │   - 문단 기반 분할
    │   - 단일 문단 시 줄 단위 분할
    │
    ├─ 3. 각 클레임 검증
    │   │
    │   ├─ 3a. 가드레일 검사 (CRITICAL)
    │   │   └─ 위반 시 → contradicted (0.97)
    │   │
    │   ├─ 3b. 근거 매칭 (matchEvidence)
    │   │   └─ 키워드(50%) + N-gram(30%) + 시퀀스(20%)
    │   │
    │   ├─ 3c. 수치 교차검증 (crossVerifyNumerics)
    │   │   └─ 불일치 시 → contradicted (0.92) + 교정 생성
    │   │
    │   ├─ 3d. 가드레일 검사 (HIGH)
    │   │   └─ 위반 시 → contradicted (0.90)
    │   │
    │   └─ 3e. 근거 점수 판정
    │       ├─ ≥ 0.5 → supported
    │       └─ < 0.5 → neutral
    │
    └─ 4. 결과 산출
        - overallScore = supported / totalClaims
        - numericalAccuracy = 1 - (contradicted / total)
        - evidenceReliability = avg(confidence)
```

### 3.3 오탐 방지 핵심 메커니즘

TruthAnchor v2.0에서 해결한 주요 오탐 패턴:

#### 3.3.1 절대값 vs 변동폭 구분 (% vs %p)

| 문제 | 해결 |
|------|------|
| "수신금리 2.83%"와 "전월 대비 0.05%p"를 동일 유형으로 비교 | `%p` 패턴을 `%`보다 먼저 매칭, 별도 단위 그룹으로 분리 |
| "increased by 0.5%"가 절대값으로 인식 | `CHANGE_CONTEXT_PATTERN`으로 변동폭 문맥 감지 후 `%p`로 승격 |

**변동폭 감지 키워드 (한/영):**
- 한국어: 대비, 변동, 상승, 하락, 인상, 인하, 축소, 확대, 증가, 감소
- 영어: increased by, decreased by, rose by, fell by, growth of, gain of, rising, declining

#### 3.3.2 보고기간 vs 발표일 날짜 역할 구분

| 문제 | 해결 |
|------|------|
| "2월 금리 보고서"(보고기간)를 "3월 27일 발표"(발표일)와 비교하여 오탐 | `dateRole` 속성으로 날짜 역할 분류, 다른 역할끼리 매칭 차단 |

**역할 판별 키워드:**
- 보고기간: 보고, 통계, 기준, 월중, 분기 / report, data, statistics, fiscal, period
- 발표일: 발표, 공보, 조간, 보도, 배포 / published, released, issued, posted

#### 3.3.3 세부 지표 문맥 분리 (subContext)

| 문제 | 해결 |
|------|------|
| 같은 "금리" 문맥의 수신금리(2.83%)와 대출금리(4.26%)를 비교 | `subContext` 패턴으로 세부 지표 식별, 다른 지표끼리 매칭 차단 |
| 수축기 혈압과 이완기 혈압 혼동 | 의료 subContext 패턴으로 분리 |

**subContext 근접 매칭 알고리즘:**
- 숫자 위치 기준 앞 120자 / 뒤 30자 범위에서 탐색
- 숫자 **앞**에 위치한 지표명이 우선 (가중 페널티: 뒤에 있으면 +200)
- 가장 가까운 지표명이 해당 수치의 subContext로 결정

---

## 4. 통합 파이프라인

### 4.1 AI Controller 실행 흐름

`ai-controller.js` (v2.1.0)에서 AEGIS와 TruthAnchor를 순차적으로 호출합니다.

```javascript
async handleUserRequest(userMessage) {
    // Phase 1: AEGIS 입력 보안
    if (securityGateway.isEnabled()) {
        const scan = securityGateway.scanInput(userMessage);
        if (!scan.allowed) return { blocked: true, reason: scan.reason };

        const pii = securityGateway.pseudonymize(userMessage);
        userMessage = pii.pseudonymized;
    }

    // Phase 2: 문서 구조 추출 + LLM 생성
    const pairs = extractor.extractTableHeaderContentPairs(document);
    const generated = await generateStructuredContent(pairs, userMessage);

    // Phase 3: AEGIS 출력 필터 + PII 복원
    if (securityGateway.isEnabled()) {
        const filtered = securityGateway.filterOutput(generated);
        generated = securityGateway.restore(filtered, piiSessionId);
    }

    // Phase 4: 문서 병합 + 렌더링
    const merged = mergeStructuredContent(document, generated, pairs);
    await viewer.updateDocument(merged);

    // Phase 5: TruthAnchor 검증 (비차단)
    if (truthAnchorClient.isEnabled()) {
        const validation = await truthAnchorClient.validate(
            sourceText, llmOutput, domain
        );
        return { success: true, validation };
    }
}
```

### 4.2 모드 선택 흐름 (TruthAnchor)

```
TruthAnchorClient.validate()
    │
    ├─ 서버 상태 확인 (GET /health, 5초 타임아웃)
    │
    ├─ 서버 가용 → Online 검증
    │   └─ POST /api/v2/validate
    │       { source_text, llm_output, domain }
    │
    └─ 서버 불가 → Offline 폴백
        └─ validateOffline(sourceText, llmOutput, domain)
            - 동적 import로 지연 로딩
            - 전체 JS 엔진 로컬 실행
```

---

## 5. 도메인별 가드레일 상세

### 5.1 전체 규칙 현황

| 도메인 | 한국어 규칙 | 영어 규칙 | 합계 | 심각도 분포 |
|--------|:---------:|:--------:|:----:|-----------|
| **공통 (general)** | 10 | 8 | 18 | CRITICAL: 5, HIGH: 4, MEDIUM: 4, EN-CRITICAL: 3, EN-HIGH: 2 |
| **금융 (finance)** | 8 | 0 | 8 | HIGH: 7, MEDIUM: 1 |
| **의료 (medical)** | 10 | 5 | 15 | CRITICAL: 4, HIGH: 6, EN-CRITICAL: 3, EN-HIGH: 1 |
| **교육 (education)** | 8 | 2 | 10 | CRITICAL: 1, HIGH: 5, MEDIUM: 2, EN-CRITICAL: 1, EN-HIGH: 1 |
| **국방 (defense)** | 8 | 3 | 11 | CRITICAL: 3, HIGH: 5, EN-CRITICAL: 2, EN-HIGH: 1 |
| **행정 (admin)** | 10 | 3 | 13 | CRITICAL: 1, HIGH: 7, MEDIUM: 1, EN-CRITICAL: 1, EN-HIGH: 2 |
| **합계** | **54** | **21** | **75** | |

### 5.2 주요 규칙 예시

#### 공통 (general)

| ID | 심각도 | 탐지 대상 | 한/영 |
|----|--------|----------|-------|
| CG-001 | CRITICAL | 투자·매수·가입 권유 | KR |
| CG-002 | CRITICAL | 수익 보장 표현 | KR |
| CG-006 | CRITICAL | 개인정보(주민번호) 노출 | KR |
| CG-009 | CRITICAL | 미래 예측 단정 | KR |
| CG-E01 | CRITICAL | Investment solicitation | EN |
| CG-E02 | CRITICAL | Guaranteed returns | EN |
| CG-E04 | CRITICAL | Definitive prediction | EN |

#### 의료 (medical)

| ID | 심각도 | 탐지 대상 | 한/영 |
|----|--------|----------|-------|
| MG-001 | CRITICAL | 의약품 투여·복용 권유 | KR |
| MG-003 | CRITICAL | 부작용·금기사항 축소 | KR |
| MG-009 | CRITICAL | 무처방 사용 권유 | KR |
| MG-E01 | CRITICAL | Medication recommendation | EN |
| MG-E03 | CRITICAL | Side effect denial | EN |
| MG-005 | HIGH | 용량·투여량 정확성 | KR |

#### 국방 (defense)

| ID | 심각도 | 탐지 대상 | 한/영 |
|----|--------|----------|-------|
| DG-002 | CRITICAL | 군사 기밀 정보 노출 | KR |
| DG-004 | CRITICAL | 작전 계획 확정 표현 | KR |
| DG-008 | CRITICAL | 군사 시설 위치 노출 | KR |
| DG-E01 | CRITICAL | Classified info exposure | EN |
| DG-E02 | CRITICAL | Military location exposure | EN |

---

## 6. 수치 교차검증 상세

### 6.1 수치 패턴 추출 (13개 유형)

| 유형 | 패턴 예시 | 단위 |
|------|----------|------|
| 퍼센트포인트 | `0.05%p`, `퍼센트포인트` | `%p` |
| 퍼센트 | `2.83%`, `퍼센트` | `%` |
| 조 | `400조원` | `조원` |
| 억 | `500억달러` | `억달러` |
| 만 | `50만명` | `만명` |
| 의료 단위 | `140mmHg`, `500mg`, `250mL` | 원본 유지 |
| 일반 수량 | `100명`, `5년`, `12월` | 원본 유지 |
| 연도 | `2026년` | `년` |
| 날짜 | `2026년 2월` | `년월` |
| 영어 대규모 | `400 trillion won` | `trillion won` |
| 소수 | `3.14` | `number` |

### 6.2 세부지표 패턴 (subContext) — 95개

| 분야 | 한국어 | 영어 | 합계 | 주요 패턴 |
|------|:-----:|:----:|:----:|----------|
| 금융 | 11 | 6 | 17 | 수신금리, 대출금리, 금리차, deposit rate, lending rate |
| 의료 | 16 | 10 | 26 | 수축기혈압, 공복혈당, 1회투여량, systolic BP, fasting glucose |
| 교육 | 12 | 8 | 20 | 모집정원, 졸업학점, 등록금, enrollment quota, tuition |
| 국방 | 10 | 6 | 16 | 현역병력, 국방예산, 전사자, active duty, defense budget |
| 행정 | 10 | 6 | 16 | 세입예산, 주민등록인구, 투표율, revenue budget, voter turnout |
| **합계** | **59** | **36** | **95** | |

### 6.3 단위 호환성 그룹

같은 그룹 내 단위만 상호 비교됩니다. 그룹이 다르면 비교하지 않습니다.

```
[%]                              ← 절대 퍼센트
[%p]                             ← 퍼센트포인트 (변동폭)
[조원, 억원, 만원, 조달러, ...]   ← 한국어 금액
[명, 건, 개, 회, 만명, ...]      ← 수량
[년, 월, 일, 개월, 세, 년월]     ← 시간
[mg, mcg, μg, IU]               ← 의료 용량
[mL, cc]                         ← 의료 부피
[trillion *, billion *, million *] ← 영어 대규모 수치
```

### 6.4 값 비교 허용 오차

| 단위 | 허용 범위 | 비교 방식 |
|------|----------|----------|
| `%` | ±0.5% | 절대 차이 |
| `%p` | ±0.1%p | 절대 차이 |
| `년`, `년월` | 정확 일치 | 동등 비교 |
| 기타 | ±5% | 상대 비율 |

### 6.5 문맥 카테고리 (21개)

동일 카테고리 내 키워드는 호환 문맥으로 판단됩니다.

| 카테고리 | 포함 키워드 (한/영) |
|---------|-------------------|
| 금리 | 금리, 이율, 기준금리, interest rate, deposit rate, lending rate |
| 혈압 | 혈압, blood pressure |
| 혈당 | 혈당, 당화혈색소, glucose, blood sugar |
| 투여 | 용량, 투여량, dosage, dose |
| 병력 | 병력, 전력, troops, personnel, forces |
| 예산 | 예산, 세율, 세입, 세출, budget, revenue, expenditure |
| 인구 | 인구, 출생률, 사망률, population, mortality |
| 선거 | 투표율, 득표율, voter turnout, vote share |
| ... | *(총 21개 카테고리)* |

---

## 7. 검증 리포트 및 교정 적용

### 7.1 리포트 구조

```
┌──────────────────────────────────────────────────┐
│  [오프라인 검증] 할루시네이션 검증 리포트 (85점)    │
│  오프라인 모드: 수치 오류, 규제 위반 패턴 검출      │
├──────────────────────────────────────────────────┤
│  총 20건: 12 지지 / 2 모순 / 6 중립               │
├──────────────────────────────────────────────────┤
│  [지지] 본 통계는 금융기관이 해당 월 중 ...        │
│         근거: 원본 문서 해당 구절                   │
│                                                    │
│  [모순] 수신금리: 연 3.50%                         │
│         [수치 교차검증] 클레임 3.50% vs 근거 2.83%  │
│         교정: 수신금리: 연 2.83%                    │
│         [이 교정 적용]                              │
│                                                    │
│  [중립] 금리 동향을 잘 나타내는 지표입니다           │
├──────────────────────────────────────────────────┤
│  [모든 모순 교정 적용 (2건)]                       │
└──────────────────────────────────────────────────┘
```

### 7.2 판정 기준

| 판정 | 조건 | 신뢰도 | 색상 |
|------|------|--------|------|
| **지지 (supported)** | 근거 매칭 점수 ≥ 0.5 | min(0.85, 점수) | 초록 |
| **모순 (contradicted)** | 가드레일 위반 또는 수치 불일치 | 0.90~0.97 | 빨강 |
| **중립 (neutral)** | 근거 부족 또는 판단 불가 | 0.5 | 노랑 |

### 7.3 교정 적용 흐름

```
사용자가 [이 교정 적용] 클릭
    │
    ├─ 1. DOM 업데이트
    │   └─ TreeWalker로 텍스트 노드 탐색 → 원문 → 교정문 치환
    │
    ├─ 2. 문서 모델 업데이트
    │   └─ sections → paragraphs → runs → run.text 치환
    │   └─ tables → cells → elements → runs 치환
    │
    └─ 3. 수정 표시
        └─ autoSaveManager.markDirty()
```

### 7.4 점수 산출

```javascript
overallScore     = supportedClaims / totalClaims           // 0.0 ~ 1.0
factualAccuracy  = supportedClaims / totalClaims           // 사실 정확도
numericalAccuracy = 1 - (contradictedClaims / totalClaims) // 수치 정확도
evidenceReliability = avg(confidence scores)               // 근거 신뢰도
```

| 점수 범위 | 해석 |
|----------|------|
| 90~100 | 우수 — 대부분의 클레임이 근거와 일치 |
| 70~89 | 양호 — 일부 확인 필요 |
| 50~69 | 보통 — 혼합된 검증 결과 |
| 0~49 | 주의 — 다수의 미확인/모순 클레임 |

---

## 8. 설정 및 환경변수

### 8.1 AEGIS 설정

| 환경변수 | 기본값 | 설명 |
|---------|--------|------|
| `AEGIS_ENABLED` | `false` | AEGIS 활성화 여부 |
| `AEGIS_BLOCK_THRESHOLD` | `60` | 차단 기준 위험도 점수 (0~100) |
| `AEGIS_SENSITIVITY` | `1.0` | 탐지 민감도 배율 |

### 8.2 TruthAnchor 설정

| 환경변수 | 기본값 | 설명 |
|---------|--------|------|
| `TRUTHANCHOR_ENABLED` | `false` | TruthAnchor 활성화 여부 |
| `TRUTHANCHOR_DOMAIN` | `general` | 검증 도메인 |

**지원 도메인 값:**

| 값 | 적용 가드레일 | 적용 세부지표 |
|---|-------------|-------------|
| `general` | 공통 18개 | 공통 키워드만 |
| `finance` | 공통 + 금융 8개 | 금융 17개 |
| `medical` | 공통 + 의료 15개 | 의료 26개 |
| `education` | 공통 + 교육 10개 | 교육 20개 |
| `defense` | 공통 + 국방 11개 | 국방 16개 |
| `admin` | 공통 + 행정 13개 | 행정 16개 |

### 8.3 런타임 토글

```javascript
// AEGIS 활성/비활성
aiController.toggleAegis(true);

// TruthAnchor 활성/비활성
aiController.toggleTruthAnchor(true);

// 도메인 변경
AIConfig.security.truthAnchor.setDomain('medical');
```

---

## 9. 파일 구조 및 버전

### 9.1 핵심 파일

| 파일 | 버전 | 코드 행 | 역할 |
|------|------|--------|------|
| `src/lib/vanilla/ai/ai-controller.js` | 2.1.0 | ~2,100 | 전체 파이프라인 오케스트레이터 |
| `src/lib/vanilla/ai/truthanchor-offline.js` | 2.0.0 | ~835 | 오프라인 검증 엔진 (6도메인, 한/영) |
| `src/lib/vanilla/ai/truthanchor-client.js` | 2.0.0 | ~183 | 하이브리드 클라이언트 (온/오프 전환) |
| `src/lib/vanilla/ai/security-gateway.js` | 1.0.0 | ~149 | AEGIS SDK 래퍼 |
| `src/lib/vanilla/config/ai-config.js` | 2.1.0 | ~715 | 보안·AI 통합 설정 |
| `src/lib/vanilla/ui/chat-panel.js` | 3.0.0 | ~1,800 | 검증 리포트 UI |
| `packages-aegis/aegis-sdk/src/index.ts` | 5.2.0 | ~277 | AEGIS SDK 진입점 |

### 9.2 AEGIS SDK 모듈 구조

```
packages-aegis/aegis-sdk/src/
├── index.ts                    # SDK 진입점
├── aegis-client.ts             # REST 클라이언트
├── paladin.ts                  # 다층 방어 오케스트레이터
├── output-filter.ts            # 출력 필터
├── output-guard.ts             # 출력 가드
├── streaming-filter.ts         # 스트리밍 필터
├── session-tracker.ts          # 세션 추적
├── middleware.ts               # Express 미들웨어
├── retry.ts                    # 재시도 로직
├── layers/                     # 방어 계층 (4개)
│   ├── trust-boundary.ts
│   ├── intent-verification.ts
│   ├── circuit-breaker.ts
│   └── behavioral-analysis.ts
├── patterns/                   # 패턴 탐지 (11개)
│   ├── prompt-injection.ts
│   ├── jailbreak.ts
│   ├── code-injection.ts
│   ├── social-engineering.ts
│   ├── info-extraction.ts
│   ├── encoding.ts
│   ├── roleplay.ts
│   ├── acoustic.ts
│   ├── homoglyphs.ts
│   ├── credentials.ts
│   └── index.ts
├── privacy/                    # PII 보호 (3개)
│   ├── pii-scanner.ts
│   ├── pii-proxy.ts
│   └── dlp.ts
├── korean/                     # 한국어 방어 (16개)
│   ├── jamo.ts
│   ├── homoglyph.ts
│   ├── code-switching.ts
│   └── ...
├── ml/                         # ML 유틸리티 (6개)
├── saber/                      # 통계 방어 (3개)
├── anomaly/                    # 이상 탐지
├── watermark/                  # 워터마크
├── canary/                     # 카나리 토큰
├── steganography/              # 스테가노그래피
├── leakage/                    # 정보 유출 탐지
├── taint/                      # 오염 추적
├── session/                    # 세션 관리
├── provenance/                 # 출처 추적
└── adaptive/                   # 적응형 방어
```

### 9.3 에러 처리 및 폴백 전략

| 장애 상황 | 동작 |
|----------|------|
| AEGIS SDK 로드 실패 | 보안 비활성화, 차단 없음 (fail-open) |
| AEGIS 스캔 오류 | `allowed: true` 반환 |
| TruthAnchor 서버 불가 | 오프라인 JS 엔진 자동 폴백 |
| 오프라인 엔진 오류 | 빈 검증 결과 반환 (비차단) |
| API 키 미설정 | 사용자에게 설정 요청 |
| 잘못된 도메인 값 | `general`로 폴백 |
