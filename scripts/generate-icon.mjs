#!/usr/bin/env node
/**
 * Generate 1024x1024 app icon with sage green theme.
 * Creates a rounded rectangle with sage background (#397863) and white container symbol.
 * Output: src-tauri/icons/icon.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'src-tauri', 'icons', 'icon.png');

const SIZE = 1024;
const CORNER_RADIUS = 224; // ~22% radius for rounded rectangle (Apple style)
const SAGE_GREEN = '#397863';
const WHITE = '#ffffff';

// Container symbol using simple rectangles (frame + corners)
// Container box: centered, 512x512, frame thickness 40px
const FRAME = 40;
const BOX_SIZE = 512;
const BOX_OFFSET = (SIZE - BOX_SIZE) / 2; // 256

const containerSymbolSVG = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <!-- Top frame bar -->
  <rect x="${BOX_OFFSET}" y="${BOX_OFFSET}" width="${BOX_SIZE}" height="${FRAME}" fill="${WHITE}"/>
  <!-- Bottom frame bar -->
  <rect x="${BOX_OFFSET}" y="${BOX_OFFSET + BOX_SIZE - FRAME}" width="${BOX_SIZE}" height="${FRAME}" fill="${WHITE}"/>
  <!-- Left frame bar -->
  <rect x="${BOX_OFFSET}" y="${BOX_OFFSET + FRAME}" width="${FRAME}" height="${BOX_SIZE - 2 * FRAME}" fill="${WHITE}"/>
  <!-- Right frame bar -->
  <rect x="${BOX_OFFSET + BOX_SIZE - FRAME}" y="${BOX_OFFSET + FRAME}" width="${FRAME}" height="${BOX_SIZE - 2 * FRAME}" fill="${WHITE}"/>
  
  <!-- Top lid (slightly inset) -->
  <rect x="${BOX_OFFSET + FRAME * 1.5}" y="${BOX_OFFSET + FRAME * 1.5}" width="${BOX_SIZE - 3 * FRAME}" height="8" rx="4" fill="${WHITE}"/>
  
  <!-- Corner twist locks -->
  <rect x="${BOX_OFFSET + FRAME * 0.5}" y="${BOX_OFFSET + FRAME * 0.5}" width="${FRAME}" height="${FRAME}" rx="4" fill="${WHITE}"/>
  <rect x="${BOX_OFFSET + BOX_SIZE - FRAME * 1.5}" y="${BOX_OFFSET + FRAME * 0.5}" width="${FRAME}" height="${FRAME}" rx="4" fill="${WHITE}"/>
  <rect x="${BOX_OFFSET + FRAME * 0.5}" y="${BOX_OFFSET + BOX_SIZE - FRAME * 1.5}" width="${FRAME}" height="${FRAME}" rx="4" fill="${WHITE}"/>
  <rect x="${BOX_OFFSET + BOX_SIZE - FRAME * 1.5}" y="${BOX_OFFSET + BOX_SIZE - FRAME * 1.5}" width="${FRAME}" height="${FRAME}" rx="4" fill="${WHITE}"/>
</svg>
`;

async function generateIcon() {
  console.log('Generating 1024x1024 app icon...');
  
  // First, render the symbol SVG to a PNG buffer
  const symbolPng = await sharp(Buffer.from(containerSymbolSVG))
    .png()
    .toBuffer();
  
  console.log('Symbol rendered to PNG buffer:', symbolPng.length, 'bytes');
  
  // Create the base: rounded rectangle with sage green background
  const baseSvg = `
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${SAGE_GREEN}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}"/>
    </svg>
  `;
  
  // Composite: base rounded rect + centered symbol (from PNG buffer)
  await sharp(Buffer.from(baseSvg))
    .composite([{
      input: symbolPng,
      gravity: 'center',
      blend: 'over'
    }])
    .png()
    .toFile(outputPath);
  
  console.log(`✓ Icon generated at: ${outputPath}`);
  
  // Verify
  const stats = fs.statSync(outputPath);
  console.log(`✓ File size: ${stats.size} bytes`);
}

generateIcon().catch(err => {
  console.error('✗ Generation failed:', err);
  process.exit(1);
});