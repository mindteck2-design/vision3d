/**
 * Vision3D - Manufacturing Product 2D to 3D Studio
 * Converts multi-angle engineering drawings and snapshots into 3D CAD meshes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar.tsx';
import { AngleSnapshotBar } from './components/AngleSnapshotBar.tsx';
import { ThreeCanvas } from './components/ThreeCanvas.tsx';
import { ControlDock } from './components/ControlDock.tsx';
import { CVPipelineModal } from './components/CVPipelineModal.tsx';
import { BlueprintSpecsModal } from './components/BlueprintSpecsModal.tsx';
import { MANUFACTURING_PRODUCTS } from './data/products.ts';
import { processImageCV } from './cv/processor.ts';
import { generate3DGeometryData } from './cv/engine.ts';
import { exportToOBJ, exportToSTL, exportToPLY } from './cv/export.ts';
import type {
  ManufacturingProduct,
  ProductAngleKey,
  ProcessOptions,
  CVResult,
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

export default function App() {
  const [currentProduct, setCurrentProduct] = useState<ManufacturingProduct>(
    MANUFACTURING_PRODUCTS[0]
  );
  const [selectedAngle, setSelectedAngle] = useState<ProductAngleKey>('blueprint_sheet');
  const [options, setOptions] = useState<ProcessOptions>(DEFAULT_OPTIONS);
  const [cvResult, setCvResult] = useState<CVResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [useBackend, setUseBackend] = useState<boolean>(true);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [isCVModalOpen, setIsCVModalOpen] = useState<boolean>(false);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ping backend server health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      })
      .catch(() => setServerStatus('offline'));
  }, []);

  // Run Computer Vision pipeline
  const runPipeline = useCallback(
    async (imgData: string, currentOpts: ProcessOptions) => {
      setIsProcessing(true);
      setErrorMsg(null);

      try {
        let result: CVResult | null = null;

        // Try Node.js Express backend if enabled
        if (useBackend && serverStatus !== 'offline') {
          try {
            let rawRgba: number[] | undefined;
            if (typeof document !== 'undefined') {
              const canvas = document.createElement('canvas');
              canvas.width = currentOpts.resolution;
              canvas.height = currentOpts.resolution;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise<void>((resolve) => {
                  img.onload = () => {
                    ctx.drawImage(img, 0, 0, currentOpts.resolution, currentOpts.resolution);
                    const d = ctx.getImageData(0, 0, currentOpts.resolution, currentOpts.resolution);
                    rawRgba = Array.from(d.data);
                    resolve();
                  };
                  img.onerror = () => resolve();
                  img.src = imgData;
                });
              }
            }

            const res = await fetch('/api/process-cv', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                options: currentOpts,
                rawRgba,
                dimensionsMm: {
                  x: currentProduct.specifications.outerDiameterMm,
                  y: currentProduct.specifications.outerDiameterMm,
                  z: Number(
                    (currentOpts.depthScale * 35 + currentOpts.baseThickness).toFixed(1)
                  ),
                },
              }),
            });

            if (res.ok) {
              const serverData = await res.json();
              // Compute client visualizations for the stage gallery
              const clientVis = await processImageCV(imgData, currentOpts);
              result = {
                ...clientVis,
                heightfield: serverData.heightfield || clientVis.heightfield,
                stats: serverData.stats || clientVis.stats,
              };
            }
          } catch (backendErr) {
            console.warn('Backend call failed, using client worker:', backendErr);
          }
        }

        // Client-side fallback
        if (!result) {
          result = await processImageCV(imgData, currentOpts);
        }

        setCvResult(result);
      } catch (err: any) {
        console.error('Computer Vision Error:', err);
        setErrorMsg(err.message || 'Failed to process manufacturing drawing');
      } finally {
        setIsProcessing(false);
      }
    },
    [useBackend, serverStatus, currentProduct]
  );

  // Initial load
  useEffect(() => {
    const angleInfo = currentProduct.angles[selectedAngle];
    if (angleInfo) {
      runPipeline(angleInfo.dataUrl, options);
    }
  }, [currentProduct, selectedAngle]);

  // Angle Selection handler
  const handleSelectAngle = (key: ProductAngleKey) => {
    setSelectedAngle(key);
    const angleInfo = currentProduct.angles[key];
    if (angleInfo) {
      runPipeline(angleInfo.dataUrl, options);
    }
  };

  // Product Selection handler
  const handleSelectProduct = (product: ManufacturingProduct) => {
    setCurrentProduct(product);
    setSelectedAngle('blueprint_sheet');
    const angleInfo = product.angles.blueprint_sheet;
    if (angleInfo) {
      runPipeline(angleInfo.dataUrl, options);
    }
  };

  // Image Upload handler
  const handleUploadImage = (dataUrl: string, filename: string) => {
    const customAngle = {
      key: 'blueprint_sheet' as ProductAngleKey,
      label: 'Uploaded Drawing',
      degrees: 'Custom View',
      description: filename,
      dataUrl,
    };
    const customProduct: ManufacturingProduct = {
      id: 'custom_' + Date.now(),
      name: filename.replace(/\.[^/.]+$/, ''),
      partNumber: 'CUSTOM-2D',
      category: 'Uploaded Part',
      materialType: 'Custom Material',
      description: 'Custom uploaded 2D drawing converted to 3D CAD mesh.',
      specifications: {
        outerDiameterMm: 120,
        boreDiameterMm: 40,
        totalHeightMm: 60,
        flangeThicknessMm: 15,
        boltPattern: 'Custom Pattern',
        tolerance: '±0.05 mm',
        surfaceFinish: 'As Machined',
      },
      angles: {
        blueprint_sheet: customAngle,
        front_view: customAngle,
        top_view: customAngle,
        side_view: customAngle,
        iso_cad: customAngle,
      },
    };
    setCurrentProduct(customProduct);
    setSelectedAngle('blueprint_sheet');
    runPipeline(dataUrl, options);
  };

  // Options update handler
  const handleChangeOptions = (updated: Partial<ProcessOptions>) => {
    const newOpts = { ...options, ...updated };
    setOptions(newOpts);

    const needsReprocess =
      updated.resolution !== undefined ||
      updated.smoothIterations !== undefined ||
      updated.invertDepth !== undefined;

    if (needsReprocess) {
      const angleInfo = currentProduct.angles[selectedAngle];
      if (angleInfo) {
        runPipeline(angleInfo.dataUrl, newOpts);
      }
    }
  };

  // Export 3D CAD Model
  const handleExport = (format: 'stl' | 'obj' | 'ply' | 'depth_png') => {
    if (!cvResult) return;

    const baseName = `${currentProduct.partNumber}_${selectedAngle}`.toLowerCase().replace(/[^a-z0-9_]+/g, '_');

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
    let filename = `${baseName}.${format}`;

    if (format === 'stl') {
      content = exportToSTL(meshData.vertices, meshData.indices, baseName);
      mime = 'model/stl';
    } else if (format === 'ply') {
      content = exportToPLY(meshData.vertices, meshData.normals, meshData.indices);
      mime = 'text/plain';
    } else {
      content = exportToOBJ(meshData.vertices, meshData.normals, meshData.uvs, meshData.indices, baseName);
      mime = 'model/obj';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentAngleInfo = currentProduct.angles[selectedAngle];

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <HeaderBar
        currentProduct={currentProduct}
        onSelectProduct={handleSelectProduct}
        onUploadImage={handleUploadImage}
        useBackend={useBackend}
        onToggleBackend={setUseBackend}
        serverStatus={serverStatus}
        onOpenCVLab={() => setIsCVModalOpen(true)}
      />

      {/* Multi-Angle Snapshots Ribbon */}
      <AngleSnapshotBar
        product={currentProduct}
        selectedAngle={selectedAngle}
        onSelectAngle={handleSelectAngle}
        onOpenBlueprintModal={() => setIsSpecsModalOpen(true)}
      />

      {/* Main 3D Viewport Workspace */}
      <main className="relative flex-1 w-full overflow-hidden">
        {cvResult ? (
          <ThreeCanvas
            heightfield={cvResult.heightfield}
            options={options}
            product={currentProduct}
            blueprintUrl={currentAngleInfo?.dataUrl}
            normalMapUrl={cvResult.normalMapUrl}
            isProcessing={isProcessing}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-cyan-300">
              Reconstructing 3D Manufacturing Geometry...
            </span>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs shadow-2xl backdrop-blur">
            {errorMsg}
          </div>
        )}

        {/* Ergonomic Bottom Control Dock */}
        <ControlDock
          options={options}
          onChangeOptions={handleChangeOptions}
          onExport={handleExport}
          onOpenCVLab={() => setIsCVModalOpen(true)}
          isProcessing={isProcessing}
        />
      </main>

      {/* Computer Vision Pipeline Laboratory Modal */}
      <CVPipelineModal
        isOpen={isCVModalOpen}
        onClose={() => setIsCVModalOpen(false)}
        result={cvResult}
      />

      {/* Blueprint & Dimension Specs Modal */}
      <BlueprintSpecsModal
        isOpen={isSpecsModalOpen}
        onClose={() => setIsSpecsModalOpen(false)}
        product={currentProduct}
      />
    </div>
  );
}
