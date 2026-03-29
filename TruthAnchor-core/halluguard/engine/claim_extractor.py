"""LLM 출력물에서 검증 가능한 클레임(주장)을 추출"""

import re
import structlog

logger = structlog.get_logger()


def extract_claims(text: str) -> list[str]:
    """텍스트에서 검증 가능한 클레임을 추출.

    전략:
    1. 문장 단위 분리
    2. 복합 문장은 절 단위 분리 (접속조사/연결어미 기준)
    3. 사실적 주장이 포함된 문장만 필터링 (의견/인사말 제외)
    """
    sentences = _split_sentences(text)
    claims = []

    for sent in sentences:
        sent = sent.strip()
        if not sent or len(sent) < 10:
            continue
        if _is_non_factual(sent):
            continue

        # 복합문 분리: 각 절이 독립적 사실 주장이면 분리
        sub_claims = _split_compound_sentence(sent)
        for sc in sub_claims:
            sc = sc.strip()
            if sc and len(sc) >= 10 and not _is_non_factual(sc):
                claims.append(sc)

    return claims


# 한국어 종결어미 확장 패턴
_SENTENCE_END_PATTERN = re.compile(
    r"(?<=[.!?。])\s+"               # 기본 구두점
    r"|(?<=다)\.\s+"                  # ~다.
    r"|(?<=요)\.\s+"                  # ~요.
    r"|(?<=죠)\.\s+"                  # ~죠.
    r"|(?<=니다)\s+"                  # ~습니다 ~합니다
    r"|(?<=니까)\s+"                  # ~니까
    r"|(?<=됩니다)\s+"               # ~됩니다
    r"|(?<=있다)\s+"                  # ~있다
    r"|(?<=없다)\s+"                  # ~없다
    r"|(?<=였다)\s+"                  # ~였다
    r"|(?<=했다)\s+"                  # ~했다
    r"|(?<=된다)\s+"                  # ~된다
    r"|(?<=이다)\s+"                  # ~이다
    r"|(?<=란다)\s+"                  # ~란다
    r"|(?<=한다)\s+"                  # ~한다
    r"|(?<=왔다)\s+"                  # ~왔다
    r"|(?<=같다)\s+"                  # ~같다
    r"|(?<=았다)\s+"                  # ~았다
    r"|(?<=겠다)\s+"                  # ~겠다
    r"|(?<=셨다)\s+"                  # ~셨다
)


def _split_sentences(text: str) -> list[str]:
    """텍스트를 문장 단위로 분리 (한국어 + 영어 지원)"""
    lines = text.split("\n")
    sentences = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 불릿/번호 접두사 제거
        line = re.sub(r"^[\s]*[-•*]\s+", "", line)
        line = re.sub(r"^[\s]*\d+[.)]\s+", "", line)

        parts = _SENTENCE_END_PATTERN.split(line)
        sentences.extend(parts)

    return sentences


# 복합문 분리용 접속 패턴
_COMPOUND_SPLITTERS = re.compile(
    r"(?<=\S),\s+(?=\S.{8,})"          # 쉼표 뒤 충분한 텍스트 (공백 포함 8자+)
    r"|(?<=고)\s+(?=\S.{6,})"          # ~고 (나열)
    r"|(?<=며)\s+(?=\S.{6,})"          # ~며 (나열)
    r"|(?<=으며)\s+(?=\S.{6,})"        # ~으며
    r"|;\s+"                            # 세미콜론
)


def _split_compound_sentence(sentence: str) -> list[str]:
    """복합문을 절 단위로 분리. 분리 불가하면 원문 그대로 반환."""
    # 짧은 문장은 분리하지 않음 (한국어는 압축적이므로 25자 기준)
    if len(sentence) < 25:
        return [sentence]

    parts = _COMPOUND_SPLITTERS.split(sentence)
    # 분리 결과가 1개이거나, 너무 짧은 조각이 있으면 원문 유지
    if len(parts) <= 1:
        return [sentence]

    result = []
    for part in parts:
        part = part.strip()
        if len(part) >= 10:
            result.append(part)
        elif result:
            # 짧은 조각은 이전 절에 병합
            result[-1] = result[-1] + ", " + part

    return result if result else [sentence]


def _is_non_factual(sentence: str) -> bool:
    """사실적 주장이 아닌 문장 필터링"""
    non_factual_patterns = [
        # 한국어 인사/감정 표현
        r"^(안녕|감사|죄송|수고|실례|네,|아,|음,|글쎄|아니요|예,|네 )",
        # 질문문
        r"\?$",
        r"(일까요|인가요|은가요|할까요|될까요|나요|을까요|ㄹ까요|맞을까요)\s*[.?]?\s*$",
        # 요청/명령문
        r"^(해주세요|알려주세요|부탁|확인해|설명해|찾아)",
        r"(해주세요|해 주세요|바랍니다|하시기 바랍니다|알려주세요|주세요)\s*\.?\s*$",
        # 영어 비사실 표현
        r"^(I think|In my opinion|Maybe|Perhaps|Personally|I believe|I feel)",
        r"^(Hello|Hi|Thanks|Sorry|Please|Could you|Would you|Can you)",
        # 접속사/전환어만으로 시작하는 불완전 문장
        r"^(그리고|또한|하지만|그러나|따라서|그래서|즉,|예를 들어)\s*$",
        # 순수 목록 헤더
        r"^(다음과 같|아래와 같|아래를 참|다음을 참)",
    ]
    for pattern in non_factual_patterns:
        if re.search(pattern, sentence, re.IGNORECASE):
            return True
    return False
