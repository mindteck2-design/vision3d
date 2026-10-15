import React from 'react';
import type { ManufacturingProduct, ProductAngleKey } from '../types/index.ts';
import { Layers, Eye, Compass, Info, Check } from 'lucide-react';

interface AngleSnapshotBarProps {
  product: ManufacturingProduct;
  selectedAngle: ProductAngleKey;
  onSelectAngle: (key: ProductAngleKey) => void;
  onOpenBlueprintModal: () => void;
}

export const AngleSnapshotBar: React.FC<AngleSnapshotBarProps> = ({
  product,
  selectedAngle,
  onSelectAngle,
  onOpenBlueprintModal,
}) => {
  const anglesList: ProductAngleKey[] = [
    'blueprint_sheet',
    'front_view',
    'top_view',
    'side_view',
    'iso_cad',
  ];

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 z-20 backdrop-blur select-none">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Product Info Badge */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                {product.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {product.partNumber}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {product.materialType} • {product.specifications.tolerance}
            </span>
          </div>
        </div>

        {/* Multi-Angle Snapshots Selector */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap flex items-center gap-1 mr-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> Angle Snapshots:
          </span>

          {anglesList.map((key) => {
            const angleInfo = product.angles[key];
            if (!angleInfo) return null;
            const isSelected = selectedAngle === key;

            return (
              <button
                key={key}
                onClick={() => onSelectAngle(key)}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition flex-shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={angleInfo.description}
              >
                {/* Thumbnail snapshot */}
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/60 border border-slate-700/60 flex-shrink-0 flex items-center justify-center p-0.5">
                  <img
                    src={angleInfo.dataUrl}
                    alt={angleInfo.label}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-semibold leading-tight flex items-center gap-1">
                    {angleInfo.label}
                    {isSelected && <Check className="w-3 h-3 text-cyan-400 inline" />}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {angleInfo.degrees}
                  </span>
                </div>
              </button>
            );
          })}

          <button
            onClick={onOpenBlueprintModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex-shrink-0"
            title="Inspect full dimensions and drawing details"
          >
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Drawing Specs</span>
          </button>
        </div>
      </div>
    </div>
  );
};
