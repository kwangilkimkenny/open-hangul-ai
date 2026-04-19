/**
 * Chat Panel - Modularized Version
 * 리팩토링된 모듈화 버전
 *
 * @module ui/chat-panel
 * @version 4.0.0
 */

// 메인 클래스와 기능 모듈들 export
export { ChatPanel, initChatPanel } from './chat-panel-core.js';
export { ChatPanelUI } from './chat-panel-ui.js';
export { ChatPanelMessaging } from './chat-panel-messaging.js';
export { ChatPanelAPI } from './chat-panel-api.js';

// 기본 export는 메인 클래스
export { ChatPanel as default } from './chat-panel-core.js';