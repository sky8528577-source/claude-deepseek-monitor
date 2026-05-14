import { useState, useEffect } from 'react';
import { X, Key, Trash2, AlertTriangle, FileSpreadsheet, FolderSearch } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupResult, setCleanupResult] = useState<number | null>(null);
  const [cookie, setCookie] = useState('');
  const [cookieSaved, setCookieSaved] = useState(false);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [ccDir, setCcDir] = useState('');
  const [ccSearching, setCcSearching] = useState(false);

  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.getConfig().then((config) => {
        if (config?.balance?.api_key) {
          setApiKey(config.balance.api_key);
        }
        if ((config as Record<string, unknown>).platform_cookie) {
          setCookie((config as Record<string, unknown>).platform_cookie as string);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = async () => {
    if (window.electronAPI && apiKey.trim()) {
      await window.electronAPI.setApiKey(apiKey.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleSaveCookie = async () => {
    if (window.electronAPI && cookie.trim()) {
      await window.electronAPI.csvSetCookie(cookie.trim());
      setCookieSaved(true);
      setTimeout(() => setCookieSaved(false), 2000);
    }
  };

  const handleCsvFetch = async () => {
    setCsvStatus('fetching');
    try {
      const count = await window.electronAPI?.csvFetch();
      if (count === -1) setCsvStatus('请先填入平台 Cookie');
      else if (count === 0) setCsvStatus('未获取到新数据（Cookie 可能过期）');
      else setCsvStatus(`成功导入 ${count} 条记录`);
    } catch {
      setCsvStatus('请求失败');
    }
    setTimeout(() => setCsvStatus(null), 5000);
  };

  const handleCleanup = async () => {
    if (window.electronAPI) {
      const count = await window.electronAPI.cleanupRecords(cleanupDays);
      setCleanupResult(count);
      setTimeout(() => setCleanupResult(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[480px] max-h-[80vh] glass-card overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-sm font-semibold">设置</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* API Key */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium">API Key</h3>
            </div>
            <div className="flex gap-2">
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-xxxxxxxxxxxxxxxx" className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-flash font-mono" />
              <button onClick={handleSaveKey} disabled={!apiKey.trim()} className="px-3 py-1.5 bg-flash hover:bg-blue-600 disabled:bg-blue-800 disabled:text-slate-400 rounded-lg text-xs font-medium transition-colors">
                {saved ? '已保存' : '保存'}
              </button>
            </div>
          </section>

          {/* CC 数据目录 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FolderSearch className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-medium">Claude Code 数据目录</h3>
            </div>
            <p className="text-xs text-slate-400 mb-2">实时请求流需要读取 CC 对话日志。自动检测或手动指定路径。</p>
            <div className="flex gap-2 mb-1">
              <input type="text" value={ccDir} onChange={(e) => setCcDir(e.target.value)} placeholder="~/.claude/projects" className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-purple-400 font-mono" />
              <button onClick={async () => { setCcSearching(true); const found = await window.electronAPI?.findCCDir(); if (found) { setCcDir(found); await window.electronAPI?.setCCDir(found); } setCcSearching(false); }} disabled={ccSearching} className="px-3 py-1.5 bg-purple-400/20 hover:bg-purple-400/30 text-purple-400 rounded text-xs transition-colors whitespace-nowrap">{ccSearching ? '搜索中' : '自动搜索'}</button>
            </div>
            <p className="text-xs text-slate-500">默认：C:\Users\用户名\.claude\projects</p>
          </section>

          {/* 用量数据 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium">用量数据同步</h3>
              <span className="text-[10px] text-slate-500 ml-auto">每60秒自动拉取</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              从 DeepSeek 官方 API 自动拉取用量数据（费用 + Token），每 60 秒更新。
            </p>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  setCsvStatus('opening');
                  try {
                    const result = await window.electronAPI?.csvLogin();
                    if (result) {
                      setCsvStatus('登录成功，Cookie 已自动保存');
                      setCookie(result.substring(0, 50) + '...');
                    } else {
                      setCsvStatus('登录取消或超时');
                    }
                  } catch {
                    setCsvStatus('操作失败');
                  }
                  setTimeout(() => setCsvStatus(null), 5000);
                }}
                className="w-full px-3 py-2 bg-green-400/20 hover:bg-green-400/30 text-green-400 rounded text-sm font-medium transition-colors"
              >
                🔐 一键登录（自动获取 Cookie）
              </button>

              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="border-t border-white/10 flex-1" />
                <span>或手动粘贴</span>
                <span className="border-t border-white/10 flex-1" />
              </div>

              <input type="text" value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="粘贴 platform.deepseek.com 的 Cookie..." className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-green-400 font-mono" />
              <div className="flex gap-2">
                <button onClick={handleSaveCookie} disabled={!cookie.trim()} className="px-3 py-1.5 bg-green-400/20 hover:bg-green-400/30 text-green-400 rounded text-xs transition-colors disabled:opacity-50">
                  {cookieSaved ? '已保存' : '保存 Cookie'}
                </button>
                <button onClick={handleCsvFetch} className="px-3 py-1.5 bg-green-400/20 hover:bg-green-400/30 text-green-400 rounded text-xs transition-colors">
                  手动拉取
                </button>
              </div>
              {csvStatus && <p className={`text-xs ${csvStatus.includes('成功') ? 'text-success' : 'text-accent'}`}>{csvStatus}</p>}
              <p className="text-xs text-slate-500">
                获取 Cookie：浏览器登录 platform.deepseek.com → F12 → Application → Cookies → 全选复制
              </p>
            </div>
          </section>

          {/* Balance Alert */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium">余额预警</h3>
            </div>
            <p className="text-xs text-slate-400">余额低于 ¥10 时通过桌面通知提醒充值</p>
          </section>

          {/* Data Cleanup */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-4 h-4 text-danger" />
              <h3 className="text-sm font-medium">数据清理</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">清理</span>
              <input type="number" value={cleanupDays} onChange={(e) => setCleanupDays(Number(e.target.value))} className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white text-center outline-none" min={1} />
              <span className="text-xs text-slate-400">天前的详细记录</span>
              <button onClick={handleCleanup} className="px-2 py-1 bg-danger/20 hover:bg-danger/30 text-danger rounded text-xs transition-colors ml-auto">执行清理</button>
            </div>
            {cleanupResult !== null && <p className="text-xs text-success mt-1">已清理 {cleanupResult} 条记录</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
