#!/usr/bin/env node
/**
 * Check that app icon exists, is valid PNG, 1024x1024, and not empty
 */

import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const iconPath = path.join(rootDir, 'src-tauri/icons/icon.png');

let passed = true;

function fail(msg) {
  console.error(`✗ ${msg}`);
  passed = false;
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

// Check file exists
if (!fs.existsSync(iconPath)) {
  fail(`Icon file missing: ${iconPath}`);
  process.exit(1);
}

const stats = fs.statSync(iconPath);
if (stats.size === 0) {
  fail('Icon file is empty');
  process.exit(1);
}

pass(`Icon file exists (${stats.size} bytes)`);

// Check PNG signature (first 8 bytes)
const fullBuffer = fs.readFileSync(iconPath);
const buffer = fullBuffer.subarray(0, 8);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!buffer.equals(pngSignature)) {
  fail('File is not a valid PNG (invalid signature)');
  process.exit(1);
}
pass('Valid PNG signature');

// Check dimensions using PNG IHDR chunk (bytes 16-23)
const ihdrBuffer = fullBuffer.subarray(16, 24);
const width = ihdrBuffer.readUInt32BE(0);
const height = ihdrBuffer.readUInt32BE(4);

if (width !== 1024 || height !== 1024) {
  fail(`Invalid dimensions: ${width}x${height} (expected 1024x1024)`);
  process.exit(1);
}
pass(`Dimensions: ${width}x${height}`);

// Check color type (should be 6 = RGBA) and bit depth (8)
const bitDepth = fullBuffer[24];
const colorType = fullBuffer[25];

if (bitDepth !== 8) {
  fail(`Invalid bit depth: ${bitDepth} (expected 8)`);
  process.exit(1);
}
pass(`Bit depth: ${bitDepth}`);

if (colorType !== 6) {
  fail(`Invalid color type: ${colorType} (expected 6 = RGBA)`);
  process.exit(1);
}
pass('Color type: RGBA');

console.log('');
if (passed) {
  console.log('✓ All icon checks passed');
  process.exit(0);
} else {
  process.exit(1);
}