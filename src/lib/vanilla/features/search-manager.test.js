/**
 * SearchManager Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

import { SearchManager } from './search-manager.js';

describe('SearchManager', () => {
  let searchManager;
  let viewer;
  let mockPositionManager;
  let mockRangeManager;

  function buildPositionList(text) {
    return text.split('').map((char, i) => ({
      value: char,
      coordinate: { left: i * 10, top: 0, width: 10, height: 20 },
    }));
  }

  beforeEach(() => {
    mockPositionManager = {
      isPositionReady: vi.fn(() => true),
      getPositionList: vi.fn(() => buildPositionList('Hello World Hello')),
    };

    mockRangeManager = {
      setRange: vi.fn(),
      clearSelection: vi.fn(),
    };

    const container = document.createElement('div');
    container.style.position = 'relative';
    document.body.innerHTML = '';
    document.body.appendChild(container);

    // Mock getBoundingClientRect on the container
    container.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
    }));

    // Mock scrollTo
    container.scrollTo = vi.fn();

    viewer = {
      positionManager: mockPositionManager,
      rangeManager: mockRangeManager,
      container,
      cursor: { setCursorPosition: vi.fn() },
      command: null,
    };

    searchManager = new SearchManager(viewer);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // 1. Constructor initializes
  it('should initialize with default state', () => {
    expect(searchManager.searchText).toBe('');
    expect(searchManager.matches).toEqual([]);
    expect(searchManager.currentMatchIndex).toBe(-1);
    expect(searchManager.highlightElements).toEqual([]);
  });

  // 2. find() empty string returns 0 and clears
  it('should return 0 and clear search for empty string', () => {
    // First do a search to populate state
    searchManager.find('Hello');
    expect(searchManager.matches.length).toBeGreaterThan(0);

    // Now search empty
    const result = searchManager.find('');
    expect(result).toBe(0);
    expect(searchManager.searchText).toBe('');
    expect(searchManager.matches).toEqual([]);
  });

  // 3. find() returns match count
  it('should return correct match count', () => {
    const count = searchManager.find('Hello');
    expect(count).toBe(2); // "Hello World Hello" has 2 occurrences of "Hello"
  });

  // 4. find() case sensitive
  it('should find case sensitive matches', () => {
    mockPositionManager.getPositionList.mockReturnValue(buildPositionList('Hello hello HELLO'));

    const count = searchManager.find('Hello', { caseSensitive: true });
    expect(count).toBe(1); // Only exact "Hello" matches
  });

  // 5. find() case insensitive (default)
  it('should find case insensitive matches by default', () => {
    mockPositionManager.getPositionList.mockReturnValue(buildPositionList('Hello hello HELLO'));

    const count = searchManager.find('hello');
    expect(count).toBe(3); // All three match case-insensitively
  });

  // 6. find() whole word
  it('should find whole word matches', () => {
    mockPositionManager.getPositionList.mockReturnValue(buildPositionList('Hello HelloWorld Hello'));

    const count = searchManager.find('Hello', { wholeWord: true });
    // "Hello" at start, "Hello" at end are whole words; "HelloWorld" is not
    expect(count).toBe(2);
  });

  // 7. find() regex
  it('should find matches using regex', () => {
    mockPositionManager.getPositionList.mockReturnValue(buildPositionList('cat bat mat'));

    const count = searchManager.find('[cbm]at', { useRegex: true });
    expect(count).toBe(3);
  });

  // 8. find() invalid regex handled
  it('should handle invalid regex gracefully', () => {
    const count = searchManager.find('[invalid', { useRegex: true });
    expect(count).toBe(0);
    expect(searchManager.matches).toEqual([]);
  });

  // 9. findNext() cycles forward
  it('should cycle forward through matches', () => {
    searchManager.find('Hello');
    expect(searchManager.currentMatchIndex).toBe(0);

    searchManager.findNext();
    expect(searchManager.currentMatchIndex).toBe(1);

    // Should wrap around
    searchManager.findNext();
    expect(searchManager.currentMatchIndex).toBe(0);
  });

  // 10. findPrevious() cycles backward
  it('should cycle backward through matches', () => {
    searchManager.find('Hello');
    expect(searchManager.currentMatchIndex).toBe(0);

    // Should wrap to last
    searchManager.findPrevious();
    expect(searchManager.currentMatchIndex).toBe(1);

    searchManager.findPrevious();
    expect(searchManager.currentMatchIndex).toBe(0);
  });

  // 11. findNext() with no matches returns false
  it('should return false for findNext when no matches', () => {
    const result = searchManager.findNext();
    expect(result).toBe(false);
  });

  // 12. replaceText() with no matches returns false
  it('should return false for replaceText when no matches found', () => {
    mockPositionManager.getPositionList.mockReturnValue(buildPositionList('no match here'));

    const result = searchManager.replaceText('xyz', 'abc');
    expect(result).toBe(false);
  });

  // 13. replaceAll() returns count
  it('should return replacement count from replaceAll with command system', () => {
    viewer.command = {
      replaceAll: vi.fn(() => 2),
    };

    const count = searchManager.replaceAll('Hello', 'Hi');
    expect(count).toBe(2);
    expect(viewer.command.replaceAll).toHaveBeenCalledWith('Hello', 'Hi', {});
  });

  // 14. clearSearch() resets state
  it('should reset search state on clearSearch', () => {
    searchManager.find('Hello');
    expect(searchManager.matches.length).toBeGreaterThan(0);

    searchManager.clearSearch();

    expect(searchManager.searchText).toBe('');
    expect(searchManager.matches).toEqual([]);
    expect(searchManager.currentMatchIndex).toBe(-1);
    expect(searchManager.highlightElements).toEqual([]);
  });

  // 15. getSearchInfo() returns correct state
  it('should return correct search info', () => {
    searchManager.find('Hello');

    const info = searchManager.getSearchInfo();
    expect(info.searchText).toBe('Hello');
    expect(info.matchCount).toBe(2);
    expect(info.currentIndex).toBe(0);
    expect(info.options).toEqual({
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
    });
  });

  // 16. _escapeRegex() escapes special chars
  it('should escape regex special characters', () => {
    const escaped = searchManager._escapeRegex('hello.world*test?');
    expect(escaped).toBe('hello\\.world\\*test\\?');
  });

  // 17. positionManager not ready -> returns 0
  it('should return 0 when positionManager is not ready', () => {
    mockPositionManager.isPositionReady.mockReturnValue(false);

    const count = searchManager.find('Hello');
    expect(count).toBe(0);
  });

  // 18. Highlight elements created for matches
  it('should create highlight elements for matches', () => {
    searchManager.find('Hello');

    // Highlights should have been appended to the container
    expect(searchManager.highlightElements.length).toBeGreaterThan(0);

    const highlights = viewer.container.querySelectorAll('.hwpx-search-highlight, .hwpx-search-highlight-current');
    expect(highlights.length).toBeGreaterThan(0);
  });

  // 19. clearSearch removes highlight elements
  it('should remove highlight elements on clearSearch', () => {
    searchManager.find('Hello');
    expect(searchManager.highlightElements.length).toBeGreaterThan(0);

    searchManager.clearSearch();

    expect(searchManager.highlightElements).toHaveLength(0);
    const highlights = viewer.container.querySelectorAll('.hwpx-search-highlight, .hwpx-search-highlight-current');
    expect(highlights.length).toBe(0);
  });

  // 20. Multiple searches override previous
  it('should override previous search results on new search', () => {
    searchManager.find('Hello');
    const firstCount = searchManager.matches.length;

    searchManager.find('World');
    expect(searchManager.matches.length).toBe(1);
    expect(searchManager.searchText).toBe('World');

    // Previous highlights should be cleared
    const currentHighlights = viewer.container.querySelectorAll('.hwpx-search-highlight, .hwpx-search-highlight-current');
    // Only World match highlights should exist
    expect(searchManager.matches[0].text).toBe('World');
  });
});
