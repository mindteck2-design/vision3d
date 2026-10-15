import type { ManufacturingProduct } from '../types/index.ts';

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const MANUFACTURING_PRODUCTS: ManufacturingProduct[] = [
  {
    id: 'flanged_bearing_housing',
    name: 'Precision Flanged Bearing Housing',
    partNumber: 'BH-140-50-CNC',
    category: 'Rotary & Transmission',
    materialType: 'Aircraft Aluminum 6061-T6 / Anodized',
    description:
      'High-precision CNC machined bearing housing with four-bolt mounting flange, central bore, and seal ring seat.',
    specifications: {
      outerDiameterMm: 140,
      boreDiameterMm: 50,
      totalHeightMm: 75,
      flangeThicknessMm: 18,
      boltPattern: '4 x M10 on 115mm PCD',
      tolerance: '±0.02 mm (ISO 2768-m)',
      surfaceFinish: 'Ra 0.8 µm (Precision Turned)',
    },
    angles: {
      blueprint_sheet: {
        key: 'blueprint_sheet',
        label: 'Engineering Blueprint',
        degrees: 'ISO Standard Sheet',
        description: 'Complete multi-view technical drawing with dimension callouts and title block.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
            <rect width="600" height="600" fill="#0b1329" stroke="#1d4ed8" stroke-width="4" />
            <!-- Blueprint grid -->
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.5" />
              </pattern>
            </defs>
            <rect width="600" height="600" fill="url(#grid)" />

            <!-- Title Block -->
            <rect x="360" y="500" width="230" height="90" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
            <text x="370" y="520" fill="#38bdf8" font-family="monospace" font-size="10" font-weight="bold">DWG: BH-140-50-CNC</text>
            <text x="370" y="538" fill="#94a3b8" font-family="monospace" font-size="9">PART: FLANGED HOUSING</text>
            <text x="370" y="556" fill="#94a3b8" font-family="monospace" font-size="9">SCALE: 1:1  |  UNITS: MM</text>
            <text x="370" y="574" fill="#38bdf8" font-family="monospace" font-size="9">TOL: ±0.02  |  REV: C</text>

            <!-- Front Elevation Projection (Center Top) -->
            <g transform="translate(160, 180)">
              <!-- Flange base plate -->
              <rect x="-110" y="10" width="220" height="35" rx="3" fill="#ffffff" stroke="#38bdf8" stroke-width="2" />
              <!-- Stepped cylindrical barrel -->
              <rect x="-70" y="-70" width="140" height="80" fill="#e2e8f0" stroke="#38bdf8" stroke-width="2" />
              <!-- Top pilot ring -->
              <rect x="-45" y="-95" width="90" height="25" fill="#f8fafc" stroke="#38bdf8" stroke-width="2" />

              <!-- Center bore hidden lines / cutout -->
              <rect x="-25" y="-95" width="50" height="140" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4 2" />

              <!-- Bolt counterbores -->
              <circle cx="-85" cy="27" r="7" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
              <circle cx="85" cy="27" r="7" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />

              <!-- Centerline -->
              <line x1="0" y1="-115" x2="0" y2="60" stroke="#ef4444" stroke-width="1" stroke-dasharray="8 3 2 3" />

              <!-- Dimension: Outer Flange Ø140 -->
              <line x1="-110" y1="55" x2="110" y2="55" stroke="#38bdf8" stroke-width="1" />
              <polygon points="-110,55 -102,52 -102,58" fill="#38bdf8" />
              <polygon points="110,55 102,52 102,58" fill="#38bdf8" />
              <text x="0" y="70" fill="#38bdf8" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">Ø 140.00 mm</text>

              <!-- Dimension: Barrel Ø85 -->
              <line x1="-70" y1="-78" x2="70" y2="-78" stroke="#38bdf8" stroke-width="1" />
              <polygon points="-70,-78 -62,-81 -62,-75" fill="#38bdf8" />
              <polygon points="70,-78 62,-81 62,-75" fill="#38bdf8" />
              <text x="0" y="-83" fill="#38bdf8" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">Ø 85.00 mm</text>

              <!-- Dimension: Total Height 75mm -->
              <line x1="125" y1="-95" x2="125" y2="45" stroke="#38bdf8" stroke-width="1" />
              <polygon points="125,-95 122,-87 128,-87" fill="#38bdf8" />
              <polygon points="125,45 122,37 128,37" fill="#38bdf8" />
              <text x="135" y="-20" fill="#38bdf8" font-family="monospace" font-size="10" font-weight="bold" transform="rotate(90 135 -20)">75.00 mm</text>
            </g>

            <!-- Top Plan Projection (Bottom Left) -->
            <g transform="translate(160, 420)">
              <!-- Flange outer circle -->
              <circle cx="0" cy="0" r="100" fill="#e2e8f0" stroke="#38bdf8" stroke-width="2" />
              <!-- Stepped body ring -->
              <circle cx="0" cy="0" r="65" fill="#cbd5e1" stroke="#38bdf8" stroke-width="2" />
              <!-- Bore hole -->
              <circle cx="0" cy="0" r="35" fill="#0b1329" stroke="#38bdf8" stroke-width="2" />
              <!-- Keyway -->
              <rect x="-6" y="-39" width="12" height="10" fill="#0b1329" stroke="#38bdf8" stroke-width="1.5" />

              <!-- 4 Bolt hole pattern (PCD 115) -->
              <circle cx="0" cy="0" r="82" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3" />
              <circle cx="-82" cy="0" r="8" fill="#0b1329" stroke="#38bdf8" stroke-width="2" />
              <circle cx="82" cy="0" r="8" fill="#0b1329" stroke="#38bdf8" stroke-width="2" />
              <circle cx="0" cy="-82" r="8" fill="#0b1329" stroke="#38bdf8" stroke-width="2" />
              <circle cx="0" cy="82" r="8" fill="#0b1329" stroke="#38bdf8" stroke-width="2" />

              <text x="0" y="115" fill="#38bdf8" font-family="monospace" font-size="10" text-anchor="middle">TOP PLAN VIEW (PCD Ø 115)</text>
            </g>
          </svg>
        `),
      },
      front_view: {
        key: 'front_view',
        label: 'Front Elevation (0°)',
        degrees: '0° Front View',
        description: 'Orthographic front elevation showing flange step, body taper, and pilot rim.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 270)">
              <!-- Flange base -->
              <rect x="-180" y="40" width="360" height="55" rx="6" fill="#cbd5e1" stroke="#ffffff" stroke-width="3" />
              <!-- Flange chamfer highlight -->
              <path d="M -180 40 L -170 30 L 170 30 L 180 40 Z" fill="#f8fafc" />
              
              <!-- Main barrel body -->
              <rect x="-115" y="-100" width="230" height="135" fill="#94a3b8" stroke="#ffffff" stroke-width="3" />
              <!-- Turned shoulder grooves -->
              <line x1="-115" y1="-40" x2="115" y2="-40" stroke="#475569" stroke-width="4" />
              <line x1="-115" y1="10" x2="115" y2="10" stroke="#475569" stroke-width="4" />

              <!-- Top pilot ring / seal neck -->
              <rect x="-70" y="-160" width="140" height="60" rx="4" fill="#e2e8f0" stroke="#ffffff" stroke-width="3" />

              <!-- Internal bore hidden cutout -->
              <rect x="-40" y="-160" width="80" height="255" fill="#0f172a" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4" />

              <!-- Mounting holes -->
              <circle cx="-140" cy="67" r="12" fill="#0f172a" stroke="#ffffff" stroke-width="2" />
              <circle cx="140" cy="67" r="12" fill="#0f172a" stroke="#ffffff" stroke-width="2" />

              <!-- Dimension arrows -->
              <line x1="-180" y1="115" x2="180" y2="115" stroke="#38bdf8" stroke-width="2" />
              <polygon points="-180,115 -168,110 -168,120" fill="#38bdf8" />
              <polygon points="180,115 168,110 168,120" fill="#38bdf8" />
              <text x="0" y="138" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">Ø 140.00 mm FLANGE</text>

              <line x1="205" y1="-160" x2="205" y2="95" stroke="#38bdf8" stroke-width="2" />
              <polygon points="205,-160 200,-148 210,-148" fill="#38bdf8" />
              <polygon points="205,95 200,83 210,83" fill="#38bdf8" />
              <text x="220" y="-30" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold" transform="rotate(90 220 -30)">H = 75.00 mm</text>
            </g>
          </svg>
        `),
      },
      top_view: {
        key: 'top_view',
        label: 'Top Plan (90°)',
        degrees: '90° Top View',
        description: 'Plan view showing circular mounting flange, 4-bolt pattern, central bore, and keyway.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 256)">
              <!-- Outer Flange circle -->
              <circle cx="0" cy="0" r="200" fill="#cbd5e1" stroke="#ffffff" stroke-width="4" />
              <!-- Flange bevel highlight -->
              <circle cx="0" cy="0" r="185" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2" />
              
              <!-- Bolt Pitch Circle (PCD 115) -->
              <circle cx="0" cy="0" r="145" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="8 6" />

              <!-- 4 Bolt holes -->
              <circle cx="-145" cy="0" r="18" fill="#0f172a" stroke="#ffffff" stroke-width="3" />
              <circle cx="145" cy="0" r="18" fill="#0f172a" stroke="#ffffff" stroke-width="3" />
              <circle cx="0" cy="-145" r="18" fill="#0f172a" stroke="#ffffff" stroke-width="3" />
              <circle cx="0" cy="145" r="18" fill="#0f172a" stroke="#ffffff" stroke-width="3" />

              <!-- Stepped body barrel -->
              <circle cx="0" cy="0" r="105" fill="#94a3b8" stroke="#ffffff" stroke-width="3" />
              <!-- Pilot neck -->
              <circle cx="0" cy="0" r="75" fill="#f8fafc" stroke="#475569" stroke-width="3" />

              <!-- Central bore (Ø50) -->
              <circle cx="0" cy="0" r="45" fill="#0f172a" stroke="#ffffff" stroke-width="4" />
              <!-- Keyway slot -->
              <rect x="-8" y="-55" width="16" height="15" fill="#0f172a" stroke="#ffffff" stroke-width="2" />

              <!-- Dimension Callout -->
              <line x1="-45" y1="0" x2="45" y2="0" stroke="#38bdf8" stroke-width="2" />
              <polygon points="-45,0 -35,-4 -35,4" fill="#38bdf8" />
              <polygon points="45,0 35,-4 35,4" fill="#38bdf8" />
              <text x="0" y="-12" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">Ø 50.00 mm BORE</text>
            </g>
          </svg>
        `),
      },
      side_view: {
        key: 'side_view',
        label: 'Section Cut (90° Profile)',
        degrees: '90° Side Section',
        description: 'Cross-sectional cut displaying internal bearing cup cavity, chamfers, and wall thickness.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 260)">
              <!-- Section profile left half -->
              <path d="M -180 50 L -180 15 L -105 15 L -105 -110 L -65 -110 L -65 -150 L -35 -150 L -35 50 Z" 
                    fill="#94a3b8" stroke="#ffffff" stroke-width="3" />
              <!-- Hatching simulation left -->
              <line x1="-160" y1="45" x2="-140" y2="15" stroke="#475569" stroke-width="2" />
              <line x1="-140" y1="45" x2="-120" y2="15" stroke="#475569" stroke-width="2" />
              <line x1="-95" y1="0" x2="-75" y2="-30" stroke="#475569" stroke-width="2" />
              <line x1="-95" y1="-40" x2="-75" y2="-70" stroke="#475569" stroke-width="2" />

              <!-- Section profile right half -->
              <path d="M 180 50 L 180 15 L 105 15 L 105 -110 L 65 -110 L 65 -150 L 35 -150 L 35 50 Z" 
                    fill="#94a3b8" stroke="#ffffff" stroke-width="3" />
              <!-- Hatching simulation right -->
              <line x1="160" y1="45" x2="140" y2="15" stroke="#475569" stroke-width="2" />
              <line x1="140" y1="45" x2="120" y2="15" stroke="#475569" stroke-width="2" />
              <line x1="95" y1="0" x2="75" y2="-30" stroke="#475569" stroke-width="2" />
              <line x1="95" y1="-40" x2="75" y2="-70" stroke="#475569" stroke-width="2" />

              <!-- Center cavity (Hollow bore) -->
              <rect x="-35" y="-150" width="70" height="200" fill="#0f172a" />

              <!-- Centerline -->
              <line x1="0" y1="-180" x2="0" y2="80" stroke="#ef4444" stroke-width="2" stroke-dasharray="10 4 3 4" />

              <text x="0" y="105" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">CROSS-SECTION A-A (INTERNAL CAVITY)</text>
            </g>
          </svg>
        `),
      },
      iso_cad: {
        key: 'iso_cad',
        label: 'Isometric CAD (45°)',
        degrees: '45° Isometric View',
        description: 'Realistic 3D isometric CAD snapshot of machined bearing housing.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#090d16" />
            <defs>
              <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="30%" stop-color="#cbd5e1" />
                <stop offset="70%" stop-color="#64748b" />
                <stop offset="100%" stop-color="#334155" />
              </linearGradient>
            </defs>
            <g transform="translate(256, 230)">
              <!-- Base Flange ellipse -->
              <path d="M -180 80 C -180 140 180 140 180 80 L 180 40 C 180 -20 -180 -20 -180 40 Z" fill="url(#metalGrad)" stroke="#94a3b8" stroke-width="3" />
              
              <!-- Flange top face -->
              <ellipse cx="0" cy="40" rx="180" ry="60" fill="#e2e8f0" stroke="#ffffff" stroke-width="3" />
              
              <!-- Bolt holes on flange -->
              <ellipse cx="-130" cy="40" rx="14" ry="7" fill="#0f172a" stroke="#64748b" stroke-width="2" />
              <ellipse cx="130" cy="40" rx="14" ry="7" fill="#0f172a" stroke="#64748b" stroke-width="2" />
              <ellipse cx="0" cy="85" rx="14" ry="7" fill="#0f172a" stroke="#64748b" stroke-width="2" />
              <ellipse cx="0" cy="-5" rx="14" ry="7" fill="#0f172a" stroke="#64748b" stroke-width="2" />

              <!-- Main Cylinder barrel -->
              <path d="M -105 40 L -105 -60 C -105 -100 105 -100 105 -60 L 105 40 Z" fill="url(#metalGrad)" stroke="#cbd5e1" stroke-width="3" />
              
              <!-- Pilot neck -->
              <path d="M -70 -60 L -70 -120 C -70 -150 70 -150 70 -120 L 70 -60 Z" fill="#e2e8f0" stroke="#ffffff" stroke-width="3" />
              
              <!-- Top rim face -->
              <ellipse cx="0" cy="-120" rx="70" ry="26" fill="#f8fafc" stroke="#ffffff" stroke-width="3" />
              <!-- Inner bore hole -->
              <ellipse cx="0" cy="-120" rx="42" ry="16" fill="#090d16" stroke="#38bdf8" stroke-width="3" />

              <text x="0" y="160" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">3D CNC MACHINED CAD SNAPSHOT</text>
            </g>
          </svg>
        `),
      },
    },
  },
  {
    id: 'helical_spur_gear',
    name: 'Precision Helical Spur Gear',
    partNumber: 'SG-120-24T-ISO',
    category: 'Gears & Powertrain',
    materialType: 'Alloy Steel 4140 / Case-Hardened (58 HRC)',
    description: 'Precision gear hub with 24 involute teeth, lightened web pocket, and splined bore.',
    specifications: {
      outerDiameterMm: 120,
      boreDiameterMm: 35,
      totalHeightMm: 45,
      flangeThicknessMm: 22,
      boltPattern: '6-Spline DIN 5480',
      tolerance: 'ISO Grade 6 (DIN 3962)',
      surfaceFinish: 'Ground Tooth Flanks (Ra 0.4 µm)',
    },
    angles: {
      blueprint_sheet: {
        key: 'blueprint_sheet',
        label: 'Gear Blueprint',
        degrees: 'Standard Sheet',
        description: 'Gear data table, module 5, 24 teeth, pressure angle 20°.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
            <rect width="600" height="600" fill="#0b1329" stroke="#1d4ed8" stroke-width="4" />
            <!-- Gear profile -->
            <g transform="translate(300, 280)">
              <circle cx="0" cy="0" r="180" fill="#1e293b" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4" />
              <!-- Teeth -->
              ${Array.from({ length: 24 })
                .map((_, i) => {
                  const rot = i * 15;
                  return `<rect x="-12" y="-195" width="24" height="30" rx="3" fill="#e2e8f0" stroke="#38bdf8" stroke-width="2" transform="rotate(${rot})" />`;
                })
                .join('')}
              <circle cx="0" cy="0" r="170" fill="#cbd5e1" stroke="#38bdf8" stroke-width="3" />
              <!-- Web pocket -->
              <circle cx="0" cy="0" r="120" fill="#475569" stroke="#38bdf8" stroke-width="2" />
              <circle cx="0" cy="0" r="85" fill="#e2e8f0" stroke="#38bdf8" stroke-width="2" />
              <!-- Bore -->
              <circle cx="0" cy="0" r="45" fill="#0b1329" stroke="#38bdf8" stroke-width="3" />
              <rect x="-8" y="-55" width="16" height="15" fill="#0b1329" stroke="#38bdf8" stroke-width="2" />
            </g>
            <text x="300" y="540" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">
              HELICAL GEAR: M=5, Z=24, PA=20°, PCD Ø 120 mm
            </text>
          </svg>
        `),
      },
      front_view: {
        key: 'front_view',
        label: 'Front View (0°)',
        degrees: '0° Front View',
        description: 'Front profile showing gear tooth thickness, hub offset, and web transition.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 256)">
              <rect x="-180" y="-50" width="360" height="100" fill="#cbd5e1" stroke="#ffffff" stroke-width="3" />
              <rect x="-90" y="-80" width="180" height="160" fill="#94a3b8" stroke="#ffffff" stroke-width="3" />
              <rect x="-40" y="-80" width="80" height="160" fill="#0f172a" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4" />
              <text x="0" y="130" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">FACE WIDTH = 45 mm | HUB DIA = 70 mm</text>
            </g>
          </svg>
        `),
      },
      top_view: {
        key: 'top_view',
        label: 'Top View (90°)',
        degrees: '90° Top Plan',
        description: 'Circular pitch contour with 24 gear teeth and spline bore.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 256)">
              ${Array.from({ length: 24 })
                .map((_, i) => {
                  const rot = i * 15;
                  return `<rect x="-10" y="-175" width="20" height="28" rx="2" fill="#ffffff" transform="rotate(${rot})" />`;
                })
                .join('')}
              <circle cx="0" cy="0" r="155" fill="#cbd5e1" stroke="#ffffff" stroke-width="3" />
              <circle cx="0" cy="0" r="110" fill="#64748b" />
              <circle cx="0" cy="0" r="75" fill="#e2e8f0" />
              <circle cx="0" cy="0" r="40" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
            </g>
          </svg>
        `),
      },
      side_view: {
        key: 'side_view',
        label: 'Section Cut',
        degrees: '90° Section Cut',
        description: 'Cutaway illustrating lightening pockets and gear rim.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 256)">
              <rect x="-170" y="-50" width="70" height="100" fill="#94a3b8" stroke="#fff" stroke-width="2" />
              <rect x="100" y="-50" width="70" height="100" fill="#94a3b8" stroke="#fff" stroke-width="2" />
              <rect x="-60" y="-80" width="30" height="160" fill="#cbd5e1" stroke="#fff" stroke-width="2" />
              <rect x="30" y="-80" width="30" height="160" fill="#cbd5e1" stroke="#fff" stroke-width="2" />
              <rect x="-30" y="-80" width="60" height="160" fill="#0f172a" />
            </g>
          </svg>
        `),
      },
      iso_cad: {
        key: 'iso_cad',
        label: '3D Isometric',
        degrees: '45° CAD',
        description: 'Isometric 3D model of gear hub.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#090d16" />
            <g transform="translate(256, 256)">
              <ellipse cx="0" cy="30" rx="170" ry="60" fill="#64748b" />
              <ellipse cx="0" cy="-20" rx="170" ry="60" fill="#e2e8f0" stroke="#fff" stroke-width="3" />
              <ellipse cx="0" cy="-20" rx="90" ry="32" fill="#94a3b8" />
              <ellipse cx="0" cy="-20" rx="45" ry="16" fill="#090d16" stroke="#38bdf8" stroke-width="2" />
            </g>
          </svg>
        `),
      },
    },
  },
  {
    id: 'aero_turbine_impeller',
    name: 'Aero Turbine Impeller Blade Disc',
    partNumber: 'TR-160-12B-TI',
    category: 'Aerospace & Turbomachinery',
    materialType: 'Titanium Ti-6Al-4V (Grade 5)',
    description: 'Centrifugal compressor impeller with 12 curved aerodynamic blades and balanced hub.',
    specifications: {
      outerDiameterMm: 160,
      boreDiameterMm: 40,
      totalHeightMm: 60,
      flangeThicknessMm: 12,
      boltPattern: 'Central Lock Nut Spline',
      tolerance: '±0.01 mm (Aerospace Spec)',
      surfaceFinish: '5-Axis CNC Milled (Ra 0.4 µm)',
    },
    angles: {
      blueprint_sheet: {
        key: 'blueprint_sheet',
        label: 'Turbine Blueprint',
        degrees: 'Aerospace Sheet',
        description: 'Blade sweep angles, 12-blade airfoil profile, and hub taper.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
            <rect width="600" height="600" fill="#0b1329" stroke="#1d4ed8" stroke-width="4" />
            <g transform="translate(300, 280)">
              <circle cx="0" cy="0" r="190" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />
              ${Array.from({ length: 12 })
                .map((_, i) => {
                  const rot = i * 30;
                  return `<path d="M 0 -45 Q 60 -110 90 -185 Q 70 -190 20 -120 Z" fill="#ffffff" stroke="#38bdf8" stroke-width="2" transform="rotate(${rot})" />`;
                })
                .join('')}
              <circle cx="0" cy="0" r="50" fill="#cbd5e1" stroke="#38bdf8" stroke-width="3" />
              <circle cx="0" cy="0" r="25" fill="#0b1329" stroke="#38bdf8" stroke-width="3" />
            </g>
            <text x="300" y="540" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">
              TITANIUM IMPELLER: 12 CURVED BLADES, Ø 160 mm
            </text>
          </svg>
        `),
      },
      front_view: {
        key: 'front_view',
        label: 'Front View (0°)',
        degrees: '0° Front View',
        description: 'Curved inlet and radial discharge profiles.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 260)">
              <path d="M -190 40 Q -90 40 -40 -110 L 40 -110 Q 90 40 190 40 Z" fill="#cbd5e1" stroke="#ffffff" stroke-width="3" />
              <rect x="-25" y="-110" width="50" height="150" fill="#0f172a" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4" />
            </g>
          </svg>
        `),
      },
      top_view: {
        key: 'top_view',
        label: 'Top View (90°)',
        degrees: '90° Top View',
        description: '12 aerodynamic blade array.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 256)">
              <circle cx="0" cy="0" r="180" fill="#1e293b" />
              ${Array.from({ length: 12 })
                .map((_, i) => {
                  const rot = i * 30;
                  return `<path d="M 0 -40 Q 50 -100 80 -170 Q 60 -175 15 -110 Z" fill="#ffffff" transform="rotate(${rot})" />`;
                })
                .join('')}
              <circle cx="0" cy="0" r="45" fill="#e2e8f0" />
              <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
            </g>
          </svg>
        `),
      },
      side_view: {
        key: 'side_view',
        label: 'Side Section',
        degrees: '90° Cut',
        description: 'Hub taper and discharge radius.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#0f172a" />
            <g transform="translate(256, 260)">
              <path d="M -180 30 Q -80 30 -35 -100 L -20 -100 L -20 30 Z" fill="#94a3b8" stroke="#fff" stroke-width="2" />
              <path d="M 180 30 Q 80 30 35 -100 L 20 -100 L 20 30 Z" fill="#94a3b8" stroke="#fff" stroke-width="2" />
            </g>
          </svg>
        `),
      },
      iso_cad: {
        key: 'iso_cad',
        label: '3D Isometric',
        degrees: '45° CAD',
        description: 'Titanium impeller 3D view.',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
            <rect width="512" height="512" fill="#090d16" />
            <g transform="translate(256, 260)">
              <ellipse cx="0" cy="30" rx="170" ry="55" fill="#64748b" />
              <ellipse cx="0" cy="-60" rx="50" ry="18" fill="#e2e8f0" stroke="#fff" stroke-width="2" />
            </g>
          </svg>
        `),
      },
    },
  },
];
