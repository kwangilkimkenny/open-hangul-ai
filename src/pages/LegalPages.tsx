/**
 * Legal Pages
 * 이용약관, 개인정보처리방침, 환불정책 (단일 파일)
 */
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';

const PAGES: Record<string, { title: string; updated: string; sections: Array<{ heading: string; body: string }> }> = {
  terms: {
    title: '이용약관',
    updated: '2026년 4월 11일',
    sections: [
      { heading: '제1조 (목적)', body: '본 약관은 OpenHangul AI(이하 "회사")가 제공하는 오픈한글 AI 문서 편집 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.' },
      { heading: '제2조 (정의)', body: '"서비스"란 회사가 제공하는 웹 기반 문서 편집기, AI 어시스턴트, 클라우드 저장 등 일체의 기능을 의미합니다.\n"이용자"란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.\n"회원"이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 회사가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.' },
      { heading: '제3조 (약관의 게시와 개정)', body: '회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.\n회사는 약관의 규제에 관한 법률, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련법을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.\n회사가 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 서비스 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.' },
      { heading: '제4조 (서비스의 제공)', body: '회사는 다음과 같은 서비스를 제공합니다:\n1. HWPX, DOCX, XLSX, PDF, PPTX, ODT, ODS, Markdown 등 멀티포맷 문서 편집\n2. GPT 기반 AI 문서 편집 어시스턴트\n3. 변경 추적, 댓글, 협업 기능\n4. 클라우드 문서 저장 및 동기화\n5. 기타 회사가 추가 개발하거나 다른 회사와의 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스' },
      { heading: '제5조 (이용계약의 체결)', body: '이용계약은 이용자가 약관의 내용에 대하여 동의를 한 후 회원가입신청을 하고 회사가 이러한 신청에 대하여 승낙함으로써 체결됩니다.' },
      { heading: '제6조 (회원의 의무)', body: '회원은 다음 행위를 하여서는 안 됩니다:\n1. 신청 또는 변경 시 허위내용의 등록\n2. 타인의 정보 도용\n3. 회사가 게시한 정보의 변경\n4. 회사 및 기타 제3자의 저작권 등 지적재산권에 대한 침해\n5. 회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위\n6. 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위' },
      { heading: '제7조 (서비스 이용료)', body: '회사가 제공하는 서비스는 무료 플랜(Free)과 유료 플랜(Personal, Business, Enterprise)으로 구성됩니다.\n유료 플랜의 요금 및 결제 방식은 요금제 페이지에서 확인할 수 있으며, 이용자는 결제 시 본 약관 및 환불정책에 동의하는 것으로 간주됩니다.' },
      { heading: '제8조 (책임 제한)', body: '회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.\n회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.\nAI 생성 콘텐츠의 정확성, 적합성에 대해 회사는 보증하지 않으며, 이용자는 AI 결과물을 검토 후 사용해야 합니다.' },
      { heading: '제9조 (분쟁해결)', body: '본 약관과 관련하여 발생한 분쟁에 대해서는 대한민국 법을 준거법으로 하며, 서울중앙지방법원을 제1심 관할법원으로 합니다.' },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    updated: '2026년 4월 11일',
    sections: [
      { heading: '1. 개인정보의 수집 및 이용 목적', body: '회사는 다음의 목적을 위하여 개인정보를 처리하며, 다음의 목적 이외의 용도로는 이용하지 않습니다:\n- 회원가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 개인식별, 부정이용 방지\n- 서비스 제공: 콘텐츠 제공, 맞춤서비스 제공, 본인인증\n- 결제 및 정산: 요금결제, 환불, 청구서 발송\n- 마케팅 및 광고에의 활용 (선택 동의 시)' },
      { heading: '2. 수집하는 개인정보 항목', body: '필수 항목: 이메일 주소, 비밀번호(암호화 저장), 이름\n자동 수집 항목: IP 주소, 쿠키, 서비스 이용 기록, 접속 로그, 기기 정보\n결제 시: 결제 내역 (카드사/계좌 정보는 결제대행사가 직접 처리하며 회사는 저장하지 않음)' },
      { heading: '3. 개인정보의 보유 및 이용기간', body: '회원 탈퇴 시 즉시 파기를 원칙으로 합니다. 단, 다음의 정보는 관련 법령에 따라 일정 기간 보관됩니다:\n- 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)\n- 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)\n- 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)\n- 로그인 기록: 3개월 (통신비밀보호법)' },
      { heading: '4. 개인정보의 제3자 제공', body: '회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 다음의 경우 예외로 합니다:\n- 이용자가 사전에 동의한 경우\n- 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우\n- 결제 처리를 위해 토스페이먼츠(주), 카카오페이(주)에 결제 정보 전달' },
      { heading: '5. 개인정보 처리의 위탁', body: '회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다:\n- Supabase Inc. (DB 호스팅, 인증)\n- Toss Payments(주) (결제 처리)\n- Kakao Pay Corp. (결제 처리)\n- OpenAI (AI API 호출 — PII 마스킹 후 전달)' },
      { heading: '6. 정보주체의 권리·의무', body: '이용자는 언제든지 다음의 권리를 행사할 수 있습니다:\n- 개인정보 열람 요구\n- 오류 등이 있을 경우 정정 요구\n- 삭제 요구\n- 처리정지 요구\n위 권리 행사는 회사에 대해 서면, 전자우편(privacy@hanview.ai)을 통하여 하실 수 있으며, 회사는 이에 대해 지체없이 조치하겠습니다.' },
      { heading: '7. 개인정보의 안전성 확보 조치', body: '회사는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적/관리적 및 물리적 조치를 하고 있습니다:\n- 비밀번호의 단방향 암호화 저장 (bcrypt)\n- 전송구간 TLS 1.3 암호화\n- AEGIS 보안 게이트웨이를 통한 PII 자동 탐지 및 마스킹\n- 접근 권한 관리 (Row Level Security)\n- 접속기록의 보관 및 위변조 방지' },
      { heading: '8. 개인정보 보호책임자', body: '개인정보 보호책임자: OpenHangul AI 데이터보호팀\n이메일: privacy@hanview.ai\n이용자는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다.' },
    ],
  },
  refund: {
    title: '환불정책',
    updated: '2026년 4월 11일',
    sections: [
      { heading: '1. 환불 원칙', body: '회사는 「전자상거래 등에서의 소비자보호에 관한 법률」 및 관련 법령에 따라 이용자의 환불 요청을 처리합니다.' },
      { heading: '2. 청약철회 (전액 환불)', body: '유료 플랜 결제 후 7일 이내, 서비스를 사용하지 않은 경우 100% 전액 환불됩니다.\n청약철회는 마이페이지 또는 support@hanview.ai로 요청 가능합니다.' },
      { heading: '3. 일부 사용 후 환불', body: '월간 플랜: 결제 후 7일 이내 사용했더라도 사용량에 비례하여 일할 환불\n연간 플랜: 사용한 월수에 대해 월 정상가 기준으로 차감 후 잔액 환불\n예시: 연 99,000원 결제 후 3개월 사용 → 99,000 - (9,900 × 3) = 69,300원 환불' },
      { heading: '4. 환불 불가 사유', body: '다음의 경우 환불이 제한됩니다:\n- 결제 후 30일이 경과한 경우 (월간 플랜)\n- 약관 위반으로 서비스가 중지된 경우\n- 무료 플랜에서 발생한 사용 (환불할 금액 없음)\n- AI 크레딧을 80% 이상 소진한 경우' },
      { heading: '5. 환불 절차 및 처리 기간', body: '1. 마이페이지 > 결제 내역 > 환불 요청 클릭\n2. 환불 사유 입력 후 제출\n3. 영업일 기준 3-5일 내 검토\n4. 승인 시 결제 수단에 따라 7-14일 내 환불 처리\n   - 신용카드: 결제 취소 (카드사 정책에 따라 최대 1개월 소요)\n   - 계좌이체: 입금 계좌로 송금\n   - 카카오페이/토스페이: 결제 수단으로 즉시 환불' },
      { heading: '6. 자동 결제 해지', body: '정기 결제 해지는 마이페이지 > 구독 관리에서 언제든지 가능합니다.\n해지 후에도 현재 결제 주기 종료일까지는 서비스를 이용할 수 있습니다.\n해지 후 환불은 위 "일부 사용 후 환불" 정책을 따릅니다.' },
      { heading: '7. 분쟁 해결', body: '환불 관련 분쟁이 발생할 경우 다음 기관을 통해 조정을 신청할 수 있습니다:\n- 한국소비자원: www.kca.go.kr / 1372\n- 전자거래분쟁조정위원회: www.ecmc.or.kr\n- 공정거래위원회: www.ftc.go.kr' },
      { heading: '문의', body: '환불 관련 문의: support@hanview.ai\n응답 시간: 영업일 기준 24시간 이내' },
    ],
  },
};

export function LegalPage() {
  const { type } = useParams<{ type: string }>();
  const page = PAGES[type || 'terms'];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  if (!page) {
    return (
      <div>
        <PublicHeader />
        <div style={{ padding: 80, textAlign: 'center' }}>
          <h1>페이지를 찾을 수 없습니다</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="legal-page">
      <PublicHeader />

      <div className="legal-container">
        <div className="legal-content">
          <h1>{page.title}</h1>
          <p className="updated">최종 업데이트: {page.updated}</p>

          {page.sections.map((section, idx) => (
            <section key={idx}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>

      <PublicFooter />

      <style>{`
        .legal-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
          background: #fff;
          min-height: 100vh;
        }
        .legal-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 60px 32px 80px;
        }
        .legal-content h1 {
          font-size: 36px;
          font-weight: 800;
          margin: 0 0 8px;
          color: #111;
          letter-spacing: -0.5px;
        }
        .updated {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 48px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
        }
        .legal-content section {
          margin-bottom: 36px;
        }
        .legal-content h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 12px;
          color: #111;
        }
        .legal-content p {
          font-size: 14px;
          line-height: 1.8;
          color: #4b5563;
          margin: 0;
          white-space: pre-line;
        }
      `}</style>
    </div>
  );
}

export default LegalPage;
