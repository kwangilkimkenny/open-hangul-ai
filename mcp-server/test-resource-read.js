#!/usr/bin/env node
/**
 * Simple test to debug resource reading
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Testing resource read in detail...\n');

const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const message = JSON.parse(line);
      console.log('📨 Received response:');
      console.log(JSON.stringify(message, null, 2));
      console.log('\n');

      if (message.id === 2) {
        // Resource read response received
        if (message.result) {
          console.log('✅ Resource read succeeded!');
          if (message.result.contents && message.result.contents.length > 0) {
            const content = message.result.contents[0];
            console.log(`   URI: ${content.uri}`);
            console.log(`   Type: ${content.mimeType}`);
            console.log(`   Text length: ${content.text?.length || 0} chars`);
            console.log(`   Preview: ${content.text?.substring(0, 150)}...`);
          }
        } else if (message.error) {
          console.log('❌ Resource read failed with error:');
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
  console.error('❌ Server stderr:', data.toString());
});

// 1. Initialize
setTimeout(() => {
  console.log('📤 Sending initialize request...\n');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'resource-test',
        version: '1.0.0'
      }
    }
  }) + '\n');
}, 100);

// 2. Read resource
setTimeout(() => {
  console.log('📤 Sending resources/read request...\n');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'resources/read',
    params: {
      uri: 'project://readme'
    }
  }) + '\n');
}, 500);

// Timeout
setTimeout(() => {
  console.log('⏱️  Timeout - killing server');
  server.kill();
  process.exit(1);
}, 5000);
