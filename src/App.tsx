/**
 * Vision3D — 2D engineering drawing → 3D CAD (simplified UI)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar.tsx';
import { ThreeCanvas } from './components/ThreeCanvas.tsx';
import { ControlDock } from './components/ControlDock.tsx';
import { MANUFACTURING_PRODUCTS } from './data/products.ts';
import { processImageCV } from './cv/processor.ts';
import { generate3DGeometryData } from './cv/engine.ts';
import { exportToOBJ, exportToSTL, exportToPLY } from './cv/export.ts';
import type {
  ManufacturingProduct,
  ProductAngleKey,
  ProcessOptions,
  CVResult,
  CadReconstruction,
} from './types/index.ts';

const DEFAULT_OPTIONS: ProcessOptions = {
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

const VIEW_ORDER: ProductAngleKey[] = [
  'blueprint_sheet',
  'front_view',
  'top_view',
  'side_view',
  'iso_cad',
];

const VIEW_LABELS: Record<ProductAngleKey, string> = {
  blueprint_sheet: 'Blueprint',
  front_view: 'Front',
  top_view: 'Top',
  side_view: 'Side',
  iso_cad: 'Iso',
};

const UNKNOWN_SPEC = {
  outerDiameterMm: 0,
  boreDiameterMm: 0,
  totalHeightMm: 0,
  flangeThicknessMm: 0,
  boltPattern: 'Unknown',
  tolerance: '—',
  surfaceFinish: '—',
};

function specsFromCad(specs: Record<string, unknown> | undefined) {
  if (!specs) return { ...UNKNOWN_SPEC };
  return {
    outerDiameterMm: Number(specs.outerDiameterMm) || 0,
    boreDiameterMm: Number(specs.boreDiameterMm) || 0,
    totalHeightMm: Number(specs.totalHeightMm) || 0,
    flangeThicknessMm: Number(specs.flangeThicknessMm) || 0,
    boltPattern: (specs.boltPattern as string) || 'Unknown',
    tolerance: 'From drawing',
    surfaceFinish: 'As reconstructed',
  };
}

export default function App() {
  const [currentProduct, setCurrentProduct] = useState<ManufacturingProduct>(
    MANUFACTURING_PRODUCTS[0]
  );
  const [selectedAngle, setSelectedAngle] = useState<ProductAngleKey>('blueprint_sheet');
  const [options, setOptions] = useState<ProcessOptions>(DEFAULT_OPTIONS);
  const [cvResult, setCvResult] = useState<CVResult | null>(null);
  const [cadResult, setCadResult] = useState<CadReconstruction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'3d' | 'drawing'>('3d');

  const resolveDataUrl = useCallback(async (src: string): Promise<string> => {
    if (src.startsWith('data:')) return src;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to load drawing: ${src}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read drawing'));
      reader.readAsDataURL(blob);
    });
  }, []);

  const runCadReconstruct = useCallback(async (product: ManufacturingProduct) => {
    // Use blueprint sheet only — extra angle SVGs are decorative and break CAD dims
    const blueprint = product.angles.blueprint_sheet;
    const primary = blueprint?.dataUrl
      ? await resolveDataUrl(blueprint.dataUrl)
      : await resolveDataUrl(
          Object.values(product.angles).find((a) => a?.dataUrl)?.dataUrl || ''
        );

    const isSvgData =
      typeof primary === 'string' && primary.startsWith('data:image/svg');
    const filenameHint =
      (isSvgData ? `${product.partNumber}.svg` : null) ||
      product.angles.blueprint_sheet?.description ||
      product.angles.blueprint_sheet?.degrees ||
      `${product.partNumber}.png`;

    let svgText: string | undefined;
    if (isSvgData && primary.includes(',')) {
      const payload = primary.slice(primary.indexOf(',') + 1);
      try {
        svgText = primary.includes(';base64,')
          ? atob(payload)
          : decodeURIComponent(payload);
      } catch {
        svgText = undefined;
      }
    }

    const res = await fetch('/api/reconstruct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: primary,
        svg_text: svgText,
        views: { blueprint_sheet: primary },
        filename: filenameHint,
        prefer_svg: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'CAD reconstruction failed');

    const solved = data.solved || {};
    return {
      status: data.status,
      stlBase64: data.stl_base64 || null,
      stepBase64: data.step_base64 || null,
      specifications: data.specifications || {},
      pipelineSteps: data.pipeline_steps || [],
      processingMs: data.processing_ms || 0,
      uncertainties: [
        ...(data.drawing_ir?.uncertainties || []),
        ...(solved.uncertainties || []),
      ],
      assumptions: [
        ...(data.drawing_ir?.assumptions || []),
        ...(solved.assumptions || []),
      ],
      validation: data.validation || null,
      drawingIr: data.drawing_ir,
      mode: 'cad' as const,
    } satisfies CadReconstruction;
  }, [resolveDataUrl]);

  const runReliefFallback = useCallback(
    async (imgData: string, currentOpts: ProcessOptions) => {
      return processImageCV(imgData, currentOpts);
    },
    []
  );

  const runPipeline = useCallback(
    async (imgData: string, currentOpts: ProcessOptions, product = currentProduct) => {
      setIsProcessing(true);
      setErrorMsg(null);

      const filenameHint =
        product.angles.blueprint_sheet?.description ||
        product.angles.blueprint_sheet?.degrees ||
        '';
      const isPdf =
        filenameHint.toLowerCase().endsWith('.pdf') ||
        (typeof imgData === 'string' && imgData.startsWith('data:application/pdf'));
      const isSvg =
        filenameHint.toLowerCase().endsWith('.svg') ||
        (typeof imgData === 'string' && imgData.startsWith('data:image/svg'));

      /** Minimal canvas state so STL can render without raster relief */
      const emptyVis = (): CVResult => ({
        originalUrl: '',
        grayscaleUrl: '',
        sobelEdgeUrl: '',
        saliencyUrl: '',
        depthMapUrl: '',
        normalMapUrl: '',
        heightfield: [
          [0, 0],
          [0, 0],
        ],
        stats: {
          width: 2,
          height: 2,
          vertexCount: 0,
          faceCount: 0,
          minDepth: 0,
          maxDepth: 0,
          avgDepth: 0,
          processingTimeMs: 0,
          gradientMean: 0,
          cvPipelineSteps: ['pdf_or_svg_cad_only'],
          dimensionsMm: { x: 0, y: 0, z: 0 },
        },
      });

      try {
        const resolvedImg = await resolveDataUrl(imgData);
        try {
          const cad = await runCadReconstruct(product);
          setCadResult(cad);
          if (cad.specifications && Object.keys(cad.specifications).length) {
            setCurrentProduct((prev) => ({
              ...prev,
              specifications: {
                ...prev.specifications,
                ...specsFromCad(cad.specifications),
              },
            }));
          }
          // Always prefer parametric STL — never overlay heightfield "fan/clover" relief
          if (cad.stlBase64) {
            setCvResult(emptyVis());
            return;
          }
          if (isPdf || isSvg) {
            setCvResult(emptyVis());
            setErrorMsg('CAD built no STL — check dimension labels on the drawing');
            return;
          }
          const clientVis = await processImageCV(resolvedImg, currentOpts);
          setCvResult(clientVis);
          const relief = await runReliefFallback(resolvedImg, currentOpts);
          setCvResult(relief);
          setCadResult({ ...cad, mode: 'relief', stlBase64: null });
          return;
        } catch (cadErr: unknown) {
          const msg = cadErr instanceof Error ? cadErr.message : 'CAD unavailable';
          console.warn(msg);
          setErrorMsg(msg);
          if (isPdf) {
            setCvResult(emptyVis());
            return;
          }
        }

        const relief = await runReliefFallback(resolvedImg, currentOpts);
        setCvResult(relief);
        setCadResult({
          status: 'incomplete',
          mode: 'relief',
          stlBase64: null,
          specifications: {},
          pipelineSteps: [],
          processingMs: relief.stats.processingTimeMs,
          uncertainties: [],
          assumptions: [],
        });
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to process drawing');
      } finally {
        setIsProcessing(false);
      }
    },
    [currentProduct, runCadReconstruct, runReliefFallback, resolveDataUrl]
  );

  useEffect(() => {
    const angleInfo =
      currentProduct.angles[selectedAngle] || currentProduct.angles.blueprint_sheet;
    if (angleInfo) {
      runPipeline(angleInfo.dataUrl, options, currentProduct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProduct.id, selectedAngle]);

  const handleSelectAngle = (key: ProductAngleKey) => setSelectedAngle(key);

  const handleSelectProduct = (product: ManufacturingProduct) => {
    setCurrentProduct(product);
    setSelectedAngle('blueprint_sheet');
    setMainTab('3d');
  };

  const handleUploadImage = (dataUrl: string, filename: string) => {
    setCurrentProduct({
      id: 'custom_' + Date.now(),
      name: filename.replace(/\.[^/.]+$/, ''),
      partNumber: 'UPLOAD',
      category: 'Uploaded',
      materialType: '—',
      description: filename,
      specifications: { ...UNKNOWN_SPEC },
      angles: {
        blueprint_sheet: {
          key: 'blueprint_sheet',
          label: 'Uploaded file',
          degrees: filename,
          description: filename,
          dataUrl,
        },
      },
    });
    setSelectedAngle('blueprint_sheet');
    setMainTab('3d');
  };

  const handleChangeOptions = (updated: Partial<ProcessOptions>) => {
    setOptions((prev) => ({ ...prev, ...updated }));
  };

  const handleExport = (format: 'stl' | 'obj' | 'ply' | 'depth_png') => {
    const baseName = `${currentProduct.partNumber}_${selectedAngle}`
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_');

    if (format === 'stl' && cadResult?.stlBase64) {
      const binary = atob(cadResult.stlBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'model/stl' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.stl`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!cvResult) return;
    if (format === 'depth_png') {
      const link = document.createElement('a');
      link.href = cvResult.depthMapUrl;
      link.download = `${baseName}_depth.png`;
      link.click();
      return;
    }

    const gridH = cvResult.heightfield.length;
    const gridW = cvResult.heightfield[0].length;
    const flatDepth = new Float32Array(gridW * gridH);
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        flatDepth[y * gridW + x] = cvResult.heightfield[y][x];
      }
    }
    const meshData = generate3DGeometryData(flatDepth, gridW, gridH, options);
    let content = '';
    let mime = 'text/plain';
    if (format === 'stl') {
      content = exportToSTL(meshData.vertices, meshData.indices, baseName);
      mime = 'model/stl';
    } else if (format === 'ply') {
      content = exportToPLY(meshData.vertices, meshData.normals, meshData.indices);
    } else {
      content = exportToOBJ(
        meshData.vertices,
        meshData.normals,
        meshData.uvs,
        meshData.indices,
        baseName
      );
      mime = 'model/obj';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentAngleInfo =
    currentProduct.angles[selectedAngle] || currentProduct.angles.blueprint_sheet;
  const drawingViews = VIEW_ORDER.filter((key) => currentProduct.angles[key]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <HeaderBar
        currentProduct={currentProduct}
        onSelectProduct={handleSelectProduct}
        onUploadImage={handleUploadImage}
        onExportStl={() => handleExport('stl')}
        mainTab={mainTab}
        onMainTab={setMainTab}
        isProcessing={isProcessing}
      />

      <main className="relative flex-1 w-full overflow-hidden">
        {mainTab === 'drawing' ? (
          <div className="relative w-full h-full flex items-center justify-center p-6 bg-slate-950">
            {drawingViews.length > 1 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-0.5 rounded-lg bg-slate-900/95 border border-slate-800">
                {drawingViews.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectAngle(key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition ${
                      selectedAngle === key
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {VIEW_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
            {currentAngleInfo?.dataUrl ? (
              (() => {
                const src = currentAngleInfo.dataUrl;
                const name =
                  currentAngleInfo.description || currentAngleInfo.degrees || '';
                const pdf =
                  name.toLowerCase().endsWith('.pdf') ||
                  src.startsWith('data:application/pdf');
                if (pdf) {
                  return (
                    <div className="max-w-lg w-full rounded-lg border border-slate-800 bg-slate-900/80 px-6 py-8 text-center space-y-2">
                      <p className="text-sm font-semibold text-cyan-400">PDF uploaded</p>
                      <p className="text-xs text-slate-300 break-all">{name || 'drawing.pdf'}</p>
                      <p className="text-xs text-slate-500">
                        Reconstructing 3D from selectable dimension text (same path as SVG).
                        Switch to the 3D tab for the live model.
                      </p>
                    </div>
                  );
                }
                return (
                  <img
                    src={src}
                    alt={currentAngleInfo.label}
                    className="max-w-full max-h-full object-contain rounded-lg border border-slate-800"
                  />
                );
              })()
            ) : (
              <span className="text-slate-500 text-sm">No drawing loaded</span>
            )}
          </div>
        ) : cvResult ? (
          <ThreeCanvas
            heightfield={cvResult.heightfield}
            options={options}
            product={currentProduct}
            blueprintUrl={currentAngleInfo?.dataUrl}
            normalMapUrl={cvResult.normalMapUrl}
            isProcessing={isProcessing}
            stlBase64={cadResult?.stlBase64}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-300">Building 3D model…</span>
          </div>
        )}

        {errorMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-lg bg-red-950/90 border border-red-500/50 text-red-200 text-xs">
            {errorMsg}
          </div>
        )}

        {mainTab === '3d' && (
          <ControlDock
            options={options}
            onChangeOptions={handleChangeOptions}
            onExport={handleExport}
            isProcessing={isProcessing}
          />
        )}
      </main>
    </div>
  );
}
