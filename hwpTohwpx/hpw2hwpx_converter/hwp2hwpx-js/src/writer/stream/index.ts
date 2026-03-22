/**
 * Stream-based XML Generation Module
 *
 * Provides flexible XML writing capabilities with both
 * string-based and stream-based implementations.
 *
 * Usage:
 * - StringXmlWriter: For small to medium documents, backwards compatible
 * - StreamXmlWriter: For large documents, 50-70% memory reduction
 *
 * @module Writer/Stream
 * @category Writer
 */

// Interface and utilities
export type { IXmlWriter, XmlAttribute, XmlWriterOptions } from './XmlWriter';
export { escapeXmlText, escapeXmlAttribute, formatAttributes } from './XmlWriter';

// String-based implementation (backwards compatible)
export { StringXmlWriter, createStringXmlWriter } from './StringXmlWriter';

// Stream-based implementation (memory efficient)
export {
    StreamXmlWriter,
    createStreamXmlWriter,
    createChunkCollectingWriter
} from './StreamXmlWriter';

// Type alias for easy migration from StringBuilder
import { StringXmlWriter, createStringXmlWriter } from './StringXmlWriter';
import { createStreamXmlWriter as createStreamWriter } from './StreamXmlWriter';
export { StringXmlWriter as XmlStringBuilder };

/**
 * Create an XML writer with automatic implementation selection
 *
 * @param options Configuration options
 * @param options.streaming Use stream-based writer (default: false)
 * @param options.stream Optional writable stream for StreamXmlWriter
 * @returns IXmlWriter instance
 */
export function createXmlWriter(options?: {
    streaming?: boolean;
    stream?: WritableStream<Uint8Array>;
    onChunk?: (chunk: Uint8Array) => void;
    initialIndent?: number;
    indentString?: string;
    prettyPrint?: boolean;
    bufferSize?: number;
    encoding?: BufferEncoding;
}): import('./XmlWriter').IXmlWriter {
    const { streaming = false, ...rest } = options ?? {};

    if (streaming || rest.stream || rest.onChunk) {
        return createStreamWriter(rest);
    }

    return createStringXmlWriter(rest);
}
