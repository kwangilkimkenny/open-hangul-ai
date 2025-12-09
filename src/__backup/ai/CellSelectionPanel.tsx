/**
 * Cell Selection Panel
 * 셀 선택 모드 제어 패널
 * 
 * @module components/ai/CellSelectionPanel
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Target, Wand2, RotateCcw, Check, X, Info } from 'lucide-react';
import { useCellSelectionStore } from '../../stores/cellSelectionStore';
import { useDocumentStore } from '../../stores/documentStore';
import { LayoutExtractor } from '../../lib/ai/layout-extractor';
import { getLogger } from '../../lib/utils/logger';
import toast from 'react-hot-toast';

const logger = getLogger();

export function CellSelectionPanel() {
  const { 
    mode, 
    enterSelectionMode, 
    exitSelectionMode,
    clearSelections,
    getKeepCells,
    getGenerateCells,
    selectMultiple
  } = useCellSelectionStore();
  
  const { document } = useDocumentStore();
  const [showHelp, setShowHelp] = useState(false);
  
  const keepCount = getKeepCells().length;
  const generateCount = getGenerateCells().length;

  /**
   * 자동 헤더 감지
   */
  const handleAutoDetect = useCallback(async () => {
    if (!document) {
      toast.error('문서를 먼저 열어주세요');
      return;
    }

    const toastId = toast.loading('헤더 자동 감지 중...');
    
    try {
      logger.info('🤖 자동 헤더 감지 시작...');
      
      const extractor = new LayoutExtractor();
      const detectedHeaders = extractor.autoDetectHeaders(document);
      
      selectMultiple(detectedHeaders);
      
      toast.success(`${detectedHeaders.length}개 헤더 자동 감지 완료`, { id: toastId });
      logger.info(`✅ ${detectedHeaders.length}개 헤더 감지 완료`);
    } catch (error) {
      logger.error('❌ 자동 감지 실패:', error);
      toast.error('자동 감지 중 오류가 발생했습니다', { id: toastId });
    }
  }, [document, selectMultiple]);

  /**
   * 레이아웃 추출 적용
   */
  const handleApply = useCallback(async () => {
    if (keepCount === 0) {
      toast.error('최소 1개 이상의 셀을 유지로 선택해주세요');
      return;
    }

    const toastId = toast.loading('레이아웃 추출 중...');
    
    try {
      logger.info('🎨 레이아웃 추출 시작...');
      logger.info(`   유지: ${keepCount}개, 생성: ${generateCount}개`);
      
      toast.success('레이아웃 추출 완료! 이제 AI 채팅에서 내용을 생성하세요.', { id: toastId, duration: 5000 });
      
      // 선택 모드 종료하지 않음 (사용자가 수동으로 종료)
      logger.info('✅ 레이아웃 추출 완료');
    } catch (error) {
      logger.error('❌ 레이아웃 추출 실패:', error);
      toast.error('레이아웃 추출 중 오류가 발생했습니다', { id: toastId });
    }
  }, [keepCount, generateCount]);

  /**
   * 선택 초기화
   */
  const handleClear = useCallback(() => {
    clearSelections();
    toast.success('선택이 초기화되었습니다');
    logger.info('🗑️  선택 초기화');
  }, [clearSelections]);

  /**
   * 선택 모드 종료
   */
  const handleExit = useCallback(() => {
    exitSelectionMode();
    toast.success('선택 모드가 종료되었습니다');
    logger.info('🎯 선택 모드 종료');
  }, [exitSelectionMode]);

  // 선택 모드가 아닐 때
  if (!mode.isActive) {
    return (
      <div style={styles.inactivePanel}>
        <button 
          onClick={enterSelectionMode}
          style={styles.startButton}
        >
          <Target size={20} />
          <span>레이아웃 추출 모드 시작</span>
        </button>
        <p style={styles.helpText}>
          표의 제목/헤더 셀을 선택하여 레이아웃을 추출하고, AI가 나머지 내용을 채웁니다.
        </p>
      </div>
    );
  }

  // 선택 모드 활성화
  return (
    <div style={styles.activePanel}>
      {/* 헤더 */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <Target size={18} />
          <h3 style={styles.title}>셀 선택 중...</h3>
        </div>
        <button onClick={handleExit} style={styles.exitButton} title="선택 모드 종료">
          <X size={18} />
        </button>
      </div>

      {/* 통계 */}
      <div style={styles.stats}>
        <div style={styles.statItem}>
          <div style={styles.keepBadge}>
            <Check size={14} />
            <span>유지: {keepCount}개</span>
          </div>
          <span style={styles.statHelp}>제목/헤더 셀</span>
        </div>
        <div style={styles.statItem}>
          <div style={styles.genBadge}>
            <Wand2 size={14} />
            <span>생성: {generateCount}개</span>
          </div>
          <span style={styles.statHelp}>AI가 채울 셀</span>
        </div>
      </div>

      {/* 사용 방법 */}
      <div style={styles.instructions}>
        <button 
          onClick={() => setShowHelp(!showHelp)}
          style={styles.helpToggle}
        >
          <Info size={14} />
          <span>{showHelp ? '사용법 숨기기' : '사용법 보기'}</span>
        </button>
        
        {showHelp && (
          <div style={styles.helpContent}>
            <ol style={styles.helpList}>
              <li>
                <span style={styles.keepColor}>● 녹색</span>: 제목/헤더로 유지할 셀 클릭
              </li>
              <li>
                <span style={styles.genColor}>● 파란색</span>: AI가 생성할 셀로 다시 클릭
              </li>
              <li>다시 클릭하면 선택 해제</li>
              <li>"자동 감지"로 헤더를 자동으로 찾을 수 있습니다</li>
            </ol>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div style={styles.actions}>
        <button 
          onClick={handleAutoDetect}
          style={styles.autoButton}
          title="헤더 자동 감지"
        >
          <Wand2 size={16} />
          <span>자동 감지</span>
        </button>
        <button 
          onClick={handleClear}
          style={styles.clearButton}
          title="선택 초기화"
        >
          <RotateCcw size={16} />
          <span>초기화</span>
        </button>
        <button 
          onClick={handleApply}
          style={{
            ...styles.applyButton,
            ...(keepCount === 0 ? styles.applyButtonDisabled : {})
          }}
          disabled={keepCount === 0}
          title="레이아웃 추출"
        >
          <Check size={16} />
          <span>레이아웃 추출 ({keepCount}개 유지)</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 스타일
// ==========================================

const styles: Record<string, React.CSSProperties> = {
  inactivePanel: {
    padding: '20px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    textAlign: 'center' as const
  },
  startButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 20px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: 'white',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  helpText: {
    marginTop: '12px',
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5
  },
  
  activePanel: {
    padding: '16px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '8px',
    border: '2px solid #3b82f6',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: 'var(--color-text-primary)'
  },
  exitButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  
  stats: {
    display: 'flex',
    gap: '12px'
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  keepBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#10b98120',
    border: '1px solid #10b981',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#10b981'
  },
  genBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#3b82f620',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#3b82f6'
  },
  statHelp: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    paddingLeft: '12px'
  },
  
  instructions: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid var(--color-border)'
  },
  helpToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    transition: 'all 0.2s ease'
  },
  helpContent: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid var(--color-border)'
  },
  helpList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.8
  },
  keepColor: {
    color: '#10b981',
    fontWeight: 'bold' as const
  },
  genColor: {
    color: '#3b82f6',
    fontWeight: 'bold' as const
  },
  
  actions: {
    display: 'flex',
    gap: '8px'
  },
  autoButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#8b5cf6',
    backgroundColor: '#8b5cf620',
    border: '1px solid #8b5cf6',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  clearButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#ef4444',
    backgroundColor: '#ef444420',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  applyButton: {
    flex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: 'white',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  applyButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  }
};

export default CellSelectionPanel;

