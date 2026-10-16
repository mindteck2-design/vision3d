import React, { useEffect } from 'react';
import type { ManufacturingProduct } from '../types/index.ts';
import { X, FileText, CheckCircle, Ruler } from 'lucide-react';

interface BlueprintSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ManufacturingProduct;
}

export const BlueprintSpecsModal: React.FC<BlueprintSpecsModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { specifications } = product;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      data-testid="blueprint-specs-modal"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Manufacturing Blueprint & GD&T Specifications
              </h2>
              <p className="text-xs text-slate-400">
                {product.name} • Part #{product.partNumber}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blueprint Preview */}
            <div className="bg-black/60 rounded-xl border border-slate-800 p-2 overflow-hidden flex items-center justify-center">
              <img
                src={
                  product.angles.blueprint_sheet?.dataUrl ||
                  product.angles.front_view?.dataUrl ||
                  ''
                }
                alt="Technical Drawing"
                className="w-full h-auto object-contain max-h-80"
              />
            </div>

            {/* Specifications Table */}
            <div className="flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-cyan-400" /> Dimension Specifications (All Angles)
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Outer Diameter (Ø):</span>
                    <span className="text-white font-bold">{specifications.outerDiameterMm}.00 mm</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Center Bore (Ø):</span>
                    <span className="text-cyan-400 font-bold">{specifications.boreDiameterMm}.00 mm</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Overall Height (Z):</span>
                    <span className="text-emerald-400 font-bold">{specifications.totalHeightMm}.00 mm</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Flange Thickness:</span>
                    <span className="text-white font-bold">{specifications.flangeThicknessMm}.00 mm</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Bolt Pattern (PCD):</span>
                    <span className="text-amber-400 font-bold">{specifications.boltPattern}</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">General Tolerance:</span>
                    <span className="text-slate-200 font-bold">{specifications.tolerance}</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Surface Finish:</span>
                    <span className="text-slate-200 font-bold">{specifications.surfaceFinish}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-[11px] font-bold text-slate-300 block mb-1">
                  Material Specification:
                </span>
                <span className="text-xs text-slate-400 block mb-2">{product.materialType}</span>
                <span className="text-[11px] text-slate-500 block">
                  {product.description}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
