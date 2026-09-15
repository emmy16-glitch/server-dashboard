import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import {
  MaterialType,
  CompositionType,
  StructureType,
  FeelingType,
} from '../../types/dashboard';
import {
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Tv,
  Share2,
  Key,
  Layers,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

const PRESETS = [
  { name: 'Tactical Industrial Panel', desc: 'Machined slate, dense rack layout, tactical telemetry' },
  { name: 'Swiss Studio Glass', desc: 'Frosted cyan glass, spacious grid, Akzidenz precision' },
  { name: 'Tokyo Minimalist Paper', desc: 'Archival washi paper, asymmetric flow, quiet Japanese ma' },
  { name: 'CRT Phosphor Terminal', desc: 'Authentic green CRT screen, scanlines, monospace matrix' },
  { name: 'Bloomberg Financial Monolith', desc: 'Trading desk density, financial order book, micro-latency' },
  { name: 'Archival Broadsheet Editorial', desc: 'Editorial typography, high-contrast narrative stories' },
  { name: 'Playful Cyber Ops', desc: 'Cyberpunk glass, bouncy micro-interactions, tamagotchi ops' },
];

export const DesignBar: React.FC = () => {
  const {
    design,
    setDesign,
    setMaterial,
    setComposition,
    setStructure,
    setFeeling,
    applyPreset,
    isReadOnlyMode,
    setIsReadOnlyMode,
    authToken,
    rotateAuthToken,
    playHapticAudio,
  } = useDashboard();

  const [expanded, setExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const materials: MaterialType[] = ['glass', 'paper', 'terminal', 'industrial panel'];
  const compositions: CompositionType[] = ['editorial', 'asymmetric', 'dense', 'spacious'];
  const structures: StructureType[] = ['swiss', 'brutalist', 'financial', 'japanese minimal'];
  const feelings: FeelingType[] = ['tactical', 'quiet', 'precise', 'playful'];

  const copyShareLink = () => {
    playHapticAudio('click');
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=ro_${authToken.slice(-8)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="w-full border-b sticky top-0 z-40 transition-colors backdrop-blur-md bg-opacity-95 text-xs">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Preset Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/10 dark:bg-white/10 font-mono font-semibold">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span className="uppercase tracking-wider text-[11px]">System Variant:</span>
          </div>

          <div className="relative inline-block">
            <select
              value={
                PRESETS.find(
                  (p) =>
                    p.name.toLowerCase().includes(design.material) &&
                    p.name.toLowerCase().includes(design.structure)
                )?.name || 'Custom Combination'
              }
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-black/15 dark:bg-white/10 hover:bg-black/25 dark:hover:bg-white/20 border border-current/20 rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors pr-6 focus:outline-none"
            >
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name} className="bg-slate-900 text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-all font-mono text-[11px]"
            title="Fine-tune material, composition, structure, feeling"
          >
            <span>Design Matrix</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Global Controls & Read-Only Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sound Synthesizer Toggle */}
          <button
            onClick={() => {
              setDesign((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
              playHapticAudio('click');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] transition-colors ${
              design.soundEnabled
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'opacity-50 hover:opacity-80'
            }`}
            title="Synthetic hardware audio haptics (Web Audio API)"
          >
            {design.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Haptics</span>
          </button>

          {/* CRT Scanline Toggle */}
          <button
            onClick={() => {
              playHapticAudio('toggle');
              setDesign((prev) => ({ ...prev, scanlines: !prev.scanlines }));
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] transition-colors ${
              design.scanlines
                ? 'bg-amber-500/25 text-amber-500 border border-amber-500/40'
                : 'opacity-50 hover:opacity-80'
            }`}
            title="CRT Cathode Scanlines simulation"
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CRT</span>
          </button>

          {/* Read-Only Share Link Mode */}
          <button
            onClick={() => setShowShareModal(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-[11px] transition-colors ${
              isReadOnlyMode
                ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20'
            }`}
            title="Read-only share token (?share=ro_...)"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isReadOnlyMode ? 'Read-Only Active' : 'Share View'}</span>
          </button>

          {/* Auth Token Indicator */}
          <div className="flex items-center gap-1 font-mono text-[11px] opacity-75">
            <Key className="w-3 h-3" />
            <span className="hidden md:inline">{authToken.slice(0, 11)}...</span>
          </div>
        </div>
      </div>

      {/* Expanded Dimensional Matrix Bar */}
      {expanded && (
        <div className="border-t border-current/10 py-3 px-4 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
          {/* 1. Material */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-60 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>1. Material (Touch & Finish)</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {materials.map((m) => (
                <button
                  key={m}
                  onClick={() => setMaterial(m)}
                  className={`px-2 py-1 text-left text-xs rounded transition-all capitalize ${
                    design.material === m
                      ? 'font-bold bg-current/20 border border-current/40 shadow-sm'
                      : 'hover:bg-current/10 opacity-70'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Composition */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-60 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>2. Composition (Layout Flow)</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {compositions.map((c) => (
                <button
                  key={c}
                  onClick={() => setComposition(c)}
                  className={`px-2 py-1 text-left text-xs rounded transition-all capitalize ${
                    design.composition === c
                      ? 'font-bold bg-current/20 border border-current/40 shadow-sm'
                      : 'hover:bg-current/10 opacity-70'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Structure */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-60 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              <span>3. Structure (Form Language)</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {structures.map((s) => (
                <button
                  key={s}
                  onClick={() => setStructure(s)}
                  className={`px-2 py-1 text-left text-xs rounded transition-all capitalize ${
                    design.structure === s
                      ? 'font-bold bg-current/20 border border-current/40 shadow-sm'
                      : 'hover:bg-current/10 opacity-70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Feeling */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-60 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>4. Feeling (Atmosphere & Pulse)</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {feelings.map((f) => (
                <button
                  key={f}
                  onClick={() => setFeeling(f)}
                  className={`px-2 py-1 text-left text-xs rounded transition-all capitalize ${
                    design.feeling === f
                      ? 'font-bold bg-current/20 border border-current/40 shadow-sm'
                      : 'hover:bg-current/10 opacity-70'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share / Auth Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-base">Public Read-Only Share & Auth</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-100 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              In accordance with <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300">docs/security.md</code>,
              the monitoring card views can be publicly shared via scoped read-only token. Process control, terminal exec,
              deploy hooks, and AI execution endpoints are strictly locked behind Bearer authentication.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Read-Only Share Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}${window.location.pathname}?share=ro_${authToken.slice(-8)}`}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono text-slate-300"
                />
                <button
                  onClick={copyShareLink}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-3 py-1.5 rounded text-xs whitespace-nowrap"
                >
                  {copiedShare ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="roToggle"
                  checked={isReadOnlyMode}
                  onChange={(e) => setIsReadOnlyMode(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="roToggle" className="cursor-pointer text-slate-300">
                  Simulate Read-Only Mode (Locks buttons)
                </label>
              </div>

              <button
                onClick={rotateAuthToken}
                className="text-amber-400 hover:text-amber-300 font-mono text-[11px] underline"
              >
                Rotate Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
