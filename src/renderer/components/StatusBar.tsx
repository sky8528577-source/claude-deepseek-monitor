import { AlertTriangle, X, Info, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function StatusBar() {
  const { error, setError, warning, setWarning } = useStore();

  if (!error && !warning) return null;

  return (
    <div className="flex-shrink-0">
      {error && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:bg-red-500/10 rounded p-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {warning && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{warning}</span>
            {warning.includes('Claude Code') && (
              <button
                onClick={() => window.electronAPI?.openExternal('https://docs.anthropic.com/en/docs/claude-code')}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 flex-shrink-0 transition-colors"
              >
                了解 Claude Code <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <button onClick={() => setWarning(null)} className="hover:bg-amber-500/10 rounded p-0.5 flex-shrink-0 ml-2">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

