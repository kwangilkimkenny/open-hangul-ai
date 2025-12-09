/**
 * Plugin Manager - 플러그인 시스템
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Plugin Manager 클래스
 */
export class PluginManager {
    constructor(options = {}) {
        this.options = {
            pluginsDir: './plugins/',
            autoLoad: false,
            ...options
        };
        
        this.plugins = new Map();
        this.hooks = new Map();
        
        logger.info('PluginManager initialized');
    }
    
    /**
     * 플러그인 등록
     */
    register(plugin) {
        if (!plugin.id || !plugin.name) {
            throw new Error('Plugin must have id and name');
        }
        
        if (this.plugins.has(plugin.id)) {
            logger.warn(`Plugin already registered: ${plugin.id}`);
            return false;
        }
        
        // 플러그인 정보 저장
        this.plugins.set(plugin.id, {
            ...plugin,
            enabled: false,
            loaded: false
        });
        
        logger.info(`Plugin registered: ${plugin.name} (${plugin.id})`);
        
        return true;
    }
    
    /**
     * 플러그인 활성화
     */
    async enable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        if (plugin.enabled) {
            logger.warn(`Plugin already enabled: ${pluginId}`);
            return true;
        }
        
        try {
            // onLoad 훅 실행
            if (plugin.onLoad) {
                await plugin.onLoad(this.getPluginAPI());
            }
            
            plugin.enabled = true;
            plugin.loaded = true;
            
            logger.info(`Plugin enabled: ${pluginId}`);
            
            // 이벤트 발생
            this.emitEvent('pluginEnabled', { pluginId, plugin });
            
            return true;
            
        } catch (error) {
            logger.error(`Failed to enable plugin ${pluginId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * 플러그인 비활성화
     */
    async disable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        if (!plugin.enabled) {
            logger.warn(`Plugin already disabled: ${pluginId}`);
            return true;
        }
        
        try {
            // onUnload 훅 실행
            if (plugin.onUnload) {
                await plugin.onUnload();
            }
            
            plugin.enabled = false;
            
            logger.info(`Plugin disabled: ${pluginId}`);
            
            // 이벤트 발생
            this.emitEvent('pluginDisabled', { pluginId, plugin });
            
            return true;
            
        } catch (error) {
            logger.error(`Failed to disable plugin ${pluginId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * 모든 플러그인 가져오기
     */
    getAllPlugins() {
        return Array.from(this.plugins.entries()).map(([id, plugin]) => ({
            id,
            name: plugin.name,
            version: plugin.version || '1.0.0',
            description: plugin.description || '',
            enabled: plugin.enabled
        }));
    }
    
    /**
     * 활성화된 플러그인 가져오기
     */
    getEnabledPlugins() {
        return this.getAllPlugins().filter(p => p.enabled);
    }
    
    /**
     * 훅 등록
     */
    registerHook(hookName, handler) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }
        
        this.hooks.get(hookName).push(handler);
        
        logger.debug(`Hook registered: ${hookName}`);
    }
    
    /**
     * 훅 실행
     */
    async executeHook(hookName, ...args) {
        const handlers = this.hooks.get(hookName) || [];
        
        logger.debug(`Executing hook: ${hookName} (${handlers.length} handlers)`);
        
        const results = [];
        for (const handler of handlers) {
            try {
                const result = await handler(...args);
                results.push(result);
            } catch (error) {
                logger.error(`Hook handler error in ${hookName}: ${error.message}`);
            }
        }
        
        return results;
    }
    
    /**
     * Plugin API 제공
     */
    getPluginAPI() {
        return {
            // 훅 등록
            registerHook: (hookName, handler) => {
                this.registerHook(hookName, handler);
            },
            
            // 이벤트 발생
            emit: (eventName, detail) => {
                this.emitEvent(eventName, detail);
            },
            
            // 로거
            logger: getLogger(),
            
            // UI 확장
            addMenuItem: (item) => {
                logger.debug('Menu item added:', item);
                // 실제 구현은 UI 매니저와 통합
            },
            
            addToolbarButton: (button) => {
                logger.debug('Toolbar button added:', button);
                // 실제 구현은 UI 매니저와 통합
            },
            
            // 문서 접근
            getDocument: () => {
                return window.HWPXViewer?.currentDocument;
            }
        };
    }
    
    /**
     * 이벤트 발생
     */
    emitEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: false
        });
        
        document.dispatchEvent(event);
        
        return event;
    }
}

/**
 * 샘플 플러그인 생성 헬퍼
 */
export function createSamplePlugin() {
    return {
        id: 'sample-plugin',
        name: 'Sample Plugin',
        version: '1.0.0',
        description: 'A sample plugin demonstrating the plugin API',
        
        onLoad(api) {
            api.logger.info('Sample plugin loaded!');
            
            // 훅 등록
            api.registerHook('documentLoaded', (doc) => {
                api.logger.info('Document loaded in sample plugin:', doc);
            });
            
            // 툴바 버튼 추가
            api.addToolbarButton({
                id: 'sample-btn',
                icon: '🔌',
                label: 'Sample',
                onClick: () => {
                    alert('Sample plugin button clicked!');
                }
            });
        },
        
        onUnload() {
            logger.info('Sample plugin unloaded!');
        }
    };
}

export default PluginManager;

