/**
 * 3D Exporter utilities for OBJ, STL (3D Printing), and PLY formats
 */

export function exportToOBJ(
  vertices: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  name = 'manufacturing_part'
): string {
  const lines: string[] = [];
  lines.push(`# Vision3D Manufacturing CAD Export: ${name}.obj`);
  lines.push(`# Vertices: ${vertices.length / 3}, Triangles: ${indices.length / 3}`);
  lines.push(`o ${name}`);

  for (let i = 0; i < vertices.length; i += 3) {
    lines.push(
      `v ${vertices[i].toFixed(4)} ${vertices[i + 1].toFixed(4)} ${vertices[i + 2].toFixed(4)}`
    );
  }

  for (let i = 0; i < normals.length; i += 3) {
    lines.push(
      `vn ${normals[i].toFixed(4)} ${normals[i + 1].toFixed(4)} ${normals[i + 2].toFixed(4)}`
    );
  }

  for (let i = 0; i < uvs.length; i += 2) {
    lines.push(`vt ${uvs[i].toFixed(4)} ${uvs[i + 1].toFixed(4)}`);
  }

  lines.push(`s 1`);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] + 1;
    const b = indices[i + 1] + 1;
    const c = indices[i + 2] + 1;
    lines.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
  }

  return lines.join('\n');
}

export function exportToSTL(
  vertices: Float32Array,
  indices: Uint32Array,
  name = 'manufacturing_part'
): string {
  const lines: string[] = [];
  lines.push(`solid ${name}`);

  for (let i = 0; i < indices.length; i += 3) {
    const iA = indices[i] * 3;
    const iB = indices[i + 1] * 3;
    const iC = indices[i + 2] * 3;

    const ax = vertices[iA], ay = vertices[iA + 1], az = vertices[iA + 2];
    const bx = vertices[iB], by = vertices[iB + 1], bz = vertices[iB + 2];
    const cx = vertices[iC], cy = vertices[iC + 1], cz = vertices[iC + 2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    let fnx = aby * acz - abz * acy;
    let fny = abz * acx - abx * acz;
    let fnz = abx * acy - aby * acx;
    const len = Math.sqrt(fnx * fnx + fny * fny + fnz * fnz) || 1.0;
    fnx /= len; fny /= len; fnz /= len;

    lines.push(`  facet normal ${fnx.toFixed(4)} ${fny.toFixed(4)} ${fnz.toFixed(4)}`);
    lines.push(`    outer loop`);
    lines.push(`      vertex ${ax.toFixed(4)} ${ay.toFixed(4)} ${az.toFixed(4)}`);
    lines.push(`      vertex ${bx.toFixed(4)} ${by.toFixed(4)} ${bz.toFixed(4)}`);
    lines.push(`      vertex ${cx.toFixed(4)} ${cy.toFixed(4)} ${cz.toFixed(4)}`);
    lines.push(`    endloop`);
    lines.push(`  endfacet`);
  }

  lines.push(`endsolid ${name}`);
  return lines.join('\n');
}

export function exportToPLY(
  vertices: Float32Array,
  normals: Float32Array,
  indices: Uint32Array
): string {
  const vertCount = vertices.length / 3;
  const faceCount = indices.length / 3;

  const header = [
    'ply',
    'format ascii 1.0',
    'comment Created by Vision3D Manufacturing CAD Studio',
    `element vertex ${vertCount}`,
    'property float x',
    'property float y',
    'property float z',
    'property float nx',
    'property float ny',
    'property float nz',
    `element face ${faceCount}`,
    'property list uchar int vertex_indices',
    'end_header',
  ];

  const lines: string[] = [...header];

  for (let i = 0; i < vertCount; i++) {
    const vI = i * 3;
    lines.push(
      `${vertices[vI].toFixed(4)} ${vertices[vI + 1].toFixed(4)} ${vertices[vI + 2].toFixed(4)} ${normals[vI].toFixed(4)} ${normals[vI + 1].toFixed(4)} ${normals[vI + 2].toFixed(4)}`
    );
  }

  for (let i = 0; i < indices.length; i += 3) {
    lines.push(`3 ${indices[i]} ${indices[i + 1]} ${indices[i + 2]}`);
  }

  return lines.join('\n');
}
