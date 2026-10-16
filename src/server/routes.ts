/**
 * Safe Node.js API Routes for Computer Vision & 3D CAD Generation
 * Bulletproof response handling compatible with both Connect and Express
 */

import { Router } from 'express';
import { MANUFACTURING_PRODUCTS } from '../data/products.ts';
import {
  computeGrayscale,
  computeSobelGradients,
  computeDistanceTransform,
  estimateDepthField,
  computeSurfaceNormals,
  generate3DGeometryData,
} from '../cv/engine.ts';
import { exportToOBJ, exportToSTL, exportToPLY } from '../cv/export.ts';
import type { ProcessOptions, CVStats } from '../types/index.ts';

export const apiRouter = Router();

const CAD_SERVICE_URL = process.env.CAD_SERVICE_URL || 'http://127.0.0.1:8000';

// Universal safe JSON sender that works in Express, Connect, or raw Node ServerResponse
export function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function probeCadService(): Promise<{ online: boolean; details?: any }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${CAD_SERVICE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return { online: false };
    const details = await r.json();
    return { online: true, details };
  } catch {
    return { online: false };
  }
}

// Health check endpoint
apiRouter.get('/health', async (req, res) => {
  const cad = await probeCadService();
  const capabilities = [
    'legacy_relief_heightfield',
    'sobel_gradient_filtering',
    'euclidean_distance_transform',
    'cad_stl_obj_generation',
  ];
  if (cad.online) {
    capabilities.unshift(
      'parametric_cad_reconstruction',
      'svg_dimension_parse',
      'constraint_solve',
      'multi_view_drawing_fusion'
    );
  }
  sendJson(res, 200, {
    status: 'ok',
    runtime: `Node.js ${process.version}`,
    cvLibrary: cad.online
      ? 'Vision3D Parametric CAD Service (Python) + legacy relief engine'
      : 'Vision3D legacy relief engine (CAD service offline)',
    cadService: {
      url: CAD_SERVICE_URL,
      online: cad.online,
      details: cad.details || null,
    },
    capabilities,
    timestamp: new Date().toISOString(),
  });
});

/** Proxy to Python parametric CAD reconstruction service */
apiRouter.post('/reconstruct', async (req, res) => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    const r = await fetch(`${CAD_SERVICE_URL}/reconstruct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'Invalid response from CAD service' };
    }
    if (!r.ok) {
      return sendJson(res, r.status >= 400 ? r.status : 502, {
        error: data.error || data.detail || 'CAD reconstruction failed',
        cadService: CAD_SERVICE_URL,
        details: data,
      });
    }
    return sendJson(res, 200, data);
  } catch (error: any) {
    console.error('CAD reconstruct proxy error:', error);
    return sendJson(res, 503, {
      error:
        error?.name === 'AbortError'
          ? 'CAD service timed out'
          : `CAD service unreachable at ${CAD_SERVICE_URL}. Start: cd python/cad_service && uvicorn app.main:app --port 8000`,
      cadService: CAD_SERVICE_URL,
    });
  }
});

// Products catalog endpoint
apiRouter.get('/products', (req, res) => {
  sendJson(res, 200, MANUFACTURING_PRODUCTS);
});

// Legacy relief heightfield endpoint (not dimensionally accurate CAD)
apiRouter.post('/process-cv', (req, res) => {
  try {
    const startTime = Date.now();
    const { options, rawRgba, dimensionsMm } = req.body;

    const defaultOpts: ProcessOptions = {
      depthScale: 1.4,
      meshMode: 'solid_cad',
      materialPreset: 'cnc_aluminum',
      resolution: 128,
      baseThickness: 4.0,
      boreDepth: 0.8,
      showDimensions: true,
      showSectionCut: false,
      sectionOffset: 0,
      smoothIterations: 1,
      invertDepth: false,
      edgeEmphasis: 0.6,
    };

    const finalOptions: ProcessOptions = { ...defaultOpts, ...(options || {}) };
    const targetRes = finalOptions.resolution || 128;

    // Use raw RGBA tensor if provided by client or fallback synthetic profile
    let gray: Float32Array;
    if (rawRgba && Array.isArray(rawRgba) && rawRgba.length >= targetRes * targetRes * 4) {
      const u8 = new Uint8Array(rawRgba);
      gray = computeGrayscale(u8, targetRes, targetRes);
    } else {
      // Procedural fallback test circle
      gray = new Float32Array(targetRes * targetRes).fill(30);
      const cx = targetRes / 2;
      const cy = targetRes / 2;
      const r = targetRes * 0.4;
      for (let y = 0; y < targetRes; y++) {
        for (let x = 0; x < targetRes; x++) {
          const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
          if (d < r) gray[y * targetRes + x] = 220;
        }
      }
    }

    const cvSteps: string[] = [
      'LEGACY RELIEF: not parametric CAD — use POST /api/reconstruct for dimensional models',
      `Node.js CV: Processed ${targetRes}x${targetRes} drawing tensor`,
      'Node.js CV: Luminance conversion (Y = 0.299R + 0.587G + 0.114B)',
    ];

    // 2. Sobel Edge Operator
    const { gx, gy, magnitude, direction, meanMagnitude } = computeSobelGradients(
      gray,
      targetRes,
      targetRes
    );
    cvSteps.push('Node.js CV: Sobel 3x3 gradient convolution for mechanical boundaries');

    // 3. Distance transform
    const distTransform = computeDistanceTransform(gray, targetRes, targetRes, 25);
    cvSteps.push('Node.js CV: Euclidean distance transform for volumetric wall extrusion');

    // 4. Depth Field
    const depthField = estimateDepthField(
      gray,
      magnitude,
      distTransform,
      targetRes,
      targetRes,
      finalOptions
    );
    cvSteps.push('Node.js CV: Mechanical step & shoulder depth estimation');

    // 5. Surface Normal Map
    const { normals, normalMapRgba } = computeSurfaceNormals(
      depthField,
      targetRes,
      targetRes,
      finalOptions.depthScale
    );
    cvSteps.push('Node.js CV: Tangent-space normal vector field synthesized');

    // Build heightfield 2D matrix
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
      processingTimeMs: Date.now() - startTime,
      gradientMean: Number(meanMagnitude.toFixed(2)),
      cvPipelineSteps: cvSteps,
      dimensionsMm: dimensionsMm || {
        x: 140,
        y: 140,
        z: Number((finalOptions.depthScale * 35 + finalOptions.baseThickness).toFixed(1)),
      },
    };

    sendJson(res, 200, {
      heightfield,
      stats,
      cvPipelineSteps: cvSteps,
    });
  } catch (error: any) {
    console.error('Server CV error:', error);
    sendJson(res, 500, { error: error.message || 'CV processing failed' });
  }
});

// 3D Model export generator endpoint
apiRouter.post('/export-3d', (req, res) => {
  try {
    const { heightfield, format, options, name } = req.body;
    if (!heightfield || !Array.isArray(heightfield) || heightfield.length === 0) {
      return sendJson(res, 400, { error: 'Valid heightfield matrix is required' });
    }

    const gridH = heightfield.length;
    const gridW = heightfield[0].length;
    const flatDepth = new Float32Array(gridW * gridH);

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        flatDepth[y * gridW + x] = heightfield[y][x];
      }
    }

    const meshData = generate3DGeometryData(flatDepth, gridW, gridH, options);
    const modelName = name || 'manufacturing_part';

    let fileContent = '';
    let mimeType = 'text/plain';
    let filename = `${modelName}.txt`;

    if (format === 'stl') {
      fileContent = exportToSTL(meshData.vertices, meshData.indices, modelName);
      mimeType = 'model/stl';
      filename = `${modelName}.stl`;
    } else if (format === 'ply') {
      fileContent = exportToPLY(meshData.vertices, meshData.normals, meshData.indices);
      mimeType = 'text/plain';
      filename = `${modelName}.ply`;
    } else {
      fileContent = exportToOBJ(meshData.vertices, meshData.normals, meshData.uvs, meshData.indices, modelName);
      mimeType = 'model/obj';
      filename = `${modelName}.obj`;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(fileContent);
  } catch (error: any) {
    console.error('Export 3D error:', error);
    sendJson(res, 500, { error: error.message || 'Export failed' });
  }
});
