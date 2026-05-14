import { useState } from 'react';
import { Zap, Key, CheckCircle, XCircle, Loader2, ExternalLink, Wifi, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../store/useStore';

type Step = 'welcome' | 'key' | 'verify' | 'login' | 'proxy' | 'done';

export default function SetupWizard() {
  const [step, setStep] = useState<Step>('welcome');
  const [apiKey, setApiKey] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { setHasApiKey, setBalance, setProxyRunning } = useStore();

  const handleVerifyKey = async () => {
    if (!apiKey.trim()) return;
    setVerifying(true);
    setErrorMsg('');

    try {
      if (window.electronAPI) {
        // Save the key
        await window.electronAPI.setApiKey(apiKey.trim());

        // Test by fetching balance
        const balance = await window.electronAPI.fetchBalance();
        if (balance) {
          setVerified(true);
          setBalance(balance, null);
          setHasApiKey(true);
          setStep('login');
        } else {
          setVerified(false);
          setErrorMsg('无法获取余额信息，请检查 API Key');
        }
      } else {
        // Dev mode - no Electron, skip verification
        setVerified(true);
        setStep('login');
      }
    } catch (err) {
      setVerified(false);
      setErrorMsg(`验证失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleSkip = () => {
    setHasApiKey(true);
    setStep('done');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['welcome', 'key', 'verify', 'login', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step === s
                    ? 'bg-flash text-white'
                    : ['welcome', 'key', 'verify', 'proxy', 'done'].indexOf(step) > i
                    ? 'bg-success/20 text-success'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                {i + 1}
              </div>
              {i < 4 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 'welcome' && (
          <div className="glass-card p-8 text-center animate-in">
            <Zap className="w-12 h-12 text-flash mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">欢迎使用 DeepSeek Monitor</h1>
            <p className="text-sm text-slate-400 mb-6">
              实时监控 DeepSeek API 用量、费用和余额。
              <br />
              通过本地代理拦截实现全量数据采集。
            </p>
            <button
              onClick={() => setStep('key')}
              className="px-6 py-2 bg-flash hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              开始设置
            </button>
          </div>
        )}

        {step === 'key' && (
          <div className="glass-card p-8 animate-in">
            <Key className="w-8 h-8 text-accent mb-4" />
            <h2 className="text-lg font-bold mb-2">配置 API Key</h2>
            <p className="text-xs text-slate-400 mb-4">
              从 DeepSeek 平台获取 API Key，用于余额查询。
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noopener"
                className="text-flash inline-flex items-center gap-1 ml-1"
              >
                获取 Key <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-flash mb-2 font-mono"
              autoFocus
            />
            <p className="text-xs text-slate-600 mb-4">
              API Key 使用系统安全存储加密保存，不会明文落盘。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('welcome')}
                className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                跳过
              </button>
              <button
                onClick={handleVerifyKey}
                disabled={!apiKey.trim() || verifying}
                className="px-4 py-1.5 bg-flash hover:bg-blue-600 disabled:bg-blue-800 disabled:text-slate-400 rounded-lg text-sm font-medium transition-colors ml-auto"
              >
                {verifying ? '验证中...' : '验证 Key'}
              </button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="glass-card p-8 text-center animate-in">
            {verifying ? (
              <>
                <Loader2 className="w-10 h-10 text-flash mx-auto mb-4 animate-spin" />
                <h2 className="text-lg font-bold mb-2">验证 API Key...</h2>
                <p className="text-sm text-slate-400">正在查询账户余额</p>
              </>
            ) : verified === true ? (
              <>
                <CheckCircle className="w-10 h-10 text-success mx-auto mb-4" />
                <h2 className="text-lg font-bold mb-2">验证成功</h2>
                <p className="text-sm text-slate-400 mb-4">API Key 有效，余额信息已加载</p>
                <button
                  onClick={() => setStep('proxy')}
                  className="px-6 py-2 bg-flash hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                >
                  继续
                </button>
              </>
            ) : (
              <>
                <XCircle className="w-10 h-10 text-danger mx-auto mb-4" />
                <h2 className="text-lg font-bold mb-2">验证失败</h2>
                <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setStep('key')}
                    className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    重新输入
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    跳过，稍后配置
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'login' && (
          <div className="glass-card p-8 animate-in">
            <FileSpreadsheet className="w-8 h-8 text-green-400 mb-4" />
            <h2 className="text-lg font-bold mb-2">获取用量数据</h2>
            <p className="text-xs text-slate-400 mb-4">
              需要登录 DeepSeek 平台来拉取费用和 Token 数据。
            </p>
            <button
              onClick={async () => {
                setVerifying(true);
                try {
                  const result = await window.electronAPI?.csvLogin();
                  if (result) {
                    setStep('done');
                  } else {
                    setErrorMsg('登录未完成，可以稍后在设置中重试');
                  }
                } catch {
                  setErrorMsg('操作失败');
                } finally {
                  setVerifying(false);
                }
              }}
              className="w-full px-4 py-3 bg-green-400/20 hover:bg-green-400/30 text-green-400 rounded-lg text-sm font-medium transition-colors mb-3"
            >
              🔐 一键登录 DeepSeek 平台
            </button>
            <button
              onClick={() => setStep('done')}
              className="w-full px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              跳过，稍后在设置中配置
            </button>
            {errorMsg && <p className="text-xs text-danger mt-2">{errorMsg}</p>}
          </div>
        )}

        {step === 'proxy' && (
          <div className="glass-card p-8 animate-in">
            <Wifi className="w-8 h-8 text-success mb-4" />
            <h2 className="text-lg font-bold mb-2">代理配置指引</h2>
            <p className="text-xs text-slate-400 mb-4">
              代理服务器已启动在 <code className="text-flash bg-white/5 px-1.5 py-0.5 rounded">localhost:9090</code>
            </p>
            <div className="space-y-3 text-sm">
              <div className="glass-card p-3">
                <h3 className="text-xs font-medium text-slate-300 mb-1">Claude Code 配置</h3>
                <p className="text-xs text-slate-500 mb-2">
                  设置环境变量指向本地代理：
                </p>
                <code className="block bg-black/30 p-2 rounded text-xs text-slate-300">
                  set DEEPSEEK_BASE_URL=http://localhost:9090
                </code>
              </div>
              <div className="glass-card p-3">
                <h3 className="text-xs font-medium text-slate-300 mb-1">OpenAI SDK 配置</h3>
                <code className="block bg-black/30 p-2 rounded text-xs text-slate-300">
                  {`new OpenAI({
  baseURL: "http://localhost:9090/v1",
  apiKey: "your-deepseek-key"
})`}
                </code>
              </div>
            </div>
            <button
              onClick={() => setStep('done')}
              className="w-full mt-4 px-4 py-2 bg-flash hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              完成设置
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="glass-card p-8 text-center animate-in">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">设置完成</h1>
            <p className="text-sm text-slate-400 mb-6">
              代理服务器已在 localhost:9090 运行。
              <br />
              请将 API 请求指向本地代理以开始监控。
            </p>
            <button
              onClick={() => setHasApiKey(true)}
              className="px-6 py-2 bg-flash hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              进入仪表板
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
