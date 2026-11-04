#!/usr/bin/env node
/**
 * Check that app icon exists and meets requirements:
 * - File exists at src-tauri/icons/icon.png
 * - Dimensions are 1024x1024
 * - Valid PNG file
 * - Not empty (file size > 0)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconPath = path.join(rootDir, 'src-tauri', 'icons', 'icon.png');

console.log(`Checking icon at: ${iconPath}`);

// Check file exists
if (!fs.existsSync(iconPath)) {
  console.error('✗ Icon file does not exist');
  process.exit(1);
}

// Check file size > 0
const stats = fs.statSync(iconPath);
if (stats.size === 0) {
  console.error('✗ Icon file is empty');
  process.exit(1);
}
console.log(`✓ File exists (${stats.size} bytes)`);

// Check PNG signature (first 8 bytes)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fileBuffer = fs.readFileSync(iconPath);
const header = fileBuffer.subarray(0, 8);
if (!header.equals(PNG_SIGNATURE)) {
  console.error('✗ File is not a valid PNG (invalid signature)');
  process.exit(1);
}
console.log('✓ Valid PNG signature');

// Check dimensions using PNG IHDR chunk (bytes 16-23 after signature)
// IHDR chunk: length(4) + type(4) + width(4) + height(4)
const ihdrData = fileBuffer.subarray(16, 24);
const width = ihdrData.readUInt32BE(0);
const height = ihdrData.readUInt32BE(4);

console.log(`✓ Dimensions: ${width}x${height}`);

if (width !== 1024 || height !== 1024) {
  console.error(`✗ Expected 1024x1024, got ${width}x${height}`);
  process.exit(1);
}

console.log('✓ All checks passed: 1024x1024 PNG icon is valid');
process.exit(0);