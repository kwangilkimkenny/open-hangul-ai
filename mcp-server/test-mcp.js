#!/usr/bin/env node
/**
 * MCP Server Test Script
 * Tests the hanview-knowledge MCP server capabilities
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPTester {
  constructor() {
    this.requestId = 1;
    this.responses = new Map();
  }

  async startServer() {
    console.log('🚀 Starting MCP server...\n');

    this.server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined) {
            const resolve = this.responses.get(message.id);
            if (resolve) {
              resolve(message);
              this.responses.delete(message.id);
            }
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      }
    });

    this.server.stderr.on('data', (data) => {
      console.error('❌ Server error:', data.toString());
    });

    // Initialize the server
    await this.sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0'
        }
      }
    });

    console.log('✅ Server initialized\n');
  }

  async sendRequest(request) {
    if (!request.id) {
      request.id = this.requestId++;
    }

    return new Promise((resolve, reject) => {
      this.responses.set(request.id, resolve);

      this.server.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.responses.has(request.id)) {
          this.responses.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  async testListResources() {
    console.log('📚 Testing resources/list...');

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'resources/list',
      params: {}
    });

    if (response.result && response.result.resources) {
      console.log(`✅ Found ${response.result.resources.length} resources:`);
      response.result.resources.slice(0, 5).forEach(resource => {
        console.log(`   - ${resource.name} (${resource.uri})`);
      });
      if (response.result.resources.length > 5) {
        console.log(`   ... and ${response.result.resources.length - 5} more`);
      }
      return true;
    } else {
      console.log('❌ No resources found');
      return false;
    }
  }

  async testReadResource() {
    console.log('\n📖 Testing resources/read...');

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'resources/read',
      params: {
        uri: 'project://readme'
      }
    });

    if (response.result && response.result.contents) {
      const content = response.result.contents[0];
      const preview = content.text.substring(0, 100);
      console.log(`✅ Read resource successfully:`);
      console.log(`   URI: ${content.uri}`);
      console.log(`   Type: ${content.mimeType}`);
      console.log(`   Preview: ${preview}...`);
      return true;
    } else {
      console.log('❌ Failed to read resource');
      return false;
    }
  }

  async testListTools() {
    console.log('\n🛠️  Testing tools/list...');

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {}
    });

    if (response.result && response.result.tools) {
      console.log(`✅ Found ${response.result.tools.length} tools:`);
      response.result.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      return true;
    } else {
      console.log('❌ No tools found');
      return false;
    }
  }

  async testCallTool() {
    console.log('\n🔍 Testing tools/call (search_project_docs)...');

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_project_docs',
        arguments: {
          keyword: 'pagination'
        }
      }
    });

    if (response.result && response.result.content) {
      const resultText = response.result.content[0].text;
      console.log(`✅ Tool executed successfully:`);
      console.log(`   ${resultText.substring(0, 200)}...`);
      return true;
    } else {
      console.log('❌ Tool execution failed');
      return false;
    }
  }

  async testListPrompts() {
    console.log('\n💬 Testing prompts/list...');

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'prompts/list',
      params: {}
    });

    if (response.result && response.result.prompts) {
      console.log(`✅ Found ${response.result.prompts.length} prompts:`);
      response.result.prompts.forEach(prompt => {
        console.log(`   - ${prompt.name}: ${prompt.description}`);
      });
      return true;
    } else {
      console.log('❌ No prompts found');
      return false;
    }
  }

  async testGetPrompt() {
    console.log('\n📋 Testing prompts/get (analyze-architecture)...');

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'prompts/get',
      params: {
        name: 'analyze-architecture'
      }
    });

    if (response.result && response.result.messages) {
      const message = response.result.messages[0];
      const preview = message.content.text.substring(0, 100);
      console.log(`✅ Prompt retrieved successfully:`);
      console.log(`   Role: ${message.role}`);
      console.log(`   Preview: ${preview}...`);
      return true;
    } else {
      console.log('❌ Failed to get prompt');
      return false;
    }
  }

  async runAllTests() {
    const results = {
      passed: 0,
      failed: 0
    };

    try {
      await this.startServer();

      const tests = [
        { name: 'List Resources', fn: () => this.testListResources() },
        { name: 'Read Resource', fn: () => this.testReadResource() },
        { name: 'List Tools', fn: () => this.testListTools() },
        { name: 'Call Tool', fn: () => this.testCallTool() },
        { name: 'List Prompts', fn: () => this.testListPrompts() },
        { name: 'Get Prompt', fn: () => this.testGetPrompt() }
      ];

      for (const test of tests) {
        try {
          const result = await test.fn();
          if (result) {
            results.passed++;
          } else {
            results.failed++;
          }
        } catch (error) {
          console.log(`❌ ${test.name} failed:`, error.message);
          results.failed++;
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('📊 TEST SUMMARY');
      console.log('='.repeat(60));
      console.log(`✅ Passed: ${results.passed}`);
      console.log(`❌ Failed: ${results.failed}`);
      console.log(`📈 Success Rate: ${Math.round(results.passed / (results.passed + results.failed) * 100)}%`);
      console.log('='.repeat(60));

      if (results.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! MCP server is fully operational!\n');
      } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.\n');
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      this.server.kill();
      process.exit(results.failed === 0 ? 0 : 1);
    }
  }
}

// Run tests
const tester = new MCPTester();
tester.runAllTests();
