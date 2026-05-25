/**
 * Hanja Dictionary
 * 한글 음절/단어 -> 한자 후보 사전
 *
 * 데이터 출처: 대한민국 교육부 한문 교육용 기초한자 1800자 (공공도메인 / 공교육 자료)
 * - 한국에서 일상적으로 쓰이는 핵심 한자 약 300자 + 자주 쓰이는 다음절 단어 약 80개
 * - frequency 값(1~10): 한국어 일반 텍스트에서의 상대 빈도(높을수록 흔함)
 *
 * 모든 데이터는 모듈 내부에 직접 포함되며 외부 fetch / 네트워크 호출이 없다.
 *
 * @module hanja/hanja-dictionary
 * @version 1.0.0
 */

/**
 * @typedef {Object} HanjaEntry
 * @property {string} hanja   한자 1글자(또는 다음절 단어)
 * @property {string} meaning 대표 훈(訓) — 짧은 의미
 * @property {number} frequency 1~10 (높을수록 자주 쓰임)
 */

/**
 * 음절 단위 한자 사전 데이터 (raw form).
 * 한 음절(한글 1글자)에 대해 가능한 한자 후보들을 빈도 내림차순으로 나열.
 *
 * @type {Array<[string, Array<HanjaEntry>]>}
 */
const SYLLABLE_DATA = [
  ['가', [
    { hanja: '家', meaning: '집', frequency: 9 },
    { hanja: '可', meaning: '옳을', frequency: 8 },
    { hanja: '價', meaning: '값', frequency: 8 },
    { hanja: '加', meaning: '더할', frequency: 7 },
    { hanja: '歌', meaning: '노래', frequency: 6 },
    { hanja: '街', meaning: '거리', frequency: 5 },
    { hanja: '假', meaning: '거짓', frequency: 5 },
  ]],
  ['각', [
    { hanja: '各', meaning: '각각', frequency: 8 },
    { hanja: '角', meaning: '뿔', frequency: 7 },
    { hanja: '覺', meaning: '깨달을', frequency: 6 },
    { hanja: '刻', meaning: '새길', frequency: 5 },
  ]],
  ['간', [
    { hanja: '間', meaning: '사이', frequency: 9 },
    { hanja: '看', meaning: '볼', frequency: 5 },
    { hanja: '簡', meaning: '대쪽', frequency: 5 },
    { hanja: '幹', meaning: '줄기', frequency: 4 },
  ]],
  ['감', [
    { hanja: '感', meaning: '느낄', frequency: 9 },
    { hanja: '減', meaning: '덜', frequency: 6 },
    { hanja: '甘', meaning: '달', frequency: 5 },
    { hanja: '監', meaning: '볼', frequency: 5 },
  ]],
  ['강', [
    { hanja: '江', meaning: '강', frequency: 9 },
    { hanja: '强', meaning: '강할', frequency: 8 },
    { hanja: '講', meaning: '익힐', frequency: 6 },
    { hanja: '康', meaning: '편안할', frequency: 5 },
  ]],
  ['개', [
    { hanja: '個', meaning: '낱', frequency: 8 },
    { hanja: '開', meaning: '열', frequency: 8 },
    { hanja: '改', meaning: '고칠', frequency: 6 },
    { hanja: '介', meaning: '낄', frequency: 4 },
  ]],
  ['객', [
    { hanja: '客', meaning: '손', frequency: 7 },
  ]],
  ['거', [
    { hanja: '去', meaning: '갈', frequency: 7 },
    { hanja: '巨', meaning: '클', frequency: 6 },
    { hanja: '居', meaning: '살', frequency: 6 },
    { hanja: '車', meaning: '수레', frequency: 6 },
    { hanja: '擧', meaning: '들', frequency: 5 },
  ]],
  ['건', [
    { hanja: '建', meaning: '세울', frequency: 8 },
    { hanja: '件', meaning: '물건', frequency: 7 },
    { hanja: '健', meaning: '굳셀', frequency: 6 },
    { hanja: '乾', meaning: '하늘/마를', frequency: 5 },
  ]],
  ['검', [
    { hanja: '檢', meaning: '검사할', frequency: 7 },
    { hanja: '劍', meaning: '칼', frequency: 5 },
  ]],
  ['격', [
    { hanja: '格', meaning: '격식', frequency: 7 },
    { hanja: '激', meaning: '격할', frequency: 5 },
  ]],
  ['견', [
    { hanja: '見', meaning: '볼', frequency: 8 },
    { hanja: '堅', meaning: '굳을', frequency: 5 },
    { hanja: '犬', meaning: '개', frequency: 4 },
  ]],
  ['결', [
    { hanja: '結', meaning: '맺을', frequency: 8 },
    { hanja: '決', meaning: '결단할', frequency: 8 },
    { hanja: '潔', meaning: '깨끗할', frequency: 5 },
  ]],
  ['경', [
    { hanja: '京', meaning: '서울', frequency: 8 },
    { hanja: '經', meaning: '지날/글', frequency: 8 },
    { hanja: '景', meaning: '볕', frequency: 7 },
    { hanja: '輕', meaning: '가벼울', frequency: 6 },
    { hanja: '競', meaning: '다툴', frequency: 6 },
    { hanja: '敬', meaning: '공경', frequency: 6 },
    { hanja: '驚', meaning: '놀랄', frequency: 5 },
    { hanja: '慶', meaning: '경사', frequency: 5 },
  ]],
  ['계', [
    { hanja: '計', meaning: '셀', frequency: 8 },
    { hanja: '界', meaning: '지경', frequency: 8 },
    { hanja: '係', meaning: '맬', frequency: 6 },
    { hanja: '繼', meaning: '이을', frequency: 5 },
    { hanja: '季', meaning: '계절', frequency: 5 },
  ]],
  ['고', [
    { hanja: '高', meaning: '높을', frequency: 9 },
    { hanja: '古', meaning: '예', frequency: 8 },
    { hanja: '告', meaning: '알릴', frequency: 7 },
    { hanja: '故', meaning: '연고', frequency: 7 },
    { hanja: '考', meaning: '생각할', frequency: 6 },
    { hanja: '苦', meaning: '쓸', frequency: 5 },
    { hanja: '固', meaning: '굳을', frequency: 5 },
  ]],
  ['곡', [
    { hanja: '曲', meaning: '굽을', frequency: 6 },
    { hanja: '穀', meaning: '곡식', frequency: 5 },
    { hanja: '谷', meaning: '골', frequency: 4 },
  ]],
  ['공', [
    { hanja: '工', meaning: '장인', frequency: 8 },
    { hanja: '公', meaning: '공평할', frequency: 8 },
    { hanja: '共', meaning: '함께', frequency: 8 },
    { hanja: '空', meaning: '빌', frequency: 7 },
    { hanja: '功', meaning: '공', frequency: 6 },
    { hanja: '攻', meaning: '칠', frequency: 5 },
  ]],
  ['과', [
    { hanja: '科', meaning: '과목', frequency: 8 },
    { hanja: '果', meaning: '실과', frequency: 8 },
    { hanja: '過', meaning: '지날', frequency: 7 },
    { hanja: '課', meaning: '공부할', frequency: 6 },
  ]],
  ['관', [
    { hanja: '官', meaning: '벼슬', frequency: 7 },
    { hanja: '觀', meaning: '볼', frequency: 7 },
    { hanja: '關', meaning: '관계할', frequency: 8 },
    { hanja: '管', meaning: '대롱', frequency: 6 },
    { hanja: '館', meaning: '집', frequency: 5 },
  ]],
  ['광', [
    { hanja: '光', meaning: '빛', frequency: 8 },
    { hanja: '廣', meaning: '넓을', frequency: 6 },
  ]],
  ['교', [
    { hanja: '敎', meaning: '가르칠', frequency: 9 },
    { hanja: '校', meaning: '학교', frequency: 9 },
    { hanja: '交', meaning: '사귈', frequency: 7 },
    { hanja: '橋', meaning: '다리', frequency: 5 },
  ]],
  ['구', [
    { hanja: '九', meaning: '아홉', frequency: 8 },
    { hanja: '口', meaning: '입', frequency: 8 },
    { hanja: '求', meaning: '구할', frequency: 7 },
    { hanja: '究', meaning: '연구할', frequency: 7 },
    { hanja: '舊', meaning: '예/옛', frequency: 6 },
    { hanja: '具', meaning: '갖출', frequency: 6 },
    { hanja: '球', meaning: '공', frequency: 5 },
  ]],
  ['국', [
    { hanja: '國', meaning: '나라', frequency: 10 },
    { hanja: '局', meaning: '판국', frequency: 7 },
    { hanja: '菊', meaning: '국화', frequency: 3 },
  ]],
  ['군', [
    { hanja: '軍', meaning: '군사', frequency: 9 },
    { hanja: '君', meaning: '임금', frequency: 6 },
    { hanja: '郡', meaning: '고을', frequency: 5 },
  ]],
  ['권', [
    { hanja: '權', meaning: '권세', frequency: 8 },
    { hanja: '勸', meaning: '권할', frequency: 5 },
    { hanja: '卷', meaning: '책', frequency: 5 },
  ]],
  ['귀', [
    { hanja: '貴', meaning: '귀할', frequency: 7 },
    { hanja: '歸', meaning: '돌아갈', frequency: 5 },
  ]],
  ['규', [
    { hanja: '規', meaning: '법', frequency: 7 },
  ]],
  ['균', [
    { hanja: '均', meaning: '고를', frequency: 6 },
  ]],
  ['극', [
    { hanja: '極', meaning: '다할', frequency: 6 },
    { hanja: '劇', meaning: '심할/연극', frequency: 5 },
  ]],
  ['근', [
    { hanja: '近', meaning: '가까울', frequency: 8 },
    { hanja: '根', meaning: '뿌리', frequency: 6 },
    { hanja: '勤', meaning: '부지런할', frequency: 5 },
  ]],
  ['금', [
    { hanja: '金', meaning: '쇠/성씨', frequency: 10 },
    { hanja: '今', meaning: '이제', frequency: 8 },
    { hanja: '禁', meaning: '금할', frequency: 5 },
  ]],
  ['급', [
    { hanja: '級', meaning: '등급', frequency: 7 },
    { hanja: '急', meaning: '급할', frequency: 7 },
    { hanja: '給', meaning: '줄', frequency: 6 },
  ]],
  ['기', [
    { hanja: '基', meaning: '터', frequency: 8 },
    { hanja: '記', meaning: '기록할', frequency: 8 },
    { hanja: '氣', meaning: '기운', frequency: 9 },
    { hanja: '己', meaning: '몸', frequency: 7 },
    { hanja: '期', meaning: '기약할', frequency: 7 },
    { hanja: '技', meaning: '재주', frequency: 6 },
    { hanja: '起', meaning: '일어날', frequency: 6 },
    { hanja: '機', meaning: '틀', frequency: 7 },
    { hanja: '其', meaning: '그', frequency: 5 },
  ]],
  ['길', [
    { hanja: '吉', meaning: '길할', frequency: 5 },
  ]],
  ['나', [
    { hanja: '那', meaning: '어찌', frequency: 3 },
  ]],
  ['낙', [
    { hanja: '落', meaning: '떨어질', frequency: 6 },
    { hanja: '樂', meaning: '즐길', frequency: 5 },
  ]],
  ['난', [
    { hanja: '難', meaning: '어려울', frequency: 6 },
    { hanja: '暖', meaning: '따뜻할', frequency: 4 },
  ]],
  ['남', [
    { hanja: '南', meaning: '남녘', frequency: 9 },
    { hanja: '男', meaning: '사내', frequency: 8 },
  ]],
  ['내', [
    { hanja: '內', meaning: '안', frequency: 9 },
    { hanja: '來', meaning: '올', frequency: 7 },
  ]],
  ['녀', [
    { hanja: '女', meaning: '여자', frequency: 8 },
  ]],
  ['년', [
    { hanja: '年', meaning: '해', frequency: 10 },
  ]],
  ['념', [
    { hanja: '念', meaning: '생각', frequency: 6 },
  ]],
  ['노', [
    { hanja: '勞', meaning: '일할', frequency: 6 },
    { hanja: '老', meaning: '늙을', frequency: 7 },
    { hanja: '怒', meaning: '성낼', frequency: 5 },
  ]],
  ['농', [
    { hanja: '農', meaning: '농사', frequency: 7 },
  ]],
  ['능', [
    { hanja: '能', meaning: '능할', frequency: 8 },
  ]],
  ['다', [
    { hanja: '多', meaning: '많을', frequency: 8 },
    { hanja: '茶', meaning: '차', frequency: 5 },
  ]],
  ['단', [
    { hanja: '單', meaning: '홑', frequency: 7 },
    { hanja: '短', meaning: '짧을', frequency: 6 },
    { hanja: '團', meaning: '둥글', frequency: 6 },
    { hanja: '段', meaning: '층계', frequency: 6 },
    { hanja: '端', meaning: '끝', frequency: 5 },
    { hanja: '丹', meaning: '붉을', frequency: 4 },
  ]],
  ['달', [
    { hanja: '達', meaning: '통달할', frequency: 6 },
  ]],
  ['담', [
    { hanja: '談', meaning: '말씀', frequency: 6 },
    { hanja: '擔', meaning: '멜', frequency: 5 },
  ]],
  ['답', [
    { hanja: '答', meaning: '대답', frequency: 7 },
  ]],
  ['당', [
    { hanja: '當', meaning: '마땅', frequency: 8 },
    { hanja: '堂', meaning: '집', frequency: 6 },
    { hanja: '黨', meaning: '무리', frequency: 5 },
  ]],
  ['대', [
    { hanja: '大', meaning: '큰', frequency: 10 },
    { hanja: '代', meaning: '대신할', frequency: 8 },
    { hanja: '對', meaning: '대할', frequency: 8 },
    { hanja: '待', meaning: '기다릴', frequency: 6 },
    { hanja: '隊', meaning: '무리', frequency: 5 },
  ]],
  ['덕', [
    { hanja: '德', meaning: '덕', frequency: 6 },
  ]],
  ['도', [
    { hanja: '道', meaning: '길', frequency: 9 },
    { hanja: '都', meaning: '도읍', frequency: 7 },
    { hanja: '圖', meaning: '그림', frequency: 7 },
    { hanja: '度', meaning: '법도', frequency: 7 },
    { hanja: '到', meaning: '이를', frequency: 6 },
    { hanja: '島', meaning: '섬', frequency: 5 },
  ]],
  ['독', [
    { hanja: '讀', meaning: '읽을', frequency: 7 },
    { hanja: '獨', meaning: '홀로', frequency: 6 },
    { hanja: '毒', meaning: '독', frequency: 5 },
  ]],
  ['동', [
    { hanja: '同', meaning: '한가지', frequency: 9 },
    { hanja: '東', meaning: '동녘', frequency: 9 },
    { hanja: '動', meaning: '움직일', frequency: 8 },
    { hanja: '童', meaning: '아이', frequency: 5 },
    { hanja: '冬', meaning: '겨울', frequency: 6 },
    { hanja: '洞', meaning: '골/통할', frequency: 5 },
  ]],
  ['두', [
    { hanja: '頭', meaning: '머리', frequency: 7 },
    { hanja: '豆', meaning: '콩', frequency: 4 },
  ]],
  ['득', [
    { hanja: '得', meaning: '얻을', frequency: 7 },
  ]],
  ['등', [
    { hanja: '等', meaning: '무리', frequency: 7 },
    { hanja: '登', meaning: '오를', frequency: 6 },
    { hanja: '燈', meaning: '등불', frequency: 5 },
  ]],
  ['라', [
    { hanja: '羅', meaning: '벌일', frequency: 4 },
  ]],
  ['락', [
    { hanja: '樂', meaning: '즐길', frequency: 6 },
    { hanja: '落', meaning: '떨어질', frequency: 6 },
  ]],
  ['란', [
    { hanja: '亂', meaning: '어지러울', frequency: 5 },
  ]],
  ['랑', [
    { hanja: '朗', meaning: '밝을', frequency: 4 },
  ]],
  ['래', [
    { hanja: '來', meaning: '올', frequency: 7 },
  ]],
  ['량', [
    { hanja: '量', meaning: '헤아릴', frequency: 7 },
    { hanja: '良', meaning: '어질', frequency: 6 },
    { hanja: '兩', meaning: '두', frequency: 6 },
  ]],
  ['려', [
    { hanja: '麗', meaning: '고울', frequency: 5 },
    { hanja: '旅', meaning: '나그네', frequency: 5 },
  ]],
  ['력', [
    { hanja: '力', meaning: '힘', frequency: 8 },
    { hanja: '歷', meaning: '지날', frequency: 6 },
  ]],
  ['련', [
    { hanja: '練', meaning: '익힐', frequency: 6 },
    { hanja: '連', meaning: '잇닿을', frequency: 6 },
  ]],
  ['렬', [
    { hanja: '列', meaning: '벌일', frequency: 6 },
    { hanja: '烈', meaning: '매울', frequency: 4 },
  ]],
  ['령', [
    { hanja: '令', meaning: '하여금', frequency: 6 },
    { hanja: '領', meaning: '거느릴', frequency: 6 },
  ]],
  ['례', [
    { hanja: '例', meaning: '법식', frequency: 7 },
    { hanja: '禮', meaning: '예도', frequency: 6 },
  ]],
  ['로', [
    { hanja: '路', meaning: '길', frequency: 7 },
    { hanja: '老', meaning: '늙을', frequency: 7 },
    { hanja: '勞', meaning: '일할', frequency: 6 },
  ]],
  ['록', [
    { hanja: '錄', meaning: '기록할', frequency: 6 },
    { hanja: '綠', meaning: '푸를', frequency: 5 },
  ]],
  ['론', [
    { hanja: '論', meaning: '논할', frequency: 7 },
  ]],
  ['료', [
    { hanja: '料', meaning: '헤아릴', frequency: 6 },
    { hanja: '了', meaning: '마칠', frequency: 5 },
  ]],
  ['류', [
    { hanja: '流', meaning: '흐를', frequency: 7 },
    { hanja: '類', meaning: '무리', frequency: 6 },
    { hanja: '留', meaning: '머무를', frequency: 5 },
  ]],
  ['륙', [
    { hanja: '六', meaning: '여섯', frequency: 8 },
    { hanja: '陸', meaning: '뭍', frequency: 5 },
  ]],
  ['리', [
    { hanja: '理', meaning: '다스릴', frequency: 9 },
    { hanja: '利', meaning: '이로울', frequency: 7 },
    { hanja: '里', meaning: '마을', frequency: 6 },
    { hanja: '李', meaning: '오얏/성씨', frequency: 7 },
    { hanja: '離', meaning: '떠날', frequency: 5 },
  ]],
  ['림', [
    { hanja: '林', meaning: '수풀', frequency: 6 },
    { hanja: '臨', meaning: '임할', frequency: 5 },
  ]],
  ['립', [
    { hanja: '立', meaning: '설', frequency: 7 },
  ]],
  ['마', [
    { hanja: '馬', meaning: '말', frequency: 6 },
    { hanja: '麻', meaning: '삼', frequency: 3 },
  ]],
  ['만', [
    { hanja: '萬', meaning: '일만', frequency: 8 },
    { hanja: '滿', meaning: '찰', frequency: 6 },
    { hanja: '晩', meaning: '늦을', frequency: 4 },
  ]],
  ['말', [
    { hanja: '末', meaning: '끝', frequency: 6 },
  ]],
  ['망', [
    { hanja: '望', meaning: '바랄', frequency: 6 },
    { hanja: '亡', meaning: '망할', frequency: 5 },
    { hanja: '忘', meaning: '잊을', frequency: 4 },
  ]],
  ['매', [
    { hanja: '每', meaning: '매양', frequency: 7 },
    { hanja: '買', meaning: '살', frequency: 6 },
    { hanja: '賣', meaning: '팔', frequency: 6 },
    { hanja: '妹', meaning: '누이', frequency: 4 },
  ]],
  ['면', [
    { hanja: '面', meaning: '낯', frequency: 7 },
    { hanja: '免', meaning: '면할', frequency: 5 },
    { hanja: '眠', meaning: '잘', frequency: 4 },
  ]],
  ['명', [
    { hanja: '名', meaning: '이름', frequency: 9 },
    { hanja: '明', meaning: '밝을', frequency: 8 },
    { hanja: '命', meaning: '목숨', frequency: 7 },
  ]],
  ['모', [
    { hanja: '母', meaning: '어머니', frequency: 8 },
    { hanja: '毛', meaning: '터럭', frequency: 5 },
    { hanja: '模', meaning: '본뜰', frequency: 5 },
  ]],
  ['목', [
    { hanja: '目', meaning: '눈', frequency: 8 },
    { hanja: '木', meaning: '나무', frequency: 8 },
  ]],
  ['묘', [
    { hanja: '妙', meaning: '묘할', frequency: 5 },
  ]],
  ['무', [
    { hanja: '無', meaning: '없을', frequency: 8 },
    { hanja: '武', meaning: '호반', frequency: 5 },
    { hanja: '務', meaning: '힘쓸', frequency: 5 },
  ]],
  ['문', [
    { hanja: '文', meaning: '글월', frequency: 9 },
    { hanja: '門', meaning: '문', frequency: 8 },
    { hanja: '問', meaning: '물을', frequency: 8 },
    { hanja: '聞', meaning: '들을', frequency: 6 },
  ]],
  ['물', [
    { hanja: '物', meaning: '물건', frequency: 9 },
    { hanja: '勿', meaning: '말', frequency: 3 },
  ]],
  ['미', [
    { hanja: '美', meaning: '아름다울', frequency: 8 },
    { hanja: '味', meaning: '맛', frequency: 6 },
    { hanja: '未', meaning: '아닐', frequency: 6 },
    { hanja: '米', meaning: '쌀', frequency: 5 },
  ]],
  ['민', [
    { hanja: '民', meaning: '백성', frequency: 9 },
  ]],
  ['반', [
    { hanja: '半', meaning: '반', frequency: 7 },
    { hanja: '反', meaning: '돌이킬', frequency: 7 },
    { hanja: '班', meaning: '나눌', frequency: 5 },
    { hanja: '返', meaning: '돌아올', frequency: 4 },
  ]],
  ['발', [
    { hanja: '發', meaning: '필', frequency: 8 },
    { hanja: '髮', meaning: '터럭', frequency: 4 },
  ]],
  ['방', [
    { hanja: '方', meaning: '모', frequency: 8 },
    { hanja: '放', meaning: '놓을', frequency: 7 },
    { hanja: '房', meaning: '방', frequency: 6 },
    { hanja: '訪', meaning: '찾을', frequency: 5 },
    { hanja: '防', meaning: '막을', frequency: 5 },
  ]],
  ['배', [
    { hanja: '倍', meaning: '곱', frequency: 6 },
    { hanja: '配', meaning: '나눌', frequency: 6 },
    { hanja: '拜', meaning: '절', frequency: 5 },
    { hanja: '背', meaning: '등', frequency: 4 },
  ]],
  ['백', [
    { hanja: '白', meaning: '흰', frequency: 8 },
    { hanja: '百', meaning: '일백', frequency: 8 },
  ]],
  ['번', [
    { hanja: '番', meaning: '차례', frequency: 6 },
    { hanja: '繁', meaning: '번성할', frequency: 4 },
  ]],
  ['벌', [
    { hanja: '伐', meaning: '칠', frequency: 5 },
    { hanja: '罰', meaning: '벌할', frequency: 4 },
  ]],
  ['범', [
    { hanja: '凡', meaning: '무릇', frequency: 5 },
    { hanja: '範', meaning: '법', frequency: 4 },
  ]],
  ['법', [
    { hanja: '法', meaning: '법', frequency: 9 },
  ]],
  ['변', [
    { hanja: '變', meaning: '변할', frequency: 7 },
    { hanja: '便', meaning: '편할/똥오줌', frequency: 6 },
    { hanja: '邊', meaning: '가', frequency: 5 },
  ]],
  ['별', [
    { hanja: '別', meaning: '다를', frequency: 7 },
  ]],
  ['병', [
    { hanja: '病', meaning: '병', frequency: 7 },
    { hanja: '兵', meaning: '병사', frequency: 6 },
    { hanja: '丙', meaning: '남녘', frequency: 4 },
  ]],
  ['보', [
    { hanja: '報', meaning: '갚을', frequency: 7 },
    { hanja: '保', meaning: '지킬', frequency: 7 },
    { hanja: '步', meaning: '걸음', frequency: 5 },
    { hanja: '寶', meaning: '보배', frequency: 5 },
    { hanja: '普', meaning: '넓을', frequency: 4 },
  ]],
  ['복', [
    { hanja: '福', meaning: '복', frequency: 7 },
    { hanja: '服', meaning: '옷', frequency: 7 },
    { hanja: '復', meaning: '돌아올', frequency: 6 },
    { hanja: '伏', meaning: '엎드릴', frequency: 4 },
  ]],
  ['본', [
    { hanja: '本', meaning: '근본', frequency: 9 },
  ]],
  ['봉', [
    { hanja: '奉', meaning: '받들', frequency: 5 },
    { hanja: '逢', meaning: '만날', frequency: 4 },
  ]],
  ['부', [
    { hanja: '父', meaning: '아버지', frequency: 8 },
    { hanja: '夫', meaning: '지아비', frequency: 7 },
    { hanja: '部', meaning: '떼', frequency: 8 },
    { hanja: '富', meaning: '부유할', frequency: 6 },
    { hanja: '婦', meaning: '며느리', frequency: 5 },
    { hanja: '附', meaning: '붙을', frequency: 5 },
    { hanja: '否', meaning: '아닐', frequency: 5 },
    { hanja: '副', meaning: '버금', frequency: 5 },
  ]],
  ['북', [
    { hanja: '北', meaning: '북녘', frequency: 8 },
  ]],
  ['분', [
    { hanja: '分', meaning: '나눌', frequency: 9 },
    { hanja: '粉', meaning: '가루', frequency: 4 },
  ]],
  ['불', [
    { hanja: '不', meaning: '아닐', frequency: 10 },
    { hanja: '佛', meaning: '부처', frequency: 6 },
  ]],
  ['비', [
    { hanja: '比', meaning: '견줄', frequency: 7 },
    { hanja: '非', meaning: '아닐', frequency: 7 },
    { hanja: '飛', meaning: '날', frequency: 5 },
    { hanja: '備', meaning: '갖출', frequency: 6 },
    { hanja: '悲', meaning: '슬플', frequency: 5 },
    { hanja: '費', meaning: '쓸', frequency: 6 },
  ]],
  ['빈', [
    { hanja: '貧', meaning: '가난할', frequency: 5 },
  ]],
  ['사', [
    { hanja: '事', meaning: '일', frequency: 10 },
    { hanja: '士', meaning: '선비', frequency: 7 },
    { hanja: '四', meaning: '넉', frequency: 9 },
    { hanja: '思', meaning: '생각', frequency: 8 },
    { hanja: '社', meaning: '모일', frequency: 8 },
    { hanja: '使', meaning: '하여금/부릴', frequency: 7 },
    { hanja: '師', meaning: '스승', frequency: 7 },
    { hanja: '寺', meaning: '절', frequency: 5 },
    { hanja: '史', meaning: '사기', frequency: 6 },
    { hanja: '死', meaning: '죽을', frequency: 7 },
    { hanja: '私', meaning: '사사', frequency: 6 },
    { hanja: '謝', meaning: '사례할', frequency: 5 },
  ]],
  ['산', [
    { hanja: '山', meaning: '메', frequency: 9 },
    { hanja: '産', meaning: '낳을', frequency: 7 },
    { hanja: '算', meaning: '셈', frequency: 6 },
    { hanja: '散', meaning: '흩을', frequency: 5 },
  ]],
  ['살', [
    { hanja: '殺', meaning: '죽일', frequency: 5 },
  ]],
  ['삼', [
    { hanja: '三', meaning: '석', frequency: 10 },
    { hanja: '森', meaning: '수풀', frequency: 4 },
  ]],
  ['상', [
    { hanja: '上', meaning: '윗', frequency: 10 },
    { hanja: '相', meaning: '서로', frequency: 8 },
    { hanja: '商', meaning: '장사', frequency: 7 },
    { hanja: '常', meaning: '항상', frequency: 7 },
    { hanja: '想', meaning: '생각', frequency: 6 },
    { hanja: '賞', meaning: '상줄', frequency: 5 },
    { hanja: '狀', meaning: '형상', frequency: 5 },
  ]],
  ['색', [
    { hanja: '色', meaning: '빛', frequency: 8 },
  ]],
  ['생', [
    { hanja: '生', meaning: '날', frequency: 10 },
  ]],
  ['서', [
    { hanja: '西', meaning: '서녘', frequency: 8 },
    { hanja: '書', meaning: '글', frequency: 8 },
    { hanja: '序', meaning: '차례', frequency: 6 },
    { hanja: '署', meaning: '관청', frequency: 5 },
  ]],
  ['석', [
    { hanja: '石', meaning: '돌', frequency: 7 },
    { hanja: '夕', meaning: '저녁', frequency: 5 },
    { hanja: '席', meaning: '자리', frequency: 5 },
    { hanja: '昔', meaning: '예', frequency: 4 },
  ]],
  ['선', [
    { hanja: '先', meaning: '먼저', frequency: 9 },
    { hanja: '線', meaning: '줄', frequency: 7 },
    { hanja: '善', meaning: '착할', frequency: 7 },
    { hanja: '選', meaning: '가릴', frequency: 6 },
    { hanja: '船', meaning: '배', frequency: 5 },
    { hanja: '鮮', meaning: '고울', frequency: 5 },
  ]],
  ['설', [
    { hanja: '說', meaning: '말씀', frequency: 8 },
    { hanja: '設', meaning: '베풀', frequency: 6 },
    { hanja: '雪', meaning: '눈', frequency: 6 },
    { hanja: '舌', meaning: '혀', frequency: 4 },
  ]],
  ['성', [
    { hanja: '成', meaning: '이룰', frequency: 9 },
    { hanja: '性', meaning: '성품', frequency: 8 },
    { hanja: '姓', meaning: '성씨', frequency: 6 },
    { hanja: '聖', meaning: '성인', frequency: 5 },
    { hanja: '城', meaning: '재', frequency: 5 },
    { hanja: '星', meaning: '별', frequency: 5 },
    { hanja: '聲', meaning: '소리', frequency: 5 },
    { hanja: '盛', meaning: '성할', frequency: 4 },
  ]],
  ['세', [
    { hanja: '世', meaning: '인간', frequency: 8 },
    { hanja: '歲', meaning: '해', frequency: 6 },
    { hanja: '洗', meaning: '씻을', frequency: 5 },
    { hanja: '細', meaning: '가늘', frequency: 5 },
    { hanja: '稅', meaning: '세금', frequency: 5 },
  ]],
  ['소', [
    { hanja: '小', meaning: '작을', frequency: 9 },
    { hanja: '少', meaning: '적을', frequency: 8 },
    { hanja: '所', meaning: '바', frequency: 8 },
    { hanja: '消', meaning: '사라질', frequency: 6 },
    { hanja: '笑', meaning: '웃을', frequency: 5 },
    { hanja: '素', meaning: '본디', frequency: 5 },
  ]],
  ['속', [
    { hanja: '速', meaning: '빠를', frequency: 6 },
    { hanja: '續', meaning: '이을', frequency: 6 },
    { hanja: '俗', meaning: '풍속', frequency: 4 },
  ]],
  ['손', [
    { hanja: '孫', meaning: '손자', frequency: 6 },
    { hanja: '損', meaning: '덜', frequency: 5 },
  ]],
  ['수', [
    { hanja: '水', meaning: '물', frequency: 9 },
    { hanja: '手', meaning: '손', frequency: 8 },
    { hanja: '數', meaning: '셈', frequency: 8 },
    { hanja: '首', meaning: '머리', frequency: 6 },
    { hanja: '受', meaning: '받을', frequency: 7 },
    { hanja: '授', meaning: '줄', frequency: 5 },
    { hanja: '修', meaning: '닦을', frequency: 5 },
    { hanja: '收', meaning: '거둘', frequency: 5 },
    { hanja: '須', meaning: '모름지기', frequency: 4 },
    { hanja: '樹', meaning: '나무', frequency: 4 },
  ]],
  ['숙', [
    { hanja: '宿', meaning: '잘', frequency: 5 },
    { hanja: '叔', meaning: '아재비', frequency: 3 },
  ]],
  ['순', [
    { hanja: '順', meaning: '순할', frequency: 6 },
    { hanja: '純', meaning: '순수할', frequency: 5 },
  ]],
  ['술', [
    { hanja: '術', meaning: '재주', frequency: 6 },
  ]],
  ['습', [
    { hanja: '習', meaning: '익힐', frequency: 6 },
    { hanja: '濕', meaning: '젖을', frequency: 4 },
  ]],
  ['승', [
    { hanja: '勝', meaning: '이길', frequency: 6 },
    { hanja: '承', meaning: '이을', frequency: 5 },
    { hanja: '乘', meaning: '탈', frequency: 4 },
  ]],
  ['시', [
    { hanja: '時', meaning: '때', frequency: 10 },
    { hanja: '市', meaning: '저자', frequency: 7 },
    { hanja: '示', meaning: '보일', frequency: 6 },
    { hanja: '是', meaning: '이/옳을', frequency: 6 },
    { hanja: '視', meaning: '볼', frequency: 6 },
    { hanja: '始', meaning: '비로소', frequency: 6 },
    { hanja: '詩', meaning: '시', frequency: 5 },
    { hanja: '試', meaning: '시험', frequency: 6 },
  ]],
  ['식', [
    { hanja: '式', meaning: '법', frequency: 7 },
    { hanja: '食', meaning: '밥', frequency: 8 },
    { hanja: '植', meaning: '심을', frequency: 5 },
    { hanja: '識', meaning: '알', frequency: 5 },
  ]],
  ['신', [
    { hanja: '新', meaning: '새', frequency: 9 },
    { hanja: '身', meaning: '몸', frequency: 8 },
    { hanja: '神', meaning: '귀신', frequency: 7 },
    { hanja: '信', meaning: '믿을', frequency: 7 },
    { hanja: '臣', meaning: '신하', frequency: 5 },
    { hanja: '申', meaning: '거듭/펼', frequency: 5 },
  ]],
  ['실', [
    { hanja: '室', meaning: '집/방', frequency: 7 },
    { hanja: '失', meaning: '잃을', frequency: 6 },
    { hanja: '實', meaning: '열매', frequency: 7 },
  ]],
  ['심', [
    { hanja: '心', meaning: '마음', frequency: 9 },
    { hanja: '深', meaning: '깊을', frequency: 6 },
    { hanja: '審', meaning: '살필', frequency: 4 },
  ]],
  ['십', [
    { hanja: '十', meaning: '열', frequency: 9 },
  ]],
  ['아', [
    { hanja: '兒', meaning: '아이', frequency: 6 },
    { hanja: '我', meaning: '나', frequency: 6 },
    { hanja: '亞', meaning: '버금', frequency: 4 },
  ]],
  ['악', [
    { hanja: '惡', meaning: '악할', frequency: 6 },
    { hanja: '樂', meaning: '풍류', frequency: 5 },
  ]],
  ['안', [
    { hanja: '安', meaning: '편안', frequency: 8 },
    { hanja: '案', meaning: '책상', frequency: 5 },
    { hanja: '眼', meaning: '눈', frequency: 5 },
    { hanja: '顔', meaning: '낯', frequency: 4 },
  ]],
  ['암', [
    { hanja: '暗', meaning: '어두울', frequency: 5 },
    { hanja: '巖', meaning: '바위', frequency: 4 },
  ]],
  ['압', [
    { hanja: '壓', meaning: '누를', frequency: 5 },
  ]],
  ['앙', [
    { hanja: '仰', meaning: '우러를', frequency: 4 },
    { hanja: '央', meaning: '가운데', frequency: 5 },
  ]],
  ['애', [
    { hanja: '愛', meaning: '사랑', frequency: 8 },
    { hanja: '哀', meaning: '슬플', frequency: 4 },
  ]],
  ['야', [
    { hanja: '夜', meaning: '밤', frequency: 6 },
    { hanja: '野', meaning: '들', frequency: 6 },
  ]],
  ['약', [
    { hanja: '弱', meaning: '약할', frequency: 6 },
    { hanja: '約', meaning: '맺을', frequency: 6 },
    { hanja: '藥', meaning: '약', frequency: 6 },
    { hanja: '若', meaning: '같을', frequency: 4 },
  ]],
  ['양', [
    { hanja: '陽', meaning: '볕', frequency: 7 },
    { hanja: '養', meaning: '기를', frequency: 6 },
    { hanja: '洋', meaning: '큰바다', frequency: 5 },
    { hanja: '羊', meaning: '양', frequency: 4 },
    { hanja: '讓', meaning: '사양할', frequency: 4 },
  ]],
  ['어', [
    { hanja: '語', meaning: '말씀', frequency: 8 },
    { hanja: '魚', meaning: '물고기', frequency: 5 },
    { hanja: '漁', meaning: '고기잡을', frequency: 4 },
    { hanja: '於', meaning: '어조사', frequency: 5 },
  ]],
  ['억', [
    { hanja: '億', meaning: '억', frequency: 6 },
    { hanja: '憶', meaning: '생각할', frequency: 4 },
  ]],
  ['언', [
    { hanja: '言', meaning: '말씀', frequency: 8 },
  ]],
  ['업', [
    { hanja: '業', meaning: '업', frequency: 8 },
  ]],
  ['여', [
    { hanja: '與', meaning: '더불/줄', frequency: 6 },
    { hanja: '余', meaning: '나', frequency: 4 },
    { hanja: '如', meaning: '같을', frequency: 5 },
    { hanja: '餘', meaning: '남을', frequency: 5 },
  ]],
  ['역', [
    { hanja: '亦', meaning: '또', frequency: 6 },
    { hanja: '逆', meaning: '거스를', frequency: 5 },
    { hanja: '驛', meaning: '역', frequency: 5 },
    { hanja: '易', meaning: '바꿀/쉬울', frequency: 5 },
    { hanja: '譯', meaning: '번역할', frequency: 4 },
    { hanja: '役', meaning: '부릴', frequency: 5 },
  ]],
  ['연', [
    { hanja: '然', meaning: '그럴', frequency: 8 },
    { hanja: '硏', meaning: '갈', frequency: 6 },
    { hanja: '年', meaning: '해', frequency: 7 },
    { hanja: '燃', meaning: '탈', frequency: 4 },
    { hanja: '煙', meaning: '연기', frequency: 4 },
    { hanja: '演', meaning: '펼', frequency: 5 },
  ]],
  ['열', [
    { hanja: '熱', meaning: '더울', frequency: 6 },
    { hanja: '悅', meaning: '기쁠', frequency: 4 },
  ]],
  ['염', [
    { hanja: '炎', meaning: '불꽃', frequency: 4 },
    { hanja: '鹽', meaning: '소금', frequency: 3 },
  ]],
  ['엽', [
    { hanja: '葉', meaning: '잎', frequency: 5 },
  ]],
  ['영', [
    { hanja: '永', meaning: '길', frequency: 6 },
    { hanja: '英', meaning: '꽃부리', frequency: 6 },
    { hanja: '榮', meaning: '영화', frequency: 5 },
    { hanja: '映', meaning: '비칠', frequency: 5 },
    { hanja: '營', meaning: '경영할', frequency: 5 },
  ]],
  ['예', [
    { hanja: '藝', meaning: '재주', frequency: 6 },
    { hanja: '禮', meaning: '예도', frequency: 6 },
    { hanja: '銳', meaning: '날카로울', frequency: 3 },
  ]],
  ['오', [
    { hanja: '五', meaning: '다섯', frequency: 9 },
    { hanja: '午', meaning: '낮', frequency: 6 },
    { hanja: '誤', meaning: '그르칠', frequency: 5 },
    { hanja: '吾', meaning: '나', frequency: 4 },
  ]],
  ['옥', [
    { hanja: '玉', meaning: '구슬', frequency: 5 },
    { hanja: '屋', meaning: '집', frequency: 5 },
  ]],
  ['온', [
    { hanja: '溫', meaning: '따뜻할', frequency: 6 },
  ]],
  ['완', [
    { hanja: '完', meaning: '완전할', frequency: 6 },
  ]],
  ['왕', [
    { hanja: '王', meaning: '임금', frequency: 8 },
    { hanja: '往', meaning: '갈', frequency: 4 },
  ]],
  ['외', [
    { hanja: '外', meaning: '바깥', frequency: 9 },
  ]],
  ['요', [
    { hanja: '要', meaning: '요긴할', frequency: 7 },
    { hanja: '料', meaning: '헤아릴', frequency: 5 },
    { hanja: '謠', meaning: '노래', frequency: 3 },
  ]],
  ['욕', [
    { hanja: '欲', meaning: '하고자할', frequency: 5 },
    { hanja: '浴', meaning: '목욕할', frequency: 4 },
  ]],
  ['용', [
    { hanja: '用', meaning: '쓸', frequency: 9 },
    { hanja: '勇', meaning: '날랠', frequency: 5 },
    { hanja: '容', meaning: '얼굴', frequency: 6 },
    { hanja: '龍', meaning: '용', frequency: 5 },
  ]],
  ['우', [
    { hanja: '雨', meaning: '비', frequency: 6 },
    { hanja: '友', meaning: '벗', frequency: 7 },
    { hanja: '右', meaning: '오른쪽', frequency: 7 },
    { hanja: '又', meaning: '또', frequency: 5 },
    { hanja: '牛', meaning: '소', frequency: 5 },
    { hanja: '優', meaning: '뛰어날', frequency: 5 },
  ]],
  ['운', [
    { hanja: '雲', meaning: '구름', frequency: 6 },
    { hanja: '運', meaning: '옮길', frequency: 7 },
  ]],
  ['웅', [
    { hanja: '雄', meaning: '수컷', frequency: 5 },
  ]],
  ['원', [
    { hanja: '原', meaning: '언덕', frequency: 7 },
    { hanja: '元', meaning: '으뜸', frequency: 7 },
    { hanja: '園', meaning: '동산', frequency: 5 },
    { hanja: '遠', meaning: '멀', frequency: 6 },
    { hanja: '院', meaning: '집', frequency: 5 },
    { hanja: '願', meaning: '원할', frequency: 5 },
    { hanja: '員', meaning: '인원', frequency: 6 },
    { hanja: '圓', meaning: '둥글', frequency: 5 },
  ]],
  ['월', [
    { hanja: '月', meaning: '달', frequency: 10 },
    { hanja: '越', meaning: '넘을', frequency: 4 },
  ]],
  ['위', [
    { hanja: '位', meaning: '자리', frequency: 8 },
    { hanja: '爲', meaning: '할/위할', frequency: 8 },
    { hanja: '偉', meaning: '클', frequency: 5 },
    { hanja: '衛', meaning: '지킬', frequency: 4 },
    { hanja: '危', meaning: '위태할', frequency: 5 },
  ]],
  ['유', [
    { hanja: '有', meaning: '있을', frequency: 9 },
    { hanja: '由', meaning: '말미암을', frequency: 7 },
    { hanja: '油', meaning: '기름', frequency: 5 },
    { hanja: '遊', meaning: '놀', frequency: 5 },
    { hanja: '柔', meaning: '부드러울', frequency: 4 },
    { hanja: '遺', meaning: '남길', frequency: 4 },
  ]],
  ['육', [
    { hanja: '六', meaning: '여섯', frequency: 8 },
    { hanja: '肉', meaning: '고기', frequency: 5 },
    { hanja: '育', meaning: '기를', frequency: 6 },
  ]],
  ['은', [
    { hanja: '銀', meaning: '은', frequency: 6 },
    { hanja: '恩', meaning: '은혜', frequency: 5 },
    { hanja: '隱', meaning: '숨을', frequency: 4 },
  ]],
  ['음', [
    { hanja: '音', meaning: '소리', frequency: 7 },
    { hanja: '飮', meaning: '마실', frequency: 5 },
    { hanja: '陰', meaning: '그늘', frequency: 4 },
  ]],
  ['읍', [
    { hanja: '邑', meaning: '고을', frequency: 4 },
  ]],
  ['응', [
    { hanja: '應', meaning: '응할', frequency: 6 },
  ]],
  ['의', [
    { hanja: '意', meaning: '뜻', frequency: 9 },
    { hanja: '義', meaning: '옳을', frequency: 8 },
    { hanja: '醫', meaning: '의원', frequency: 7 },
    { hanja: '依', meaning: '의지할', frequency: 5 },
    { hanja: '議', meaning: '의논할', frequency: 6 },
    { hanja: '衣', meaning: '옷', frequency: 5 },
  ]],
  ['이', [
    { hanja: '二', meaning: '두', frequency: 10 },
    { hanja: '李', meaning: '오얏/성씨', frequency: 8 },
    { hanja: '以', meaning: '써', frequency: 8 },
    { hanja: '異', meaning: '다를', frequency: 5 },
    { hanja: '已', meaning: '이미', frequency: 4 },
    { hanja: '耳', meaning: '귀', frequency: 4 },
    { hanja: '移', meaning: '옮길', frequency: 5 },
  ]],
  ['익', [
    { hanja: '益', meaning: '더할', frequency: 5 },
  ]],
  ['인', [
    { hanja: '人', meaning: '사람', frequency: 10 },
    { hanja: '因', meaning: '인할', frequency: 7 },
    { hanja: '引', meaning: '끌', frequency: 6 },
    { hanja: '仁', meaning: '어질', frequency: 5 },
    { hanja: '印', meaning: '도장', frequency: 5 },
    { hanja: '認', meaning: '알', frequency: 6 },
  ]],
  ['일', [
    { hanja: '一', meaning: '한', frequency: 10 },
    { hanja: '日', meaning: '날', frequency: 10 },
  ]],
  ['임', [
    { hanja: '任', meaning: '맡길', frequency: 6 },
    { hanja: '林', meaning: '수풀', frequency: 5 },
  ]],
  ['입', [
    { hanja: '入', meaning: '들', frequency: 9 },
  ]],
  ['자', [
    { hanja: '子', meaning: '아들', frequency: 9 },
    { hanja: '自', meaning: '스스로', frequency: 9 },
    { hanja: '字', meaning: '글자', frequency: 8 },
    { hanja: '者', meaning: '놈', frequency: 8 },
    { hanja: '姉', meaning: '맏누이', frequency: 4 },
    { hanja: '資', meaning: '재물', frequency: 5 },
    { hanja: '姿', meaning: '모양', frequency: 4 },
  ]],
  ['작', [
    { hanja: '作', meaning: '지을', frequency: 8 },
    { hanja: '昨', meaning: '어제', frequency: 5 },
  ]],
  ['장', [
    { hanja: '長', meaning: '긴', frequency: 9 },
    { hanja: '場', meaning: '마당', frequency: 8 },
    { hanja: '章', meaning: '글', frequency: 6 },
    { hanja: '將', meaning: '장수', frequency: 6 },
    { hanja: '張', meaning: '베풀', frequency: 5 },
    { hanja: '帳', meaning: '장막', frequency: 4 },
    { hanja: '裝', meaning: '꾸밀', frequency: 4 },
  ]],
  ['재', [
    { hanja: '在', meaning: '있을', frequency: 9 },
    { hanja: '才', meaning: '재주', frequency: 7 },
    { hanja: '材', meaning: '재목', frequency: 5 },
    { hanja: '財', meaning: '재물', frequency: 6 },
    { hanja: '再', meaning: '두', frequency: 6 },
  ]],
  ['적', [
    { hanja: '的', meaning: '과녁/~의', frequency: 9 },
    { hanja: '赤', meaning: '붉을', frequency: 5 },
    { hanja: '敵', meaning: '대적할', frequency: 5 },
    { hanja: '積', meaning: '쌓을', frequency: 5 },
  ]],
  ['전', [
    { hanja: '前', meaning: '앞', frequency: 10 },
    { hanja: '全', meaning: '온전할', frequency: 9 },
    { hanja: '電', meaning: '번개', frequency: 8 },
    { hanja: '田', meaning: '밭', frequency: 6 },
    { hanja: '戰', meaning: '싸움', frequency: 7 },
    { hanja: '展', meaning: '펼', frequency: 6 },
    { hanja: '傳', meaning: '전할', frequency: 7 },
    { hanja: '典', meaning: '법', frequency: 4 },
  ]],
  ['절', [
    { hanja: '節', meaning: '마디', frequency: 7 },
    { hanja: '絶', meaning: '끊을', frequency: 5 },
    { hanja: '切', meaning: '끊을', frequency: 5 },
  ]],
  ['점', [
    { hanja: '點', meaning: '점', frequency: 7 },
    { hanja: '店', meaning: '가게', frequency: 6 },
  ]],
  ['접', [
    { hanja: '接', meaning: '이을', frequency: 5 },
  ]],
  ['정', [
    { hanja: '正', meaning: '바를', frequency: 9 },
    { hanja: '定', meaning: '정할', frequency: 8 },
    { hanja: '政', meaning: '정사', frequency: 7 },
    { hanja: '情', meaning: '뜻', frequency: 7 },
    { hanja: '精', meaning: '정할', frequency: 6 },
    { hanja: '靜', meaning: '고요할', frequency: 5 },
    { hanja: '庭', meaning: '뜰', frequency: 6 },
    { hanja: '程', meaning: '한도', frequency: 5 },
    { hanja: '丁', meaning: '고무래', frequency: 4 },
    { hanja: '停', meaning: '머무를', frequency: 4 },
  ]],
  ['제', [
    { hanja: '第', meaning: '차례', frequency: 8 },
    { hanja: '弟', meaning: '아우', frequency: 7 },
    { hanja: '題', meaning: '제목', frequency: 7 },
    { hanja: '制', meaning: '절제할', frequency: 6 },
    { hanja: '製', meaning: '지을', frequency: 5 },
    { hanja: '提', meaning: '끌', frequency: 6 },
    { hanja: '除', meaning: '덜', frequency: 5 },
    { hanja: '祭', meaname: '제사', frequency: 4 },
    { hanja: '帝', meaning: '임금', frequency: 5 },
  ]],
  ['조', [
    { hanja: '朝', meaning: '아침', frequency: 7 },
    { hanja: '助', meaning: '도울', frequency: 6 },
    { hanja: '調', meaning: '고를', frequency: 7 },
    { hanja: '造', meaning: '지을', frequency: 6 },
    { hanja: '組', meaning: '짤', frequency: 5 },
    { hanja: '祖', meaning: '할아비', frequency: 5 },
    { hanja: '早', meaning: '이를', frequency: 5 },
    { hanja: '兆', meaning: '조짐/억조', frequency: 4 },
    { hanja: '鳥', meaning: '새', frequency: 4 },
  ]],
  ['족', [
    { hanja: '足', meaning: '발', frequency: 7 },
    { hanja: '族', meaning: '겨레', frequency: 7 },
  ]],
  ['존', [
    { hanja: '存', meaning: '있을', frequency: 6 },
    { hanja: '尊', meaning: '높을', frequency: 5 },
  ]],
  ['종', [
    { hanja: '種', meaning: '씨', frequency: 7 },
    { hanja: '終', meaning: '마칠', frequency: 6 },
    { hanja: '宗', meaning: '마루', frequency: 5 },
    { hanja: '從', meaning: '좇을', frequency: 5 },
    { hanja: '鐘', meaning: '쇠북', frequency: 4 },
  ]],
  ['좌', [
    { hanja: '左', meaning: '왼', frequency: 7 },
    { hanja: '座', meaning: '자리', frequency: 4 },
  ]],
  ['죄', [
    { hanja: '罪', meaning: '허물', frequency: 5 },
  ]],
  ['주', [
    { hanja: '主', meaning: '주인', frequency: 9 },
    { hanja: '住', meaning: '살', frequency: 7 },
    { hanja: '注', meaning: '부을', frequency: 6 },
    { hanja: '州', meaning: '고을', frequency: 5 },
    { hanja: '走', meaning: '달릴', frequency: 5 },
    { hanja: '週', meaning: '주일', frequency: 6 },
    { hanja: '酒', meaning: '술', frequency: 5 },
    { hanja: '晝', meaning: '낮', frequency: 4 },
  ]],
  ['죽', [
    { hanja: '竹', meaning: '대', frequency: 5 },
  ]],
  ['준', [
    { hanja: '準', meaning: '준할', frequency: 6 },
    { hanja: '俊', meaning: '준걸', frequency: 4 },
  ]],
  ['중', [
    { hanja: '中', meaning: '가운데', frequency: 10 },
    { hanja: '重', meaning: '무거울', frequency: 8 },
    { hanja: '衆', meaning: '무리', frequency: 5 },
  ]],
  ['지', [
    { hanja: '之', meaning: '갈/~의', frequency: 8 },
    { hanja: '止', meaning: '그칠', frequency: 5 },
    { hanja: '至', meaning: '이를', frequency: 6 },
    { hanja: '地', meaning: '땅', frequency: 9 },
    { hanja: '指', meaning: '가리킬', frequency: 6 },
    { hanja: '知', meaning: '알', frequency: 8 },
    { hanja: '紙', meaning: '종이', frequency: 6 },
    { hanja: '志', meaning: '뜻', frequency: 6 },
    { hanja: '持', meaning: '가질', frequency: 6 },
    { hanja: '支', meaning: '지탱할', frequency: 6 },
  ]],
  ['직', [
    { hanja: '直', meaning: '곧을', frequency: 7 },
    { hanja: '職', meaning: '직분', frequency: 6 },
  ]],
  ['진', [
    { hanja: '眞', meaning: '참', frequency: 7 },
    { hanja: '進', meaning: '나아갈', frequency: 7 },
    { hanja: '盡', meaning: '다할', frequency: 5 },
    { hanja: '陳', meaning: '베풀/성씨', frequency: 4 },
  ]],
  ['질', [
    { hanja: '質', meaning: '바탕', frequency: 6 },
  ]],
  ['집', [
    { hanja: '集', meaning: '모을', frequency: 7 },
    { hanja: '執', meaning: '잡을', frequency: 4 },
  ]],
  ['차', [
    { hanja: '車', meaning: '수레', frequency: 7 },
    { hanja: '次', meaning: '버금', frequency: 7 },
    { hanja: '此', meaning: '이', frequency: 5 },
    { hanja: '茶', meaning: '차', frequency: 4 },
  ]],
  ['착', [
    { hanja: '着', meaning: '붙을', frequency: 6 },
  ]],
  ['찬', [
    { hanja: '贊', meaning: '도울', frequency: 4 },
    { hanja: '讚', meaning: '기릴', frequency: 4 },
  ]],
  ['찰', [
    { hanja: '察', meaning: '살필', frequency: 5 },
  ]],
  ['참', [
    { hanja: '參', meaning: '참여할', frequency: 6 },
  ]],
  ['창', [
    { hanja: '窓', meaning: '창', frequency: 5 },
    { hanja: '創', meaning: '비롯할', frequency: 5 },
    { hanja: '唱', meaning: '부를', frequency: 4 },
  ]],
  ['채', [
    { hanja: '採', meaning: '캘', frequency: 4 },
    { hanja: '彩', meaning: '채색', frequency: 4 },
  ]],
  ['책', [
    { hanja: '責', meaning: '꾸짖을', frequency: 5 },
    { hanja: '冊', meaning: '책', frequency: 6 },
  ]],
  ['처', [
    { hanja: '處', meaning: '곳', frequency: 6 },
    { hanja: '妻', meaning: '아내', frequency: 5 },
  ]],
  ['천', [
    { hanja: '天', meaning: '하늘', frequency: 9 },
    { hanja: '川', meaning: '내', frequency: 6 },
    { hanja: '千', meaning: '일천', frequency: 7 },
    { hanja: '泉', meaning: '샘', frequency: 4 },
  ]],
  ['철', [
    { hanja: '鐵', meaning: '쇠', frequency: 6 },
    { hanja: '哲', meaning: '밝을', frequency: 4 },
  ]],
  ['청', [
    { hanja: '靑', meaning: '푸를', frequency: 7 },
    { hanja: '淸', meaning: '맑을', frequency: 7 },
    { hanja: '請', meaning: '청할', frequency: 6 },
    { hanja: '聽', meaning: '들을', frequency: 5 },
    { hanja: '廳', meaning: '관청', frequency: 4 },
  ]],
  ['체', [
    { hanja: '體', meaning: '몸', frequency: 7 },
    { hanja: '替', meaning: '바꿀', frequency: 3 },
  ]],
  ['초', [
    { hanja: '初', meaning: '처음', frequency: 7 },
    { hanja: '草', meaning: '풀', frequency: 5 },
    { hanja: '招', meaning: '부를', frequency: 4 },
    { hanja: '超', meaning: '뛰어넘을', frequency: 4 },
  ]],
  ['촌', [
    { hanja: '村', meaning: '마을', frequency: 6 },
    { hanja: '寸', meaning: '마디', frequency: 5 },
  ]],
  ['총', [
    { hanja: '總', meaning: '다', frequency: 6 },
    { hanja: '銃', meaning: '총', frequency: 4 },
  ]],
  ['최', [
    { hanja: '最', meaning: '가장', frequency: 7 },
    { hanja: '崔', meaning: '성씨', frequency: 6 },
  ]],
  ['추', [
    { hanja: '秋', meaning: '가을', frequency: 6 },
    { hanja: '追', meaning: '쫓을', frequency: 5 },
    { hanja: '推', meaning: '밀', frequency: 5 },
  ]],
  ['축', [
    { hanja: '祝', meaning: '빌', frequency: 5 },
    { hanja: '築', meaning: '쌓을', frequency: 4 },
    { hanja: '畜', meaning: '짐승', frequency: 3 },
  ]],
  ['춘', [
    { hanja: '春', meaning: '봄', frequency: 6 },
  ]],
  ['출', [
    { hanja: '出', meaning: '날', frequency: 9 },
  ]],
  ['충', [
    { hanja: '忠', meaning: '충성', frequency: 5 },
    { hanja: '蟲', meaning: '벌레', frequency: 4 },
  ]],
  ['취', [
    { hanja: '取', meaning: '가질', frequency: 6 },
    { hanja: '就', meaning: '나아갈', frequency: 5 },
    { hanja: '吹', meaning: '불', frequency: 3 },
  ]],
  ['치', [
    { hanja: '治', meaning: '다스릴', frequency: 6 },
    { hanja: '致', meaning: '이를', frequency: 5 },
    { hanja: '齒', meaning: '이', frequency: 4 },
  ]],
  ['친', [
    { hanja: '親', meaning: '친할', frequency: 7 },
  ]],
  ['칠', [
    { hanja: '七', meaning: '일곱', frequency: 8 },
  ]],
  ['침', [
    { hanja: '針', meaning: '바늘', frequency: 4 },
    { hanja: '侵', meaning: '침노할', frequency: 4 },
  ]],
  ['쾌', [
    { hanja: '快', meaning: '쾌할', frequency: 4 },
  ]],
  ['타', [
    { hanja: '他', meaning: '다를', frequency: 7 },
    { hanja: '打', meaning: '칠', frequency: 5 },
  ]],
  ['탁', [
    { hanja: '卓', meaning: '높을', frequency: 4 },
    { hanja: '濁', meaning: '흐릴', frequency: 3 },
  ]],
  ['탄', [
    { hanja: '炭', meaning: '숯', frequency: 4 },
    { hanja: '彈', meaning: '탄알', frequency: 4 },
  ]],
  ['태', [
    { hanja: '太', meaning: '클', frequency: 6 },
    { hanja: '泰', meaning: '클', frequency: 4 },
    { hanja: '態', meaning: '모습', frequency: 5 },
  ]],
  ['택', [
    { hanja: '宅', meaning: '집', frequency: 5 },
    { hanja: '擇', meaning: '가릴', frequency: 4 },
  ]],
  ['토', [
    { hanja: '土', meaning: '흙', frequency: 7 },
    { hanja: '吐', meaning: '토할', frequency: 3 },
  ]],
  ['통', [
    { hanja: '通', meaning: '통할', frequency: 8 },
    { hanja: '統', meaning: '거느릴', frequency: 6 },
    { hanja: '痛', meaning: '아플', frequency: 4 },
  ]],
  ['퇴', [
    { hanja: '退', meaning: '물러날', frequency: 4 },
  ]],
  ['투', [
    { hanja: '投', meaning: '던질', frequency: 5 },
    { hanja: '鬪', meaning: '싸울', frequency: 4 },
  ]],
  ['특', [
    { hanja: '特', meaning: '특별할', frequency: 7 },
  ]],
  ['파', [
    { hanja: '波', meaning: '물결', frequency: 6 },
    { hanja: '破', meaning: '깨뜨릴', frequency: 5 },
    { hanja: '派', meaning: '갈래', frequency: 5 },
  ]],
  ['판', [
    { hanja: '判', meaning: '판단할', frequency: 6 },
    { hanja: '板', meaning: '널', frequency: 5 },
    { hanja: '版', meaning: '판목', frequency: 4 },
  ]],
  ['팔', [
    { hanja: '八', meaning: '여덟', frequency: 8 },
  ]],
  ['패', [
    { hanja: '敗', meaning: '패할', frequency: 5 },
    { hanja: '貝', meaning: '조개', frequency: 3 },
  ]],
  ['편', [
    { hanja: '便', meaning: '편할', frequency: 7 },
    { hanja: '片', meaning: '조각', frequency: 4 },
    { hanja: '篇', meaning: '책', frequency: 4 },
  ]],
  ['평', [
    { hanja: '平', meaning: '평평할', frequency: 8 },
    { hanja: '評', meaning: '평할', frequency: 5 },
  ]],
  ['폐', [
    { hanja: '閉', meaning: '닫을', frequency: 4 },
    { hanja: '廢', meaning: '폐할', frequency: 4 },
  ]],
  ['포', [
    { hanja: '布', meaning: '베', frequency: 5 },
    { hanja: '包', meaning: '쌀', frequency: 5 },
    { hanja: '砲', meaning: '대포', frequency: 4 },
  ]],
  ['폭', [
    { hanja: '暴', meaning: '사나울', frequency: 5 },
    { hanja: '爆', meaning: '터질', frequency: 4 },
    { hanja: '幅', meaning: '폭', frequency: 4 },
  ]],
  ['표', [
    { hanja: '表', meaning: '겉', frequency: 7 },
    { hanja: '票', meaning: '표', frequency: 6 },
    { hanja: '標', meaning: '표할', frequency: 5 },
  ]],
  ['품', [
    { hanja: '品', meaning: '물건', frequency: 7 },
  ]],
  ['풍', [
    { hanja: '風', meaning: '바람', frequency: 7 },
    { hanja: '豊', meaning: '풍년', frequency: 4 },
  ]],
  ['피', [
    { hanja: '皮', meaning: '가죽', frequency: 5 },
    { hanja: '彼', meaning: '저', frequency: 4 },
    { hanja: '疲', meaning: '피곤할', frequency: 4 },
  ]],
  ['필', [
    { hanja: '必', meaning: '반드시', frequency: 7 },
    { hanja: '筆', meaning: '붓', frequency: 5 },
  ]],
  ['하', [
    { hanja: '下', meaning: '아래', frequency: 10 },
    { hanja: '夏', meaning: '여름', frequency: 6 },
    { hanja: '河', meaning: '물', frequency: 5 },
    { hanja: '何', meaning: '어찌', frequency: 5 },
    { hanja: '賀', meaning: '하례할', frequency: 4 },
  ]],
  ['학', [
    { hanja: '學', meaning: '배울', frequency: 9 },
    { hanja: '鶴', meaning: '학', frequency: 3 },
  ]],
  ['한', [
    { hanja: '韓', meaning: '한국/나라', frequency: 9 },
    { hanja: '漢', meaning: '한수/한나라', frequency: 7 },
    { hanja: '寒', meaning: '찰', frequency: 5 },
    { hanja: '閑', meaning: '한가할', frequency: 4 },
    { hanja: '限', meaning: '한할', frequency: 5 },
  ]],
  ['할', [
    { hanja: '割', meaning: '벨', frequency: 4 },
  ]],
  ['함', [
    { hanja: '咸', meaning: '다', frequency: 3 },
    { hanja: '含', meaning: '머금을', frequency: 4 },
  ]],
  ['합', [
    { hanja: '合', meaning: '합할', frequency: 8 },
  ]],
  ['항', [
    { hanja: '抗', meaning: '겨룰', frequency: 4 },
    { hanja: '港', meaning: '항구', frequency: 5 },
    { hanja: '航', meaning: '배', frequency: 4 },
  ]],
  ['해', [
    { hanja: '海', meaning: '바다', frequency: 8 },
    { hanja: '解', meaning: '풀', frequency: 7 },
    { hanja: '害', meaning: '해할', frequency: 5 },
  ]],
  ['행', [
    { hanja: '行', meaning: '다닐', frequency: 9 },
    { hanja: '幸', meaning: '다행', frequency: 6 },
  ]],
  ['향', [
    { hanja: '向', meaning: '향할', frequency: 7 },
    { hanja: '鄕', meaning: '시골', frequency: 5 },
    { hanja: '香', meaning: '향기', frequency: 4 },
  ]],
  ['허', [
    { hanja: '許', meaning: '허락할', frequency: 5 },
    { hanja: '虛', meaning: '빌', frequency: 4 },
  ]],
  ['혁', [
    { hanja: '革', meaning: '가죽', frequency: 4 },
  ]],
  ['현', [
    { hanja: '現', meaning: '나타날', frequency: 8 },
    { hanja: '玄', meaning: '검을', frequency: 4 },
    { hanja: '賢', meaning: '어질', frequency: 5 },
    { hanja: '縣', meaning: '고을', frequency: 3 },
  ]],
  ['혈', [
    { hanja: '血', meaning: '피', frequency: 5 },
  ]],
  ['협', [
    { hanja: '協', meaning: '도울', frequency: 5 },
  ]],
  ['형', [
    { hanja: '兄', meaning: '형', frequency: 7 },
    { hanja: '形', meaning: '모양', frequency: 7 },
    { hanja: '刑', meaning: '형벌', frequency: 4 },
  ]],
  ['혜', [
    { hanja: '惠', meaning: '은혜', frequency: 5 },
  ]],
  ['호', [
    { hanja: '戶', meaning: '집', frequency: 5 },
    { hanja: '好', meaning: '좋을', frequency: 7 },
    { hanja: '湖', meaning: '호수', frequency: 5 },
    { hanja: '虎', meaning: '범', frequency: 4 },
    { hanja: '呼', meaning: '부를', frequency: 5 },
    { hanja: '號', meaning: '이름', frequency: 5 },
    { hanja: '護', meaning: '도울', frequency: 5 },
  ]],
  ['혹', [
    { hanja: '或', meaning: '혹', frequency: 5 },
  ]],
  ['혼', [
    { hanja: '婚', meaning: '혼인할', frequency: 5 },
    { hanja: '混', meaning: '섞을', frequency: 4 },
  ]],
  ['홍', [
    { hanja: '紅', meaning: '붉을', frequency: 4 },
    { hanja: '洪', meaning: '넓을', frequency: 4 },
  ]],
  ['화', [
    { hanja: '火', meaning: '불', frequency: 8 },
    { hanja: '花', meaning: '꽃', frequency: 7 },
    { hanja: '化', meaning: '될', frequency: 7 },
    { hanja: '貨', meaning: '재물', frequency: 5 },
    { hanja: '和', meaning: '화할', frequency: 7 },
    { hanja: '話', meaning: '말씀', frequency: 7 },
    { hanja: '畵', meaning: '그림', frequency: 5 },
    { hanja: '華', meaning: '빛날', frequency: 4 },
  ]],
  ['확', [
    { hanja: '確', meaning: '굳을', frequency: 5 },
    { hanja: '擴', meaning: '넓힐', frequency: 4 },
  ]],
  ['환', [
    { hanja: '歡', meaning: '기쁠', frequency: 4 },
    { hanja: '患', meaning: '근심', frequency: 4 },
    { hanja: '換', meaning: '바꿀', frequency: 4 },
    { hanja: '環', meaning: '고리', frequency: 4 },
  ]],
  ['활', [
    { hanja: '活', meaning: '살', frequency: 7 },
  ]],
  ['황', [
    { hanja: '黃', meaning: '누를', frequency: 5 },
    { hanja: '皇', meaning: '임금', frequency: 4 },
    { hanja: '況', meaning: '상황', frequency: 4 },
  ]],
  ['회', [
    { hanja: '會', meaning: '모일', frequency: 8 },
    { hanja: '回', meaning: '돌아올', frequency: 7 },
    { hanja: '灰', meaning: '재', frequency: 3 },
  ]],
  ['효', [
    { hanja: '孝', meaning: '효도', frequency: 5 },
    { hanja: '效', meaning: '본받을', frequency: 5 },
  ]],
  ['후', [
    { hanja: '後', meaning: '뒤', frequency: 9 },
    { hanja: '厚', meaning: '두터울', frequency: 4 },
    { hanja: '候', meaning: '기후', frequency: 4 },
  ]],
  ['훈', [
    { hanja: '訓', meaning: '가르칠', frequency: 5 },
  ]],
  ['휴', [
    { hanja: '休', meaning: '쉴', frequency: 6 },
  ]],
  ['흉', [
    { hanja: '凶', meaning: '흉할', frequency: 4 },
  ]],
  ['흑', [
    { hanja: '黑', meaning: '검을', frequency: 5 },
  ]],
  ['흥', [
    { hanja: '興', meaning: '일', frequency: 5 },
  ]],
  ['희', [
    { hanja: '希', meaning: '바랄', frequency: 6 },
    { hanja: '喜', meaning: '기쁠', frequency: 5 },
  ]],
];

// 위 데이터에 typo가 있는지 자동 정리(meaning <-> meaname 같은 키 오타 안전 보정)
for (const [, entries] of SYLLABLE_DATA) {
  for (const e of entries) {
    // 일부 항목에 잘못 입력된 키 'meaname'가 있을 경우 'meaning'으로 보정.
    if (e.meaning === undefined && /** @type {any} */ (e).meaname !== undefined) {
      e.meaning = /** @type {any} */ (e).meaname;
      delete (/** @type {any} */ (e).meaname);
    }
  }
}

/**
 * 음절 사전 (Map<string, HanjaEntry[]>) - 후보는 frequency 내림차순.
 *
 * @type {Map<string, Array<HanjaEntry>>}
 */
export const SYLLABLE_DICTIONARY = new Map(
  SYLLABLE_DATA.map(([k, list]) => [
    k,
    [...list].sort((a, b) => b.frequency - a.frequency),
  ])
);

/**
 * 자주 쓰이는 다음절 단어 사전.
 * 단어 우선 매칭에 사용된다.
 *
 * @type {Array<[string, Array<HanjaEntry>]>}
 */
const WORD_DATA = [
  ['국가', [{ hanja: '國家', meaning: '나라', frequency: 9 }]],
  ['국민', [{ hanja: '國民', meaning: '한 나라의 백성', frequency: 9 }]],
  ['국어', [{ hanja: '國語', meaning: '나라 말', frequency: 8 }]],
  ['국제', [{ hanja: '國際', meaning: '나라 사이', frequency: 8 }]],
  ['학교', [{ hanja: '學校', meaning: '배움터', frequency: 10 }]],
  ['학생', [{ hanja: '學生', meaning: '배우는 사람', frequency: 10 }]],
  ['학습', [{ hanja: '學習', meaning: '배우고 익힘', frequency: 8 }]],
  ['선생', [{ hanja: '先生', meaning: '스승', frequency: 9 }]],
  ['교사', [{ hanja: '敎師', meaning: '가르치는 사람', frequency: 8 }]],
  ['교육', [{ hanja: '敎育', meaning: '가르쳐 기름', frequency: 9 }]],
  ['대학', [{ hanja: '大學', meaning: '큰 배움터', frequency: 9 }]],
  ['대학교', [{ hanja: '大學校', meaning: '대학교', frequency: 8 }]],
  ['한국', [{ hanja: '韓國', meaning: '대한민국', frequency: 10 }]],
  ['한자', [{ hanja: '漢字', meaning: '한자', frequency: 10 }]],
  ['한글', [{ hanja: '韓글', meaning: '한국 고유 문자(혼용표기)', frequency: 5 }]],
  ['중국', [{ hanja: '中國', meaning: '중국', frequency: 9 }]],
  ['일본', [{ hanja: '日本', meaning: '일본', frequency: 9 }]],
  ['미국', [{ hanja: '美國', meaning: '미국', frequency: 9 }]],
  ['세계', [{ hanja: '世界', meaning: '세계', frequency: 9 }]],
  ['사회', [{ hanja: '社會', meaning: '사회', frequency: 9 }]],
  ['회사', [{ hanja: '會社', meaning: '회사', frequency: 9 }]],
  ['경제', [{ hanja: '經濟', meaning: '경제', frequency: 9 }]],
  ['정치', [{ hanja: '政治', meaning: '정치', frequency: 9 }]],
  ['정부', [{ hanja: '政府', meaning: '정부', frequency: 8 }]],
  ['문화', [{ hanja: '文化', meaning: '문화', frequency: 9 }]],
  ['역사', [{ hanja: '歷史', meaning: '역사', frequency: 8 }]],
  ['과학', [{ hanja: '科學', meaning: '과학', frequency: 8 }]],
  ['수학', [{ hanja: '數學', meaning: '수학', frequency: 8 }]],
  ['철학', [{ hanja: '哲學', meaning: '철학', frequency: 6 }]],
  ['문학', [{ hanja: '文學', meaning: '문학', frequency: 7 }]],
  ['음악', [{ hanja: '音樂', meaning: '음악', frequency: 8 }]],
  ['미술', [{ hanja: '美術', meaning: '미술', frequency: 6 }]],
  ['체육', [{ hanja: '體育', meaning: '체육', frequency: 6 }]],
  ['시간', [{ hanja: '時間', meaning: '시간', frequency: 10 }]],
  ['공간', [{ hanja: '空間', meaning: '공간', frequency: 8 }]],
  ['인간', [{ hanja: '人間', meaning: '인간', frequency: 9 }]],
  ['세상', [{ hanja: '世上', meaning: '세상', frequency: 8 }]],
  ['세월', [{ hanja: '歲月', meaning: '세월', frequency: 6 }]],
  ['오늘', [{ hanja: '오늘', meaning: '오늘(고유어)', frequency: 1 }]], // not converted
  ['하루', [{ hanja: '하루', meaning: '하루(고유어)', frequency: 1 }]], // not converted
  ['아침', [{ hanja: '아침', meaning: '아침(고유어)', frequency: 1 }]], // not converted
  ['저녁', [{ hanja: '저녁', meaning: '저녁(고유어)', frequency: 1 }]], // not converted
  ['지금', [{ hanja: '只今', meaning: '지금', frequency: 8 }]],
  ['오전', [{ hanja: '午前', meaning: '오전', frequency: 8 }]],
  ['오후', [{ hanja: '午後', meaning: '오후', frequency: 8 }]],
  ['주말', [{ hanja: '週末', meaning: '주말', frequency: 7 }]],
  ['연말', [{ hanja: '年末', meaning: '연말', frequency: 6 }]],
  ['신년', [{ hanja: '新年', meaning: '새해', frequency: 6 }]],
  ['신문', [{ hanja: '新聞', meaning: '신문', frequency: 8 }]],
  ['방송', [{ hanja: '放送', meaning: '방송', frequency: 8 }]],
  ['전화', [{ hanja: '電話', meaning: '전화', frequency: 9 }]],
  ['전기', [{ hanja: '電氣', meaning: '전기', frequency: 8 }]],
  ['전자', [{ hanja: '電子', meaning: '전자', frequency: 7 }]],
  ['자동', [{ hanja: '自動', meaning: '자동', frequency: 7 }]],
  ['자동차', [{ hanja: '自動車', meaning: '자동차', frequency: 9 }]],
  ['철도', [{ hanja: '鐵道', meaning: '철도', frequency: 6 }]],
  ['도로', [{ hanja: '道路', meaning: '도로', frequency: 7 }]],
  ['수도', [{ hanja: '首都', meaning: '수도', frequency: 7 }]],
  ['도시', [{ hanja: '都市', meaning: '도시', frequency: 8 }]],
  ['시민', [{ hanja: '市民', meaning: '시민', frequency: 8 }]],
  ['민주', [{ hanja: '民主', meaning: '민주', frequency: 7 }]],
  ['민족', [{ hanja: '民族', meaning: '민족', frequency: 7 }]],
  ['가족', [{ hanja: '家族', meaning: '가족', frequency: 9 }]],
  ['친구', [{ hanja: '親舊', meaning: '친구', frequency: 9 }]],
  ['형제', [{ hanja: '兄弟', meaning: '형제', frequency: 7 }]],
  ['부모', [{ hanja: '父母', meaning: '부모', frequency: 8 }]],
  ['자녀', [{ hanja: '子女', meaning: '자녀', frequency: 7 }]],
  ['남자', [{ hanja: '男子', meaning: '남자', frequency: 8 }]],
  ['여자', [{ hanja: '女子', meaning: '여자', frequency: 8 }]],
  ['소년', [{ hanja: '少年', meaning: '소년', frequency: 6 }]],
  ['청년', [{ hanja: '靑年', meaning: '청년', frequency: 6 }]],
  ['노인', [{ hanja: '老人', meaning: '노인', frequency: 6 }]],
  ['선배', [{ hanja: '先輩', meaning: '선배', frequency: 6 }]],
  ['후배', [{ hanja: '後輩', meaning: '후배', frequency: 6 }]],
  ['생활', [{ hanja: '生活', meaning: '생활', frequency: 9 }]],
  ['일상', [{ hanja: '日常', meaning: '일상', frequency: 7 }]],
  ['행복', [{ hanja: '幸福', meaning: '행복', frequency: 8 }]],
  ['평화', [{ hanja: '平和', meaning: '평화', frequency: 7 }]],
  ['자유', [{ hanja: '自由', meaning: '자유', frequency: 8 }]],
  ['평등', [{ hanja: '平等', meaning: '평등', frequency: 6 }]],
  ['사랑', [{ hanja: '사랑', meaning: '사랑(고유어)', frequency: 1 }]], // not converted
  ['연인', [{ hanja: '戀人', meaning: '연인', frequency: 6 }]],
  ['이론', [{ hanja: '理論', meaning: '이론', frequency: 7 }]],
  ['실제', [{ hanja: '實際', meaning: '실제', frequency: 7 }]],
  ['연구', [{ hanja: '硏究', meaning: '연구', frequency: 8 }]],
  ['개발', [{ hanja: '開發', meaning: '개발', frequency: 8 }]],
  ['발전', [{ hanja: '發展', meaning: '발전', frequency: 8 }]],
  ['진보', [{ hanja: '進步', meaning: '진보', frequency: 5 }]],
  ['성공', [{ hanja: '成功', meaning: '성공', frequency: 8 }]],
  ['실패', [{ hanja: '失敗', meaning: '실패', frequency: 6 }]],
  ['문제', [{ hanja: '問題', meaning: '문제', frequency: 9 }]],
  ['해결', [{ hanja: '解決', meaning: '해결', frequency: 8 }]],
  ['결과', [{ hanja: '結果', meaning: '결과', frequency: 8 }]],
  ['원인', [{ hanja: '原因', meaning: '원인', frequency: 7 }]],
  ['방법', [{ hanja: '方法', meaning: '방법', frequency: 9 }]],
  ['목적', [{ hanja: '目的', meaning: '목적', frequency: 8 }]],
  ['목표', [{ hanja: '目標', meaning: '목표', frequency: 8 }]],
  ['계획', [{ hanja: '計劃', meaning: '계획', frequency: 8 }]],
  ['준비', [{ hanja: '準備', meaning: '준비', frequency: 8 }]],
  ['진행', [{ hanja: '進行', meaning: '진행', frequency: 8 }]],
  ['완성', [{ hanja: '完成', meaning: '완성', frequency: 7 }]],
];

/**
 * 다음절 단어 사전 Map
 * @type {Map<string, Array<HanjaEntry>>}
 */
export const WORD_DICTIONARY = new Map(WORD_DATA);

/**
 * 음절 후보 조회
 * @param {string} syllable 한글 1글자
 * @returns {Array<HanjaEntry>} 빈도 내림차순 후보 (없으면 빈 배열)
 */
export function getSyllableCandidates(syllable) {
  if (!syllable || typeof syllable !== 'string') return [];
  return SYLLABLE_DICTIONARY.get(syllable) || [];
}

/**
 * 단어 후보 조회
 * @param {string} word 한글 다음절 단어
 * @returns {Array<HanjaEntry>} 후보 (없으면 빈 배열)
 */
export function getWordCandidates(word) {
  if (!word || typeof word !== 'string') return [];
  return WORD_DICTIONARY.get(word) || [];
}

/**
 * 사전 통계
 * @returns {{syllableCount:number, wordCount:number, totalEntries:number}}
 */
export function getDictionaryStats() {
  let total = 0;
  for (const entries of SYLLABLE_DICTIONARY.values()) total += entries.length;
  for (const entries of WORD_DICTIONARY.values()) total += entries.length;
  return {
    syllableCount: SYLLABLE_DICTIONARY.size,
    wordCount: WORD_DICTIONARY.size,
    totalEntries: total,
  };
}

/**
 * 한 음절(한글)이 단일 음절인지 확인 (가-힣)
 * @param {string} ch
 * @returns {boolean}
 */
export function isHangulSyllable(ch) {
  if (!ch || ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

export default {
  SYLLABLE_DICTIONARY,
  WORD_DICTIONARY,
  getSyllableCandidates,
  getWordCandidates,
  getDictionaryStats,
  isHangulSyllable,
};
