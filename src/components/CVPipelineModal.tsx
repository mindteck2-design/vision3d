import React, { useState, useEffect } from 'react';
import type { CVResult } from '../types/index.ts';
import {
  X,
  Sparkles,
  Layers,
  Cpu,
  CheckCircle,
} from 'lucide-react';

interface CVPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CVResult | null;
}

export const CVPipelineModal: React.FC<CVPipelineModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const [activeStage, setActiveStage] = useState<number>(4);
  const [inspectCoord, setInspectCoord] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !result) return null;

  const stages = [
    {
      title: '1. Original 2D Drawing',
      desc: 'Input 2D manufacturing engineering drawing or multi-angle snapshot',
      url: result.originalUrl,
      tag: '2D RGB Input',
    },
    {
      title: '2. Grayscale Luminance',
      desc: 'ITU-R BT.601 standard: Y = 0.299R + 0.587G + 0.114B',
      url: result.grayscaleUrl,
      tag: '1-Channel Luma',
    },
    {
      title: '3. Sobel Edge Gradient',
      desc: '3x3 convolution for mechanical contour boundaries and chamfers',
      url: result.sobelEdgeUrl,
      tag: 'Spatial Derivative',
    },
    {
      title: '4. Distance Transform (EDT)',
      desc: '2-pass Euclidean distance field for cylindrical and flange volume extrusion',
      url: result.saliencyUrl,
      tag: 'Morphology',
    },
    {
      title: '5. Estimated Depth Map',
      desc: '2.5D normalized heightfield matrix (0.0 = Base, 1.0 = Peak Step)',
      url: result.depthMapUrl,
      tag: 'Heightfield Z',
    },
    {
      title: '6. Tangent Normal Map',
      desc: 'Surface normals n = normalize(-dZ/dx, -dZ/dy, 1) mapped to RGB',
      url: result.normalMapUrl,
      tag: 'Normal Vector Map',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      data-testid="cv-pipeline-modal"
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Manufacturing Computer Vision Pipeline Inspector
              </h2>
              <p className="text-xs text-slate-400">
                Inspect every tensor transformation, gradient filter, and monocular depth estimation stage.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Pipeline Stages Gallery */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" /> Image Processing & Computer Vision Tensors
              </span>
              <span className="text-xs text-slate-400">Click any stage to enlarge</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stages.map((stage, idx) => {
                const isSelected = activeStage === idx;
                return (
                  <div
                    key={stage.title}
                    onClick={() => setActiveStage(idx)}
                    className={`group cursor-pointer rounded-xl border p-2 bg-slate-950/40 transition-all ${
                      isSelected
                        ? 'border-cyan-400 ring-2 ring-cyan-500/20 shadow-lg'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-black/60 mb-2">
                      <img
                        src={stage.url}
                        alt={stage.title}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute top-1 left-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-cyan-300">
                        {stage.tag}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300 block truncate">
                      {stage.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Stage Detailed Inspector */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-950/80 border border-slate-800 rounded-xl p-5">
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 bg-black/80 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                <img
                  src={stages[activeStage].url}
                  alt={stages[activeStage].title}
                  className="w-full h-full object-contain"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.floor(
                      ((e.clientX - rect.left) / rect.width) * result.stats.width
                    );
                    const y = Math.floor(
                      ((e.clientY - rect.top) / rect.height) * result.stats.height
                    );
                    setInspectCoord({ x, y });
                  }}
                  onMouseLeave={() => setInspectCoord(null)}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-2">
                Hover over image to inspect pixel values
              </span>
            </div>

            <div className="md:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    STAGE {activeStage + 1} OF 6
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {stages[activeStage].title}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mb-4">{stages[activeStage].desc}</p>

                {/* Mathematical Formulation */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg mb-4">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Computer Vision Mathematical Formulation:
                  </span>
                  <code className="text-xs text-emerald-300 font-mono block">
                    Z(x,y) = 0.65 · I(x,y) + 0.25 · √EDT(x,y) + 0.15 · |∇I(x,y)|
                  </code>
                </div>

                {inspectCoord && (
                  <div className="p-3 bg-slate-900/90 border border-cyan-500/30 rounded-lg">
                    <span className="text-[10px] font-mono text-cyan-400 block mb-1">
                      PIXEL INSPECTOR AT ({inspectCoord.x}, {inspectCoord.y}):
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                      <div>
                        Calculated Height (Z):{' '}
                        <span className="text-white font-bold">
                          {result.heightfield[inspectCoord.y]?.[inspectCoord.x]?.toFixed(3) ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        Grid Dimension:{' '}
                        <span className="text-white">
                          {result.stats.width}x{result.stats.height}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Execution Steps Log */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Execution Pipeline Log:
                </span>
                <div className="space-y-1">
                  {result.stats.cvPipelineSteps.map((step, idx) => (
                    <div key={idx} className="text-[11px] text-slate-400 font-mono">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Performance & Mesh Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Processing Latency
              </span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {result.stats.processingTimeMs} ms
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                3D Vertex Count
              </span>
              <span className="text-lg font-bold font-mono text-white">
                {result.stats.vertexCount.toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                3D Triangle Faces
              </span>
              <span className="text-lg font-bold font-mono text-white">
                {result.stats.faceCount.toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Mean Edge Gradient
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {result.stats.gradientMean}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
