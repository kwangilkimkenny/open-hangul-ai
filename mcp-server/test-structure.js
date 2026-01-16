#!/usr/bin/env node
/**
 * Test get_project_structure tool
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🌳 Testing get_project_structure tool...\n');

const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const message = JSON.parse(line);

      if (message.id === 2) {
        // Tool call response
        if (message.result && message.result.content) {
          console.log('✅ Tool executed successfully!\n');
          console.log(message.result.content[0].text);
        } else if (message.error) {
          console.log('❌ Tool execution failed:');
          console.log(JSON.stringify(message.error, null, 2));
        }

        setTimeout(() => {
          server.kill();
          process.exit(0);
        }, 500);
      }
    } catch (e) {
      // Ignore non-JSON
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

// 1. Initialize
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'structure-test', version: '1.0.0' }
    }
  }) + '\n');
}, 100);

// 2. Call tool
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: {
      name: 'get_project_structure',
      arguments: {
        maxDepth: 2
      }
    }
  }) + '\n');
}, 500);

// Timeout
setTimeout(() => {
  console.log('⏱️  Timeout');
  server.kill();
  process.exit(1);
}, 5000);
