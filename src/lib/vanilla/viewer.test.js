/**
 * HWPXViewer tests
 */

// Mock logger first
vi.mock('./utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
  resetLogger: vi.fn(),
}));

vi.mock('./core/parser.js', () => ({
  SimpleHWPXParser: class {
    constructor() {}
    parse = vi.fn(async () => ({ sections: [{ elements: [] }], images: new Map() }));
    cleanup = vi.fn();
    reset = vi.fn();
  },
}));

vi.mock('./core/renderer.js', () => ({
  DocumentRenderer: class {
    constructor() {}
    render = vi.fn(async () => 1);
    totalPages = 0;
    clearImageCache = vi.fn();
    checkPagination = vi.fn();
    reset = vi.fn();
  },
}));

vi.mock('./core/worker-manager.js', () => ({
  WorkerManager: class {
    constructor() {
      this.isReady = false;
    }
    static isSupported = vi.fn(() => false);
    initialize = vi.fn();
    parseHWPX = vi.fn();
    terminate = vi.fn();
  },
}));

vi.mock('./ui/context-menu.js', () => ({
  ContextMenu: class {
    constructor() {}
  },
}));
vi.mock('./ui/search-dialog.js', () => ({
  SearchDialog: class {
    constructor() {}
  },
}));
vi.mock('./ui/editing-toolbar.js', () => ({
  EditingToolbar: class {
    constructor() {}
  },
}));
vi.mock('./ui/theme-manager.js', () => ({
  ThemeManager: class {
    constructor() {}
  },
}));
vi.mock('./features/inline-editor.js', () => ({
  InlineEditor: class {
    constructor() {
      this.editingCell = null;
    }
    onChange = vi.fn();
  },
}));
vi.mock('./features/history-manager-v2.js', () => ({
  HistoryManagerV2: class {
    constructor() {
      this.execute = vi.fn();
      this.undo = vi.fn();
      this.redo = vi.fn();
    }
  },
}));
vi.mock('./features/change-tracker.js', () => ({
  ChangeTracker: class {
    constructor() {
      this.isTracking = false;
      this.changes = [];
    }
    enable = vi.fn();
    disable = vi.fn();
    onChange = vi.fn();
  },
}));
vi.mock('./features/annotation-manager.js', () => ({
  AnnotationManager: class {
    constructor() {
      this.comments = [];
    }
    onChange = vi.fn();
    addComment = vi.fn();
  },
}));
vi.mock('./features/edit-mode-manager.js', () => ({
  EditModeManager: class {
    constructor() {
      this.isGlobalEditMode = true;
    }
  },
}));
// 동적 import로 로드되는 accessibility 모듈 mock
vi.mock('../a11y/accessibility', () => ({
  AccessibilityManager: class {
    constructor() {}
    init = vi.fn();
    destroy = vi.fn();
  },
}));
vi.mock('./features/table-editor.js', () => ({
  TableEditor: class {
    constructor() {}
  },
}));
vi.mock('./features/clipboard-manager.js', () => ({
  ClipboardManager: class {
    constructor() {}
  },
}));
vi.mock('./features/search-manager.js', () => ({
  SearchManager: class {
    constructor() {}
  },
}));
vi.mock('./features/position-manager.js', () => ({
  PositionManager: class {
    constructor() {}
    computePositions = vi.fn(async () => {});
    getStats = vi.fn(() => ({ totalCharacters: 0, pages: 0, paragraphs: 0, tableCells: 0 }));
    reset = vi.fn();
  },
}));
vi.mock('./features/range-manager.js', () => ({
  RangeManager: class {
    constructor() {}
    destroy = vi.fn();
    reset = vi.fn();
  },
}));
vi.mock('./features/cursor.js', () => ({
  Cursor: class {
    constructor() {}
    destroy = vi.fn();
  },
}));
vi.mock('./features/text-formatter.js', () => ({
  TextFormatter: class {
    constructor() {}
  },
}));
vi.mock('./features/special-character-picker.js', () => ({
  SpecialCharacterPicker: class {
    constructor() {}
  },
}));
vi.mock('./features/advanced-search.js', () => ({
  AdvancedSearch: class {
    constructor() {}
  },
}));
vi.mock('./features/bookmark-manager.js', () => ({
  BookmarkManager: class {
    constructor() {}
  },
}));
vi.mock('./features/autosave-manager.js', () => ({
  AutoSaveManager: class {
    constructor() {
      this.enableAutoSave = vi.fn();
      this.detectCrashRecovery = vi.fn(async () => null);
      this.dispose = vi.fn();
    }
    initialize = vi.fn(async () => {});
  },
}));
vi.mock('./command/command.js', () => ({
  Command: class {
    constructor() {}
  },
}));
vi.mock('./command/command-adapt.js', () => ({
  CommandAdapt: class {
    constructor() {}
  },
}));
vi.mock('./utils/ui.js', () => ({
  showToast: vi.fn(),
  showLoading: vi.fn(),
  updateStatus: vi.fn(),
  showProgress: vi.fn(),
  showConfirm: vi.fn(),
  showAlert: vi.fn(),
}));
vi.mock('./utils/error.js', () => ({
  ErrorType: {},
  HWPXError: class extends Error {},
  getErrorHandler: vi.fn(),
}));
vi.mock('./utils/format.js', () => ({
  formatFileSize: vi.fn(),
  formatDate: vi.fn(),
}));

import { HWPXViewer } from './viewer.js';
import { WorkerManager } from './core/worker-manager.js';
import { showLoading, updateStatus, showToast } from './utils/ui.js';

describe('HWPXViewer', () => {
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    container.id = 'hwpx-viewer';
    document.body.appendChild(container);
    // Reset WorkerManager.isSupported to return false by default
    WorkerManager.isSupported.mockReturnValue(false);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.editModeManager;
    delete window.viewer;
  });

  // 1. Constructor with container element
  it('should construct with a container element', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.container).toBe(container);
  });

  // 2. Constructor with selector string
  it('should construct with a selector string', () => {
    const viewer = new HWPXViewer({ container: '#hwpx-viewer' });
    expect(viewer.container).toBe(container);
  });

  // 3. Throws when container not found
  it('should throw when container not found', () => {
    expect(() => new HWPXViewer({ container: '#nonexistent' })).toThrow('Container not found');
  });

  // 4. Initializes parser; renderer lazy-loads only in inline mode
  it('should initialize parser; renderer null in canvas mode', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.parser).toBeDefined();
    expect(viewer.renderer).toBeNull();
  });

  it('should lazy-load renderer in inline mode', async () => {
    const viewer = new HWPXViewer({ container, editorType: 'inline' });
    expect(viewer.parser).toBeDefined();
    await viewer._vanillaCorePromise;
    expect(viewer.renderer).toBeDefined();
    expect(viewer.renderer).not.toBeNull();
  });

  // 5. WorkerManager not created when isSupported returns false
  it('should not create WorkerManager when not supported', () => {
    WorkerManager.isSupported.mockReturnValue(false);
    const viewer = new HWPXViewer({ container });
    expect(viewer.workerManager).toBeNull();
  });

  // 6. options defaults
  it('should set default options', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.options.useWorker).toBe(true);
    expect(viewer.options.enableAI).toBe(true);
    expect(viewer.options.onLoad).toBeNull();
    expect(viewer.options.onError).toBeNull();
  });

  // 7. getDocument() returns null initially
  it('should return null from getDocument() initially', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.getDocument()).toBeNull();
  });

  // 8. getDocument() returns document after loadFile
  it('should return document from getDocument() after loadFile', async () => {
    const viewer = new HWPXViewer({ container });
    const mockBuffer = new ArrayBuffer(10);
    await viewer.loadFile(mockBuffer);
    expect(viewer.getDocument()).not.toBeNull();
    expect(viewer.getDocument().sections).toBeDefined();
  });

  // 9. loadFile() parses and renders
  it('should parse and render on loadFile (inline mode)', async () => {
    const viewer = new HWPXViewer({ container, editorType: 'inline' });
    const mockBuffer = new ArrayBuffer(10);
    await viewer.loadFile(mockBuffer);
    expect(viewer.parser.parse).toHaveBeenCalled();
    expect(viewer.renderer.render).toHaveBeenCalled();
  });

  // 9b. canvas mode skips vanilla renderer entirely (renderer never instantiated)
  it('should skip vanilla renderer in canvas mode', async () => {
    const viewer = new HWPXViewer({ container, editorType: 'canvas' });
    await viewer.loadFile(new ArrayBuffer(10));
    expect(viewer.parser.parse).toHaveBeenCalled();
    expect(viewer.renderer).toBeNull();
  });

  // 10. loadFile() calls onLoad callback
  it('should call onLoad callback after loading', async () => {
    const onLoad = vi.fn();
    const viewer = new HWPXViewer({ container, onLoad });
    await viewer.loadFile(new ArrayBuffer(10));
    expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ sections: expect.any(Array) }));
  });

  // 11. loadFile() throws if already loading
  it('should throw if already loading a file', async () => {
    const viewer = new HWPXViewer({ container });
    // Simulate parser.parse that never resolves to keep isLoading true
    viewer.parser.parse = vi.fn(() => new Promise(() => {}));
    const loadPromise = viewer.loadFile(new ArrayBuffer(10));

    await expect(viewer.loadFile(new ArrayBuffer(10))).rejects.toThrow('Already loading a file');

    // Clean up the pending promise by resetting state
    viewer.state.isLoading = false;
  });

  // 12. loadFile() calls onError on failure
  it('should call onError callback on load failure', async () => {
    const onError = vi.fn();
    const viewer = new HWPXViewer({ container, onError });
    const parseError = new Error('Parse failed');
    viewer.parser.parse = vi.fn(async () => {
      throw parseError;
    });

    await expect(viewer.loadFile(new ArrayBuffer(10))).rejects.toThrow('Parse failed');
    expect(onError).toHaveBeenCalledWith(parseError);
  });

  // 13. updateDocument() updates state and re-renders (inline mode)
  it('should update document state and re-render on updateDocument (inline mode)', async () => {
    const viewer = new HWPXViewer({ container, editorType: 'inline' });
    const newDoc = { sections: [{ elements: [{ type: 'paragraph' }] }] };
    await viewer.updateDocument(newDoc);
    expect(viewer.state.document).toBe(newDoc);
    expect(viewer.renderer.render).toHaveBeenCalledWith(newDoc);
  });

  // 14. state.isLoading set correctly
  it('should manage isLoading state correctly during loadFile', async () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.state.isLoading).toBe(false);

    let resolveParser;
    viewer.parser.parse = vi.fn(
      () =>
        new Promise(r => {
          resolveParser = r;
        })
    );

    const loadPromise = viewer.loadFile(new ArrayBuffer(10));
    expect(viewer.state.isLoading).toBe(true);

    resolveParser({ sections: [{ elements: [] }], images: new Map() });
    await loadPromise;
    expect(viewer.state.isLoading).toBe(false);
  });

  // 15. destroy() terminates worker
  it('should terminate worker on destroy', () => {
    WorkerManager.isSupported.mockReturnValue(true);
    const viewer = new HWPXViewer({ container });
    expect(viewer.workerManager).not.toBeNull();
    viewer.destroy();
    expect(viewer.workerManager.terminate).toHaveBeenCalled();
  });

  // 16. editing features initialized (inline mode lazy-loads InlineEditor)
  it('should initialize editing features in inline mode', async () => {
    const viewer = new HWPXViewer({ container, editorType: 'inline' });
    // wait a microtask + module load
    await Promise.resolve();
    await Promise.resolve();
    expect(viewer.historyManager).not.toBeNull();
    expect(viewer.tableEditor).not.toBeNull();
  });

  it('should skip InlineEditor in canvas mode', async () => {
    const viewer = new HWPXViewer({ container });
    await Promise.resolve();
    expect(viewer.inlineEditor).toBeNull();
    expect(viewer.options.editorType).toBe('canvas');
  });

  // 17. AI features initially null (lazy loaded)
  it('should have AI features initially null', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.aiController).toBeNull();
    expect(viewer.chatPanel).toBeNull();
  });

  // 18. contextMenu initialized
  it('should initialize contextMenu', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.contextMenu).not.toBeNull();
  });

  // 19. editModeManager exposed on window
  it('should expose editModeManager on window', () => {
    const viewer = new HWPXViewer({ container });
    expect(window.editModeManager).toBeDefined();
    expect(window.editModeManager).toBe(viewer.editModeManager);
  });

  // 20. autoSaveManager initialized
  it('should initialize autoSaveManager', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.autoSaveManager).not.toBeNull();
    expect(viewer.autoSaveManager.initialize).toHaveBeenCalled();
  });

  // 21. default editorType is 'canvas' (Phase 5a)
  it('should default editorType to canvas', () => {
    const viewer = new HWPXViewer({ container });
    expect(viewer.options.editorType).toBe('canvas');
  });

  describe('getDocument() canvas-aware behavior', () => {
    it('returns adapter output when canvas-editor is mounted', () => {
      const viewer = new HWPXViewer({ container });
      viewer.state.document = {
        sections: [{ elements: [{ type: 'paragraph', runs: [{ text: 'old' }] }] }],
        images: new Map([['img-1', new Uint8Array([1, 2, 3])]]),
        borderFills: new Map([['bf-1', { type: 'solid' }]]),
        metadata: { title: 'Original', author: 'A' },
      };
      const editedDoc = {
        sections: [{ elements: [{ type: 'paragraph', runs: [{ text: 'edited' }] }] }],
        metadata: { title: 'Edited' },
      };
      viewer.canvasEditor = { editor: {}, getDocument: vi.fn(() => editedDoc) };

      const out = viewer.getDocument();
      expect(out.sections[0].elements[0].runs[0].text).toBe('edited');
    });

    it('preserves images, borderFills, and merges metadata from base state', () => {
      const viewer = new HWPXViewer({ container });
      const baseImages = new Map([['img-1', new Uint8Array([1])]]);
      const baseBorders = new Map([['bf-1', { type: 'dashed' }]]);
      viewer.state.document = {
        sections: [],
        images: baseImages,
        borderFills: baseBorders,
        metadata: { title: 'Original', author: 'Alice' },
      };
      viewer.canvasEditor = {
        editor: {},
        getDocument: vi.fn(() => ({ sections: [{ elements: [] }], metadata: { title: 'Edited' } })),
      };

      const out = viewer.getDocument();
      expect(out.images).toBe(baseImages);
      expect(out.borderFills).toBe(baseBorders);
      expect(out.metadata).toEqual({ title: 'Edited', author: 'Alice' });
    });

    it('falls back to base state when adapter throws', () => {
      const viewer = new HWPXViewer({ container });
      const base = { sections: [{ elements: [] }], metadata: { title: 'X' } };
      viewer.state.document = base;
      viewer.canvasEditor = {
        editor: {},
        getDocument: vi.fn(() => {
          throw new Error('boom');
        }),
      };

      expect(viewer.getDocument()).toBe(base);
    });

    it('returns base state when adapter has no editor mounted', () => {
      const viewer = new HWPXViewer({ container });
      const base = { sections: [{ elements: [] }] };
      viewer.state.document = base;
      viewer.canvasEditor = { editor: null, getDocument: vi.fn() };

      expect(viewer.getDocument()).toBe(base);
    });

    it('returns null when no document loaded', () => {
      const viewer = new HWPXViewer({ container });
      expect(viewer.getDocument()).toBeNull();
    });
  });
});
