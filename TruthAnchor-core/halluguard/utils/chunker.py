"""문서 텍스트 청킹 유틸리티"""

import re


def chunk_text(
    text: str,
    max_chunk_size: int = 500,
    overlap: int = 50,
) -> list[dict]:
    """텍스트를 의미 단위로 청킹.

    Returns:
        list of {"text": str, "index": int, "start_char": int, "end_char": int}
    """
    if not text.strip():
        return []

    # 단락 기준으로 먼저 분리
    paragraphs = re.split(r"\n\s*\n", text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks = []
    current_chunk = ""
    current_start = 0
    char_pos = 0

    for para in paragraphs:
        if len(current_chunk) + len(para) + 1 <= max_chunk_size:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
                current_start = char_pos
        else:
            if current_chunk:
                chunks.append({
                    "text": current_chunk,
                    "index": len(chunks),
                    "start_char": current_start,
                    "end_char": current_start + len(current_chunk),
                })
            # 긴 단락은 문장 단위로 분할
            if len(para) > max_chunk_size:
                sub_chunks = _split_long_paragraph(para, max_chunk_size, overlap)
                for sc in sub_chunks:
                    chunks.append({
                        "text": sc,
                        "index": len(chunks),
                        "start_char": char_pos,
                        "end_char": char_pos + len(sc),
                    })
                current_chunk = ""
            else:
                current_chunk = para
                current_start = char_pos

        char_pos += len(para) + 2  # +2 for \n\n

    if current_chunk:
        chunks.append({
            "text": current_chunk,
            "index": len(chunks),
            "start_char": current_start,
            "end_char": current_start + len(current_chunk),
        })

    return chunks


def _split_long_paragraph(text: str, max_size: int, overlap: int) -> list[str]:
    """긴 단락을 문장 단위로 분할"""
    sentences = re.split(r"(?<=[.!?。])\s+", text)
    chunks = []
    current = ""

    for sent in sentences:
        if len(current) + len(sent) + 1 <= max_size:
            current = f"{current} {sent}".strip() if current else sent
        else:
            if current:
                chunks.append(current)
            current = sent

    if current:
        chunks.append(current)

    return chunks
