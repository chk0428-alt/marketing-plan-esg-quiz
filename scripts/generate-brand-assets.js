const sharp = require('sharp');
const path = require('path');

const OUT = path.join(__dirname, 'resources');

const PRIMARY = '#0b3d8c';
const PRIMARY_DARKER = '#051a3f';
const ACCENT = '#b35900';

// Geometric "A" mark, scaled to sit inside the ~66% adaptive-icon safe zone.
const markPath = `
  <polyline points="512,240 308,798" fill="none" stroke="#ffffff" stroke-width="120" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="512,240 716,798" fill="none" stroke="#ffffff" stroke-width="120" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="365.8" y="607" width="292.4" height="66" rx="28" fill="${ACCENT}"/>
`;

const bgGradientDef = `
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${PRIMARY}"/>
    <stop offset="100%" stop-color="${PRIMARY_DARKER}"/>
  </linearGradient>
`;

const iconBackground = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>${bgGradientDef}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`;

const iconForeground = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${markPath}
</svg>`;

const iconFlat = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>${bgGradientDef}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${markPath}
</svg>`;

const splash = `
<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <rect width="2732" height="2732" fill="${PRIMARY}"/>
  <g transform="translate(858, 858) scale(1.0)">
    ${markPath}
  </g>
</svg>`;

async function run() {
  await sharp(Buffer.from(iconBackground)).png().toFile(path.join(OUT, 'icon-background.png'));
  await sharp(Buffer.from(iconForeground)).png().toFile(path.join(OUT, 'icon-foreground.png'));
  await sharp(Buffer.from(iconFlat)).png().toFile(path.join(OUT, 'icon.png'));
  await sharp(Buffer.from(splash)).png().toFile(path.join(OUT, 'splash.png'));
  console.log('done');
}

run().catch(err => { console.error(err); process.exit(1); });
