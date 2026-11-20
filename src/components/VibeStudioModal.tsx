import React from 'react';
import { GENZ_VIBE_TAGS } from '../data/seedData';
import type { FinderGenZ } from '../types/sahiroomie';
import { Icon } from './Icon';

interface VibeStudioModalProps {
  finderGenZ: FinderGenZ;
  setFinderGenZ: React.Dispatch<React.SetStateAction<FinderGenZ>>;
  onSave: () => void;
  onClose: () => void;
}

export const VibeStudioModal: React.FC<VibeStudioModalProps> = ({
  finderGenZ,
  setFinderGenZ,
  onSave,
  onClose,
}) => {
  const toggleTag = (tag: string) => {
    setFinderGenZ((prev) => {
      const exists = prev.vibeTags.includes(tag);
      return {
        ...prev,
        vibeTags: exists ? prev.vibeTags.filter((x) => x !== tag) : [...prev.vibeTags, tag],
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
      <div className="w-full max-w-lg max-h-[88%] rounded-t-2xl flex flex-col modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-base font-extrabold flex items-center gap-1.5">
              <Icon name="sparkles" size={16} className="text-[#4F46E5]" /> Gen-Z Roommate AI Vibe Setup
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Scores every listing against your real daily expectations
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close AI vibe setup" className="w-10 h-10 rounded-full flex items-center justify-center">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold">Sleep & Hustle Rhythm</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Early Bird', 'Night Owl', 'Flexible'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFinderGenZ((p) => ({ ...p, sleepVibe: opt }))}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold ${
                    finderGenZ.sleepVibe === opt ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                  }`}
                  style={finderGenZ.sleepVibe !== opt ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold">Social Battery & Hangout Energy</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Introvert', 'Ambivert', 'Extrovert'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFinderGenZ((p) => ({ ...p, socialBattery: opt }))}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold ${
                    finderGenZ.socialBattery === opt
                      ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#4F46E5] dark:border-[#4F46E5]'
                      : ''
                  }`}
                  style={finderGenZ.socialBattery !== opt ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold">Cleanliness & Room Aesthetics</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Pinterest Clean', 'Organized Chaos'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFinderGenZ((p) => ({ ...p, cleanlinessVibe: opt }))}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold ${
                    finderGenZ.cleanlinessVibe === opt ? 'bg-[#059669] text-white border-[#059669]' : ''
                  }`}
                  style={finderGenZ.cleanlinessVibe !== opt ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold">Gen-Z Non-Negotiables & Vibe Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {GENZ_VIBE_TAGS.map((tag) => {
                const selected = finderGenZ.vibeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                      selected ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                    }`}
                    style={!selected ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                  >
                    {selected ? '✓ ' : '+ '}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold">What do you expect from your Sahiroomie?</label>
            <textarea
              rows={3}
              value={finderGenZ.customExpectation}
              onChange={(e) => setFinderGenZ((p) => ({ ...p, customExpectation: e.target.value }))}
              placeholder="e.g., Need someone chill who splits Zepto/Blinkit on Splitwise, uses earphones after 11 PM..."
              className="w-full p-3 rounded-2xl border text-xs leading-relaxed outline-none focus:border-[#4F46E5]"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onSave}
            className="w-full h-12 rounded-full bg-[#4F46E5] text-white font-bold text-sm"
          >
            Save & Recalculate AI Matches
          </button>
        </div>
      </div>
    </div>
  );
};
