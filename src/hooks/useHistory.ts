/**
 * useHistory Hook
 * Undo/Redo 기능을 위한 히스토리 관리 Hook
 * 
 * @module hooks/useHistory
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T | null;
  future: T[];
}

interface UseHistoryOptions {
  maxHistory?: number;
}

export function useHistory<T>(
  initialState: T | null = null,
  options: UseHistoryOptions = {}
) {
  const { maxHistory = 50 } = options;
  
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  // 새로운 상태 추가
  const push = useCallback((newState: T) => {
    setState(prev => {
      const newPast = prev.present !== null 
        ? [...prev.past, prev.present].slice(-maxHistory) 
        : prev.past;

      return {
        past: newPast,
        present: newState,
        future: [] // 새로운 상태 추가 시 future 초기화
      };
    });
  }, [maxHistory]);

  // Undo
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;
      const newFuture = prev.present !== null 
        ? [prev.present, ...prev.future] 
        : prev.future;

      return {
        past: newPast,
        present: newPresent,
        future: newFuture
      };
    });
  }, []);

  // Redo
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.future.length === 0) return prev;

      const [newPresent, ...newFuture] = prev.future;
      const newPast = prev.present !== null 
        ? [...prev.past, prev.present] 
        : prev.past;

      return {
        past: newPast,
        present: newPresent,
        future: newFuture
      };
    });
  }, []);

  // 초기화
  const reset = useCallback((newState: T | null = null) => {
    setState({
      past: [],
      present: newState,
      future: []
    });
  }, []);

  // 히스토리 클리어 (현재 상태 유지)
  const clearHistory = useCallback(() => {
    setState(prev => ({
      past: [],
      present: prev.present,
      future: []
    }));
  }, []);

  return {
    state: state.present,
    past: state.past,
    future: state.future,
    push,
    undo,
    redo,
    reset,
    clearHistory,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    historyLength: state.past.length + state.future.length
  };
}

export default useHistory;

