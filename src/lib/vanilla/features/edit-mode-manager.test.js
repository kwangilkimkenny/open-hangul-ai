/**
 * EditModeManager Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

import { EditModeManager } from './edit-mode-manager.js';

describe('EditModeManager', () => {
  let manager;
  let mockInlineEditor;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockInlineEditor = {
      isEditing: vi.fn(() => false),
      saveChanges: vi.fn(),
    };

    manager = new EditModeManager(mockInlineEditor);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // 1. Constructor defaults to edit mode ON
  it('should default to edit mode ON', () => {
    expect(manager.isGlobalEditMode).toBe(true);
  });

  // 2. isEditMode() returns true initially
  it('should return true for isEditMode initially', () => {
    expect(manager.isEditMode()).toBe(true);
  });

  // 3. toggleGlobalEditMode() flips to OFF
  it('should toggle edit mode to OFF', () => {
    manager.toggleGlobalEditMode();

    expect(manager.isGlobalEditMode).toBe(false);

    const textSpan = document.querySelector('#toggle-edit-mode .text');
    if (textSpan) {
      expect(textSpan.textContent).toContain('OFF');
    }
  });

  // 4. toggleGlobalEditMode() again flips to ON
  it('should toggle edit mode back to ON', () => {
    manager.toggleGlobalEditMode(); // OFF
    manager.toggleGlobalEditMode(); // ON

    expect(manager.isGlobalEditMode).toBe(true);

    const textSpan = document.querySelector('#toggle-edit-mode .text');
    if (textSpan) {
      expect(textSpan.textContent).toContain('ON');
    }
  });

  // 5. setEditMode(false) disables
  it('should disable edit mode with setEditMode(false)', () => {
    expect(manager.isEditMode()).toBe(true);

    manager.setEditMode(false);

    expect(manager.isEditMode()).toBe(false);
  });

  // 6. setEditMode(true) when already true -> no toggle
  it('should not toggle when setEditMode matches current state', () => {
    const toggleSpy = vi.spyOn(manager, 'toggleGlobalEditMode');

    manager.setEditMode(true); // Already true

    expect(toggleSpy).not.toHaveBeenCalled();
  });

  // 7. Toggle OFF saves current edit if editing
  it('should save current edit when toggling OFF while editing', () => {
    mockInlineEditor.isEditing.mockReturnValue(true);

    manager.toggleGlobalEditMode(); // OFF

    expect(mockInlineEditor.saveChanges).toHaveBeenCalledWith(true);
  });

  // 8. Body class 'global-edit-mode' managed correctly
  it('should manage global-edit-mode body class correctly', () => {
    // Initially ON - class should be present (set during constructor)
    expect(document.body.classList.contains('global-edit-mode')).toBe(true);

    manager.toggleGlobalEditMode(); // OFF
    expect(document.body.classList.contains('global-edit-mode')).toBe(false);

    manager.toggleGlobalEditMode(); // ON
    expect(document.body.classList.contains('global-edit-mode')).toBe(true);
  });
});
