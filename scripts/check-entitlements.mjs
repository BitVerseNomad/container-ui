#!/usr/bin/env node
/**
 * Check that entitlements.plist exists and contains required keys for WebKit JIT
 */

import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const entitlementsPath = path.join(rootDir, 'src-tauri/entitlements.plist');

let passed = true;

function fail(msg) {
  console.error(`✗ ${msg}`);
  passed = false;
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

// Check file exists
if (!fs.existsSync(entitlementsPath)) {
  fail(`Entitlements file missing: ${entitlementsPath}`);
  process.exit(1);
}

const content = fs.readFileSync(entitlementsPath, 'utf-8');
pass('Entitlements file exists');

// Required keys for WebKit JIT + network + file access
const requiredKeys = [
  'com.apple.security.cs.allow-jit',
  'com.apple.security.cs.allow-unsigned-executable-memory',
  'com.apple.security.network.client',
  'com.apple.security.files.user-selected.read-write',
];

for (const key of requiredKeys) {
  // Check key exists and is set to true
  const keyPattern = new RegExp(`<key>${key}</key>\\s*<true/>`);
  if (!keyPattern.test(content)) {
    fail(`Missing or false key: ${key}`);
  } else {
    pass(`Key present and true: ${key}`);
  }
}

console.log('');
if (passed) {
  console.log('✓ All entitlements checks passed');
  process.exit(0);
} else {
  process.exit(1);
}