/**
 * Sample HWPX XML strings for parser tests
 */

export const MINIMAL_SECTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run>
      <hp:secPr>
        <hp:pageSize width="59528" height="84188"/>
        <hp:pageMar top="5668" bottom="5668" left="5668" right="5668"
                    header="4252" footer="4252"/>
      </hp:secPr>
    </hp:run>
  </hp:p>
  <hp:p>
    <hp:run>
      <hp:t>안녕하세요</hp:t>
    </hp:run>
  </hp:p>
</hs:sec>`;

export const SECTION_WITH_TABLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run>
      <hp:tbl colCnt="3" rowCnt="2">
        <hp:tr>
          <hp:tc>
            <hp:subList>
              <hp:p><hp:run><hp:t>A1</hp:t></hp:run></hp:p>
            </hp:subList>
          </hp:tc>
          <hp:tc>
            <hp:subList>
              <hp:p><hp:run><hp:t>B1</hp:t></hp:run></hp:p>
            </hp:subList>
          </hp:tc>
          <hp:tc>
            <hp:subList>
              <hp:p><hp:run><hp:t>C1</hp:t></hp:run></hp:p>
            </hp:subList>
          </hp:tc>
        </hp:tr>
        <hp:tr>
          <hp:tc>
            <hp:subList>
              <hp:p><hp:run><hp:t>A2</hp:t></hp:run></hp:p>
            </hp:subList>
          </hp:tc>
          <hp:tc>
            <hp:subList>
              <hp:p><hp:run><hp:t>B2</hp:t></hp:run></hp:p>
            </hp:subList>
          </hp:tc>
          <hp:tc>
            <hp:subList>
              <hp:p><hp:run><hp:t>C2</hp:t></hp:run></hp:p>
            </hp:subList>
          </hp:tc>
        </hp:tr>
      </hp:tbl>
    </hp:run>
  </hp:p>
</hs:sec>`;

export const SECTION_WITH_IMAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hc="http://www.hancom.co.kr/hwpml/2011/common">
  <hp:p>
    <hp:run>
      <hp:pic>
        <hp:imgRect>
          <hp:imgClip/>
        </hp:imgRect>
        <hp:img binaryItemIDRef="img1"/>
        <hc:sz width="20000" height="15000"/>
      </hp:pic>
    </hp:run>
  </hp:p>
</hs:sec>`;

export const EMPTY_SECTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
</hs:sec>`;

export const SECTION_WITH_STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run charPrIDRef="1">
      <hp:t>Bold and Red</hp:t>
    </hp:run>
  </hp:p>
  <hp:p>
    <hp:run charPrIDRef="2">
      <hp:t>Italic Blue</hp:t>
    </hp:run>
  </hp:p>
</hs:sec>`;

export const MALFORMED_XML = `<?xml version="1.0"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <unclosed-tag>
</hs:sec>`;

export const KOREAN_TEXT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run>
      <hp:t>가나다라마바사아자차카타파하</hp:t>
    </hp:run>
  </hp:p>
  <hp:p>
    <hp:run>
      <hp:t>特殊文字: ①②③ ㄱㄴㄷ ㅏㅑㅓㅕ</hp:t>
    </hp:run>
  </hp:p>
</hs:sec>`;

export const SECTION_WITH_SHAPE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hc="http://www.hancom.co.kr/hwpml/2011/common">
  <hp:p>
    <hp:run>
      <hp:rect>
        <hc:sz width="10000" height="5000"/>
        <hp:offset x="100" y="200"/>
        <hp:lineShape color="#000000" width="1"/>
      </hp:rect>
    </hp:run>
  </hp:p>
</hs:sec>`;
