# Phase 3: File Compatibility Improvement (Senior Developer Upgrade)

## 1. Deep Analysis & Risk Assessment
- **Core Requirement**: HWPX Compliance (ISO/IEC 29500 equivalent + Hancom specifics).
- **Complexity Analysis**:
    - **Implicit Dependencies**: `ParaShape` and `CharShape` IDs in `section.xml` must map to *existing* entries in `header.xml`. Missing refs cause "Broken File".
    - **Asset Integrity**: `BinData` (images) must have correct `Id` and `Format` mapping.
    - **Namespace Pollution**: Ensure XML namespaces (`xmlns`) are strictly defined to avoid parsing errors in strict parsers.

## 2. Architectural Design
- **Validation Pipeline (Pre-Export)**:
    - **Reference Checker**: Scan all sections. Verify every `ParaShapeId`, `StyleId`, `CharShapeId` exists in the Header model.
    - **Orphan Sweeper**: Identify and warn about unused ID definitions (bloat) or missing resources (corruption).
- **Safe Builders**:
    - Factory methods for XML tags that enforce default attributes (`InstId`, `Lock`, `ZOrder`).
    - **Randomized ID Generator**: Use `UUID` or `High-Entropy Int` to reduce collision probability in merged documents.

## 3. Implementation Plan
- **File**: `src/lib/vanilla/export/json-to-xml.js`
- **Key Logic**:
    - **Defensive ID Lookup**:
        ```javascript
        const validParaId = header.paraShapes[id] ? id : 0; // Fallback to Default (0)
        ```
    - **Version Strategy**: Hardcode `1.0` in `version.xml` but allow override via config for future-proofing.
    - **Sanitizer**: `escapeXml` must cover all XML special chars including vertical tabs or control codes that might creep in from copy-paste.

## 4. Senior Review / Edge Cases
- **Q**: How do we handle "Custom Fonts"?
    - **A**: Ensure `FontId` maps to a generic fallback (e.g., "Malgun Gothic") if the custom font mapping is lost.
- **Q**: What if `InstId` collision happens (1 in a billion)?
    - **A**: Acceptable risk for client-side generation. For robust server-side, maintain a global ID registry.

## 5. Verification & Stress Test
- **Validator Tool**: Build a mini-script `validateHwpxStructure(json)` that runs before export.
- **Schema Compliance**: Check generated XML against strict XSD (if available) or check for well-formedness (closing tags, quoting).
- **Round-Trip Test**: Import Generated File -> Viewer -> Export Again. Diff the XML structures. They should be isomorphic.

## 6. Fix / Refinement
- **Current Status**: Randomized `InstId` added.
- **Required Upgrade**: Implement the `Reference Checker` logic to prevent "Index Out of Bounds" errors in the Hancom parser.
