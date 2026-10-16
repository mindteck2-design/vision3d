import React, { useRef } from 'react';
import { MANUFACTURING_PRODUCTS } from '../data/products.ts';
import type { ManufacturingProduct } from '../types/index.ts';
import { Upload, Box, Download, FileImage } from 'lucide-react';

interface HeaderBarProps {
  currentProduct: ManufacturingProduct;
  onSelectProduct: (product: ManufacturingProduct) => void;
  onUploadImage: (dataUrl: string, filename: string) => void;
  onExportStl: () => void;
  mainTab: '3d' | 'drawing';
  onMainTab: (tab: '3d' | 'drawing') => void;
  isProcessing?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentProduct,
  onSelectProduct,
  onUploadImage,
  onExportStl,
  mainTab,
  onMainTab,
  isProcessing = false,
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

  const isCustom = currentProduct.id.startsWith('custom_');

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
      active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
    }`;

  return (
    <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3 z-20 select-none">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center">
          <Box className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-sm font-bold text-white hidden sm:block">Vision3D</h1>
      </div>

      <select
        value={isCustom ? '__upload__' : currentProduct.id}
        onChange={(e) => {
          if (e.target.value === '__upload__') return;
          const found = MANUFACTURING_PRODUCTS.find((p) => p.id === e.target.value);
          if (found) onSelectProduct(found);
        }}
        className="min-w-0 max-w-xs flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-cyan-500 cursor-pointer truncate"
      >
        {isCustom && <option value="__upload__">{currentProduct.name} (uploaded)</option>}
        {MANUFACTURING_PRODUCTS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-950 border border-slate-800 flex-shrink-0">
        <button type="button" onClick={() => onMainTab('3d')} className={tabClass(mainTab === '3d')}>
          <Box className="w-3.5 h-3.5" />
          3D
        </button>
        <button
          type="button"
          onClick={() => onMainTab('drawing')}
          className={tabClass(mainTab === 'drawing')}
        >
          <FileImage className="w-3.5 h-3.5" />
          {isCustom ? 'Uploaded file' : 'Drawing'}
        </button>
      </div>

      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.svg,.pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        <button
          type="button"
          onClick={onExportStl}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold transition disabled:opacity-50"
          title="Download STL"
        >
          <Download className="w-3.5 h-3.5" />
          STL
        </button>
      </div>
    </header>
  );
};
