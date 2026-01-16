/**
 * UI Utilities Tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    ToastType,
    showToast,
    closeAllToasts,
    showLoading,
    updateStatus,
    showProgress,
    hideProgress,
    toggleElement,
    toggleClass,
    scrollToElement,
    debounce,
    throttle
} from './ui.js';

describe('UI Utilities', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="toast-container"></div>
            <div id="loading-overlay">
                <div class="loading-message"></div>
            </div>
            <div id="status-text"></div>
            <div id="progress-bar"></div>
            <div id="progress-text"></div>
            <div id="progress-container"></div>
            <div id="test-element"></div>
        `;
    });

    describe('ToastType', () => {
        it('should have all toast types', () => {
            expect(ToastType.SUCCESS).toBe('success');
            expect(ToastType.ERROR).toBe('error');
            expect(ToastType.WARNING).toBe('warning');
            expect(ToastType.INFO).toBe('info');
        });

        it('should be frozen', () => {
            expect(Object.isFrozen(ToastType)).toBe(true);
        });
    });

    describe('showToast', () => {
        it('should create toast element', () => {
            showToast('success', 'Success', 'Operation completed');
            
            const toast = document.querySelector('.toast');
            expect(toast).toBeTruthy();
            expect(toast.classList.contains('success')).toBe(true);
        });

        it('should include title and message', () => {
            showToast('info', 'Test Title', 'Test Message');
            
            const title = document.querySelector('.toast-title');
            const message = document.querySelector('.toast-message');
            
            expect(title.textContent).toBe('Test Title');
            expect(message.textContent).toBe('Test Message');
        });

        it('should have correct icon for each type', () => {
            const types = [
                ['success', '✅'],
                ['error', '❌'],
                ['warning', '⚠️'],
                ['info', 'ℹ️']
            ];

            types.forEach(([type, icon]) => {
                document.getElementById('toast-container').innerHTML = '';
                showToast(type, 'Title', 'Message');
                
                const toastIcon = document.querySelector('.toast-icon');
                expect(toastIcon.textContent).toBe(icon);
            });
        });

        it('should have close button', () => {
            showToast('info', 'Test', 'Message');
            
            const closeBtn = document.querySelector('.toast-close');
            expect(closeBtn).toBeTruthy();
        });

        it('should escape HTML in title and message', () => {
            showToast('info', '<script>alert("xss")</script>', '<b>Bold</b>');
            
            const title = document.querySelector('.toast-title');
            const message = document.querySelector('.toast-message');
            
            expect(title.textContent).toContain('script');
            expect(message.textContent).toContain('<b>');
        });

        it('should handle missing container', () => {
            document.getElementById('toast-container').remove();
            
            // Should not throw
            expect(() => {
                showToast('info', 'Test', 'Message');
            }).not.toThrow();
        });
    });

    describe('closeAllToasts', () => {
        it('should close all toasts', () => {
            showToast('success', 'Test 1', 'Message 1');
            showToast('error', 'Test 2', 'Message 2');
            
            expect(document.querySelectorAll('.toast').length).toBe(2);
            
            closeAllToasts();
            
            // Toasts are removed after animation (300ms)
            setTimeout(() => {
                expect(document.querySelectorAll('.toast').length).toBe(0);
            }, 400);
        });
    });

    describe('showLoading', () => {
        it('should show loading overlay', () => {
            showLoading(true);
            
            const overlay = document.getElementById('loading-overlay');
            expect(overlay.classList.contains('show')).toBe(true);
        });

        it('should hide loading overlay', () => {
            const overlay = document.getElementById('loading-overlay');
            overlay.classList.add('show');
            
            showLoading(false);
            
            expect(overlay.classList.contains('show')).toBe(false);
        });

        it('should update loading message', () => {
            showLoading(true, 'Loading document...');
            
            const message = document.querySelector('.loading-message');
            expect(message.textContent).toBe('Loading document...');
        });

        it('should handle missing overlay', () => {
            document.getElementById('loading-overlay').remove();
            
            expect(() => {
                showLoading(true);
            }).not.toThrow();
        });
    });

    describe('updateStatus', () => {
        it('should update status text', () => {
            updateStatus('Ready');
            
            const statusEl = document.getElementById('status-text');
            expect(statusEl.textContent).toBe('Ready');
        });

        it('should handle missing element', () => {
            document.getElementById('status-text').remove();
            
            expect(() => {
                updateStatus('Test');
            }).not.toThrow();
        });
    });

    describe('showProgress', () => {
        it('should update progress bar width', () => {
            showProgress(50);
            
            const progressBar = document.getElementById('progress-bar');
            expect(progressBar.style.width).toBe('50%');
        });

        it('should clamp progress between 0 and 100', () => {
            showProgress(-10);
            expect(document.getElementById('progress-bar').style.width).toBe('0%');
            
            showProgress(150);
            expect(document.getElementById('progress-bar').style.width).toBe('100%');
        });

        it('should update progress message', () => {
            showProgress(75, 'Processing...');
            
            const progressText = document.getElementById('progress-text');
            expect(progressText.textContent).toBe('Processing...');
        });
    });

    describe('hideProgress', () => {
        it('should hide progress container', () => {
            hideProgress();
            
            const container = document.getElementById('progress-container');
            expect(container.style.display).toBe('none');
        });
    });

    describe('toggleElement', () => {
        it('should toggle element visibility', () => {
            const el = document.getElementById('test-element');
            
            toggleElement('test-element');
            expect(el.style.display).toBe('none');
            
            toggleElement('test-element');
            expect(el.style.display).toBe('');
        });

        it('should force show/hide', () => {
            const el = document.getElementById('test-element');
            
            toggleElement('test-element', false);
            expect(el.style.display).toBe('none');
            
            toggleElement('test-element', true);
            expect(el.style.display).toBe('');
        });

        it('should accept HTMLElement', () => {
            const el = document.getElementById('test-element');
            
            toggleElement(el, false);
            expect(el.style.display).toBe('none');
        });

        it('should handle missing element', () => {
            expect(() => {
                toggleElement('non-existent');
            }).not.toThrow();
        });
    });

    describe('toggleClass', () => {
        it('should toggle class', () => {
            const el = document.getElementById('test-element');
            
            toggleClass('test-element', 'active');
            expect(el.classList.contains('active')).toBe(true);
            
            toggleClass('test-element', 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should force add/remove', () => {
            const el = document.getElementById('test-element');
            
            toggleClass('test-element', 'active', true);
            expect(el.classList.contains('active')).toBe(true);
            
            toggleClass('test-element', 'active', false);
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should accept HTMLElement', () => {
            const el = document.getElementById('test-element');
            
            toggleClass(el, 'active', true);
            expect(el.classList.contains('active')).toBe(true);
        });
    });

    describe('scrollToElement', () => {
        it('should call scrollIntoView', () => {
            const el = document.getElementById('test-element');
            el.scrollIntoView = vi.fn();
            
            scrollToElement('test-element');
            
            expect(el.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'start'
            });
        });

        it('should accept custom options', () => {
            const el = document.getElementById('test-element');
            el.scrollIntoView = vi.fn();
            
            scrollToElement(el, { behavior: 'instant', block: 'center' });
            
            expect(el.scrollIntoView).toHaveBeenCalledWith(
                expect.objectContaining({
                    behavior: 'instant',
                    block: 'center'
                })
            );
        });
    });

    describe('debounce', () => {
        vi.useFakeTimers();

        it('should debounce function calls', () => {
            const func = vi.fn();
            const debounced = debounce(func, 100);

            debounced();
            debounced();
            debounced();

            expect(func).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);

            expect(func).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments', () => {
            const func = vi.fn();
            const debounced = debounce(func, 100);

            debounced('arg1', 'arg2');

            vi.advanceTimersByTime(100);

            expect(func).toHaveBeenCalledWith('arg1', 'arg2');
        });
    });

    describe('throttle', () => {
        vi.useFakeTimers();

        it('should throttle function calls', () => {
            const func = vi.fn();
            const throttled = throttle(func, 100);

            throttled(); // Called immediately
            throttled(); // Ignored
            throttled(); // Ignored

            expect(func).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(100);
            
            throttled(); // Called after cooldown
            
            expect(func).toHaveBeenCalledTimes(2);
        });

        it('should pass arguments', () => {
            const func = vi.fn();
            const throttled = throttle(func, 100);

            throttled('arg1', 'arg2');

            expect(func).toHaveBeenCalledWith('arg1', 'arg2');
        });
    });
});

