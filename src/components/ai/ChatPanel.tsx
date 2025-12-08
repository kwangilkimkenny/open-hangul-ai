/**
 * Chat Panel Component
 * AI 채팅 인터페이스 컴포넌트
 * 
 * @module components/ai/ChatPanel
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Settings, 
  Loader2,
  Bot,
  User
} from 'lucide-react';
import { useAIStore, type ChatMessage } from '../../stores/aiStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useUIStore } from '../../stores/uiStore';
import { getLogger } from '../../lib/utils/logger';
import { AIDocumentController } from '../../lib/ai/document-controller';
import { TemplateButton } from './TemplateButton';
import { CellSelectionPanel } from './CellSelectionPanel';
import { useCellSelectionStore } from '../../stores/cellSelectionStore';
import { LayoutExtractor } from '../../lib/ai/layout-extractor';
import { SelectiveContentGenerator } from '../../lib/ai/selective-generator';
import toast from 'react-hot-toast';
import '../../styles/chat-panel.css';

const logger = getLogger();

// AI Controller 싱글톤
let aiController: AIDocumentController | null = null;
function getAIController(): AIDocumentController {
  if (!aiController) {
    aiController = new AIDocumentController();
  }
  return aiController;
}

// 로딩 메시지 배열
const LOADING_MESSAGES = [
  '문서를 꼼꼼히 읽는 중...',
  'AI가 커피 한잔 마시며 생각 중...',
  '창의적인 영감을 받는 중...',
  '문장을 예쁘게 다듬는 중...',
  '마법을 부리는 중...',
  '문서 구조를 분석하는 중...',
  '내용을 최적화하는 중...',
  '완벽을 추구하는 중...',
  '거의 다 왔어요...',
];

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);
  
  const {
    messages,
    isPanelOpen,
    isProcessing,
    addMessage,
    updateMessage,
    removeMessage,
    addLoadingMessage,
    setProcessing,
    togglePanel,
    setPanelOpen,
    setApiKey,
    hasApiKey,
    getActiveApiKey,
  } = useAIStore();
  
  const { document, setDocument, setDirty } = useDocumentStore();
  const { showToast } = useUIStore();
  
  // 셀 선택 스토어
  const { 
    mode, 
    getKeepCells, 
    getGenerateCells, 
    buildContext 
  } = useCellSelectionStore();

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 패널 열릴 때 입력창 포커스
  useEffect(() => {
    if (isPanelOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isPanelOpen]);

  // 초기 환영 메시지 (Strict Mode에서 중복 방지)
  useEffect(() => {
    if (!initializedRef.current && messages.length === 0) {
      initializedRef.current = true;
      addMessage('system', 'AI 문서 편집 기능에 오신 것을 환영합니다! 문서 구조를 유지하면서 내용을 변경할 수 있습니다.');
    }
  }, []);

  // 메시지 전송 핸들러
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isProcessing) return;
    
    logger.info(`📝 사용자 요청: "${trimmedInput}"`);

    // API 키 확인
    if (!hasApiKey()) {
      addMessage('system', '⚠️ API 키를 먼저 설정해주세요.');
      handleApiKeyPrompt();
      return;
    }

    // 문서 확인
    if (!document) {
      addMessage('system', '⚠️ 먼저 HWPX 문서를 불러와주세요.');
      return;
    }

    // 입력 초기화
    setInput('');

    // 사용자 메시지 추가
    addMessage('user', trimmedInput);

    // 로딩 메시지 추가
    const loadingId = addLoadingMessage();
    setProcessing(true);

    // 로딩 메시지 변경 인터벌
    let messageIndex = 0;
    const loadingInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      updateMessage(loadingId, LOADING_MESSAGES[messageIndex]);
    }, 2000);

    try {
      // ==========================================
      // 선택 모드 체크: 선택적 생성 vs 일반 생성
      // ==========================================
      const keepCells = getKeepCells();
      const generateCells = getGenerateCells();
      // 선택 정보가 있으면 선택적 생성 사용 (모드 활성화 여부 무관)
      const isSelectiveMode = keepCells.length > 0;
      
      if (isSelectiveMode) {
        logger.info('🎯 선택 모드: 선택적 생성 시작');
        logger.info(`   유지: ${keepCells.length}개, 생성: ${generateCells.length}개`);
        
        // API 키 가져오기
        const apiKey = getActiveApiKey();
        if (!apiKey) {
          throw new Error('API 키를 찾을 수 없습니다.');
        }
        
        // 1. 레이아웃 추출
        const extractor = new LayoutExtractor();
        const allSelections = [...keepCells, ...generateCells];
        const layoutResult = extractor.extractLayout(document, allSelections);
        
        // 2. 선택적 콘텐츠 생성
        const generator = new SelectiveContentGenerator();
        const result = await generator.generateSelective(
          layoutResult.layoutDocument,
          layoutResult.context,
          {
            userRequest: trimmedInput,
            apiKey,
            temperature: 0.7,
            maxTokens: 2000
          }
        );
        
        // 3. 문서 업데이트
        setDocument(result.document);
        setDirty(true);
        
        // 로딩 메시지 제거
        clearInterval(loadingInterval);
        removeMessage(loadingId);
        
        // 결과 메시지
        const statsMessage = `✅ 선택적 생성 완료!\n\n` +
          `📊 통계:\n` +
          `- 업데이트된 셀: ${result.stats.itemsUpdated}개\n` +
          `- 사용 토큰: ${result.stats.tokensUsed}개\n` +
          `- 비용: $${result.stats.cost.toFixed(4)}\n` +
          `- 소요 시간: ${(result.stats.duration / 1000).toFixed(1)}초`;
        
        addMessage('assistant', statsMessage);
        toast.success('선택적 생성 완료!');
        
        logger.info('✅ 선택적 생성 완료');
        
        setProcessing(false);
        return;
      }
      
      // ==========================================
      // 일반 모드: 기존 AI Controller 사용
      // ==========================================
      logger.info('🤖 일반 모드: 전체 문서 생성');
      
      // AI Controller 가져오기
      const controller = getAIController();

      // API 키 설정
      const apiKey = getActiveApiKey();
      if (apiKey) {
        controller.setApiKey(apiKey);
      } else {
        throw new Error('API 키를 찾을 수 없습니다.');
      }

      // AI 요청 처리
      const result = await controller.handleUserRequest(document!, trimmedInput);

      // 로딩 메시지 제거
      clearInterval(loadingInterval);
      removeMessage(loadingId);

      // 문서 업데이트
      setDocument(result.updatedDocument);
      setDirty(true);

      // 성공 메시지
      addMessage('assistant', 
        `✅ 요청이 완료되었습니다!\n\n` +
        `📝 업데이트: ${result.metadata.itemsUpdated}개 항목\n` +
        `🪙 토큰 사용: ${result.metadata.tokensUsed.toLocaleString()}개\n` +
        `💰 비용: $${result.metadata.cost.toFixed(4)}\n` +
        `⏱️ 처리 시간: ${(result.metadata.processingTime / 1000).toFixed(1)}초`
      );
      
      showToast('success', '완료', `${result.metadata.itemsUpdated}개 항목이 업데이트되었습니다.`);
      logger.info('AI request processed successfully', result.metadata);

    } catch (error) {
      clearInterval(loadingInterval);
      removeMessage(loadingId);
      
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addMessage('assistant', `❌ 오류가 발생했습니다:\n\n${errorMessage}`);
      showToast('error', '오류', errorMessage);
      logger.error('AI request error:', error);
    } finally {
      setProcessing(false);
    }
  }, [input, isProcessing, document, hasApiKey, addMessage, updateMessage, removeMessage, addLoadingMessage, setProcessing, showToast, mode, getKeepCells, getGenerateCells, buildContext, setDocument, setDirty, getActiveApiKey]);

  // API 키 설정 핸들러
  const handleApiKeyPrompt = useCallback(() => {
    const key = prompt('OpenAI API 키를 입력하세요:');
    if (key?.trim()) {
      setApiKey(key.trim());
      addMessage('system', '✅ API 키가 설정되었습니다!');
      showToast('success', '성공', 'API 키가 설정되었습니다.');
    }
  }, [setApiKey, addMessage, showToast]);

  // Enter 키 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <>
      {/* 토글 버튼 */}
      <button
        className="chat-toggle-button"
        onClick={togglePanel}
        title="AI 문서 편집"
      >
        <MessageSquare size={24} />
      </button>

      {/* 채팅 패널 */}
      <div className={`chat-panel ${isPanelOpen ? 'open' : ''}`}>
        {/* 헤더 */}
        <div className="chat-header">
          <div className="chat-header-title">
            <Bot size={20} />
            <span>AI 문서 편집</span>
          </div>
          <div className="chat-header-actions">
            <button
              onClick={handleApiKeyPrompt}
              className={`header-btn ${hasApiKey() ? 'has-key' : ''}`}
              title="API 키 설정"
            >
              <span style={{ fontSize: '18px', color: hasApiKey() ? '#a8f0a8' : '#ffffff', fontWeight: 'bold' }}>🔑</span>
            </button>
            <button
              onClick={() => setPanelOpen(false)}
              className="header-btn"
              title="닫기"
            >
              <span style={{ fontSize: '20px', color: '#ffffff', fontWeight: 'bold' }}>✕</span>
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="chat-messages">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 템플릿 및 셀 선택 섹션 */}
        <div className="chat-template-section" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <TemplateButton />
          <CellSelectionPanel />
        </div>

        {/* 입력 영역 */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="문서 수정 요청을 입력하세요..."
            disabled={isProcessing}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="send-button"
          >
            {isProcessing ? (
              <Loader2 size={20} className="spinning" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// 메시지 버블 컴포넌트
interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const getIcon = () => {
    switch (message.type) {
      case 'user':
        return <User size={16} />;
      case 'assistant':
        return <Bot size={16} />;
      case 'system':
        return <Settings size={16} />;
    }
  };

  return (
    <div className={`message-bubble ${message.type} ${message.isLoading ? 'loading' : ''}`}>
      <div className="message-icon">
        {getIcon()}
      </div>
      <div className="message-content">
        {message.content}
      </div>
    </div>
  );
}

export default ChatPanel;

