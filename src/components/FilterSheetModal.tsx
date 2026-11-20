import React from 'react';
import { TRANSLATIONS } from '../data/seedData';
import type { FilterState, Language } from '../types/sahiroomie';
import { formatINR } from '../utils/compatibility';
import { Icon } from './Icon';

interface FilterSheetModalProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  applyRentPreset: (preset: string) => void;
  resultsCount: number;
  onClose: () => void;
  lang: Language;
}

export const FilterSheetModal: React.FC<FilterSheetModalProps> = ({
  filters,
  setFilters,
  applyRentPreset,
  resultsCount,
  onClose,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const minPct = ((filters.minRent - 1000) / (35000 - 1000)) * 100;
  const maxPct = ((filters.maxRent - 1000) / (35000 - 1000)) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
      <div className="w-full max-w-lg max-h-[88%] rounded-t-2xl flex flex-col modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-base font-extrabold">{t.filters}</h3>
          <button type="button" onClick={onClose} aria-label="Close filters" className="w-10 h-10 rounded-full flex items-center justify-center">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold">{t.rentRange}</label>
              <span className="text-xs font-extrabold text-[#4F46E5] font-mono-num">
                {formatINR(filters.minRent)} – {filters.maxRent >= 35000 ? '₹30,000+' : formatINR(filters.maxRent)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Any',
                'Under ₹3,000',
                '₹3,000–5,000',
                '₹5,000–7,000',
                '₹7,000–10,000',
                '₹10,000–15,000',
                '₹15,000–30,000',
                '₹30,000+',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyRentPreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                    filters.rentPreset === preset ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                  }`}
                  style={filters.rentPreset !== preset ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="relative h-6 flex items-center">
              <div className="h-1.5 rounded-full w-full relative" style={{ backgroundColor: 'var(--border)' }}>
                <div
                  className="absolute top-0 h-1.5 rounded-full bg-[#4F46E5]"
                  style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
                />
              </div>
              <input
                type="range"
                min={1000}
                max={35000}
                step={500}
                aria-label="Minimum monthly rent"
                value={filters.minRent}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value), filters.maxRent - 1000);
                  setFilters((f) => ({ ...f, rentPreset: 'Custom', minRent: v }));
                }}
                style={{ zIndex: filters.minRent > 30000 ? 4 : 3 }}
                className="dual-range-input"
              />
              <input
                type="range"
                min={1000}
                max={35000}
                step={500}
                aria-label="Maximum monthly rent"
                value={filters.maxRent}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value), filters.minRent + 1000);
                  setFilters((f) => ({ ...f, rentPreset: 'Custom', maxRent: v }));
                }}
                style={{ zIndex: 3 }}
                className="dual-range-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold">{t.genderPref}</label>
            <div className="flex flex-wrap gap-1.5">
              {['Any', 'Male', 'Female', 'Other', 'Matches my profile'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, gender: g }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    filters.gender === g
                      ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#4F46E5] dark:border-[#4F46E5]'
                      : ''
                  }`}
                  style={filters.gender !== g ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold">{t.listingType}</label>
            <div className="flex flex-wrap gap-1.5">
              {['Any', 'Roommate', 'PG', 'Flat', 'Room in a flat'].map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, type: tp }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    filters.type === tp ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                  }`}
                  style={filters.type !== tp ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {tp}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, hygieneImportant: !f.hygieneImportant }))}
            className="w-full p-3.5 rounded-2xl border flex items-center justify-between text-left"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div>
              <div className="text-xs font-extrabold">{t.hygieneToggle}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {t.hygieneDesc}
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 ${
                filters.hygieneImportant ? 'bg-[#059669] text-white' : 'bg-gray-300/40'
              }`}
            >
              {filters.hygieneImportant ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="space-y-2">
            <label className="text-xs font-extrabold">Compatibility & Lifestyle</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, diet: f.diet === 'Veg' ? 'Any' : 'Veg' }))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  filters.diet === 'Veg' ? 'bg-[#059669] text-white border-[#059669]' : ''
                }`}
                style={filters.diet !== 'Veg' ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
              >
                Veg friendly
              </button>
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, smoking: f.smoking === 'No smoking' ? 'Any' : 'No smoking' }))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  filters.smoking === 'No smoking' ? 'bg-[#059669] text-white border-[#059669]' : ''
                }`}
                style={filters.smoking !== 'No smoking' ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
              >
                Non-smoker
              </button>
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, wfh: !f.wfh }))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  filters.wfh ? 'bg-[#059669] text-white border-[#059669]' : ''
                }`}
                style={!filters.wfh ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
              >
                WFH setup
              </button>
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, coupleFriendly: !f.coupleFriendly }))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  filters.coupleFriendly ? 'bg-[#059669] text-white border-[#059669]' : ''
                }`}
                style={!filters.coupleFriendly ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
              >
                Couple-friendly
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm"
          >
            {t.applyFilters} ({resultsCount})
          </button>
        </div>
      </div>
    </div>
  );
};
