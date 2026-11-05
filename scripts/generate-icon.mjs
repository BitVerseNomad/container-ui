#!/usr/bin/env node
/**
 * Generate app icon placeholder - 1024x1024 PNG with sage/green theme
 * Uses sharp to create SVG → PNG: rounded rect sage background + white Docker whale silhouette
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const iconsDir = path.join(rootDir, 'src-tauri/icons');
const outputPath = path.join(iconsDir, 'icon.png');

const size = 1024;

// SVG for the icon: sage rounded rect + white whale silhouette
const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Sage green rounded rectangle background -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.18}" fill="#8BA88D"/>
  
  <!-- Whale body (white ellipse) -->
  <ellipse cx="${size * 0.5}" cy="${size * 0.475}" rx="${size * 0.3}" ry="${size * 0.175}" fill="#FFFFFF"/>
  
  <!-- Tail fluke -->
  <path d="
    M ${size * 0.17} ${size * 0.445}
    Q ${size * 0.125} ${size * 0.375} ${size * 0.075} ${size * 0.445}
    Q ${size * 0.125} ${size * 0.515} ${size * 0.17} ${size * 0.495}
    Z
  " fill="#FFFFFF"/>
  
  <!-- Spout -->
  <path d="
    M ${size * 0.62} ${size * 0.175}
    L ${size * 0.605} ${size * 0.075}
    L ${size * 0.635} ${size * 0.075}
    L ${size * 0.62} ${size * 0.175}
    Z
  " fill="#FFFFFF"/>
  
  <!-- Eye (sage green) -->
  <circle cx="${size * 0.68}" cy="${size * 0.485}" r="${size * 0.012}" fill="#8BA88D"/>
</svg>
`;

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

await sharp(Buffer.from(svg))
  .resize(size, size)
  .png()
  .toFile(outputPath);

const stats = fs.statSync(outputPath);
console.log(`✓ Generated icon: ${outputPath} (${stats.size} bytes, ${size}x${size})`);