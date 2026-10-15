/**
 * Computer Vision Pipeline Processor
 * Converts 2D engineering images into 3D heightfield tensors and normal maps
 */

import {
  computeGrayscale,
  computeSobelGradients,
  computeDistanceTransform,
  estimateDepthField,
  computeSurfaceNormals,
} from './engine.ts';
import type { ProcessOptions, CVResult, CVStats } from '../types/index.ts';

function bufferToGrayscaleDataUrl(
  data: Float32Array,
  width: number,
  height: number,
  maxVal = 255
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  const buf = imgData.data;

  for (let i = 0; i < data.length; i++) {
    const val = Math.min(255, Math.max(0, Math.round((data[i] / maxVal) * 255)));
    const idx = i * 4;
    buf[idx] = val;
    buf[idx + 1] = val;
    buf[idx + 2] = val;
    buf[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function normalMapToDataUrl(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function processImageCV(
  imageDataUrl: string,
  options: ProcessOptions
): Promise<CVResult> {
  const startTime = performance.now();
  const cvSteps: string[] = [];

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const targetRes = options.resolution || 128;
        const canvas = document.createElement('canvas');
        canvas.width = targetRes;
        canvas.height = targetRes;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not create canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetRes, targetRes);
        const imgData = ctx.getImageData(0, 0, targetRes, targetRes);
        const rgba = imgData.data;
        cvSteps.push(`1. Resample engineering drawing to ${targetRes}x${targetRes} grid`);

        // 1. Grayscale
        const gray = computeGrayscale(rgba, targetRes, targetRes);
        cvSteps.push('2. Grayscale luminance conversion (ITU-R BT.601)');

        // 2. Sobel Edge & Gradient Operator
        const { gx, gy, magnitude, direction, meanMagnitude } = computeSobelGradients(
          gray,
          targetRes,
          targetRes
        );
        cvSteps.push('3. Sobel 3x3 convolution for mechanical contours & edges');

        // 3. Distance Transform
        const distTransform = computeDistanceTransform(gray, targetRes, targetRes, 25);
        cvSteps.push('4. Euclidean distance transform for stepped cylindrical volume');

        // 4. Depth Field
        const depthField = estimateDepthField(
          gray,
          magnitude,
          distTransform,
          targetRes,
          targetRes,
          options
        );
        cvSteps.push('5. Multi-cue mechanical depth estimation & shoulder stepping');

        // 5. Surface Normal synthesis
        const { normals, normalMapRgba } = computeSurfaceNormals(
          depthField,
          targetRes,
          targetRes,
          options.depthScale
        );
        cvSteps.push('6. Tangent-space normal vector synthesis (n = normalize(-dZ/dx, -dZ/dy, 1))');

        // Build heightfield 2D array
        const heightfield: number[][] = [];
        let minD = 1.0;
        let maxD = 0.0;
        let sumD = 0.0;

        for (let y = 0; y < targetRes; y++) {
          const row: number[] = [];
          for (let x = 0; x < targetRes; x++) {
            const d = depthField[y * targetRes + x];
            row.push(d);
            if (d < minD) minD = d;
            if (d > maxD) maxD = d;
            sumD += d;
          }
          heightfield.push(row);
        }

        const avgDepth = sumD / (targetRes * targetRes);

        const grayscaleUrl = bufferToGrayscaleDataUrl(gray, targetRes, targetRes, 255);
        const sobelEdgeUrl = bufferToGrayscaleDataUrl(magnitude, targetRes, targetRes, 350);
        const saliencyUrl = bufferToGrayscaleDataUrl(distTransform, targetRes, targetRes, 1.0);
        const depthMapUrl = bufferToGrayscaleDataUrl(depthField, targetRes, targetRes, 1.0);
        const normalMapUrl = normalMapToDataUrl(normalMapRgba, targetRes, targetRes);

        const endTime = performance.now();
        const procMs = Math.round(endTime - startTime);

        const numQuads = (targetRes - 1) * (targetRes - 1);
        const totalVerts = targetRes * targetRes * 2;
        const totalFaces = Math.round(numQuads * 4.5);

        const stats: CVStats = {
          width: targetRes,
          height: targetRes,
          vertexCount: totalVerts,
          faceCount: totalFaces,
          minDepth: Number(minD.toFixed(3)),
          maxDepth: Number(maxD.toFixed(3)),
          avgDepth: Number(avgDepth.toFixed(3)),
          processingTimeMs: procMs,
          gradientMean: Number(meanMagnitude.toFixed(2)),
          cvPipelineSteps: cvSteps,
          dimensionsMm: {
            x: 140,
            y: 140,
            z: Number((options.depthScale * 35 + options.baseThickness).toFixed(1)),
          },
        };

        resolve({
          originalUrl: imageDataUrl,
          grayscaleUrl,
          sobelEdgeUrl,
          saliencyUrl,
          depthMapUrl,
          normalMapUrl,
          stats,
          heightfield,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => reject(new Error('Failed to load image for CV: ' + String(e)));
    img.src = imageDataUrl;
  });
}
