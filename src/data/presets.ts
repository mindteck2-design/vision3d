import { PresetItem } from '../types/index.ts';

// Helper to convert SVG to data URL
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const PRESETS: PresetItem[] = [
  {
    id: 'roman_coin',
    name: 'Roman Imperial Medallion',
    category: 'Relief & Coins',
    description: 'Gold aureus with laurel wreath, imperial bust silhouette, and beaded rim border.',
    defaultOptions: {
      depthEstimationMethod: 'bilateral_relief',
      depthScale: 1.4,
      materialPreset: 'gold',
      meshMode: 'solid_base',
      smoothIterations: 1,
      baseThickness: 3.5,
    },
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <defs>
          <radialGradient id="coinGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fff" />
            <stop offset="55%" stop-color="#ddd" />
            <stop offset="85%" stop-color="#999" />
            <stop offset="100%" stop-color="#333" />
          </radialGradient>
          <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
            <stop offset="88%" stop-color="#333" />
            <stop offset="92%" stop-color="#fff" />
            <stop offset="96%" stop-color="#666" />
            <stop offset="100%" stop-color="#111" />
          </radialGradient>
        </defs>
        <!-- Background outer coin -->
        <circle cx="256" cy="256" r="250" fill="url(#rimGrad)" />
        <circle cx="256" cy="256" r="225" fill="#555" />
        <circle cx="256" cy="256" r="218" fill="url(#coinGrad)" />

        <!-- Beaded rim dots -->
        <g fill="#eee" stroke="#222" stroke-width="1">
          ${Array.from({ length: 48 })
            .map((_, i) => {
              const angle = (i * 360) / 48;
              const rad = (angle * Math.PI) / 180;
              const cx = 256 + Math.cos(rad) * 220;
              const cy = 256 + Math.sin(rad) * 220;
              return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" />`;
            })
            .join('')}
        </g>

        <!-- Latin text path simulation -->
        <g font-family="serif" font-size="22" font-weight="bold" fill="#fff" text-anchor="middle">
          <text x="256" y="70" letter-spacing="4">CAESAR • AUGUSTUS • DIVI • F</text>
          <text x="256" y="465" letter-spacing="4">PONTIFEX • MAXIMUS</text>
        </g>

        <!-- Classical bust relief profile -->
        <path d="M 230 140 
                 C 250 135 285 145 295 170 
                 C 305 195 285 210 280 220 
                 C 290 225 305 235 300 250
                 C 295 260 280 265 285 280
                 C 290 295 275 305 270 315
                 C 260 330 250 355 275 380
                 C 250 380 200 370 190 350
                 C 180 330 185 305 180 290
                 C 170 270 170 240 185 220
                 C 175 190 190 150 230 140 Z" 
              fill="#ffffff" stroke="#333" stroke-width="4" />

        <!-- Laurel wreath -->
        <g fill="#ddd" stroke="#333" stroke-width="2">
          <ellipse cx="235" cy="145" rx="14" ry="7" transform="rotate(-30 235 145)" />
          <ellipse cx="255" cy="148" rx="15" ry="8" transform="rotate(-15 255 148)" />
          <ellipse cx="275" cy="158" rx="14" ry="7" transform="rotate(10 275 158)" />
          <ellipse cx="220" cy="160" rx="13" ry="6" transform="rotate(-40 220 160)" />
          <ellipse cx="240" cy="165" rx="14" ry="7" transform="rotate(-20 240 165)" />
          <ellipse cx="265" cy="175" rx="15" ry="7" transform="rotate(5 265 175)" />
        </g>

        <!-- Bust drapery folds -->
        <path d="M 190 350 Q 230 360 275 380" stroke="#444" stroke-width="6" fill="none" />
        <path d="M 200 325 Q 240 340 270 345" stroke="#555" stroke-width="5" fill="none" />
        <path d="M 215 300 Q 250 315 265 315" stroke="#666" stroke-width="4" fill="none" />
      </svg>
    `),
  },
  {
    id: 'mountain_terrain',
    name: 'Topographic Volcanic Island',
    category: 'Terrain & Geology',
    description: 'Elevated alpine volcanic peak with concentric contour ridges and steep caldera crater.',
    defaultOptions: {
      depthEstimationMethod: 'hybrid_cv',
      depthScale: 2.2,
      materialPreset: 'bronze',
      meshMode: 'solid_base',
      smoothIterations: 2,
      baseThickness: 2.0,
    },
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <defs>
          <radialGradient id="peakGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fff" />
            <stop offset="25%" stop-color="#e0e0e0" />
            <stop offset="50%" stop-color="#9e9e9e" />
            <stop offset="75%" stop-color="#424242" />
            <stop offset="100%" stop-color="#050505" />
          </radialGradient>
        </defs>
        <rect width="512" height="512" fill="#000" />
        <!-- Island contour base layers -->
        <path d="M 90 260 C 90 160 170 90 260 85 C 360 80 430 160 425 260 C 420 370 350 430 250 435 C 150 440 90 360 90 260 Z" fill="#222" />
        <path d="M 120 260 C 120 180 180 120 260 115 C 340 110 395 180 390 260 C 385 340 330 395 250 400 C 170 405 120 340 120 260 Z" fill="#444" />
        <path d="M 160 258 C 160 195 200 150 260 148 C 320 145 360 195 355 258 C 350 320 305 365 250 368 C 195 370 160 320 160 258 Z" fill="#666" />
        <path d="M 190 256 C 190 210 220 180 260 178 C 300 175 330 210 325 256 C 320 305 290 335 250 338 C 210 340 190 305 190 256 Z" fill="#999" />
        <path d="M 220 255 C 220 230 235 210 260 208 C 285 205 300 230 295 255 C 290 280 275 300 250 302 C 225 305 220 280 220 255 Z" fill="#ccc" />
        <!-- Peak ridges -->
        <circle cx="256" cy="256" r="32" fill="#fff" />
        <!-- Caldera crater depression (darker center) -->
        <circle cx="256" cy="256" r="14" fill="#555" />
        <circle cx="256" cy="256" r="6" fill="#111" />
        <!-- Ridge spurs -->
        <path d="M 256 224 L 270 110 L 250 112 Z" fill="#bbb" />
        <path d="M 288 256 L 390 270 L 388 250 Z" fill="#bbb" />
        <path d="M 256 288 L 245 400 L 265 398 Z" fill="#bbb" />
        <path d="M 224 256 L 120 240 L 122 260 Z" fill="#bbb" />
      </svg>
    `),
  },
  {
    id: 'cyber_emblem',
    name: 'Cybernetic Tech Crest',
    category: 'Mechanical & Logo',
    description: 'Precision mechanical cog with faceted hexagonal core and cybernetic circuit tracks.',
    defaultOptions: {
      depthEstimationMethod: 'sobel_saliency',
      depthScale: 1.8,
      materialPreset: 'bronze',
      meshMode: 'solid_base',
      smoothIterations: 0,
      baseThickness: 4.0,
    },
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <rect width="512" height="512" fill="#111" />
        <!-- Outer Gear teeth ring -->
        <g fill="#888">
          ${Array.from({ length: 12 })
            .map((_, i) => {
              const rot = i * 30;
              return `<rect x="236" y="30" width="40" height="60" rx="6" transform="rotate(${rot} 256 256)" />`;
            })
            .join('')}
        </g>
        <circle cx="256" cy="256" r="195" fill="#aaa" stroke="#222" stroke-width="6" />
        <circle cx="256" cy="256" r="160" fill="#444" stroke="#eee" stroke-width="4" />
        <circle cx="256" cy="256" r="140" fill="#777" />

        <!-- Hexagonal core -->
        <polygon points="256,150 348,203 348,309 256,362 164,309 164,203" fill="#ffffff" stroke="#222" stroke-width="8" />
        <polygon points="256,175 326,215 326,297 256,337 186,297 186,215" fill="#444" />

        <!-- Center power node -->
        <circle cx="256" cy="256" r="45" fill="#fff" />
        <circle cx="256" cy="256" r="25" fill="#222" />
        <circle cx="256" cy="256" r="12" fill="#fff" />

        <!-- Circuit channels -->
        <line x1="256" y1="96" x2="256" y2="150" stroke="#fff" stroke-width="6" />
        <line x1="256" y1="362" x2="256" y2="416" stroke="#fff" stroke-width="6" />
        <line x1="118" y1="256" x2="164" y2="256" stroke="#fff" stroke-width="6" />
        <line x1="348" y1="256" x2="394" y2="256" stroke="#fff" stroke-width="6" />
      </svg>
    `),
  },
  {
    id: 'renaissance_bust',
    name: 'Renaissance Carrara Sculpture',
    category: 'Art & Sculpture',
    description: 'Neoclassical sculptural bust with flowing hair, facial contours, and draped toga folds.',
    defaultOptions: {
      depthEstimationMethod: 'hybrid_cv',
      depthScale: 1.6,
      materialPreset: 'marble',
      meshMode: 'relief',
      smoothIterations: 2,
    },
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <rect width="512" height="512" fill="#050505" />
        <!-- Vignette plate -->
        <ellipse cx="256" cy="256" rx="210" ry="240" fill="#222" stroke="#555" stroke-width="4" />
        <ellipse cx="256" cy="256" rx="195" ry="225" fill="#333" />
        
        <!-- Sculpted bust shape -->
        <!-- Shoulder & Torso -->
        <path d="M 110 440 C 130 380 180 340 230 330 C 270 330 330 370 380 440 Z" fill="#999" />
        <path d="M 130 440 C 150 400 200 370 240 360 C 270 360 320 390 360 440 Z" fill="#bbb" />
        <path d="M 180 430 C 210 390 260 390 300 430 Z" fill="#eee" />

        <!-- Neck -->
        <rect x="235" y="270" width="45" height="70" rx="15" fill="#bbb" />

        <!-- Head & Face Profile / 3/4 turn -->
        <ellipse cx="256" cy="210" rx="70" ry="85" fill="#ddd" />
        <!-- Forehead & Nose bridge highlight -->
        <path d="M 250 170 Q 258 210 260 225 L 245 235 L 255 242" stroke="#fff" stroke-width="12" stroke-linecap="round" fill="none" />
        <!-- Cheekbones & Brow -->
        <ellipse cx="225" cy="210" rx="18" ry="12" fill="#fff" />
        <ellipse cx="285" cy="210" rx="18" ry="12" fill="#fff" />
        <ellipse cx="256" cy="265" rx="20" ry="10" fill="#fff" /> <!-- Chin -->

        <!-- Classical curls hair volume -->
        <circle cx="210" cy="155" r="28" fill="#fff" />
        <circle cx="245" cy="140" r="32" fill="#fff" />
        <circle cx="280" cy="145" r="30" fill="#fff" />
        <circle cx="310" cy="170" r="26" fill="#fff" />
        <circle cx="200" cy="190" r="24" fill="#eee" />
        <circle cx="315" cy="205" r="22" fill="#eee" />
      </svg>
    `),
  },
  {
    id: 'fern_fossil',
    name: 'Prehistoric Botanical Fossil',
    category: 'Nature & Organic',
    description: 'Petrified fern frond with ribbed rachis and delicate symmetrical pinnule leaflets.',
    defaultOptions: {
      depthEstimationMethod: 'distance_transform',
      depthScale: 1.2,
      materialPreset: 'clay',
      meshMode: 'solid_base',
      smoothIterations: 1,
      baseThickness: 3.0,
    },
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <rect width="512" height="512" fill="#151515" />
        <circle cx="256" cy="256" r="230" fill="#2a2a2a" />
        <!-- Main Stem / Rachis -->
        <path d="M 256 460 Q 256 280 256 60" stroke="#ffffff" stroke-width="14" stroke-linecap="round" fill="none" />
        
        <!-- Symmetrical fern leaflets -->
        <g stroke="#ffffff" stroke-width="10" stroke-linecap="round">
          ${[100, 140, 180, 220, 260, 300, 340, 380, 410]
            .map((y, idx) => {
              const len = Math.sin((idx + 1) * 0.3) * 110 + 40;
              return `
                <line x1="256" y1="${y}" x2="${256 - len}" y2="${y - 30}" />
                <line x1="256" y1="${y}" x2="${256 + len}" y2="${y - 30}" />
                <ellipse cx="${256 - len}" cy="${y - 30}" rx="18" ry="10" fill="#fff" stroke="none" />
                <ellipse cx="${256 + len}" cy="${y - 30}" rx="18" ry="10" fill="#fff" stroke="none" />
              `;
            })
            .join('')}
        </g>
        <!-- Top terminal frond bud -->
        <circle cx="256" cy="55" r="16" fill="#fff" />
      </svg>
    `),
  },
  {
    id: 'gothic_rosette',
    name: 'Gothic Rose Window Relief',
    category: 'Architecture',
    description: 'Cathedral rosette stonework with twelvefold radial symmetry and trefoil tracery arches.',
    defaultOptions: {
      depthEstimationMethod: 'sobel_saliency',
      depthScale: 2.0,
      materialPreset: 'jade',
      meshMode: 'solid_base',
      smoothIterations: 1,
      baseThickness: 4.5,
    },
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
        <rect width="512" height="512" fill="#000" />
        <!-- Rosette frame rings -->
        <circle cx="256" cy="256" r="235" fill="#222" stroke="#fff" stroke-width="10" />
        <circle cx="256" cy="256" r="210" fill="#444" stroke="#fff" stroke-width="6" />
        <circle cx="256" cy="256" r="170" fill="#666" stroke="#fff" stroke-width="8" />
        
        <!-- 12 Radial Tracery Spokes -->
        <g stroke="#ffffff" stroke-width="8">
          ${Array.from({ length: 12 })
            .map((_, i) => {
              const rot = i * 30;
              return `<line x1="256" y1="256" x2="256" y2="46" transform="rotate(${rot} 256 256)" />`;
            })
            .join('')}
        </g>

        <!-- 12 Petal Trefoils -->
        <g fill="#ffffff" stroke="#222" stroke-width="4">
          ${Array.from({ length: 12 })
            .map((_, i) => {
              const rot = i * 30;
              return `
                <g transform="rotate(${rot} 256 256)">
                  <circle cx="256" cy="115" r="24" />
                  <circle cx="240" cy="135" r="18" />
                  <circle cx="272" cy="135" r="18" />
                </g>
              `;
            })
            .join('')}
        </g>

        <!-- Center Oculum -->
        <circle cx="256" cy="256" r="60" fill="#333" stroke="#fff" stroke-width="8" />
        <circle cx="256" cy="256" r="40" fill="#fff" />
        <circle cx="256" cy="256" r="18" fill="#111" />
      </svg>
    `),
  },
];
