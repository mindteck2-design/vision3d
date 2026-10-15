/**
 * Node.js Server-side Computer Vision Engine
 * Uses Jimp and mathematical Computer Vision algorithms for 3D depth extraction
 */

import { Jimp } from 'jimp';
import {
  computeGrayscale,
  computeSobelGradients,
  computeDistanceTransform,
  estimateDepthField,
  computeSurfaceNormals,
} from '../cv/engine.ts';
import type { ProcessOptions, CVResult, CVStats } from '../types/index.ts';

// Helper to convert Float32Array to PNG base64 data URL using Jimp
async function floatBufferToPngDataUrl(
  data: Float32Array,
  width: number,
  height: number,
  maxVal = 255
): Promise<string> {
  const image = new Jimp({ width, height });

  for (let i = 0; i < data.length; i++) {
    const v = Math.min(255, Math.max(0, Math.round((data[i] / maxVal) * 255)));
    const idx = i * 4;
    image.bitmap.data[idx] = v;
    image.bitmap.data[idx + 1] = v;
    image.bitmap.data[idx + 2] = v;
    image.bitmap.data[idx + 3] = 255;
  }

  const base64 = await image.getBase64('image/png');
  return base64;
}

// Helper to convert Normal Map RGBA buffer to PNG base64
async function normalBufferToPngDataUrl(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Promise<string> {
  const image = new Jimp({ width, height });
  image.bitmap.data.set(rgba);
  const base64 = await image.getBase64('image/png');
  return base64;
}

/**
 * Server-side CV Processor
 */
export async function processImageServerCV(
  imageData: string,
  options: ProcessOptions,
  rawRgba?: number[] | Uint8Array
): Promise<CVResult> {
  const startTime = Date.now();
  const targetRes = options.resolution || 128;
  let width = targetRes;
  let height = targetRes;
  let rawData: Uint8Array;
  const cvSteps: string[] = [];

  if (rawRgba && rawRgba.length >= targetRes * targetRes * 4) {
    rawData = rawRgba instanceof Uint8Array ? rawRgba : new Uint8Array(rawRgba);
    cvSteps.push(`Node.js CV Engine: Processing ${width}x${height} RGBA tensor`);
  } else {
    let buffer: Buffer;
    if (imageData.startsWith('data:')) {
      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(imageData, 'base64');
    }

    const image = await Jimp.read(buffer);
    image.resize({ w: targetRes, h: targetRes });
    width = image.bitmap.width;
    height = image.bitmap.height;
    rawData = image.bitmap.data;
    cvSteps.push(`Node.js Jimp: Image decoded & resampled to ${width}x${height}`);
  }

  // 1. Grayscale luminance conversion (ITU-R BT.601)
  const gray = computeGrayscale(rawData, width, height);
  cvSteps.push('Node.js CV: Luminance conversion (Y = 0.299R + 0.587G + 0.114B)');

  // 2. Sobel Edge & Gradient Operator
  const { gx, gy, magnitude, direction, meanMagnitude } = computeSobelGradients(
    gray,
    width,
    height
  );
  cvSteps.push('Node.js CV: Sobel 3x3 gradient convolution (Gx, Gy, Magnitude)');

  // 3. Euclidean Distance transform
  const distTransform = computeDistanceTransform(
    gray,
    width,
    height,
    options.backgroundThreshold || 25
  );
  cvSteps.push('Node.js CV: Euclidean distance transform for volumetric profile');

  // 4. Multi-Cue Depth Field
  const depthField = estimateDepthField(
    gray,
    magnitude,
    distTransform,
    width,
    height,
    options
  );
  cvSteps.push(`Node.js CV: Multi-cue depth estimation (${options.depthEstimationMethod})`);

  // 5. Surface Normal Vector Map
  const { normals, normalMapRgba } = computeSurfaceNormals(
    depthField,
    width,
    height,
    options.depthScale
  );
  cvSteps.push('Node.js CV: Tangent-space normal vector field generated');

  // Build heightfield 2D array
  const heightfield: number[][] = [];
  let minD = 1.0;
  let maxD = 0.0;
  let sumD = 0.0;

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const d = depthField[y * width + x];
      row.push(d);
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
      sumD += d;
    }
    heightfield.push(row);
  }

  const avgDepth = sumD / (width * height);

  // Generate PNG visualizations via Jimp
  const [grayscaleUrl, sobelEdgeUrl, saliencyUrl, depthMapUrl, normalMapUrl] =
    await Promise.all([
      floatBufferToPngDataUrl(gray, width, height, 255),
      floatBufferToPngDataUrl(magnitude, width, height, 350),
      floatBufferToPngDataUrl(distTransform, width, height, 1.0),
      floatBufferToPngDataUrl(depthField, width, height, 1.0),
      normalBufferToPngDataUrl(normalMapRgba, width, height),
    ]);

  const numQuads = (width - 1) * (height - 1);
  const triFactor = options.meshMode === 'solid_base' ? 4.5 : options.meshMode === 'double_sided' ? 4.0 : 2.0;

  const stats: CVStats = {
    width,
    height,
    vertexCount: options.meshMode === 'solid_base' ? width * height * 2 : width * height,
    faceCount: Math.round(numQuads * triFactor),
    minDepth: Number(minD.toFixed(3)),
    maxDepth: Number(maxD.toFixed(3)),
    avgDepth: Number(avgDepth.toFixed(3)),
    processingTimeMs: Date.now() - startTime,
    gradientMean: Number(meanMagnitude.toFixed(2)),
    cvPipelineSteps: cvSteps,
    estimatedPrintDimensionsMm: {
      x: 80,
      y: 80,
      z: Number((options.depthScale * 25 + options.baseThickness).toFixed(1)),
    },
  };

  return {
    originalUrl: imageData,
    grayscaleUrl,
    sobelEdgeUrl,
    saliencyUrl,
    depthMapUrl,
    normalMapUrl,
    stats,
    heightfield,
  };
}
