import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { getThemeClasses } from '../utils/themeStyles';
import { Server, KeyRound, ArrowRight } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { design, login, playHapticAudio } = useDashboard();
  const theme = getThemeClasses(design);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    playHapticAudio('click');
    const ok = await login(token);
    setBusy(false);
    if (ok) {
      playHapticAudio('beep');
    } else {
      setError('Password rejected — the server did not accept it. Check the password and try again.');
    }
  };

  return (
    <div className={`${theme.wrapper} ${theme.fontFamily} min-h-screen flex items-center justify-center p-4`}>
      <form onSubmit={submit} className={`${theme.modal} w-full max-w-md p-8 space-y-5 border shadow-2xl animate-fadeIn`}>
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-lg bg-current/10">
            <Server size={22} />
          </span>
          <div>
            <h1 className="font-bold text-lg leading-tight">server-dashboard</h1>
            <p className="text-xs opacity-60">One secure control plane for all your apps</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
            <KeyRound size={12} /> Admin password
          </label>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Enter your admin password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-current/20 bg-transparent font-mono text-sm outline-none focus:border-current/50"
          />
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <p className="text-[11px] opacity-50">
            Enter the admin password set on the server. Control APIs stay private — monitoring cards can be shared read-only.
          </p>
        </div>

        <button
          type="submit"
          disabled={!token.trim() || busy}
          className="w-full py-2.5 rounded-md font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-500"
        >
          {busy ? 'Verifying…' : (<>Sign in <ArrowRight size={15} /></>)}
        </button>

      </form>
    </div>
  );
};
