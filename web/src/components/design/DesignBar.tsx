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
  LogOut,
  Layers,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

const PRESETS: { name: string; desc: string; state: { material: MaterialType; composition: CompositionType; structure: StructureType; feeling: FeelingType } }[] = [
  { name: 'Tactical Industrial Panel', desc: 'Machined slate, dense rack layout, tactical telemetry', state: { material: 'industrial panel', composition: 'dense', structure: 'brutalist', feeling: 'tactical' } },
  { name: 'Swiss Studio Glass', desc: 'Frosted cyan glass, spacious grid, Akzidenz precision', state: { material: 'glass', composition: 'spacious', structure: 'swiss', feeling: 'precise' } },
  { name: 'Tokyo Minimalist Paper', desc: 'Archival washi paper, asymmetric flow, quiet Japanese ma', state: { material: 'paper', composition: 'asymmetric', structure: 'japanese minimal', feeling: 'quiet' } },
  { name: 'CRT Phosphor Terminal', desc: 'Authentic green CRT screen, scanlines, monospace matrix', state: { material: 'terminal', composition: 'dense', structure: 'brutalist', feeling: 'tactical' } },
  { name: 'Bloomberg Financial Monolith', desc: 'Trading desk density, financial order book, micro-latency', state: { material: 'industrial panel', composition: 'dense', structure: 'financial', feeling: 'precise' } },
  { name: 'Archival Broadsheet Editorial', desc: 'Editorial typography, high-contrast narrative stories', state: { material: 'paper', composition: 'editorial', structure: 'swiss', feeling: 'quiet' } },
  { name: 'Playful Cyber Ops', desc: 'Cyberpunk glass, bouncy micro-interactions, tamagotchi ops', state: { material: 'glass', composition: 'asymmetric', structure: 'brutalist', feeling: 'playful' } },
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
    logout,
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

  const currentPreset =
    PRESETS.find(
      (p) =>
        p.state.material === design.material &&
        p.state.composition === design.composition &&
        p.state.structure === design.structure &&
        p.state.feeling === design.feeling
    )?.name || 'custom';

  return (
    <div className="w-full border-b sticky top-0 z-40 transition-colors backdrop-blur-md bg-opacity-95 text-xs">
      {/* Compact top row: preset + matrix toggle + sign out only */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/10 dark:bg-white/10 font-mono font-semibold whitespace-nowrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span className="uppercase tracking-wider text-[11px] hidden sm:inline">System Variant:</span>
          </div>

          <div className="relative inline-block min-w-0">
            <select
              value={currentPreset}
              onChange={(e) => { if (e.target.value !== 'custom') applyPreset(e.target.value); }}
              className="bg-black/15 dark:bg-white/10 hover:bg-black/25 dark:hover:bg-white/20 border border-current/20 rounded px-2 py-1 text-xs font-medium cursor-pointer transition-colors focus:outline-none max-w-[42vw] truncate"
            >
              {currentPreset === 'custom' && (
                <option value="custom" className="bg-slate-900 text-slate-100">
                  Custom
                </option>
              )}
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name} className="bg-slate-900 text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-all font-mono text-[11px] whitespace-nowrap"
            title="Fine-tune material, composition, structure, feeling + display & session"
          >
            <span className="hidden sm:inline">Design Matrix</span>
            <span className="sm:hidden">Matrix</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Sign out only — everything else moved into the matrix panel */}
        <div className="flex items-center gap-1 font-mono text-[11px] opacity-75 flex-shrink-0">
          {isReadOnlyMode && (
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px]">
              RO
            </span>
          )}
          <span className="hidden lg:inline">{authToken ? `${authToken.slice(0, 11)}...` : 'demo mode'}</span>
          <button
            onClick={() => logout()}
            title="Sign out (clears stored token)"
            className="ml-1 px-1.5 py-1 rounded hover:bg-black/20 dark:hover:bg-white/20 font-sans font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Dimensional Matrix Bar */}
      {expanded && (
        <div className="border-t border-current/10 py-3 px-4 max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 animate-fadeIn">
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

          {/* 5. Display & Session */}
          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-60 flex items-center gap-1">
              <Tv className="w-3 h-3" />
              <span>5. Display & Session</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-1">
              <button
                onClick={() => {
                  setDesign((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
                  playHapticAudio('click');
                }}
                className={`px-2 py-1 text-left text-xs rounded transition-all flex items-center gap-1.5 ${
                  design.soundEnabled
                    ? 'font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'hover:bg-current/10 opacity-70'
                }`}
              >
                {design.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                Haptics
              </button>
              <button
                onClick={() => {
                  playHapticAudio('toggle');
                  setDesign((prev) => ({ ...prev, scanlines: !prev.scanlines }));
                }}
                className={`px-2 py-1 text-left text-xs rounded transition-all flex items-center gap-1.5 ${
                  design.scanlines
                    ? 'font-bold bg-amber-500/25 text-amber-500 border border-amber-500/40'
                    : 'hover:bg-current/10 opacity-70'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                CRT scanlines
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className={`px-2 py-1 text-left text-xs rounded transition-all flex items-center gap-1.5 ${
                  isReadOnlyMode
                    ? 'font-bold bg-rose-500/20 text-rose-500 border border-rose-500/40'
                    : 'hover:bg-current/10 opacity-70'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                {isReadOnlyMode ? 'Read-Only Active' : 'Share view'}
              </button>
              <div className="px-2 py-1 text-xs rounded hover:bg-current/10 opacity-70 flex items-center gap-1.5 font-mono">
                <Key className="w-3.5 h-3.5" />
                <span className="truncate">{authToken ? `${authToken.slice(0, 11)}...` : 'demo mode'}</span>
              </div>
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
