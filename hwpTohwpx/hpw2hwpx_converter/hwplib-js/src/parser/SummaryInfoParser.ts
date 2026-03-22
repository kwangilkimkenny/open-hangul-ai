
/**
 * OLE Property Set Parser for HWP Summary Information
 * Parses standard OLE Property Sets (Title, Author, etc.)
 */

export interface SummaryInfo {
    title?: string;
    subject?: string;
    author?: string;
    keywords?: string;
    comments?: string;
    template?: string;
    lastSavedBy?: string;
    revisionNumber?: string;
    totalTime?: number;
    lastPrinted?: Date;
    created?: Date;
    lastSaved?: Date;
    pages?: number;
    words?: number;
    chars?: number;
    security?: number;
}

export class SummaryInfoParser {
    private view: DataView;
    private offset: number = 0;
    private encoding: any;

    constructor(data: Uint8Array) {
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.encoding = new TextDecoder('utf-16le'); // Default to UTF-16LE for OLE
    }

    parse(): SummaryInfo {
        const info: SummaryInfo = {};

        // 1. Property Set Header
        const byteOrder = this.view.getUint16(0, true); // 0xFFFE
        const version = this.view.getUint16(2, true);
        // SystemID (4), CLSID (16) skipped
        const numPropertySets = this.view.getUint32(24, true);

        if (byteOrder !== 0xFFFE) {
            console.warn('Unknown ByteOrder in SummaryInfo:', byteOrder.toString(16));
        }

        // 2. Iterate Property Sets
        // Usually HWP has only one set in HwpSummaryInformation
        if (numPropertySets > 0) {
            // FMTID (16), Offset (4)
            const fmtIdOffset = 28;
            const sectionOffset = this.view.getUint32(fmtIdOffset + 16, true);

            this.parseSection(sectionOffset, info);
        }

        return info;
    }

    private parseSection(startOffset: number, info: SummaryInfo): void {
        let curr = startOffset;
        const size = this.view.getUint32(curr, true);
        const numProperties = this.view.getUint32(curr + 4, true);
        curr += 8;

        const properties: { id: number; offset: number }[] = [];

        // Read Property Directory
        for (let i = 0; i < numProperties; i++) {
            const id = this.view.getUint32(curr, true);
            const offset = this.view.getUint32(curr + 4, true);
            properties.push({ id, offset: startOffset + offset });
            curr += 8;
        }

        // Read Property Values
        for (const prop of properties) {
            try {
                const value = this.readPropertyValue(prop.offset);
                this.assignProperty(info, prop.id, value);
            } catch (e) {
                console.warn(`Failed to parse property ID ${prop.id}`, e);
            }
        }
    }

    private readPropertyValue(offset: number): any {
        const type = this.view.getUint32(offset, true);
        // offset + 4 is padding? standard says Value starts at offset+4 usually? 
        // Actually VT_LPSTR (30) starts with 4 byte length.

        /*
          Standard Property Types (VT_*)
          2: I2 (short)
          3: I4 (int)
          19: UI4 (uint)
          30: LPSTR (null-terminated string, 4-byte len incl null)
          31: LPWSTR (unicode string, 4-byte len incl null)
          64: FILETIME (8 bytes)
        */

        switch (type) {
            case 2: // VT_I2
                return this.view.getInt16(offset + 4, true);
            case 3: // VT_I4
                return this.view.getInt32(offset + 4, true);
            case 19: // VT_UI4
                return this.view.getUint32(offset + 4, true);
            case 30: // VT_LPSTR (ANSI String)
                {
                    const len = this.view.getUint32(offset + 4, true);
                    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + offset + 8, len);
                    // Euc-KR check? OLE might use CP949 for HWP.
                    // For now assume standard CP949 or UTF-8? HWP usually uses CP949 for older, UTF-16 for newer.
                    // But SummaryInfo is OLE standard.
                    // Try TextDecoder with euc-kr if possible, else pattern match.
                    // In browser 'euc-kr' might work.
                    try {
                        return new TextDecoder('euc-kr').decode(bytes).replace(/\0/g, '');
                    } catch {
                        return new TextDecoder().decode(bytes).replace(/\0/g, '');
                    }
                }
            case 31: // VT_LPWSTR (Unicode String)
                {
                    const len = this.view.getUint32(offset + 4, true); // Length in 2-byte chars (incl null) ??
                    // Spec says: "Count of characters in the string" (including null)
                    // But sometimes it's bytes. Let's check.
                    // HWP extraction: Usually len * 2 bytes.
                    const byteLen = len * 2;
                    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + offset + 8, byteLen);
                    return this.encoding.decode(bytes).replace(/\0/g, '');
                }
            case 64: // VT_FILETIME
                {
                    const low = this.view.getUint32(offset + 4, true);
                    const high = this.view.getUint32(offset + 8, true);
                    return this.filetimeToDate(low, high);
                }
            default:
                // console.warn('Unknown Property Type:', type);
                return null;
        }
    }

    private assignProperty(info: SummaryInfo, id: number, value: any) {
        if (value === null) return;

        /*
          PID_TITLE = 0x00000002
          PID_SUBJECT = 0x00000003
          PID_AUTHOR = 0x00000004
          PID_KEYWORDS = 0x00000005
          PID_COMMENTS = 0x00000006
          PID_TEMPLATE = 0x00000007
          PID_LASTAUTHOR = 0x00000008
          PID_REVNUMBER = 0x00000009
          PID_EDITTIME = 0x0000000A
          PID_LASTPRINTED = 0x0000000B
          PID_CREATE_DTM = 0x0000000C
          PID_LASTSAVE_DTM = 0x0000000D
          PID_PAGECOUNT = 0x0000000E
          PID_WORDCOUNT = 0x0000000F
          PID_CHARCOUNT = 0x00000010
          PID_THUMBNAIL = 0x00000011 (Skipped)
          PID_APPNAME = 0x00000012
          PID_SECURITY = 0x00000013
        */
        switch (id) {
            case 2: info.title = value; break;
            case 3: info.subject = value; break;
            case 4: info.author = value; break;
            case 5: info.keywords = value; break;
            case 6: info.comments = value; break;
            case 7: info.template = value; break;
            case 8: info.lastSavedBy = value; break;
            case 9: info.revisionNumber = String(value); break;
            case 10: info.totalTime = value; break; // minutes?
            case 11: info.lastPrinted = value; break;
            case 12: info.created = value; break;
            case 13: info.lastSaved = value; break;
            case 14: info.pages = value; break;
            case 15: info.words = value; break;
            case 16: info.chars = value; break;
            case 19: info.security = value; break;
        }
    }

    // Windows FILETIME to Date
    // Intervals of 100-nanoseconds since Jan 1, 1601 UTC
    private filetimeToDate(low: number, high: number): Date {
        const combined = (BigInt(high) << 32n) | BigInt(low);
        // epoch diff: 11644473600000 ms between 1601 and 1970
        // 1 ms = 10,000 ticks
        const millis = Number((combined / 10000n) - 11644473600000n);
        return new Date(millis);
    }
}
