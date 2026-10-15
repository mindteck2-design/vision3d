import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGrayscale,
  computeSobelGradients,
  computeDistanceTransform,
  computeSurfaceNormals,
  generate3DGeometryData,
} from './engine.ts';
import { exportToOBJ, exportToSTL } from './export.ts';
import type { ProcessOptions } from '../types/index.ts';

test('computeGrayscale converts RGBA to luminance correctly', () => {
  const rgba = new Uint8Array([
    255, 0, 0, 255,     // Red: 0.299*255 = 76.245
    0, 255, 0, 255,     // Green: 0.587*255 = 149.685
    0, 0, 255, 255,     // Blue: 0.114*255 = 29.07
    255, 255, 255, 255, // White: 255
  ]);
  const gray = computeGrayscale(rgba, 2, 2);

  assert.equal(gray.length, 4);
  assert.ok(Math.abs(gray[0] - 76.245) < 0.1);
  assert.ok(Math.abs(gray[1] - 149.685) < 0.1);
  assert.ok(Math.abs(gray[2] - 29.07) < 0.1);
  assert.ok(Math.abs(gray[3] - 255) < 0.1);
});

test('computeSobelGradients detects step edges', () => {
  const gray = new Float32Array([
    0, 0, 200, 200,
    0, 0, 200, 200,
    0, 0, 200, 200,
    0, 0, 200, 200,
  ]);
  const { gx, magnitude } = computeSobelGradients(gray, 4, 4);
  assert.ok(gx[1 * 4 + 1] > 100);
  assert.ok(magnitude[1 * 4 + 1] > 100);
});

test('computeDistanceTransform increases toward interior', () => {
  const mask = new Float32Array([
    0, 0, 0, 0, 0,
    0, 255, 255, 255, 0,
    0, 255, 255, 255, 0,
    0, 255, 255, 255, 0,
    0, 0, 0, 0, 0,
  ]);
  const dist = computeDistanceTransform(mask, 5, 5, 50);
  assert.ok(dist[2 * 5 + 2] >= dist[1 * 5 + 1]);
});

test('computeSurfaceNormals produces upright normal on flat plane', () => {
  const depth = new Float32Array(9).fill(0.5);
  const { normals } = computeSurfaceNormals(depth, 3, 3, 1.0);
  assert.ok(Math.abs(normals[4 * 3]) < 0.001);
  assert.ok(Math.abs(normals[4 * 3 + 1]) < 0.001);
  assert.ok(Math.abs(normals[4 * 3 + 2] - 1.0) < 0.001);
});

test('generate3DGeometryData creates closed solid manifold mesh', () => {
  const depth = new Float32Array(4 * 4).fill(0.5);
  const options: ProcessOptions = {
    depthScale: 1.0,
    meshMode: 'solid_cad',
    materialPreset: 'cnc_aluminum',
    resolution: 4,
    baseThickness: 4.0,
    boreDepth: 0.8,
    showDimensions: true,
    showSectionCut: false,
    sectionOffset: 0,
    smoothIterations: 0,
    invertDepth: false,
    edgeEmphasis: 0.5,
  };

  const mesh = generate3DGeometryData(depth, 4, 4, options);
  assert.equal(mesh.vertexCount, 32); // 16 top + 16 bottom
  assert.ok(mesh.faceCount > 18); // top, bottom, and 4 sides
});

test('exportToOBJ formats valid Wavefront file', () => {
  const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
  const indices = new Uint32Array([0, 1, 2]);

  const obj = exportToOBJ(vertices, normals, uvs, indices, 'test_part');
  assert.ok(obj.includes('o test_part'));
  assert.ok(obj.includes('f 1/1/1 2/2/2 3/3/3'));
});

test('exportToSTL produces valid STL with normals', () => {
  const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint32Array([0, 1, 2]);

  const stl = exportToSTL(vertices, indices, 'cnc_rotor');
  assert.ok(stl.includes('solid cnc_rotor'));
  assert.ok(stl.includes('facet normal'));
  assert.ok(stl.includes('endsolid cnc_rotor'));
});
