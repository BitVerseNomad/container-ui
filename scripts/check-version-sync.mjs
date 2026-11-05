#!/usr/bin/env node
/**
 * Check that version is synchronized across package.json, tauri.conf.json, and Cargo.toml
 */

import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const files = {
  'package.json': path.join(rootDir, 'package.json'),
  'src-tauri/tauri.conf.json': path.join(rootDir, 'src-tauri/tauri.conf.json'),
  'src-tauri/Cargo.toml': path.join(rootDir, 'src-tauri/Cargo.toml'),
};

function extractVersion(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (fileName.endsWith('.json')) {
    const json = JSON.parse(content);
    return json.version;
  } else if (fileName.endsWith('.toml')) {
    const match = content.match(/^version\s*=\s*"([^"]+)"/m);
    if (!match) {
      throw new Error(`Could not find version in ${fileName}`);
    }
    return match[1];
  }
  
  throw new Error(`Unsupported file type: ${fileName}`);
}

const versions = {};
let allSame = true;
let firstVersion = null;

for (const [name, filePath] of Object.entries(files)) {
  try {
    const version = extractVersion(filePath, name);
    versions[name] = version;
    console.log(`${name}: ${version}`);
    
    if (firstVersion === null) {
      firstVersion = version;
    } else if (version !== firstVersion) {
      allSame = false;
    }
  } catch (err) {
    console.error(`Error reading ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log('');

if (allSame) {
  console.log(`✓ All versions are synchronized: ${firstVersion}`);
  process.exit(0);
} else {
  console.error('✗ Version mismatch detected!');
  process.exit(1);
}