import React, { useRef } from 'react';
import { MANUFACTURING_PRODUCTS } from '../data/products.ts';
import type { ManufacturingProduct } from '../types/index.ts';
import {
  Upload,
  Box,
  Sparkles,
  Server,
  ChevronDown,
} from 'lucide-react';

interface HeaderBarProps {
  currentProduct: ManufacturingProduct;
  onSelectProduct: (product: ManufacturingProduct) => void;
  onUploadImage: (dataUrl: string, filename: string) => void;
  useBackend: boolean;
  onToggleBackend: (use: boolean) => void;
  serverStatus: 'online' | 'offline' | 'checking';
  onOpenCVLab: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentProduct,
  onSelectProduct,
  onUploadImage,
  useBackend,
  onToggleBackend,
  serverStatus,
  onOpenCVLab,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <header className="h-16 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 z-20 backdrop-blur select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 font-black">
          <Box className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-tight">Vision3D</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              MANUFACTURING CAD
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            2D Multi-Angle Blueprints & Snapshots to 3D CAD Meshes
          </p>
        </div>
      </div>

      {/* Product Selector */}
      <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
        <span className="text-[11px] font-semibold text-slate-400 px-2 hidden md:inline">
          Product:
        </span>
        <select
          value={currentProduct.id}
          onChange={(e) => {
            const found = MANUFACTURING_PRODUCTS.find((p) => p.id === e.target.value);
            if (found) onSelectProduct(found);
          }}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer max-w-[140px] sm:max-w-xs truncate"
        >
          {MANUFACTURING_PRODUCTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold shadow transition"
          title="Upload custom manufacturing drawing or photo"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Upload 2D</span>
        </button>

        {/* Backend Node.js CV Engine Toggle */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] text-slate-300">Backend:</span>
          <button
            onClick={() => onToggleBackend(!useBackend)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              useBackend
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
            title="Toggle Node.js Server vs Fast Client Web Worker"
          >
            {useBackend ? 'Node.js CV' : 'Client Worker'}
          </button>
        </div>

        {/* CV Pipeline Button */}
        <button
          onClick={onOpenCVLab}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CV Tensors</span>
        </button>
      </div>
    </header>
  );
};
