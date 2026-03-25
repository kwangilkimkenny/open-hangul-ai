/**
 * XML Generator Worker
 *
 * Web Worker for parallel section XML generation.
 * Offloads CPU-intensive XML generation from the main thread.
 *
 * Supported task types:
 * - generateSection: Convert section data to XML
 * - generateParagraphs: Convert paragraphs to XML
 * - generateTable: Convert table to XML
 *
 * @module Worker
 * @category Worker
 */

import type { WorkerResult } from './WorkerPool';
import type { HWPSection, HWPParagraph } from '../models/hwp.types';
import type { Table } from 'hwplib-js';

// Worker message event type
interface WorkerMessage<T = unknown> {
    id: string;
    type: string;
    payload: T;
}

// Task payloads
interface GenerateSectionPayload {
    section: HWPSection;
    inlineTableXmls?: string[];
    inlinePictureXmls?: string[];
}

interface GenerateParagraphsPayload {
    paragraphs: HWPParagraph[];
    injectedXmls?: string[];
    width?: number;
}

interface GenerateTablePayload {
    table: Table;
}

/**
 * Post result back to main thread
 */
function postResult<R>(id: string, success: boolean, result?: R, error?: string): void {
    const response: WorkerResult<R> = {
        id,
        success,
        result,
        error
    };
    self.postMessage(response);
}

/**
 * Lazy load section generator to reduce worker startup time
 */
let generateSectionXml: ((section: HWPSection, inlineTableXmls?: string[], inlinePictureXmls?: string[]) => string) | null = null;

async function getGenerateSectionXml() {
    if (!generateSectionXml) {
        const { generateSectionXml: gen } = await import('../writer/section/ForSection');
        generateSectionXml = gen;
    }
    return generateSectionXml;
}

/**
 * Lazy load paragraph generator
 */
let generateParagraphsXml: ((paragraphs: HWPParagraph[], injectedXmls?: string[], width?: number) => string) | null = null;

async function getGenerateParagraphsXml() {
    if (!generateParagraphsXml) {
        const { generateParagraphsXml: gen } = await import('../writer/section/ForParagraph');
        generateParagraphsXml = gen;
    }
    return generateParagraphsXml;
}

/**
 * Lazy load table generator
 */
let tableToXml: ((table: Table) => string) | null = null;

async function getTableToXml() {
    if (!tableToXml) {
        const { tableToXml: gen } = await import('../writer/section/controls/ForTable');
        tableToXml = gen;
    }
    return tableToXml;
}

/**
 * Handle generateSection task
 */
async function handleGenerateSection(id: string, payload: GenerateSectionPayload): Promise<void> {
    try {
        const gen = await getGenerateSectionXml();
        const xml = gen(payload.section, payload.inlineTableXmls, payload.inlinePictureXmls);
        postResult(id, true, xml);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        postResult(id, false, undefined, message);
    }
}

/**
 * Handle generateParagraphs task
 */
async function handleGenerateParagraphs(id: string, payload: GenerateParagraphsPayload): Promise<void> {
    try {
        const gen = await getGenerateParagraphsXml();
        const xml = gen(payload.paragraphs, payload.injectedXmls, payload.width);
        postResult(id, true, xml);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        postResult(id, false, undefined, message);
    }
}

/**
 * Handle generateTable task
 */
async function handleGenerateTable(id: string, payload: GenerateTablePayload): Promise<void> {
    try {
        const gen = await getTableToXml();
        const xml = gen(payload.table);
        postResult(id, true, xml);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        postResult(id, false, undefined, message);
    }
}

/**
 * Message handler
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = event.data;

    switch (type) {
        case 'generateSection':
            await handleGenerateSection(id, payload as GenerateSectionPayload);
            break;

        case 'generateParagraphs':
            await handleGenerateParagraphs(id, payload as GenerateParagraphsPayload);
            break;

        case 'generateTable':
            await handleGenerateTable(id, payload as GenerateTablePayload);
            break;

        case 'ping':
            // Health check
            postResult(id, true, { status: 'ok', timestamp: Date.now() });
            break;

        default:
            postResult(id, false, undefined, `Unknown task type: ${type}`);
    }
};

/**
 * Error handler
 * Note: OnErrorEventHandler expects (event: Event | string) => void
 */
self.onerror = (event: Event | string) => {
    console.error('Worker error:', event);
};

/**
 * Signal that worker is ready
 */
self.postMessage({ type: 'ready' });
