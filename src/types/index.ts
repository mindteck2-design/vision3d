/**
 * Type definitions for Manufacturing Product 2D to 3D Studio
 */

export type ProductAngleKey =
  | 'blueprint_sheet'
  | 'front_view'
  | 'top_view'
  | 'side_view'
  | 'iso_cad';

export type MeshMode =
  | 'solid_cad'
  | 'hollow_bore'
  | 'stepped_relief'
  | 'point_cloud'
  | 'wireframe_cad';

export type MaterialPreset =
  | 'cnc_aluminum'
  | 'machined_steel'
  | 'cast_iron'
  | 'brass_bronze'
  | 'cad_hologram'
  | 'blueprint_texture';

export interface ProductAngleInfo {
  key: ProductAngleKey;
  label: string;
  degrees: string;
  description: string;
  dataUrl: string;
}

export interface ManufacturingProduct {
  id: string;
  name: string;
  partNumber: string;
  category: string;
  materialType: string;
  description: string;
  specifications: {
    outerDiameterMm: number;
    boreDiameterMm: number;
    totalHeightMm: number;
    flangeThicknessMm: number;
    boltPattern: string;
    tolerance: string;
    surfaceFinish: string;
  };
  angles: Record<ProductAngleKey, ProductAngleInfo>;
}

export interface ProcessOptions {
  depthScale: number; // 0.2 to 3.5x
  meshMode: MeshMode;
  materialPreset: MaterialPreset;
  resolution: number; // 64, 128, 256
  baseThickness: number; // mm
  boreDepth: number; // 0 to 1.0 (relative bore depth)
  showDimensions: boolean;
  showSectionCut: boolean;
  sectionOffset: number; // -50 to 50 mm
  smoothIterations: number;
  invertDepth: boolean;
  edgeEmphasis: number;
}

export interface CVStats {
  width: number;
  height: number;
  vertexCount: number;
  faceCount: number;
  minDepth: number;
  maxDepth: number;
  avgDepth: number;
  processingTimeMs: number;
  gradientMean: number;
  cvPipelineSteps: string[];
  dimensionsMm: {
    x: number;
    y: number;
    z: number;
  };
}

export interface CVResult {
  originalUrl: string;
  grayscaleUrl: string;
  sobelEdgeUrl: string;
  saliencyUrl: string;
  depthMapUrl: string;
  normalMapUrl: string;
  stats: CVStats;
  heightfield: number[][]; // [y][x] normalized 0..1
}
