/**
 * Sample parsed HWPX document object for testing
 */

export function createSampleDocument(overrides = {}) {
  return {
    sections: overrides.sections || [createSampleSection()],
    images: overrides.images || new Map(),
    borderFills: overrides.borderFills || new Map(),
    rawHeaderXml: overrides.rawHeaderXml || '<hh:head/>',
    metadata: {
      parsedAt: '2026-01-01T00:00:00.000Z',
      sectionsCount: 1,
      imagesCount: 0,
      borderFillsCount: 0,
      ...overrides.metadata,
    },
  };
}

export function createSampleSection(overrides = {}) {
  return {
    elements: overrides.elements || [
      createSampleParagraph({ text: '안녕하세요. 테스트 문서입니다.' }),
    ],
    pageSettings: {
      width: 595,
      height: 842,
      marginTop: 56.7,
      marginBottom: 56.7,
      marginLeft: 56.7,
      marginRight: 56.7,
      ...overrides.pageSettings,
    },
    header: overrides.header || null,
    footer: overrides.footer || null,
    ...overrides,
  };
}

export function createSampleParagraph(overrides = {}) {
  const text = overrides.text || 'Sample text';
  return {
    type: 'paragraph',
    runs: overrides.runs || [
      {
        text,
        style: {
          fontSize: '13.33px',
          fontFamily: '함초롬돋움',
          color: '#000000',
          bold: false,
          italic: false,
          underline: false,
          ...overrides.runStyle,
        },
      },
    ],
    style: {
      textAlign: 'left',
      lineHeight: 1.6,
      marginTop: '0px',
      marginBottom: '0px',
      ...overrides.style,
    },
    paraPr: overrides.paraPr || {},
    numbering: overrides.numbering || null,
    backgroundShapes: overrides.backgroundShapes || [],
    shapes: overrides.shapes || [],
  };
}

export function createSampleImage(overrides = {}) {
  return {
    type: 'image',
    url: overrides.url || 'blob:mock-image-url',
    src: overrides.src || 'blob:mock-image-url',
    width: overrides.width || 200,
    height: overrides.height || 150,
    alt: overrides.alt || 'Test image',
    position: overrides.position || { treatAsChar: true },
    children: overrides.children || [],
  };
}

export function createEmptyDocument() {
  return {
    sections: [],
    images: new Map(),
    borderFills: new Map(),
    rawHeaderXml: '',
    metadata: {
      parsedAt: '2026-01-01T00:00:00.000Z',
      sectionsCount: 0,
      imagesCount: 0,
      borderFillsCount: 0,
    },
  };
}

export function createDocumentWithImages() {
  const images = new Map();
  images.set('img1', { url: 'blob:test-image-1', type: 'image/png' });
  images.set('img2', { url: 'blob:test-image-2', type: 'image/jpeg' });

  return createSampleDocument({
    images,
    sections: [
      createSampleSection({
        elements: [
          createSampleParagraph({ text: 'Document with images' }),
          createSampleImage({ url: 'blob:test-image-1' }),
          createSampleImage({ url: 'blob:test-image-2' }),
        ],
      }),
    ],
    metadata: { imagesCount: 2 },
  });
}
