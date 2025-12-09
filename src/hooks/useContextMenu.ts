/**
 * useContextMenu Hook
 * 컨텍스트 메뉴 관리 훅
 * 
 * @module hooks/useContextMenu
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  position: ContextMenuPosition;
  targetElement: HTMLElement | null;
}

export interface UseContextMenuReturn {
  isOpen: boolean;
  position: ContextMenuPosition;
  targetElement: HTMLElement | null;
  openMenu: (event: React.MouseEvent, element: HTMLElement) => void;
  closeMenu: () => void;
}

export function useContextMenu(): UseContextMenuReturn {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetElement: null,
  });

  const menuRef = useRef<HTMLDivElement | null>(null);

  // 메뉴 열기
  const openMenu = useCallback((event: React.MouseEvent, element: HTMLElement) => {
    event.preventDefault();
    event.stopPropagation();

    const x = event.clientX;
    const y = event.clientY;

    // 화면 경계 확인 및 위치 조정
    const menuWidth = 200;
    const menuHeight = 300;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // 오른쪽 경계 체크
    if (x + menuWidth > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - 10;
    }

    // 하단 경계 체크
    if (y + menuHeight > viewportHeight) {
      adjustedY = viewportHeight - menuHeight - 10;
    }

    setState({
      isOpen: true,
      position: { x: adjustedX, y: adjustedY },
      targetElement: element,
    });
  }, []);

  // 메뉴 닫기
  const closeMenu = useCallback(() => {
    setState({
      isOpen: false,
      position: { x: 0, y: 0 },
      targetElement: null,
    });
  }, []);

  // 외부 클릭 감지
  useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    // 약간의 지연 후 이벤트 리스너 등록 (메뉴를 여는 클릭과 충돌 방지)
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.isOpen, closeMenu]);

  // 스크롤 시 메뉴 닫기
  useEffect(() => {
    if (!state.isOpen) return;

    const handleScroll = () => {
      closeMenu();
    };

    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [state.isOpen, closeMenu]);

  return {
    isOpen: state.isOpen,
    position: state.position,
    targetElement: state.targetElement,
    openMenu,
    closeMenu,
  };
}

export default useContextMenu;

