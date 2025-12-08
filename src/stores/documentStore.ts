/**
 * Document Store
 * 문서 상태 관리 (Zustand)
 * 
 * @module stores/documentStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { HWPXDocument, HWPXSection, HWPXElement } from '../types/hwpx';

interface DocumentState {
  // State
  document: HWPXDocument | null;
  originalFile: File | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
  
  // Actions
  setDocument: (doc: HWPXDocument) => void;
  updateDocument: (doc: HWPXDocument) => void;
  setOriginalFile: (file: File) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDirty: (dirty: boolean) => void;
  reset: () => void;
  
  // Computed / Getters
  getSectionCount: () => number;
  getSection: (index: number) => HWPXSection | null;
  
  // Element Updates
  updateElement: (sectionIndex: number, elementIndex: number, element: HWPXElement) => void;
  updateCellText: (path: CellPath, text: string) => void;
}

interface CellPath {
  section: number;
  table: number;
  row: number;
  cell: number;
}

const initialState = {
  document: null,
  originalFile: null,
  fileName: null,
  isLoading: false,
  error: null,
  isDirty: false,
};

export const useDocumentStore = create<DocumentState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Actions
      setDocument: (doc) => set({ 
        document: doc, 
        isLoading: false, 
        error: null,
        isDirty: false 
      }),
      
      updateDocument: (doc) => set({ 
        document: doc, 
        isDirty: true 
      }),
      
      setOriginalFile: (file) => set({ 
        originalFile: file,
        fileName: file.name 
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error, isLoading: false }),
      
      setDirty: (dirty) => set({ isDirty: dirty }),
      
      reset: () => set(initialState),
      
      // Computed
      getSectionCount: () => {
        const { document } = get();
        return document?.sections?.length || 0;
      },
      
      getSection: (index) => {
        const { document } = get();
        return document?.sections?.[index] || null;
      },
      
      // Element Updates
      updateElement: (sectionIndex, elementIndex, element) => {
        const { document } = get();
        if (!document) return;
        
        const newDocument = JSON.parse(JSON.stringify(document)) as HWPXDocument;
        if (newDocument.sections[sectionIndex]) {
          newDocument.sections[sectionIndex].elements[elementIndex] = element;
        }
        
        set({ document: newDocument, isDirty: true });
      },
      
      updateCellText: (path, text) => {
        const { document } = get();
        if (!document) return;
        
        const newDocument = JSON.parse(JSON.stringify(document)) as HWPXDocument;
        const section = newDocument.sections[path.section];
        if (!section) return;
        
        const table = section.elements[path.table];
        if (!table || table.type !== 'table') return;
        
        const row = (table as any).rows?.[path.row];
        if (!row) return;
        
        const cell = row.cells?.[path.cell];
        if (!cell) return;
        
        // Update text in first paragraph's first run
        if (cell.elements?.[0]?.runs?.[0]) {
          cell.elements[0].runs[0].text = text;
        } else if (cell.elements?.[0]) {
          cell.elements[0].runs = [{ text, style: {} }];
        } else {
          cell.elements = [{
            type: 'paragraph',
            runs: [{ text, style: {} }]
          }];
        }
        
        set({ document: newDocument, isDirty: true });
      },
    }),
    { name: 'document-store' }
  )
);

export default useDocumentStore;

