import React, { useState, useEffect } from 'react';
import { 
  getApiDiagnostics, 
  setApiBaseUrl, 
  testBackendConnection, 
  ApiDiagnosticsInfo,
  DEFAULT_PRODUCTION_BACKEND_URL 
} from '../services/api';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  Globe, 
  Cpu, 
  Radio, 
  Trash2,
  ExternalLink
} from 'lucide-react';

interface NetworkDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkDiagnosticModal: React.FC<NetworkDiagnosticModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [diag, setDiag] = useState<ApiDiagnosticsInfo>(getApiDiagnostics());
  const [testing, setTesting] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    latencyMs: number;
    statusCode: number;
    targetUrl: string;
    data?: any;
    error?: string;
    isSleepingWakeup?: boolean;
  } | null>(null);
  const [customInput, setCustomInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const runPing = async (urlOverride?: string) => {
    setTesting(true);
    setPingResult(null);
    try {
      const res = await testBackendConnection(urlOverride);
      setPingResult(res);
    } finally {
      setTesting(false);
      setDiag(getApiDiagnostics());
    }
  };

  useEffect(() => {
    if (isOpen) {
      const currentDiag = getApiDiagnostics();
      setDiag(currentDiag);
      setCustomInput(currentDiag.storedOverride || currentDiag.resolvedBaseUrl || '');
      runPing();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCustom = (urlToSet: string) => {
    setApiBaseUrl(urlToSet);
    setDiag(getApiDiagnostics());
    runPing(urlToSet);
  };

  const handleReset = () => {
    setApiBaseUrl('');
    setDiag(getApiDiagnostics());
    runPing();
  };

  const handleCopyReport = () => {
    const report = [
      `=== ScoreMate API 诊断报告 ===`,
      `时间: ${new Date().toLocaleString()}`,
      `当前网页 URL: ${window.location.href}`,
      `构建环境变量 (VITE_API_URL): ${diag.viteEnvValue || '(未注入/空)'}`,
      `本地存储覆盖 (localStorage): ${diag.storedOverride || '(无)'}`,
      `URL 查询参数: ${diag.queryParam || '(无)'}`,
      `最终生效 API 地址: ${diag.resolvedBaseUrl || '(同源)'}`,
      `解析来源: ${diag.source}`,
      `解析原因: ${diag.reason}`,
      `连通性测试: ${pingResult ? (pingResult.ok ? `正常 (延迟 ${pingResult.latencyMs}ms)` : `失败 (${pingResult.error})`) : '未完成'}`,
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border-3 border-black rounded-3xl p-5 shadow-brutal-lg max-h-[90vh] overflow-y-auto space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#4D96FF] border-2 border-black shadow-brutal-sm text-white">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-black text-black">网络与 API 连通性排查</h2>
              <p className="text-[11px] text-neutral-500 font-bold">查看环境变量是否注入与后端在线状态</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-black bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all text-black cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Real-time Status Card */}
        <div className={`p-4 rounded-2xl border-2 border-black shadow-brutal-sm transition-all ${
          testing 
            ? 'bg-neutral-100' 
            : pingResult?.ok 
              ? 'bg-[#A8E6CF]' 
              : 'bg-[#FFD3B6]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {testing ? (
                <RefreshCw className="w-5 h-5 text-neutral-600 animate-spin" />
              ) : pingResult?.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700 stroke-[2.5]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-700 stroke-[2.5]" />
              )}
              <span className="text-sm font-black text-black">
                {testing 
                  ? '正在测试后端连接中...' 
                  : pingResult?.ok 
                    ? `后端服务正常在线 (${pingResult.latencyMs}ms)` 
                    : '后端连接未通 / 唤醒中'}
              </span>
            </div>
            <button
              onClick={() => runPing()}
              disabled={testing}
              className="px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border border-black shadow-brutal-xs hover:bg-neutral-800 active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
              <span>重新检测</span>
            </button>
          </div>

          {!testing && pingResult && !pingResult.ok && (
            <div className="mt-2 pt-2 border-t border-black/20 text-xs font-bold text-neutral-800 space-y-1">
              <p className="text-red-700">❌ 错误详情: {pingResult.error}</p>
              {pingResult.isSleepingWakeup && (
                <p className="text-amber-800 bg-amber-100 p-2 rounded-lg border border-amber-300 text-[11px]">
                  💡 提示：Render 免费服务器闲置后会自动休眠，首次访问需要 20-30 秒唤醒，请稍等片刻再次点击检测。
                </p>
              )}
            </div>
          )}
        </div>

        {/* Diagnostic Metadata Table */}
        <div className="space-y-2 text-xs">
          <div className="font-black text-neutral-700 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>环境变量与路由解析详情:</span>
          </div>

          <div className="bg-neutral-50 rounded-2xl border-2 border-black p-3.5 space-y-2.5 font-medium">
            {/* 1. VITE_API_URL */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-neutral-500 font-bold shrink-0">1. 构建环境变量 VITE_API_URL:</span>
              <span className="font-mono font-black text-right break-all text-black">
                {diag.viteEnvValue ? (
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                    ✅ {diag.viteEnvValue}
                  </span>
                ) : (
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                    ⚠️ 未注入 (未在打包时读取到)
                  </span>
                )}
              </span>
            </div>

            {/* 2. Target Resolved Base URL */}
            <div className="flex items-start justify-between gap-2 border-t border-neutral-200 pt-2">
              <span className="text-neutral-500 font-bold shrink-0">2. 最终生效请求地址:</span>
              <span className="font-mono font-black text-right break-all text-[#4D96FF]">
                {diag.resolvedBaseUrl || '(同源相对路径)'}
              </span>
            </div>

            {/* 3. Match Reason */}
            <div className="flex items-start justify-between gap-2 border-t border-neutral-200 pt-2">
              <span className="text-neutral-500 font-bold shrink-0">3. 解析依据:</span>
              <span className="text-neutral-800 font-bold text-right text-[11px]">
                {diag.reason}
              </span>
            </div>

            {/* 4. Hostname */}
            <div className="flex items-start justify-between gap-2 border-t border-neutral-200 pt-2">
              <span className="text-neutral-500 font-bold shrink-0">4. 当前网页域名:</span>
              <span className="font-mono text-neutral-700 text-right text-[11px]">
                {diag.hostname} ({diag.isCloudflarePages ? 'Cloudflare Pages' : '独立服务器'})
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions & Manual Override */}
        <div className="space-y-2 text-xs">
          <div className="font-black text-neutral-700 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" />
            <span>一键切换 / 手动指定后端:</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSaveCustom(DEFAULT_PRODUCTION_BACKEND_URL)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FFE66D] border-2 border-black font-black text-[11px] hover:bg-[#ffd93d] active:scale-95 shadow-brutal-xs flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>使用官方 Render 后端 (scoremate-sfbw)</span>
            </button>
            {diag.storedOverride && (
              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-200 border-2 border-black font-bold text-[11px] hover:bg-neutral-300 active:scale-95 shadow-brutal-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>清除自定义缓存</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-black/10 flex items-center justify-between gap-2">
          <button
            onClick={handleCopyReport}
            className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border-2 border-black text-black font-bold text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制诊断报告' : '复制诊断报告'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-black text-white border-2 border-black font-black text-xs shadow-brutal-sm hover:bg-neutral-800 active:scale-95 cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
