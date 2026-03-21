/**
 * Simple i18n System
 * 한국어/영어 지원을 위한 경량 국제화 모듈
 *
 * @module lib/i18n
 * @version 1.0.0
 */

type Locale = 'ko' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  ko: {
    // 파일 메뉴
    'menu.file': '파일(F)',
    'menu.edit': '편집(E)',
    'menu.view': '보기(V)',
    'menu.insert': '삽입(I)',
    'menu.format': '서식(O)',
    'menu.tools': '도구(T)',
    'file.new': '새 문서',
    'file.open': '열기',
    'file.save': '저장',
    'file.saveAs': '다른 이름으로 저장',
    'file.exportPdf': 'PDF로 내보내기',
    'file.print': '인쇄',
    'file.docInfo': '문서 정보',
    // 편집 메뉴
    'edit.undo': '실행 취소',
    'edit.redo': '다시 실행',
    'edit.cut': '잘라내기',
    'edit.copy': '복사',
    'edit.paste': '붙여넣기',
    'edit.find': '찾기',
    'edit.replace': '찾아 바꾸기',
    // 보기 메뉴
    'view.zoomIn': '확대',
    'view.zoomOut': '축소',
    'view.zoomReset': '100%',
    'view.editMode': '편집 모드 전환',
    'view.darkMode': '다크 모드 전환',
    // 삽입 메뉴
    'insert.table': '표 삽입 (3x3)',
    'insert.image': '그림 삽입',
    'insert.specialChar': '특수 문자',
    'insert.bullet': '글머리 기호',
    'insert.numbering': '번호 매기기',
    'insert.removeList': '목록 제거',
    'insert.pageBreak': '페이지 나누기',
    'insert.header': '머리글 편집',
    'insert.footer': '바닥글 편집',
    'insert.footnote': '각주 삽입',
    // 서식
    'format.bold': '굵게',
    'format.italic': '기울임',
    'format.underline': '밑줄',
    'format.strikethrough': '취소선',
    'format.alignLeft': '왼쪽 정렬',
    'format.alignCenter': '가운데 정렬',
    'format.alignRight': '오른쪽 정렬',
    'format.alignJustify': '양쪽 정렬',
    // 도구
    'tools.editMode': '편집 모드 전환',
    'tools.validate': '문서 검증',
    'tools.shortcuts': '키보드 단축키',
    // 리본 탭
    'tab.home': '홈',
    'tab.insert': '삽입',
    'tab.format': '서식',
    'tab.tools': '도구',
    'tab.view': '보기',
    'tab.ai': 'AI',
    // 리본 그룹
    'group.font': '글꼴',
    'group.paragraph': '단락',
    'group.editing': '편집',
    'group.charFormat': '글자 모양',
    'group.superSub': '첨자',
    'group.alignment': '문단 정렬',
    'group.lineSpacing': '줄 간격',
    // 상태바
    'status.page': '페이지',
    'status.chars': '글자',
    'status.insert': '삽입',
    'status.overwrite': '수정',
    // 메시지
    'msg.saved': '저장 완료',
    'msg.saving': '저장 중...',
    'msg.saveFailed': '저장 실패',
    'msg.newDoc': '새 문서가 생성되었습니다',
    'msg.noDoc': '문서가 없습니다',
    'msg.loadComplete': '문서 로드 완료!',
    'msg.loading': '문서 로드 중',
    'msg.pleaseWait': '잠시만 기다려주세요...',
    'msg.unsavedChanges': '저장하지 않은 변경사항이 있습니다.',
    'msg.skipToContent': '본문으로 건너뛰기',
  },
  en: {
    'menu.file': 'File(F)',
    'menu.edit': 'Edit(E)',
    'menu.view': 'View(V)',
    'menu.insert': 'Insert(I)',
    'menu.format': 'Format(O)',
    'menu.tools': 'Tools(T)',
    'file.new': 'New Document',
    'file.open': 'Open',
    'file.save': 'Save',
    'file.saveAs': 'Save As',
    'file.exportPdf': 'Export as PDF',
    'file.print': 'Print',
    'file.docInfo': 'Document Info',
    'edit.undo': 'Undo',
    'edit.redo': 'Redo',
    'edit.cut': 'Cut',
    'edit.copy': 'Copy',
    'edit.paste': 'Paste',
    'edit.find': 'Find',
    'edit.replace': 'Find & Replace',
    'view.zoomIn': 'Zoom In',
    'view.zoomOut': 'Zoom Out',
    'view.zoomReset': '100%',
    'view.editMode': 'Toggle Edit Mode',
    'view.darkMode': 'Toggle Dark Mode',
    'insert.table': 'Insert Table (3x3)',
    'insert.image': 'Insert Image',
    'insert.specialChar': 'Special Characters',
    'insert.bullet': 'Bullet List',
    'insert.numbering': 'Numbered List',
    'insert.removeList': 'Remove List',
    'insert.pageBreak': 'Page Break',
    'insert.header': 'Edit Header',
    'insert.footer': 'Edit Footer',
    'insert.footnote': 'Insert Footnote',
    'format.bold': 'Bold',
    'format.italic': 'Italic',
    'format.underline': 'Underline',
    'format.strikethrough': 'Strikethrough',
    'format.alignLeft': 'Align Left',
    'format.alignCenter': 'Align Center',
    'format.alignRight': 'Align Right',
    'format.alignJustify': 'Justify',
    'tools.editMode': 'Toggle Edit Mode',
    'tools.validate': 'Validate Document',
    'tools.shortcuts': 'Keyboard Shortcuts',
    'tab.home': 'Home',
    'tab.insert': 'Insert',
    'tab.format': 'Format',
    'tab.tools': 'Tools',
    'tab.view': 'View',
    'tab.ai': 'AI',
    'group.font': 'Font',
    'group.paragraph': 'Paragraph',
    'group.editing': 'Editing',
    'group.charFormat': 'Character',
    'group.superSub': 'Script',
    'group.alignment': 'Alignment',
    'group.lineSpacing': 'Line Spacing',
    'status.page': 'Page',
    'status.chars': 'Chars',
    'status.insert': 'INS',
    'status.overwrite': 'OVR',
    'msg.saved': 'Saved',
    'msg.saving': 'Saving...',
    'msg.saveFailed': 'Save failed',
    'msg.newDoc': 'New document created',
    'msg.noDoc': 'No document loaded',
    'msg.loadComplete': 'Document loaded!',
    'msg.loading': 'Loading document',
    'msg.pleaseWait': 'Please wait...',
    'msg.unsavedChanges': 'You have unsaved changes.',
    'msg.skipToContent': 'Skip to content',
  },
};

let currentLocale: Locale = 'ko';

/** 현재 로케일 설정 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/** 현재 로케일 반환 */
export function getLocale(): Locale {
  return currentLocale;
}

/** 번역 문자열 반환 */
export function t(key: string, fallback?: string): string {
  return translations[currentLocale]?.[key] || translations.ko[key] || fallback || key;
}

/** 사용 가능한 로케일 목록 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(translations) as Locale[];
}

export default { t, setLocale, getLocale, getAvailableLocales };
