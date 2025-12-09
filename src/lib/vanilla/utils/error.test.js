/**
 * Error Handling Tests
 * @jest-environment jsdom
 */

import {
    ErrorType,
    HWPXError,
    ErrorHandler,
    getErrorHandler,
    resetErrorHandler,
    handleError
} from './error.js';

describe('Error Handling', () => {
    describe('ErrorType', () => {
        it('should have all error types defined', () => {
            expect(ErrorType.FILE_SELECT_ERROR).toBe('FILE_SELECT_ERROR');
            expect(ErrorType.DOCUMENT_LOAD_ERROR).toBe('DOCUMENT_LOAD_ERROR');
            expect(ErrorType.HWPX_PARSE_ERROR).toBe('HWPX_PARSE_ERROR');
            expect(ErrorType.DOCUMENT_RENDER_ERROR).toBe('DOCUMENT_RENDER_ERROR');
            expect(ErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
            expect(ErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
            expect(ErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
        });

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(ErrorType)).toBe(true);
        });
    });

    describe('HWPXError', () => {
        it('should create error with type and message', () => {
            const error = new HWPXError(ErrorType.HWPX_PARSE_ERROR, 'Parse failed');
            expect(error.type).toBe(ErrorType.HWPX_PARSE_ERROR);
            expect(error.message).toBe('Parse failed');
            expect(error.name).toBe('HWPXError');
        });

        it('should store timestamp', () => {
            const error = new HWPXError(ErrorType.UNKNOWN_ERROR, 'Test');
            expect(error.timestamp).toBeDefined();
            expect(new Date(error.timestamp)).toBeInstanceOf(Date);
        });

        it('should store original error', () => {
            const original = new Error('Original error');
            const error = new HWPXError(ErrorType.UNKNOWN_ERROR, 'Wrapped', original);
            expect(error.originalError).toBe(original);
        });

        it('should convert to JSON', () => {
            const error = new HWPXError(ErrorType.HWPX_PARSE_ERROR, 'Test error');
            const json = error.toJSON();
            
            expect(json.name).toBe('HWPXError');
            expect(json.type).toBe(ErrorType.HWPX_PARSE_ERROR);
            expect(json.message).toBe('Test error');
            expect(json.timestamp).toBeDefined();
            expect(json.stack).toBeDefined();
        });

        it('should include original error in JSON', () => {
            const original = new Error('Original');
            const error = new HWPXError(ErrorType.UNKNOWN_ERROR, 'Wrapped', original);
            const json = error.toJSON();
            
            expect(json.originalError).toBeDefined();
            expect(json.originalError.message).toBe('Original');
        });
    });

    describe('ErrorHandler', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        describe('handle()', () => {
            it('should handle HWPXError', () => {
                const error = new HWPXError(ErrorType.HWPX_PARSE_ERROR, 'Test');
                const result = handler.handle(error);
                
                expect(result).toBe(error);
                expect(handler.errors.length).toBe(1);
            });

            it('should wrap regular Error', () => {
                const error = new Error('Regular error');
                const result = handler.handle(error);
                
                expect(result).toBeInstanceOf(HWPXError);
                expect(result.originalError).toBe(error);
                expect(handler.errors.length).toBe(1);
            });

            it('should store context', () => {
                const error = new Error('Test');
                const context = { file: 'test.hwpx' };
                handler.handle(error, context);
                
                expect(handler.errors[0].context).toBe(context);
            });

            it('should limit stored errors', () => {
                handler.maxErrors = 5;
                
                for (let i = 0; i < 10; i++) {
                    handler.handle(new Error(`Error ${i}`));
                }
                
                expect(handler.errors.length).toBe(5);
            });
        });

        describe('detectErrorType()', () => {
            it('should detect parse error', () => {
                const error = new Error('Failed to parse document');
                const type = handler.detectErrorType(error, {});
                expect(type).toBe(ErrorType.HWPX_PARSE_ERROR);
            });

            it('should detect render error', () => {
                const error = new Error('Rendering failed');
                const type = handler.detectErrorType(error, {});
                expect(type).toBe(ErrorType.DOCUMENT_RENDER_ERROR);
            });

            it('should detect load error', () => {
                const error = new Error('Failed to load file');
                const type = handler.detectErrorType(error, {});
                expect(type).toBe(ErrorType.DOCUMENT_LOAD_ERROR);
            });

            it('should detect network error', () => {
                const error = new Error('Network request failed');
                const type = handler.detectErrorType(error, {});
                expect(type).toBe(ErrorType.NETWORK_ERROR);
            });

            it('should detect validation error', () => {
                const error = new Error('Invalid input value');
                const type = handler.detectErrorType(error, {});
                expect(type).toBe(ErrorType.VALIDATION_ERROR);
            });

            it('should use context type if provided', () => {
                const error = new Error('Test');
                const type = handler.detectErrorType(error, { 
                    type: ErrorType.FILE_SELECT_ERROR 
                });
                expect(type).toBe(ErrorType.FILE_SELECT_ERROR);
            });

            it('should default to UNKNOWN_ERROR', () => {
                const error = new Error('Something went wrong');
                const type = handler.detectErrorType(error, {});
                expect(type).toBe(ErrorType.UNKNOWN_ERROR);
            });
        });

        describe('getUserFriendlyMessage()', () => {
            it('should return Korean message for each type', () => {
                const types = Object.values(ErrorType);
                types.forEach(type => {
                    const message = handler.getUserFriendlyMessage(type, new Error());
                    expect(message).toBeTruthy();
                    expect(typeof message).toBe('string');
                });
            });

            it('should handle encrypted file', () => {
                const error = new Error('File is encrypted');
                const message = handler.getUserFriendlyMessage(ErrorType.HWPX_PARSE_ERROR, error);
                expect(message).toContain('암호화');
            });

            it('should handle corrupted file', () => {
                const error = new Error('File is corrupted');
                const message = handler.getUserFriendlyMessage(ErrorType.HWPX_PARSE_ERROR, error);
                expect(message).toContain('손상된');
            });

            it('should handle size error', () => {
                const error = new Error('File size exceeds limit');
                const message = handler.getUserFriendlyMessage(ErrorType.VALIDATION_ERROR, error);
                expect(message).toContain('크기');
            });
        });

        describe('getRecentErrors()', () => {
            it('should return recent errors', () => {
                for (let i = 0; i < 5; i++) {
                    handler.handle(new Error(`Error ${i}`));
                }
                
                const recent = handler.getRecentErrors(3);
                expect(recent.length).toBe(3);
            });

            it('should default to 10 errors', () => {
                for (let i = 0; i < 15; i++) {
                    handler.handle(new Error(`Error ${i}`));
                }
                
                const recent = handler.getRecentErrors();
                expect(recent.length).toBe(10);
            });
        });

        describe('getErrorsByType()', () => {
            it('should filter errors by type', () => {
                handler.handle(new Error('parse error'));
                handler.handle(new Error('render error'));
                handler.handle(new Error('another parse error'));
                
                const parseErrors = handler.getErrorsByType(ErrorType.HWPX_PARSE_ERROR);
                expect(parseErrors.length).toBe(2);
            });
        });

        describe('clear()', () => {
            it('should clear all errors', () => {
                handler.handle(new Error('Error 1'));
                handler.handle(new Error('Error 2'));
                
                expect(handler.errors.length).toBe(2);
                handler.clear();
                expect(handler.errors.length).toBe(0);
            });
        });

        describe('getStatistics()', () => {
            it('should return error count by type', () => {
                handler.handle(new Error('parse error'));
                handler.handle(new Error('parse error'));
                handler.handle(new Error('render error'));
                
                const stats = handler.getStatistics();
                expect(stats[ErrorType.HWPX_PARSE_ERROR]).toBe(2);
                expect(stats[ErrorType.DOCUMENT_RENDER_ERROR]).toBe(1);
            });
        });
    });

    describe('Global Functions', () => {
        afterEach(() => {
            resetErrorHandler();
        });

        describe('getErrorHandler()', () => {
            it('should return singleton instance', () => {
                const handler1 = getErrorHandler();
                const handler2 = getErrorHandler();
                expect(handler1).toBe(handler2);
            });
        });

        describe('resetErrorHandler()', () => {
            it('should create new instance', () => {
                const handler1 = getErrorHandler();
                handler1.handle(new Error('Test'));
                
                resetErrorHandler();
                const handler2 = getErrorHandler();
                
                expect(handler1).not.toBe(handler2);
                expect(handler2.errors.length).toBe(0);
            });
        });

        describe('handleError()', () => {
            it('should handle error using default handler', () => {
                const error = new Error('Test error');
                const result = handleError(error);
                
                expect(result).toBeInstanceOf(HWPXError);
            });

            it('should accept context', () => {
                const error = new Error('Test');
                const context = { file: 'test.hwpx' };
                handleError(error, context);
                
                const handler = getErrorHandler();
                expect(handler.errors[0].context).toBe(context);
            });
        });
    });
});

