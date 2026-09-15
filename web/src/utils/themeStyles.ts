import { DesignState } from '../types/dashboard';

export interface ThemeClasses {
  wrapper: string;
  card: string;
  cardHeader: string;
  badgeUp: string;
  badgeDegraded: string;
  badgeDown: string;
  badgeStopped: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonDanger: string;
  input: string;
  accentText: string;
  subtext: string;
  border: string;
  fontFamily: string;
  headerBar: string;
  modal: string;
}

export function getThemeClasses(design: DesignState): ThemeClasses {
  const { material, structure, feeling } = design;

  // BASE BY MATERIAL
  let wrapper = 'min-h-screen transition-colors duration-300 ';
  let card = 'transition-all duration-200 ';
  let cardHeader = '';
  let badgeUp = '';
  let badgeDegraded = '';
  let badgeDown = '';
  let badgeStopped = '';
  let buttonPrimary = 'transition-all duration-150 ';
  let buttonSecondary = 'transition-all duration-150 ';
  let buttonDanger = 'transition-all duration-150 ';
  let input = 'transition-all ';
  let accentText = '';
  let subtext = '';
  let border = '';
  let fontFamily = 'font-sans';
  let headerBar = '';
  let modal = '';

  if (material === 'glass') {
    wrapper += 'bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.12),rgba(255,255,255,0))]';
    card += 'bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-xl shadow-cyan-950/20 hover:border-cyan-500/40 rounded-xl';
    cardHeader = 'border-b border-slate-800/80';
    badgeUp = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    badgeDegraded = 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse';
    badgeDown = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    badgeStopped = 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    buttonPrimary = 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 rounded-lg';
    buttonSecondary = 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-lg';
    buttonDanger = 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg';
    input = 'bg-slate-900/90 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg focus:border-cyan-400 focus:outline-none';
    accentText = 'text-cyan-400';
    subtext = 'text-slate-400';
    border = 'border-slate-800';
    headerBar = 'bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80';
    modal = 'bg-slate-900/95 backdrop-blur-2xl border border-slate-700/70 text-slate-100 shadow-2xl rounded-2xl';
  } else if (material === 'paper') {
    wrapper += 'bg-[#F9F7F1] text-[#1D1D1B] selection:bg-amber-200';
    card += 'bg-[#FFFDF9] border border-[#DDD9CE] shadow-sm hover:shadow-md hover:border-[#B5B09F] rounded-sm';
    cardHeader = 'border-b border-[#E8E4DA] bg-[#F4EFE6]/60';
    badgeUp = 'bg-[#E3EFE6] text-[#1B6A3B] border border-[#B7D8C0] font-mono';
    badgeDegraded = 'bg-[#FFF2D6] text-[#A66200] border border-[#F2D18D] font-mono';
    badgeDown = 'bg-[#FCE3E2] text-[#B01B17] border border-[#EAA7A5] font-mono';
    badgeStopped = 'bg-[#ECEAE2] text-[#636159] border border-[#D5D2C7] font-mono';
    buttonPrimary = 'bg-[#1D1D1B] hover:bg-[#333330] text-[#F9F7F1] font-medium rounded-sm shadow-sm';
    buttonSecondary = 'bg-[#EFECE1] hover:bg-[#E3DFD2] text-[#2C2A26] border border-[#D5D0C2] rounded-sm';
    buttonDanger = 'bg-[#FCE3E2] hover:bg-[#F8CCCC] text-[#A81B17] border border-[#E79F9C] rounded-sm';
    input = 'bg-[#FFFDF9] border border-[#CFC9BA] text-[#1D1D1B] placeholder-[#9E9A8E] rounded-sm focus:border-[#1D1D1B] focus:outline-none';
    accentText = 'text-[#C93B2B]';
    subtext = 'text-[#6F6C64]';
    border = 'border-[#E4E0D5]';
    headerBar = 'bg-[#F4EFE6] border-b border-[#DDD9CE]';
    modal = 'bg-[#FFFDF9] border border-[#CFC9BA] text-[#1D1D1B] shadow-2xl rounded-sm';
  } else if (material === 'terminal') {
    wrapper += 'bg-[#080B08] text-[#33FF55] selection:bg-[#33ff55]/30 font-mono';
    card += 'bg-[#0c120c] border border-[#1b3d1b] shadow-lg shadow-[#33ff55]/5 hover:border-[#33ff55]/60 rounded-none';
    cardHeader = 'border-b border-[#1b3d1b] bg-[#091009]';
    badgeUp = 'bg-[#0d260d] text-[#33ff55] border border-[#33ff55]/50';
    badgeDegraded = 'bg-[#292205] text-[#ffd000] border border-[#ffd000]/50 animate-pulse';
    badgeDown = 'bg-[#290909] text-[#ff4444] border border-[#ff4444]/50';
    badgeStopped = 'bg-[#141b14] text-[#719971] border border-[#719971]/50';
    buttonPrimary = 'bg-[#33ff55] hover:bg-[#20cc3e] text-[#050e05] font-bold rounded-none';
    buttonSecondary = 'bg-[#101d10] hover:bg-[#182d18] text-[#33ff55] border border-[#33ff55]/40 rounded-none';
    buttonDanger = 'bg-[#2b0e0e] hover:bg-[#3d1414] text-[#ff5555] border border-[#ff5555]/50 rounded-none';
    input = 'bg-[#060a06] border border-[#225522] text-[#33ff55] placeholder-[#1e461e] rounded-none focus:border-[#33ff55] focus:outline-none';
    accentText = 'text-[#33ff55]';
    subtext = 'text-[#588e58]';
    border = 'border-[#1b3d1b]';
    headerBar = 'bg-[#060a06] border-b border-[#1b3d1b]';
    modal = 'bg-[#0a0f0a] border-2 border-[#33ff55]/70 text-[#33ff55] rounded-none shadow-2xl';
    fontFamily = 'font-mono';
  } else {
    // industrial panel
    wrapper += 'bg-[#15171C] text-[#E1E4EA] selection:bg-amber-500/30';
    card += 'bg-[#1D2027] border-2 border-[#2C313D] shadow-md hover:border-[#4B5569] rounded-md';
    cardHeader = 'border-b-2 border-[#2C313D] bg-[#171A21]';
    badgeUp = 'bg-[#0F291E] text-[#34D399] border border-[#059669] font-mono tracking-wider';
    badgeDegraded = 'bg-[#32230D] text-[#FBBF24] border border-[#D97706] font-mono tracking-wider animate-pulse';
    badgeDown = 'bg-[#331114] text-[#F87171] border border-[#DC2626] font-mono tracking-wider';
    badgeStopped = 'bg-[#222631] text-[#94A3B8] border border-[#475569] font-mono tracking-wider';
    buttonPrimary = 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-b-2 border-amber-700 active:translate-y-0.5 rounded-md';
    buttonSecondary = 'bg-[#272B35] hover:bg-[#323846] text-[#E1E4EA] border border-[#3E4556] rounded-md';
    buttonDanger = 'bg-[#3F1418] hover:bg-[#521A20] text-[#FCA5A5] border border-[#991B1B] rounded-md';
    input = 'bg-[#111317] border-2 border-[#333845] text-[#E1E4EA] placeholder-[#64748B] rounded-md focus:border-amber-500 focus:outline-none';
    accentText = 'text-amber-400';
    subtext = 'text-[#8C95A8]';
    border = 'border-[#2C313D]';
    headerBar = 'bg-[#181B22] border-b-2 border-[#2C313D]';
    modal = 'bg-[#1A1D24] border-2 border-[#434B5D] text-[#E1E4EA] shadow-2xl rounded-md';
  }

  // STRUCTURE MODIFIERS
  if (structure === 'swiss') {
    card += ' rounded-none';
    fontFamily = 'font-sans tracking-tight';
  } else if (structure === 'brutalist') {
    card += ' border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] rounded-none';
  } else if (structure === 'financial') {
    fontFamily = 'font-mono text-xs';
  } else if (structure === 'japanese minimal') {
    card += ' border-[0.5px] shadow-none rounded-none tracking-wide';
    cardHeader += ' uppercase tracking-widest text-[11px]';
  }

  // FEELING MODIFIERS
  if (feeling === 'tactical') {
    // Add tactical crosshairs or military labels
  } else if (feeling === 'quiet') {
    card += ' transition-opacity hover:opacity-100 opacity-95';
  } else if (feeling === 'precise') {
    // sharp monospaced sub-telemetry
  } else if (feeling === 'playful') {
    card += ' hover:-translate-y-1';
  }

  return {
    wrapper,
    card,
    cardHeader,
    badgeUp,
    badgeDegraded,
    badgeDown,
    badgeStopped,
    buttonPrimary,
    buttonSecondary,
    buttonDanger,
    input,
    accentText,
    subtext,
    border,
    fontFamily,
    headerBar,
    modal,
  };
}
