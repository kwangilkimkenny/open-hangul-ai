/**
 * Renderers Index
 * 모든 렌더러를 하나의 파일에서 export
 * 
 * @module renderers
 * @version 2.0.0
 */

export { renderParagraph, renderParagraphs } from './paragraph.js';
export { renderImage, applyImageOptimizations, clearImageCache } from './image.js';
export { renderTable } from './table.js';
export { renderShape } from './shape.js';
export { renderContainer } from './container.js';
export {
    renderFootnoteArea,
    renderEndnoteArea,
    renderNoteEntry,
    FOOTNOTE_AREA_RESERVE_PX,
} from './footnote.js';

// Default export (모든 렌더러 포함)
export default {
    paragraph: require('./paragraph.js'),
    image: require('./image.js'),
    table: require('./table.js'),
    shape: require('./shape.js'),
    container: require('./container.js'),
    footnote: require('./footnote.js'),
};

