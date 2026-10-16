import React from 'react';
import type { ProcessOptions, MaterialPreset } from '../types/index.ts';
import { Download } from 'lucide-react';

interface ControlDockProps {
  options: ProcessOptions;
  onChangeOptions: (updated: Partial<ProcessOptions>) => void;
  onExport: (format: 'stl' | 'obj' | 'ply' | 'depth_png') => void;
  isProcessing?: boolean;
}

const MATERIALS: { id: MaterialPreset; label: string }[] = [
  { id: 'cnc_aluminum', label: 'Aluminum' },
  { id: 'machined_steel', label: 'Steel' },
  { id: 'cast_iron', label: 'Iron' },
  { id: 'brass_bronze', label: 'Brass' },
];

/** Minimal bottom bar: material + export only */
export const ControlDock: React.FC<ControlDockProps> = ({
  options,
  onChangeOptions,
  onExport,
  isProcessing = false,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur">
      <select
        value={options.materialPreset}
        onChange={(e) =>
          onChangeOptions({ materialPreset: e.target.value as MaterialPreset })
        }
        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
        title="Material"
      >
        {MATERIALS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={isProcessing}
        onClick={() => onExport('stl')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5" />
        Export STL
      </button>
    </div>
  );
};
