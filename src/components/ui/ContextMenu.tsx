/**
 * Context Menu Component
 * 우클릭 컨텍스트 메뉴
 * 
 * @module components/ui/ContextMenu
 * @version 1.0.0
 */

import { Copy, Clipboard, Edit3, Sparkles } from 'lucide-react';
import '../../styles/editing.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  className?: string;
  onClick?: () => void;
}

export interface ContextMenuProps {
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    
    if (item.onClick) {
      item.onClick();
    }
    
    onClose();
  };

  return (
    <div
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className="context-menu-divider" />;
        }

        return (
          <div
            key={item.id}
            className={`context-menu-item ${item.className || ''} ${
              item.disabled ? 'disabled' : ''
            }`}
            onClick={() => handleItemClick(item)}
          >
            {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
            <span className="context-menu-item-label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu-item-shortcut">{item.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 기본 편집 메뉴 아이템 생성
 */
export function createEditingMenuItems(
  onEdit: () => void,
  onAIGenerate: () => void,
  canEdit: boolean = true
): ContextMenuItem[] {
  return [
    {
      id: 'edit',
      label: '수정',
      icon: <Edit3 size={16} />,
      disabled: !canEdit,
      onClick: onEdit,
    },
    {
      id: 'copy',
      label: '복사',
      icon: <Copy size={16} />,
      shortcut: 'Ctrl+C',
      onClick: () => {
        // 기본 복사 동작은 브라우저가 처리
      },
    },
    {
      id: 'paste',
      label: '붙여넣기',
      icon: <Clipboard size={16} />,
      shortcut: 'Ctrl+V',
      onClick: () => {
        // 기본 붙여넣기 동작은 브라우저가 처리
      },
    },
    {
      id: 'divider-1',
      label: '',
      divider: true,
    },
    {
      id: 'ai-generate',
      label: 'AI로 생성',
      icon: <Sparkles size={16} />,
      className: 'ai-item',
      onClick: onAIGenerate,
    },
  ];
}

export default ContextMenu;

