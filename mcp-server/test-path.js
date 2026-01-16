#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Current file:', __filename);
console.log('Current dir:', __dirname);

const PROJECT_ROOT = resolve(__dirname, '../..');
console.log('Project root:', PROJECT_ROOT);

const readmePath = join(PROJECT_ROOT, 'README.md');
console.log('README path:', readmePath);

try {
  const content = await readFile(readmePath, 'utf-8');
  console.log('✅ Successfully read README.md');
  console.log('   Length:', content.length, 'characters');
  console.log('   Preview:', content.substring(0, 100));
} catch (error) {
  console.log('❌ Failed to read README.md:', error.message);
}
