/**
 * Chat Panel Messaging Module
 * 메시지 관리, 저장, 불러오기 로직
 *
 * @module ui/chat-panel-messaging
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * ChatPanel 메시징 관리 클래스
 */
export class ChatPanelMessaging {
    constructor() {
        this.conversations = new Map();
        this.currentConversationId = null;
        this.storageKey = 'hanview-chat-conversations';
        this.maxConversations = 50;
        this.maxMessagesPerConversation = 100;

        this.loadConversations();
    }

    /**
     * 새 대화 시작
     */
    startNewConversation(title = null) {
        const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const conversation = {
            id,
            title: title || `대화 ${new Date().toLocaleString('ko-KR')}`,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.conversations.set(id, conversation);
        this.currentConversationId = id;
        this.saveConversations();

        logger.info('New conversation started', { id, title: conversation.title });
        return conversation;
    }

    /**
     * 현재 대화에 메시지 추가
     */
    addMessage(content, isUser = false, metadata = {}) {
        const currentConv = this.getCurrentConversation();
        if (!currentConv) {
            this.startNewConversation();
        }

        const message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            isUser,
            timestamp: new Date().toISOString(),
            metadata
        };

        const conversation = this.getCurrentConversation();
        conversation.messages.push(message);
        conversation.updatedAt = new Date().toISOString();

        // 메시지 수 제한
        if (conversation.messages.length > this.maxMessagesPerConversation) {
            conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
        }

        // 첫 사용자 메시지로 제목 자동 생성
        if (isUser && conversation.messages.filter(m => m.isUser).length === 1) {
            conversation.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        }

        this.saveConversations();
        return message;
    }

    /**
     * 현재 대화 가져오기
     */
    getCurrentConversation() {
        if (!this.currentConversationId) return null;
        return this.conversations.get(this.currentConversationId) || null;
    }

    /**
     * 대화 목록 가져오기
     */
    getConversationList() {
        return Array.from(this.conversations.values())
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    /**
     * 특정 대화로 전환
     */
    switchToConversation(conversationId) {
        if (this.conversations.has(conversationId)) {
            this.currentConversationId = conversationId;
            return this.conversations.get(conversationId);
        }
        return null;
    }

    /**
     * 대화 삭제
     */
    deleteConversation(conversationId) {
        if (this.conversations.has(conversationId)) {
            this.conversations.delete(conversationId);

            // 현재 대화를 삭제한 경우
            if (this.currentConversationId === conversationId) {
                this.currentConversationId = null;
            }

            this.saveConversations();
            logger.info('Conversation deleted', { conversationId });
            return true;
        }
        return false;
    }

    /**
     * 대화 내용 검색
     */
    searchMessages(query, conversationId = null) {
        const results = [];
        const conversations = conversationId ?
            [this.conversations.get(conversationId)].filter(Boolean) :
            Array.from(this.conversations.values());

        for (const conversation of conversations) {
            const matchingMessages = conversation.messages.filter(message =>
                message.content.toLowerCase().includes(query.toLowerCase())
            );

            if (matchingMessages.length > 0) {
                results.push({
                    conversation,
                    messages: matchingMessages
                });
            }
        }

        return results;
    }

    /**
     * 대화 내용 내보내기
     */
    exportConversation(conversationId, format = 'json') {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) return null;

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(conversation, null, 2);

            case 'markdown':
                return this.convertToMarkdown(conversation);

            case 'txt':
                return this.convertToText(conversation);

            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * 마크다운 형식으로 변환
     */
    convertToMarkdown(conversation) {
        let markdown = `# ${conversation.title}\n\n`;
        markdown += `**생성일:** ${new Date(conversation.createdAt).toLocaleString('ko-KR')}\n`;
        markdown += `**수정일:** ${new Date(conversation.updatedAt).toLocaleString('ko-KR')}\n\n`;
        markdown += '---\n\n';

        for (const message of conversation.messages) {
            const sender = message.isUser ? '👤 **사용자**' : '🤖 **AI 어시스턴트**';
            const timestamp = new Date(message.timestamp).toLocaleTimeString('ko-KR');

            markdown += `${sender} (${timestamp})\n\n`;
            markdown += `${message.content}\n\n`;
            markdown += '---\n\n';
        }

        return markdown;
    }

    /**
     * 텍스트 형식으로 변환
     */
    convertToText(conversation) {
        let text = `${conversation.title}\n`;
        text += `생성일: ${new Date(conversation.createdAt).toLocaleString('ko-KR')}\n`;
        text += `수정일: ${new Date(conversation.updatedAt).toLocaleString('ko-KR')}\n`;
        text += '=' * 50 + '\n\n';

        for (const message of conversation.messages) {
            const sender = message.isUser ? '사용자' : 'AI 어시스턴트';
            const timestamp = new Date(message.timestamp).toLocaleTimeString('ko-KR');

            text += `[${timestamp}] ${sender}:\n`;
            text += `${message.content}\n\n`;
            text += '-' * 30 + '\n\n';
        }

        return text;
    }

    /**
     * 대화 내용을 로컬 스토리지에 저장
     */
    saveConversations() {
        try {
            const data = {
                conversations: Array.from(this.conversations.entries()),
                currentConversationId: this.currentConversationId,
                savedAt: new Date().toISOString()
            };

            localStorage.setItem(this.storageKey, JSON.stringify(data));
            logger.debug('Conversations saved to storage');
        } catch (error) {
            logger.error('Failed to save conversations', error);
        }
    }

    /**
     * 로컬 스토리지에서 대화 내용 불러오기
     */
    loadConversations() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return;

            const parsed = JSON.parse(data);

            // 대화 복원
            this.conversations = new Map(parsed.conversations || []);
            this.currentConversationId = parsed.currentConversationId;

            // 오래된 대화 정리 (30일 이상)
            this.cleanupOldConversations();

            logger.debug('Conversations loaded from storage', {
                count: this.conversations.size,
                currentId: this.currentConversationId
            });
        } catch (error) {
            logger.error('Failed to load conversations', error);
            this.conversations = new Map();
            this.currentConversationId = null;
        }
    }

    /**
     * 오래된 대화 정리
     */
    cleanupOldConversations() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let cleanedCount = 0;
        for (const [id, conversation] of this.conversations) {
            if (new Date(conversation.updatedAt) < thirtyDaysAgo) {
                this.conversations.delete(id);
                cleanedCount++;
            }
        }

        // 최대 개수 제한
        const sortedConversations = Array.from(this.conversations.entries())
            .sort(([, a], [, b]) => new Date(b.updatedAt) - new Date(a.updatedAt));

        if (sortedConversations.length > this.maxConversations) {
            const toRemove = sortedConversations.slice(this.maxConversations);
            for (const [id] of toRemove) {
                this.conversations.delete(id);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info('Old conversations cleaned up', { count: cleanedCount });
            this.saveConversations();
        }
    }

    /**
     * 통계 정보 가져오기
     */
    getStatistics() {
        const conversations = Array.from(this.conversations.values());
        const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
        const userMessages = conversations.reduce((sum, conv) =>
            sum + conv.messages.filter(m => m.isUser).length, 0);

        return {
            totalConversations: conversations.length,
            totalMessages,
            userMessages,
            aiMessages: totalMessages - userMessages,
            oldestConversation: conversations.length > 0 ?
                Math.min(...conversations.map(c => new Date(c.createdAt))) : null,
            newestConversation: conversations.length > 0 ?
                Math.max(...conversations.map(c => new Date(c.updatedAt))) : null
        };
    }
}

export default ChatPanelMessaging;