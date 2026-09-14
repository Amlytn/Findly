// Findly icon set builder — extracts artwork paths from the original
// F-icon-transparent.svg and assembles the standard SVG icon set.
// Run: node tools/build.mjs   (from findly-icon-set/)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);                       // findly-icon-set/
const SRC  = join(dirname(ROOT), 'brand', 'F-icon-transparent.svg');   // design/brand/
const src  = readFileSync(SRC, 'utf8');

const grab = (re, name) => {
  const m = src.match(re);
  if (!m) throw new Error('extract failed: ' + name);
  return m[1];
};

// ---- artwork extracted verbatim from the source file (zero re-drawing) ----
const SQ   = grab(/<path d="(M 427\.2,134\.6 [^"]+?)" fill="url\(#bg\)"/, 'squircle');
const BAR  = grab(/<path d="(M 543,601 C 575,591[^"]+?)" fill="url\(#bar\)"/, 'bar');
const F    = grab(/<path d="(M 697,352 C 660,358[^"]+?)" fill="url\(#fwhite\)"/, 'F');
const STEM = grab(/<path d="(M 378,845 380,830[^"]+?)" fill="url\(#stemg\)"/, 'stem');
const PIN  = grab(/<path d="(M 766,486 A 114,114[^"]+?)" fill="url\(#pin\)"/, 'pin');
const AOG  = grab(/<path d="(M 543,600 C 549,590[^"]+?)" fill="none" stroke="url\(#aog\)"/, 'aog');
const FOLD = grab(/<path d="(M 543,600 527,610[^"]+?)" fill="none" stroke="url\(#foldg\)"/, 'fold');
const ARC  = grab(/<path d="(M 379,946 C 380,965[^"]+?)" fill="none" stroke="#E6FBFD"/, 'arc');
const BOT  = grab(/<path d="(M 216,1045[^"]+?)" fill="none" stroke="#027E93"/, 'bottom edge stroke');

const BARCLIP_INNER  = grab(/<clipPath id="barclip">(.*?)<\/clipPath>/, 'barclip');
const FCLIP_INNER    = grab(/<clipPath id="fclip">(.*?)<\/clipPath>/, 'fclip');
const STEMCLIP_INNER = grab(/<clipPath id="stemclip">(.*?)<\/clipPath>/, 'stemclip');
const BARCLIP_SHADOW = grab(/(<g clip-path="url\(#barclip\)".*?<\/g>)/, 'barclip shadow');

const SHADOWS_F_B = src.slice(src.indexOf('<!-- bar shadow'), src.indexOf('<!-- shapes -->')).trim();
if (SHADOWS_F_B.length < 500) throw new Error('F/B shadow slice looks wrong');

const PIN_SHADOWS = src.slice(
  src.indexOf('<!-- pin shadow -->'),
  src.indexOf('<path d="M 766,486 A 114,114 0 1 1 918,486 L 851,543 Q 840,553 829,543 Z" fill="url(#pin)"')
).trim();
if (PIN_SHADOWS.length < 200) throw new Error('pin shadow slice looks wrong');

// ---- shared defs ----
const GRADS = `
<linearGradient id="bg" x1="144" y1="134" x2="733" y2="1308" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#31CBBB"/><stop offset="0.25" stop-color="#25BAB3"/><stop offset="0.5" stop-color="#1AA9AC"/><stop offset="0.75" stop-color="#0F97A4"/><stop offset="1" stop-color="#04869D"/></linearGradient>
<linearGradient id="bgDark" x1="144" y1="134" x2="733" y2="1308" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#27A296"/><stop offset="0.25" stop-color="#1E958F"/><stop offset="0.5" stop-color="#15878A"/><stop offset="0.75" stop-color="#0C7983"/><stop offset="1" stop-color="#036B7E"/></linearGradient>
<linearGradient id="fwhite" x1="382" y1="360" x2="828" y2="583" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.3" stop-color="#F7FDFD"/><stop offset="0.6" stop-color="#E9FBFC"/><stop offset="1" stop-color="#D3FAFC"/></linearGradient>
<linearGradient id="stemg" x1="378" y1="845" x2="543" y2="600" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#E1F8FA"/><stop offset="1" stop-color="#C4F0F4"/></linearGradient>
<linearGradient id="bar" x1="533" y1="828" x2="817" y2="668" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1AA09C"/><stop offset="0.25" stop-color="#4BC0C2"/><stop offset="0.5" stop-color="#74D4D0"/><stop offset="0.75" stop-color="#95EEE1"/><stop offset="1" stop-color="#BFFFEB"/></linearGradient>
<linearGradient id="pin" x1="842" y1="288" x2="842" y2="552" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FCFDFD"/><stop offset="1" stop-color="#DDF8FB"/></linearGradient>
<linearGradient id="hole" x1="842" y1="347" x2="842" y2="455" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#12B2A3"/><stop offset="1" stop-color="#06908B"/></linearGradient>
<linearGradient id="bartop" x1="0" y1="588" x2="0" y2="612" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="foldg" x1="378" y1="770" x2="543" y2="600" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C2EFF3" stop-opacity="0"/><stop offset="0.45" stop-color="#C2EFF3" stop-opacity="0.9"/><stop offset="1" stop-color="#D2F2F5"/></linearGradient>
<radialGradient id="crease" cx="545" cy="601" r="45" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#04414C" stop-opacity="0.12"/><stop offset="1" stop-color="#04414C" stop-opacity="0"/></radialGradient>
<linearGradient id="stemleft" x1="378" y1="0" x2="398" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="stemright" x1="500" y1="0" x2="543" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#A9E9EF" stop-opacity="0"/><stop offset="1" stop-color="#A9E9EF" stop-opacity="0.7"/></linearGradient>`;

// defs shared by the teal glyph: fold/highlight gradients from GRADS
const GRADS_HIGHLIGHT = GRADS.slice(GRADS.indexOf('<linearGradient id="foldg"'));

const GRADS_AO = `
<linearGradient id="armdark" x1="580" y1="380" x2="695" y2="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#78C8D8" stop-opacity="0"/><stop offset="1" stop-color="#78C8D8" stop-opacity="0.12"/></linearGradient>
<linearGradient id="aog" x1="543" y1="0" x2="696" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#04414C" stop-opacity="0.45"/><stop offset="1" stop-color="#04414C" stop-opacity="0.02"/></linearGradient>`;

const GRADS_TEAL = `
<linearGradient id="fwhiteT" x1="382" y1="360" x2="828" y2="583" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#31CBBB"/><stop offset="0.3" stop-color="#22B2AF"/><stop offset="0.6" stop-color="#12A0A6"/><stop offset="1" stop-color="#04869D"/></linearGradient>
<linearGradient id="stemgT" x1="378" y1="845" x2="543" y2="600" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0D8B95"/><stop offset="1" stop-color="#149EA5"/></linearGradient>
<linearGradient id="barT" x1="533" y1="828" x2="817" y2="668" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F4FDFD"/><stop offset="0.25" stop-color="#EDFBFB"/><stop offset="0.5" stop-color="#E2F9F9"/><stop offset="0.75" stop-color="#D8F7F5"/><stop offset="1" stop-color="#CFF4F0"/></linearGradient>
<linearGradient id="pinT" x1="842" y1="288" x2="842" y2="552" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#35C4BA"/><stop offset="1" stop-color="#07839A"/></linearGradient>`;

const FILT_SOFT = `
<filter id="fSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="fFold" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>`;

const FILT_MASTER = FILT_SOFT + `
<filter id="fAO" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="fTight" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="fWide" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="26"/></filter>
<filter id="fBarW" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="45"/></filter>
<filter id="fBarT" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="fPinT" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="fPinW" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30"/></filter>`;

const CLIP_SQ   = `<path id="sqp" d="${SQ}"/><clipPath id="sqclip"><use xlink:href="#sqp" href="#sqp"/></clipPath>`;
const CLIP_F    = `<clipPath id="fclip">${FCLIP_INNER}</clipPath><clipPath id="stemclip">${STEMCLIP_INNER}</clipPath>`;
const CLIP_BAR  = `<clipPath id="barclip">${BARCLIP_INNER}</clipPath>`;

// ---- shape assembly ----
const shapes = ({ shadows = false, teal = false } = {}) => {
  const fillF    = teal ? 'url(#fwhiteT)' : 'url(#fwhite)';
  const fillStem = teal ? 'url(#stemgT)'  : 'url(#stemg)';
  const fillBar  = teal ? 'url(#barT)'    : 'url(#bar)';
  const fillPin  = teal ? 'url(#pinT)'    : 'url(#pin)';
  const fillHole = teal ? '#FFFFFF'       : 'url(#hole)';
  return `<g transform="translate(0.5,0.5)">
${shadows ? SHADOWS_F_B + `\n<path d="${AOG}" fill="none" stroke="url(#armdark)" stroke-width="16" filter="url(#fAO)"/>` : ''}
<path d="${BAR}" fill="${fillBar}"/>
${shadows ? BARCLIP_SHADOW : ''}
<path d="${F}" fill="${fillF}"/>
<path d="${STEM}" fill="${fillStem}"/>
<path d="${FOLD}" fill="none" stroke="url(#foldg)" stroke-width="9" filter="url(#fFold)" clip-path="url(#fclip)"/>
${teal ? '' : `<path d="${BAR}" fill="url(#bartop)"/>`}
<path d="${BAR}" fill="url(#crease)"/>
<g clip-path="url(#stemclip)"><path d="${FOLD}" fill="none" stroke="#D9F6F9" stroke-opacity="0.75" stroke-width="8" filter="url(#fSoft)"/></g>
<path d="${STEM}" fill="url(#stemright)"/>
<path d="${STEM}" fill="url(#stemleft)"/>
<path d="${ARC}" fill="none" stroke="#E6FBFD" stroke-opacity="0.55" stroke-width="1.6"/>
</g>
${shadows ? PIN_SHADOWS + '\n' : ''}<path d="${PIN}" fill="${fillPin}"/>
<circle cx="842" cy="401" r="54" fill="${fillHole}"/>`;
};

const sqBg = (edge = true, stroke = '#027E93', fill = 'url(#bg)') => `<use xlink:href="#sqp" href="#sqp" fill="${fill}"/>
${edge ? `<path d="${BOT}" fill="none" stroke="${stroke}" stroke-opacity="0.55" stroke-width="2.5" clip-path="url(#sqclip)"/>` : ''}`;

const file = ({ w, h, vb = '0 0 1254 1254', defs, body }) =>
`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${vb}">
<defs>${defs}
</defs>
${body}
</svg>
`;

// all generated files go under assets/; the package root stays clean
const ASSETS = 'assets';
const write = (rel, content) => {
  if (/undefined|NaN/.test(content)) throw new Error('bad content in ' + rel);
  const target = join(ROOT, ASSETS, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(join(ASSETS, rel).padEnd(42), (content.length / 1024).toFixed(1) + ' KB');
};

// ---- container variants ----
const defsMaster = CLIP_SQ + GRADS + GRADS_AO + CLIP_BAR + CLIP_F + FILT_MASTER;
const defsFlat   = CLIP_SQ + GRADS + CLIP_F + FILT_SOFT;

write('master/icon-master.svg', file({
  w: 1254, h: 1254, defs: defsMaster,
  body: sqBg() + '\n' + shapes({ shadows: true }),
}));

write('master/icon-flat.svg', file({
  w: 1254, h: 1254, defs: defsFlat,
  body: sqBg() + '\n' + shapes(),
}));

write('app/icon-dark.svg', file({
  w: 1254, h: 1254, defs: CLIP_SQ + GRADS + GRADS_AO + CLIP_BAR + CLIP_F + FILT_MASTER,
  body: sqBg(true, '#026576', 'url(#bgDark)') + '\n' + shapes({ shadows: true }),
}));

write('app/icon-circle.svg', file({
  w: 512, h: 512, defs: GRADS + GRADS_AO + CLIP_BAR + CLIP_F + FILT_MASTER,
  body: `<circle cx="627" cy="627" r="540" fill="url(#bg)"/>` + '\n' + shapes({ shadows: true }),
}));

write('app/apple-touch-icon.svg', file({
  w: 180, h: 180, defs: GRADS + GRADS_AO + CLIP_BAR + CLIP_F + FILT_MASTER,
  body: `<rect width="1254" height="1254" fill="url(#bg)"/>` + '\n' + shapes({ shadows: true }),
}));

write('app/icon-maskable.svg', file({
  w: 512, h: 512, defs: GRADS + GRADS_AO + CLIP_BAR + CLIP_F + FILT_MASTER,
  body: `<rect width="1254" height="1254" fill="url(#bg)"/>
<g transform="translate(-106.7,-69.85) scale(1.1)">
` + shapes({ shadows: true }) + `
</g>`,
}));

// ---- glyph variants (no container) ----
const GLYPH_VB = '348 257 638 753';
write('glyph/glyph.svg', file({
  w: 512, h: 604, vb: GLYPH_VB, defs: GRADS + CLIP_F + FILT_SOFT,
  body: shapes(),
}));

write('glyph/glyph-teal.svg', file({
  w: 512, h: 604, vb: GLYPH_VB, defs: GRADS_TEAL + GRADS_HIGHLIGHT + CLIP_F + FILT_SOFT,
  body: shapes({ teal: true }),
}));

// mono: single-colour silhouette (F + stem + bar union, pin with punched hole)
const HOLE_SUB = 'M 788,401 a 54,54 0 1 0 108,0 a 54,54 0 1 0 -108,0 Z';
const monoBody = (color) => `<path d="${F} ${STEM} ${BAR}" fill="${color}"/>
<path fill-rule="evenodd" d="${PIN} ${HOLE_SUB}" fill="${color}"/>`;
write('glyph/glyph-mono-black.svg', file({ w: 512, h: 604, vb: GLYPH_VB, defs: '', body: monoBody('#000000') }));
write('glyph/glyph-mono-white.svg', file({ w: 512, h: 604, vb: GLYPH_VB, defs: '', body: monoBody('#FFFFFF') }));

// ---- favicon + standard size series ----
write('favicon.svg', file({ w: 64, h: 64, defs: defsFlat, body: sqBg() + '\n' + shapes() }));
for (const n of [16, 24, 32, 48, 64]) write(`sizes/icon-${n}.svg`, file({ w: n, h: n, defs: defsFlat, body: sqBg() + '\n' + shapes() }));
for (const n of [96, 128, 256, 512]) write(`sizes/icon-${n}.svg`, file({ w: n, h: n, defs: defsMaster, body: sqBg() + '\n' + shapes({ shadows: true }) }));

// ---- sprite ----
write('sprite.svg', `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1254 1254" style="display:none">
<defs>${CLIP_SQ + GRADS + GRADS_AO + GRADS_TEAL + CLIP_BAR + CLIP_F + FILT_MASTER}
</defs>
<symbol id="findly-icon" viewBox="0 0 1254 1254">${sqBg()}
${shapes({ shadows: true })}</symbol>
<symbol id="findly-icon-flat" viewBox="0 0 1254 1254">${sqBg()}
${shapes()}</symbol>
<symbol id="findly-glyph" viewBox="${GLYPH_VB}">${shapes()}</symbol>
<symbol id="findly-glyph-teal" viewBox="${GLYPH_VB}">${shapes({ teal: true })}</symbol>
<symbol id="findly-mono" viewBox="${GLYPH_VB}"><path d="${F} ${STEM} ${BAR}" fill="currentColor"/>
<path fill-rule="evenodd" d="${PIN} ${HOLE_SUB}" fill="currentColor"/></symbol>
</svg>
`);

console.log('done.');
