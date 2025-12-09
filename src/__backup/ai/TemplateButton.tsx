/**
 * Template Button Component
 * 템플릿 생성 버튼 및 옵션 패널
 * 
 * @module components/ai/TemplateButton
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { 
  FileType, 
  Settings, 
  Loader2 
} from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { useTemplateStore } from '../../stores/templateStore';
import { TemplateAnalyzer } from '../../lib/core/template-analyzer';
import { TemplateGenerator } from '../../lib/core/template-generator';
import type { TemplateOptions } from '../../types/template';
import { getLogger } from '../../lib/utils/logger';
import toast from 'react-hot-toast';

const logger = getLogger();

export function TemplateButton() {
  const { document, updateDocument } = useDocumentStore();
  const {
    isGenerating,
    setGenerating,
    setLastGenerationResult
  } = useTemplateStore();

  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<TemplateOptions>({
    keepTitles: true,
    titlePlaceholder: '[제목을 입력하세요]',
    
    keepTableHeaders: true,
    keepTableStructure: true,
    clearDataCells: true,
    
    keepImages: false,
    keepShapes: true,
    
    keepPageSettings: true,
    keepHeaderFooter: false,
    
    cellPlaceholder: '',
    preserveFormatting: true,
    
    minTitleConfidence: 50,
    detectFormulas: false,
  });

  /**
   * 템플릿 생성 핸들러
   * 문서의 레이아웃은 유지하고 텍스트 내용만 삭제하여
   * AI 콘텐츠 생성을 위한 빈 템플릿으로 변환
   */
  const handleGenerateTemplate = useCallback(async () => {
    if (!document) {
      toast.error('문서를 먼저 열어주세요');
      return;
    }

    setGenerating(true);
    const toastId = toast.loading('레이아웃 분석 중...');

    try {
      logger.info('🎨 템플릿 변환 시작 (레이아웃 유지, 텍스트 삭제)');

      // 1. 분석기 및 생성기 초기화
      const analyzer = new TemplateAnalyzer();
      const generator = new TemplateGenerator(analyzer, options);

      // 2. 템플릿 생성 (레이아웃 유지, 텍스트 삭제)
      const result = await generator.generateTemplate(document, options);

      setLastGenerationResult(result);

      if (!result.success || !result.template || !result.metadata) {
        throw new Error('템플릿 변환에 실패했습니다');
      }

      // 3. 현재 문서를 템플릿으로 교체 (저장하지 않고 화면에만 반영)
      updateDocument(result.template);

      // 4. 성공 메시지
      toast.success(
        `레이아웃 추출 완료!\n` +
        `• 제목: ${result.structure.titleCount}개\n` +
        `• 표: ${result.structure.tableCount}개\n` +
        `• 텍스트 제거율: ${result.statistics.reductionRate.toFixed(1)}%\n` +
        `AI 콘텐츠 생성을 위한 준비가 완료되었습니다.`,
        {
          id: toastId,
          duration: 5000,
        }
      );

      logger.info('✅ 템플릿 변환 완료 (레이아웃 유지, 텍스트 삭제):', result.metadata);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      logger.error('❌ 템플릿 변환 실패:', error);

      toast.error(`템플릿 변환 실패: ${errorMsg}`, {
        id: toastId,
        duration: 5000,
      });
    } finally {
      setGenerating(false);
    }
  }, [document, options, setGenerating, setLastGenerationResult, updateDocument]);

  /**
   * 옵션 변경 핸들러
   */
  const handleOptionChange = useCallback((
    key: keyof TemplateOptions,
    value: any
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!document) {
    return null;
  }

  return (
    <div className="template-button-container" style={styles.container}>
      {/* 메인 버튼 */}
      <button
        onClick={handleGenerateTemplate}
        disabled={isGenerating}
        style={styles.mainButton}
        title="레이아웃을 유지하고 텍스트를 삭제하여 AI 콘텐츠 생성 준비"
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span>레이아웃 추출 중...</span>
          </>
        ) : (
          <>
            <FileType size={18} />
            <span>📄 레이아웃 추출</span>
          </>
        )}
      </button>

      {/* 옵션 버튼 */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isGenerating}
        style={styles.optionsButton}
        title="레이아웃 추출 옵션 설정"
      >
        <Settings size={16} />
      </button>

      {/* 옵션 패널 */}
      {showOptions && (
        <div style={styles.optionsPanel}>
          <h4 style={styles.optionsTitle}>레이아웃 추출 옵션</h4>

          <div style={styles.optionGroup}>
            <h5 style={styles.groupTitle}>제목 처리</h5>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.keepTitles}
                onChange={(e) => handleOptionChange('keepTitles', e.target.checked)}
              />
              <span>제목 유지 (플레이스홀더로 변경)</span>
            </label>
            {options.keepTitles && (
              <input
                type="text"
                value={options.titlePlaceholder}
                onChange={(e) => handleOptionChange('titlePlaceholder', e.target.value)}
                placeholder="제목 플레이스홀더"
                style={styles.textInput}
              />
            )}
          </div>

          <div style={styles.optionGroup}>
            <h5 style={styles.groupTitle}>표 처리</h5>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.keepTableStructure}
                onChange={(e) => handleOptionChange('keepTableStructure', e.target.checked)}
              />
              <span>표 구조 유지</span>
            </label>
            {options.keepTableStructure && (
              <>
                <label style={styles.option}>
                  <input
                    type="checkbox"
                    checked={options.keepTableHeaders}
                    onChange={(e) => handleOptionChange('keepTableHeaders', e.target.checked)}
                  />
                  <span>표 헤더 유지</span>
                </label>
                <label style={styles.option}>
                  <input
                    type="checkbox"
                    checked={options.clearDataCells}
                    onChange={(e) => handleOptionChange('clearDataCells', e.target.checked)}
                  />
                  <span>데이터 셀 비우기</span>
                </label>
              </>
            )}
          </div>

          <div style={styles.optionGroup}>
            <h5 style={styles.groupTitle}>요소 처리</h5>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.keepImages}
                onChange={(e) => handleOptionChange('keepImages', e.target.checked)}
              />
              <span>이미지 유지</span>
            </label>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.keepShapes}
                onChange={(e) => handleOptionChange('keepShapes', e.target.checked)}
              />
              <span>도형 유지</span>
            </label>
          </div>

          <div style={styles.optionGroup}>
            <h5 style={styles.groupTitle}>페이지 설정</h5>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.keepPageSettings}
                onChange={(e) => handleOptionChange('keepPageSettings', e.target.checked)}
              />
              <span>페이지 설정 유지 (여백, 크기 등)</span>
            </label>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.keepHeaderFooter}
                onChange={(e) => handleOptionChange('keepHeaderFooter', e.target.checked)}
              />
              <span>머리글/바닥글 유지</span>
            </label>
          </div>

          <div style={styles.optionGroup}>
            <h5 style={styles.groupTitle}>고급 설정</h5>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={options.preserveFormatting}
                onChange={(e) => handleOptionChange('preserveFormatting', e.target.checked)}
              />
              <span>서식 보존 (폰트, 정렬 등)</span>
            </label>
            <label style={styles.option}>
              <span>제목 감지 신뢰도:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={options.minTitleConfidence}
                onChange={(e) => handleOptionChange('minTitleConfidence', parseInt(e.target.value))}
                style={styles.rangeInput}
              />
              <span>{options.minTitleConfidence}%</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 인라인 스타일 (추후 CSS 모듈로 분리 가능)
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  mainButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  optionsButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    fontSize: '14px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  optionsPanel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '8px',
    padding: '16px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 1000,
    maxHeight: '400px',
    overflowY: 'auto',
  },
  optionsTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
  },
  optionGroup: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  groupTitle: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  textInput: {
    width: '100%',
    padding: '8px 12px',
    marginTop: '4px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
  },
  rangeInput: {
    flex: 1,
    margin: '0 8px',
  },
};

export default TemplateButton;

