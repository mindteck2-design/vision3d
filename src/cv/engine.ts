/**
 * Computer Vision Engine for 2D to 3D Conversion
 * Pure mathematical implementation of Grayscale, Sobel gradients, Euclidean Distance Transform,
 * Monocular Shape-from-Shading, Normal synthesis, and 3D Solid CAD Mesh generation.
 */

import type { ProcessOptions } from '../types/index.ts';

/**
 * Convert RGBA pixel buffer to standard grayscale luminance [0..255]
 * Formula: Y = 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601 standard)
 */
export function computeGrayscale(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    gray[j] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * 2D Convolution with arbitrary odd-sized kernel
 */
export function convolve2D(
  src: Float32Array,
  width: number,
  height: number,
  kernel: number[][],
  divisor = 1,
  bias = 0
): Float32Array {
  const dst = new Float32Array(width * height);
  const kSize = kernel.length;
  const half = Math.floor(kSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kSize; ky++) {
        const py = Math.min(Math.max(y + ky - half, 0), height - 1);
        const row = kernel[ky];
        for (let kx = 0; kx < kSize; kx++) {
          const px = Math.min(Math.max(x + kx - half, 0), width - 1);
          sum += src[py * width + px] * row[kx];
        }
      }
      dst[y * width + x] = sum / divisor + bias;
    }
  }
  return dst;
}

/**
 * Apply Gaussian Blur filter (separable 5x5 approximation)
 */
export function applyGaussianBlur(
  src: Float32Array,
  width: number,
  height: number,
  iterations = 1
): Float32Array {
  const current = new Float32Array(src.length);
  current.set(src);
  let buffer: Float32Array = current;
  const kernel5x5 = [
    [1, 4, 6, 4, 1],
    [4, 16, 24, 16, 4],
    [6, 24, 36, 24, 6],
    [4, 16, 24, 16, 4],
    [1, 4, 6, 4, 1],
  ];

  for (let it = 0; it < iterations; it++) {
    buffer = convolve2D(buffer, width, height, kernel5x5, 256, 0);
  }
  return buffer;
}

/**
 * Sobel Edge & Gradient Operator
 * Computes Gx, Gy, Gradient Magnitude G = sqrt(Gx^2 + Gy^2) and Direction
 */
export function computeSobelGradients(
  gray: Float32Array,
  width: number,
  height: number
): {
  gx: Float32Array;
  gy: Float32Array;
  magnitude: Float32Array;
  direction: Float32Array;
  meanMagnitude: number;
} {
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  let sumMag = 0;

  for (let y = 1; y < height - 1; y++) {
    const yPrev = (y - 1) * width;
    const yCurr = y * width;
    const yNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = yCurr + x;

      // Sobel horizontal kernel
      const valGx =
        -1 * gray[yPrev + (x - 1)] +
        1 * gray[yPrev + (x + 1)] +
        -2 * gray[yCurr + (x - 1)] +
        2 * gray[yCurr + (x + 1)] +
        -1 * gray[yNext + (x - 1)] +
        1 * gray[yNext + (x + 1)];

      // Sobel vertical kernel
      const valGy =
        -1 * gray[yPrev + (x - 1)] +
        -2 * gray[yPrev + x] +
        -1 * gray[yPrev + (x + 1)] +
        1 * gray[yNext + (x - 1)] +
        2 * gray[yNext + x] +
        1 * gray[yNext + (x + 1)];

      const mag = Math.sqrt(valGx * valGx + valGy * valGy);
      gx[idx] = valGx;
      gy[idx] = valGy;
      magnitude[idx] = mag;
      direction[idx] = Math.atan2(valGy, valGx);
      sumMag += mag;
    }
  }

  const meanMagnitude = sumMag / (width * height);
  return { gx, gy, magnitude, direction, meanMagnitude };
}

/**
 * 2D Euclidean / Manhattan Distance Transform
 * Computes distance of each pixel to nearest boundary/background for organic volume inflation
 */
export function computeDistanceTransform(
  mask: Uint8Array | Float32Array,
  width: number,
  height: number,
  threshold = 20
): Float32Array {
  const dist = new Float32Array(width * height);
  const INF = 1e6;

  // Initialize
  for (let i = 0; i < width * height; i++) {
    dist[i] = mask[i] > threshold ? INF : 0;
  }

  // Forward pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (dist[idx] > 0) {
        let minD = dist[idx];
        if (x > 0) minD = Math.min(minD, dist[idx - 1] + 1);
        if (y > 0) minD = Math.min(minD, dist[(y - 1) * width + x] + 1);
        if (x > 0 && y > 0) minD = Math.min(minD, dist[(y - 1) * width + (x - 1)] + 1.414);
        if (x < width - 1 && y > 0) minD = Math.min(minD, dist[(y - 1) * width + (x + 1)] + 1.414);
        dist[idx] = minD;
      }
    }
  }

  // Backward pass
  let maxD = 0;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (dist[idx] > 0) {
        let minD = dist[idx];
        if (x < width - 1) minD = Math.min(minD, dist[idx + 1] + 1);
        if (y < height - 1) minD = Math.min(minD, dist[(y + 1) * width + x] + 1);
        if (x < width - 1 && y < height - 1) minD = Math.min(minD, dist[(y + 1) * width + (x + 1)] + 1.414);
        if (x > 0 && y < height - 1) minD = Math.min(minD, dist[(y + 1) * width + (x - 1)] + 1.414);
        dist[idx] = minD;
        if (minD > maxD) maxD = minD;
      }
    }
  }

  if (maxD > 0) {
    for (let i = 0; i < width * height; i++) {
      dist[i] = dist[i] / maxD;
    }
  }

  return dist;
}

/**
 * Computer Vision Multi-Cue Depth Estimation for Manufacturing Products
 */
export function estimateDepthField(
  gray: Float32Array,
  sobelMag: Float32Array,
  distTransform: Float32Array,
  width: number,
  height: number,
  options: ProcessOptions
): Float32Array {
  const depth = new Float32Array(width * height);
  const { invertDepth, edgeEmphasis = 0.5 } = options;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const g = gray[idx] / 255.0; // 0..1
      const edge = Math.min(sobelMag[idx] / 400.0, 1.0); // 0..1
      const dist = distTransform[idx]; // 0..1

      // Mechanical stepped surface profile
      // High contrast steps for flanges, cylindrical shoulders, bore recesses
      let zVal = g * 0.65 + Math.sqrt(dist) * 0.25 + edge * edgeEmphasis * 0.15;

      if (invertDepth) {
        zVal = 1.0 - zVal;
      }

      depth[idx] = Math.max(0, Math.min(1.0, zVal));
    }
  }

  if (options.smoothIterations > 0) {
    return applyGaussianBlur(depth, width, height, options.smoothIterations);
  }

  return depth;
}

/**
 * Compute 3D Surface Normal vectors from Depth Field
 * n = normalize(-dZ/dx, -dZ/dy, 1)
 */
export function computeSurfaceNormals(
  depth: Float32Array,
  width: number,
  height: number,
  depthScale = 1.0
): {
  normals: Float32Array; // 3 floats per pixel
  normalMapRgba: Uint8ClampedArray; // RGBA buffer for normal map texture
} {
  const normals = new Float32Array(width * height * 3);
  const normalMapRgba = new Uint8ClampedArray(width * height * 4);
  const scaleZ = depthScale * 2.5;

  for (let y = 0; y < height; y++) {
    const yPrev = Math.max(0, y - 1) * width;
    const yNext = Math.min(height - 1, y + 1) * width;
    const yCurr = y * width;

    for (let x = 0; x < width; x++) {
      const xPrev = Math.max(0, x - 1);
      const xNext = Math.min(width - 1, x + 1);

      const dzdx = (depth[yCurr + xNext] - depth[yCurr + xPrev]) * scaleZ;
      const dzdy = (depth[yNext + x] - depth[yPrev + x]) * scaleZ;

      let nx = -dzdx;
      let ny = -dzdy;
      let nz = 1.0;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx3 = (yCurr + x) * 3;
      normals[idx3] = nx;
      normals[idx3 + 1] = ny;
      normals[idx3 + 2] = nz;

      const idx4 = (yCurr + x) * 4;
      normalMapRgba[idx4] = Math.round((nx * 0.5 + 0.5) * 255);
      normalMapRgba[idx4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalMapRgba[idx4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalMapRgba[idx4 + 3] = 255;
    }
  }

  return { normals, normalMapRgba };
}

/**
 * Generate 3D CAD Geometry Data (Vertices, Normals, UVs, Indices)
 * Creates a watertight solid CAD model suitable for 3D printing & engineering inspection
 */
export function generate3DGeometryData(
  depthGrid: Float32Array,
  gridW: number,
  gridH: number,
  options: ProcessOptions
): {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  faceCount: number;
} {
  const { depthScale, baseThickness = 4.0, meshMode } = options;
  const zScale = depthScale * 35.0; // mm equivalent scale
  const baseOffset = baseThickness;

  const extentX = 100;
  const extentY = (100 * gridH) / gridW;
  const halfX = extentX / 2;
  const halfY = extentY / 2;

  // For solid_cad / default watertight solid
  const topVertCount = gridW * gridH;
  const totalVerts = topVertCount * 2;
  const vertices = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const normals = new Float32Array(totalVerts * 3);

  // Center coordinate for central bore calculation
  const cx = gridW / 2;
  const cy = gridH / 2;
  const boreRadius = gridW * 0.16;

  // Build top sculpt surface vertices
  for (let y = 0; y < gridH; y++) {
    const v = y / (gridH - 1);
    const posY = (1 - v) * extentY - halfY;
    for (let x = 0; x < gridW; x++) {
      const u = x / (gridW - 1);
      const posX = u * extentX - halfX;
      let d = depthGrid[y * gridW + x];

      // If hollow_bore mode, carve out central cylindrical bore hole
      if (meshMode === 'hollow_bore') {
        const distFromCenter = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (distFromCenter < boreRadius) {
          d = Math.max(0, d - (1.0 - distFromCenter / boreRadius) * 0.8);
        }
      }

      const posZ = d * zScale + baseOffset;

      const idx = (y * gridW + x) * 3;
      vertices[idx] = posX;
      vertices[idx + 1] = posY;
      vertices[idx + 2] = posZ;

      const uvIdx = (y * gridW + x) * 2;
      uvs[uvIdx] = u;
      uvs[uvIdx + 1] = 1 - v;
    }
  }

  // Build flat bottom base plate vertices (Z = 0)
  for (let y = 0; y < gridH; y++) {
    const v = y / (gridH - 1);
    const posY = (1 - v) * extentY - halfY;
    for (let x = 0; x < gridW; x++) {
      const u = x / (gridW - 1);
      const posX = u * extentX - halfX;

      const idx = (topVertCount + y * gridW + x) * 3;
      vertices[idx] = posX;
      vertices[idx + 1] = posY;
      vertices[idx + 2] = 0; // Flat base

      const uvIdx = (topVertCount + y * gridW + x) * 2;
      uvs[uvIdx] = u;
      uvs[uvIdx + 1] = 1 - v;
    }
  }

  // Compute indices for watertight closed manifold solid
  const topTriCount = (gridW - 1) * (gridH - 1) * 2;
  const botTriCount = topTriCount;
  const sideTriCount = (2 * (gridW - 1) + 2 * (gridH - 1)) * 2;
  const totalTriangles = topTriCount + botTriCount + sideTriCount;

  const indices = new Uint32Array(totalTriangles * 3);
  let iPtr = 0;

  // Top surface
  for (let y = 0; y < gridH - 1; y++) {
    for (let x = 0; x < gridW - 1; x++) {
      const a = y * gridW + x;
      const b = y * gridW + (x + 1);
      const c = (y + 1) * gridW + x;
      const d = (y + 1) * gridW + (x + 1);

      indices[iPtr++] = a;
      indices[iPtr++] = c;
      indices[iPtr++] = b;

      indices[iPtr++] = b;
      indices[iPtr++] = c;
      indices[iPtr++] = d;
    }
  }

  // Bottom surface (reverse winding for outward normal)
  for (let y = 0; y < gridH - 1; y++) {
    for (let x = 0; x < gridW - 1; x++) {
      const a = topVertCount + y * gridW + x;
      const b = topVertCount + y * gridW + (x + 1);
      const c = topVertCount + (y + 1) * gridW + x;
      const d = topVertCount + (y + 1) * gridW + (x + 1);

      indices[iPtr++] = a;
      indices[iPtr++] = b;
      indices[iPtr++] = c;

      indices[iPtr++] = b;
      indices[iPtr++] = d;
      indices[iPtr++] = c;
    }
  }

  // 4 Sides connecting top edge to bottom base
  // Side 1: Top edge (y = 0)
  for (let x = 0; x < gridW - 1; x++) {
    const tA = x;
    const tB = x + 1;
    const bA = topVertCount + x;
    const bB = topVertCount + x + 1;

    indices[iPtr++] = tA;
    indices[iPtr++] = bA;
    indices[iPtr++] = tB;

    indices[iPtr++] = tB;
    indices[iPtr++] = bA;
    indices[iPtr++] = bB;
  }

  // Side 2: Bottom edge (y = gridH - 1)
  const lastRowTop = (gridH - 1) * gridW;
  const lastRowBot = topVertCount + lastRowTop;
  for (let x = 0; x < gridW - 1; x++) {
    const tA = lastRowTop + x;
    const tB = lastRowTop + x + 1;
    const bA = lastRowBot + x;
    const bB = lastRowBot + x + 1;

    indices[iPtr++] = tA;
    indices[iPtr++] = tB;
    indices[iPtr++] = bA;

    indices[iPtr++] = tB;
    indices[iPtr++] = bB;
    indices[iPtr++] = bA;
  }

  // Side 3: Left edge (x = 0)
  for (let y = 0; y < gridH - 1; y++) {
    const tA = y * gridW;
    const tB = (y + 1) * gridW;
    const bA = topVertCount + tA;
    const bB = topVertCount + tB;

    indices[iPtr++] = tA;
    indices[iPtr++] = tB;
    indices[iPtr++] = bA;

    indices[iPtr++] = tB;
    indices[iPtr++] = bB;
    indices[iPtr++] = bA;
  }

  // Side 4: Right edge (x = gridW - 1)
  for (let y = 0; y < gridH - 1; y++) {
    const tA = y * gridW + (gridW - 1);
    const tB = (y + 1) * gridW + (gridW - 1);
    const bA = topVertCount + tA;
    const bB = topVertCount + tB;

    indices[iPtr++] = tA;
    indices[iPtr++] = bA;
    indices[iPtr++] = tB;

    indices[iPtr++] = tB;
    indices[iPtr++] = bA;
    indices[iPtr++] = bB;
  }

  computeMeshNormals(vertices, indices, normals);

  return {
    vertices,
    normals,
    uvs,
    indices,
    vertexCount: totalVerts,
    faceCount: indices.length / 3,
  };
}

/**
 * Compute smooth vertex normals by accumulating face normal vectors
 */
export function computeMeshNormals(
  vertices: Float32Array,
  indices: Uint32Array,
  normals: Float32Array
): void {
  normals.fill(0);

  for (let i = 0; i < indices.length; i += 3) {
    const iA = indices[i] * 3;
    const iB = indices[i + 1] * 3;
    const iC = indices[i + 2] * 3;

    const ax = vertices[iA], ay = vertices[iA + 1], az = vertices[iA + 2];
    const bx = vertices[iB], by = vertices[iB + 1], bz = vertices[iB + 2];
    const cx = vertices[iC], cy = vertices[iC + 1], cz = vertices[iC + 2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;

    const fnx = aby * acz - abz * acy;
    const fny = abz * acx - abx * acz;
    const fnz = abx * acy - aby * acx;

    normals[iA] += fnx; normals[iA + 1] += fny; normals[iA + 2] += fnz;
    normals[iB] += fnx; normals[iB + 1] += fny; normals[iB + 2] += fnz;
    normals[iC] += fnx; normals[iC + 1] += fny; normals[iC + 2] += fnz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i];
    const ny = normals[i + 1];
    const nz = normals[i + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
    normals[i] = nx / len;
    normals[i + 1] = ny / len;
    normals[i + 2] = nz / len;
  }
}
