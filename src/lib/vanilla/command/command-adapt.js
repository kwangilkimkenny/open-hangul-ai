/**
 * Command Adapt - Modularized Version
 * 리팩토링된 모듈화 버전
 *
 * @module command/command-adapt
 * @version 2.0.0
 */

// 메인 클래스와 개별 명령 모듈들 export
export { CommandAdapt } from './command-adapt-core.js';
export { TextCommands } from './text-commands.js';
export { HistoryCommands } from './history-commands.js';
export { RangeCommands } from './range-commands.js';
export { ListCommands } from './list-commands.js';
export { TableCommands } from './table-commands.js';
export { ImageCommands } from './image-commands.js';
export { ShapeCommands } from './shape-commands.js';
export { DocumentCommands } from './document-commands.js';
export { ClipboardCommands } from './clipboard-commands.js';
export { TextInputCommands } from './text-input-commands.js';
export { FindReplaceCommands } from './find-replace-commands.js';
export { UtilityCommands } from './utility-commands.js';

// 기본 export는 메인 클래스
export { CommandAdapt as default } from './command-adapt-core.js';