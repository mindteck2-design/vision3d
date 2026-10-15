import React, { useState, useEffect } from 'react';
import type { ProcessOptions, MaterialPreset, MeshMode } from '../types/index.ts';
import {
  Sliders,
  Sparkles,
  Download,
  ChevronDown,
  ChevronUp,
  Layers,
  Box,
  Palette,
  FileCode,
  Check,
} from 'lucide-react';

interface ControlDockProps {
  options: ProcessOptions;
  onChangeOptions: (updated: Partial<ProcessOptions>) => void;
  onExport: (format: 'stl' | 'obj' | 'ply' | 'depth_png') => void;
  onOpenCVLab: () => void;
  isProcessing?: boolean;
}

const MATERIAL_SWATCHES: { id: MaterialPreset; label: string; color: string; border: string }[] = [
  { id: 'cnc_aluminum', label: 'CNC Aluminum', color: '#d8e1ea', border: '#f1f5f9' },
  { id: 'machined_steel', label: 'Machined Steel', color: '#94a3b8', border: '#cbd5e1' },
  { id: 'cast_iron', label: 'Cast Iron', color: '#334155', border: '#475569' },
  { id: 'brass_bronze', label: 'Brass / Bronze', color: '#df9e38', border: '#f59e0b' },
  { id: 'blueprint_texture', label: 'Blueprint Texture', color: '#2563eb', border: '#60a5fa' },
  { id: 'cad_hologram', label: 'CAD Hologram', color: '#06b6d4', border: '#22d3ee' },
];

const MESH_MODES: { id: MeshMode; label: string; desc: string }[] = [
  { id: 'solid_cad', label: 'Solid CAD Block', desc: 'Watertight solid mesh' },
  { id: 'hollow_bore', label: 'Hollow Center Bore', desc: 'Inner shaft cavity' },
  { id: 'stepped_relief', label: 'Stepped Relief', desc: 'Surface stepped profile' },
  { id: 'point_cloud', label: 'CAD Point Cloud', desc: '3D coordinate cloud' },
];

export const ControlDock: React.FC<ControlDockProps> = ({
  options,
  onChangeOptions,
  onExport,
  onOpenCVLab,
  isProcessing = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'sculpt' | 'material' | 'export'>('sculpt');
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExportClick = (format: 'stl' | 'obj' | 'ply' | 'depth_png') => {
    onExport(format);
    setExportSuccess(format.toUpperCase());
    setTimeout(() => setExportSuccess(null), 2500);
  };

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-full transition-all duration-300 ease-out pointer-events-auto ${
        isCollapsed ? 'translate-y-[calc(100%+8px)]' : 'translate-y-0'
      }`}
      style={{ maxWidth: 'min(960px, 95vw)' }}
    >
      <div className="flex justify-center mb-1.5">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 px-4 py-1 rounded-full bg-slate-900/95 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 shadow-xl transition-all"
          title="Toggle Control Dock (Press 'H')"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Show Controls</span>
              <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400">
                H
              </kbd>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Hide Controls</span>
              <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400">
                H
              </kbd>
            </>
          )}
        </button>
      </div>

      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('sculpt')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'sculpt'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">3D </span>Geometry</span>
            </button>

            <button
              onClick={() => setActiveTab('material')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'material'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">Machined </span>Finishes</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'export'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export<span className="hidden sm:inline"> STL & OBJ</span></span>
            </button>
          </div>

          <button
            onClick={onOpenCVLab}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-medium transition"
            title="Inspect Sobel gradients, distance transform, and depth map steps"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>CV Pipeline Inspector</span>
          </button>
        </div>

        {activeTab === 'sculpt' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                CAD Geometry Mode
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MESH_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => onChangeOptions({ meshMode: mode.id })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left ${
                      options.meshMode === mode.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-1.5 bg-slate-950/40 p-2 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-cyan-400" /> Height Extrusion (Z)
                </span>
                <span className="font-mono text-cyan-300 font-bold">
                  {options.depthScale.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={3.0}
                step={0.05}
                value={options.depthScale}
                onChange={(e) => onChangeOptions({ depthScale: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.3x Profile</span>
                <span>1.4x Nominal</span>
                <span>3.0x Deep</span>
              </div>
            </div>

            <div className="md:col-span-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Base Plate:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={15}
                    step={1}
                    value={options.baseThickness}
                    onChange={(e) => onChangeOptions({ baseThickness: parseInt(e.target.value) })}
                    className="w-20 accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-xs text-cyan-300 w-8 text-right">
                    {options.baseThickness}mm
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Invert Surface:</span>
                <button
                  onClick={() => onChangeOptions({ invertDepth: !options.invertDepth })}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition ${
                    options.invertDepth
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {options.invertDepth ? 'Negative Mold' : 'Positive Boss'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'material' && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Manufacturing Material & Metal Finish
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {MATERIAL_SWATCHES.map((swatch) => {
                const isSelected = options.materialPreset === swatch.id;
                return (
                  <button
                    key={swatch.id}
                    onClick={() => onChangeOptions({ materialPreset: swatch.id })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-400 text-white shadow-md'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full shadow-inner flex-shrink-0"
                      style={{
                        backgroundColor: swatch.color,
                        boxShadow: `0 0 6px ${swatch.border}55`,
                      }}
                    />
                    <span className="truncate">{swatch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">3D CAD File Export</span>
              <span className="text-[11px] text-slate-400">
                Ready for CNC CAM milling, 3D printing (Cura/PrusaSlicer), Blender, SolidWorks, and Fusion 360.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExportClick('stl')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition"
                title="Download 3D printable watertight STL file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>STL (3D Print / CNC)</span>
              </button>

              <button
                onClick={() => handleExportClick('obj')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition"
                title="Download Wavefront OBJ 3D model"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Wavefront OBJ</span>
              </button>

              <button
                onClick={() => handleExportClick('ply')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition"
                title="Download PLY Point / Mesh with normals"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>PLY Mesh</span>
              </button>

              <button
                onClick={() => handleExportClick('depth_png')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition"
                title="Download 2.5D Displacement Depth Map PNG"
              >
                <span>Depth Map PNG</span>
              </button>
            </div>

            {exportSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                <Check className="w-3.5 h-3.5" /> Exported {exportSuccess}!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
