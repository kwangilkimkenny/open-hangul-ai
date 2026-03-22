/**
 * Type Guards and Type Utilities
 *
 * Provides type-safe runtime checks and casting utilities
 * to improve type safety across the codebase.
 */

import type { HWPSection, HWPParagraph } from '../models/hwp.types';
import type { EnhancedSection, EnhancedParagraph, BinDataItem } from '../adapters/IHwpParser';

/**
 * Type guard to check if an object is a valid HWP section
 */
export function isHWPSection(obj: unknown): obj is HWPSection {
    if (!obj || typeof obj !== 'object') return false;
    const section = obj as Record<string, unknown>;
    return (
        typeof section.index === 'number' &&
        Array.isArray(section.paragraphs)
    );
}

/**
 * Type guard to check if an object is a valid HWP paragraph
 */
export function isHWPParagraph(obj: unknown): obj is HWPParagraph {
    if (!obj || typeof obj !== 'object') return false;
    const para = obj as Record<string, unknown>;
    return (
        (para.text === undefined || typeof para.text === 'string') &&
        (para.runs === undefined || Array.isArray(para.runs))
    );
}

/**
 * Type guard to check if an object is an EnhancedSection
 */
export function isEnhancedSection(obj: unknown): obj is EnhancedSection {
    if (!obj || typeof obj !== 'object') return false;
    const section = obj as Record<string, unknown>;
    return (
        typeof section.index === 'number' &&
        Array.isArray(section.paragraphs)
    );
}

/**
 * Type guard to check if an object is an EnhancedParagraph
 */
export function isEnhancedParagraph(obj: unknown): obj is EnhancedParagraph {
    if (!obj || typeof obj !== 'object') return false;
    const para = obj as Record<string, unknown>;
    return (
        (para.text === undefined || typeof para.text === 'string') &&
        (para.runs === undefined || Array.isArray(para.runs))
    );
}

/**
 * Type guard to check if an object is a BinDataItem
 */
export function isBinDataItem(obj: unknown): obj is BinDataItem {
    if (!obj || typeof obj !== 'object') return false;
    const item = obj as Record<string, unknown>;
    return (
        typeof item.id === 'number' &&
        item.data instanceof Uint8Array &&
        typeof item.extension === 'string'
    );
}

/**
 * Safe type assertion with runtime check
 * Throws an error if the type guard fails
 */
export function assertType<T>(
    obj: unknown,
    guard: (obj: unknown) => obj is T,
    typeName: string
): T {
    if (!guard(obj)) {
        throw new TypeError(`Expected ${typeName} but got ${typeof obj}`);
    }
    return obj;
}

/**
 * Safe optional type cast
 * Returns undefined if the type guard fails
 */
export function castIfValid<T>(
    obj: unknown,
    guard: (obj: unknown) => obj is T
): T | undefined {
    return guard(obj) ? obj : undefined;
}

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

/**
 * Check if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

/**
 * Check if a value is a non-negative integer
 */
export function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && value >= 0 && Number.isInteger(value);
}

/**
 * Check if a value is a Map
 */
export function isMap<K, V>(value: unknown): value is Map<K, V> {
    return value instanceof Map;
}

/**
 * Safely get a property from an object
 */
export function getProperty<T>(
    obj: unknown,
    key: string,
    defaultValue: T
): T {
    if (!isObject(obj)) return defaultValue;
    const value = obj[key];
    return value !== undefined ? (value as T) : defaultValue;
}
