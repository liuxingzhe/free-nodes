/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * @description AutoProxyGenerator React Live Workspace Web Console.
 */

import { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Terminal, 
  Copy, 
  Check, 
  Settings, 
  Code, 
  Wifi, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Search, 
  FileText, 
  AlertCircle, 
  Download, 
  ChevronRight, 
  Zap, 
  SlidersHorizontal,
  X,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScraperSource {
  name: string;
  url: string;
  type: 'base64' | 'raw';
}

interface TelegramChannel {
  name: string;
  channel: string;
}

interface WebSource {
  name: string;
  url: string;
  depth: number;
}

interface TesterConfig {
  threads: number;
  timeout_ms: number;
  min_download_mbps: number;
  max_ping_ms: number;
  test_mode: 'pingonly' | 'pingandspeed';
  test_url: string;
}

interface AppConfig {
  scrapers: {
    github_sources: ScraperSource[];
    telegram_channels: TelegramChannel[];
    web_sources?: WebSource[];
  };
  tester: TesterConfig;
  convertor: {
    max_output_nodes: number;
    clash_group_name: string;
  };
}

interface ProxyNode {
  protocol: string;
  server: string;
  port: number;
  uuid: string;
  name: string;
  raw: string;
  ping: number;
  speed: number;
  country: string;
}

export default function App() {
  // Config States
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'preview'>('dashboard');
  const [isStaticMode, setIsStaticMode] = useState(false);
  
  // Real-time Action states
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeLogs, setScrapeLogs] = useState<string[]>([]);
  const [nodes, setNodes] = useState<ProxyNode[]>([]);
  const [reports, setReports] = useState<{ sub_txt?: string; clash_yaml?: string; singbox_json?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<'all' | 'vmess' | 'vless' | 'ss' | 'trojan' | 'hysteria2'>('all');
  const [sortField, setSortField] = useState<'speed' | 'ping'>('speed');
  
  // Code preview file view
  const [previewFile, setPreviewFile] = useState<'clash' | 'singbox' | 'raw'>('clash');

  // Input states for adding new config items
  const [newGhName, setNewGhName] = useState('');
  const [newGhUrl, setNewGhUrl] = useState('');
  const [newGhType, setNewGhType] = useState<'base64' | 'raw'>('base64');
  const [newTgName, setNewTgName] = useState('');
  const [newTgChannel, setNewTgChannel] = useState('');
  const [newWebName, setNewWebName] = useState('');
  const [newWebUrl, setNewWebUrl] = useState('');
  const [newWebDepth, setNewWebDepth] = useState<number>(2);

  // Auto scroll terminal log ref
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig();
    // Pre-trigger standard node fetching to ensure tables are loaded beautifully
    triggerScrape(true); // silent fetch on mount
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrapeLogs]);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/config');
      const text = await res.text();
      let data;
      
      if (!res.ok || text.trim().startsWith('<')) {
        console.warn("API route not found, falling back to static config.json");
        setIsStaticMode(true);
        const staticRes = await fetch('./config.json');
        data = await staticRes.json();
      } else {
        data = JSON.parse(text);
      }
      
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.warn("加载服务端配置失败，尝试加载静态 config.json", err);
      setIsStaticMode(true);
      try {
        const staticRes = await fetch('./config.json');
        const data = await staticRes.json();
        if (data.success && data.config) {
          setConfig(data.config);
        }
      } catch (staticErr) {
        console.error("加载静态配置文件也失败", staticErr);
      }
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async (updatedConfig: AppConfig) => {
    setConfig(updatedConfig);
    if (isStaticMode) {
      console.info("静态发布模式下，前端暂存修改，要永久生效请修改源码中的 config.yaml 文件");
      return;
    }
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updatedConfig })
      });
    } catch (err) {
      console.error("保存配置失败", err);
    }
  };

  const triggerScrape = async (silent = false) => {
    if (isScraping) return;
    setIsScraping(true);
    if (!silent) {
      setScrapeLogs(['[SYSTEM] 初始化进程，准备连接远端爬取节点服务器...', '[SYSTEM] 读取 config.yaml 配置模型...']);
    }
    
    try {
      const response = await fetch('/api/scrape', { method: 'POST' });
      const text = await response.text();
      let data;

      if (!response.ok || text.trim().startsWith('<')) {
        console.warn("API scraper not found, loading static nodes.json");
        setIsStaticMode(true);
        const staticRes = await fetch('./nodes.json');
        data = await staticRes.json();
        
        if (!silent) {
          setScrapeLogs([
            '[SYSTEM] 初始化进程...',
            '[SYSTEM] 提示：当前页面部署于无后端静态发布环境 (GitHub Pages)',
            `[SYSTEM] 最新节点已由 GitHub Actions 在 [ ${data.updated_at || '最近'} ] 完成测试调度与编译输出！`,
            `[SYSTEM] 成功拉取并静态加载 ${data.nodes?.length || 0} 个最快优选节点。`,
            '[SYSTEM] 免去手动调速，保障实时订阅全天候稳健运行！'
          ]);
        }
      } else {
        data = JSON.parse(text);
        if (!silent) {
          setScrapeLogs(data.logs || []);
        }
      }

      if (data.success) {
        setNodes(data.nodes || []);
        setReports(data.reports || null);
      } else {
        if (!silent) {
          setScrapeLogs(prev => [...prev, `❌ 运行失败: ${data.error}`]);
        }
      }
    } catch (err: any) {
      setIsStaticMode(true);
      try {
        const staticRes = await fetch('./nodes.json');
        const data = await staticRes.json();
        setNodes(data.nodes || []);
        setReports(data.reports || null);
        if (!silent) {
          setScrapeLogs([
            '[SYSTEM] 提示：当前页面部署于无后端静态发布环境 (GitHub Pages)',
            `[SYSTEM] 最新节点已由 GitHub Actions 在 [ ${data.updated_at || '最近'} ] 完成测试调度与编译输出！`,
            `[SYSTEM] 成功拉取并静态加载 ${data.nodes?.length || 0} 个最快优选节点。`,
            '[SYSTEM] 免去手动调速，无需重复发起探测！'
          ]);
        }
      } catch (staticErr) {
        if (!silent) {
          setScrapeLogs(prev => [...prev, `❌ 静态资源拉取失败: ${err.message}`]);
        }
      }
    } finally {
      setIsScraping(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const addGithubSource = () => {
    if (!config || !newGhName || !newGhUrl) return;
    const updated = { ...config };
    if (!updated.scrapers.github_sources) updated.scrapers.github_sources = [];
    updated.scrapers.github_sources.push({
      name: newGhName,
      url: newGhUrl,
      type: newGhType
    });
    handleSaveConfig(updated);
    setNewGhName('');
    setNewGhUrl('');
  };

  const removeGithubSource = (index: number) => {
    if (!config) return;
    const updated = { ...config };
    updated.scrapers.github_sources.splice(index, 1);
    handleSaveConfig(updated);
  };

  const addTelegramChannel = () => {
    if (!config || !newTgName || !newTgChannel) return;
    const updated = { ...config };
    if (!updated.scrapers.telegram_channels) updated.scrapers.telegram_channels = [];
    updated.scrapers.telegram_channels.push({
      name: newTgName,
      channel: newTgChannel
    });
    handleSaveConfig(updated);
    setNewTgName('');
    setNewTgChannel('');
  };

  const removeTelegramChannel = (index: number) => {
    if (!config) return;
    const updated = { ...config };
    updated.scrapers.telegram_channels.splice(index, 1);
    handleSaveConfig(updated);
  };

  const addWebSource = () => {
    if (!config || !newWebName || !newWebUrl) return;
    const updated = { ...config };
    if (!updated.scrapers.web_sources) updated.scrapers.web_sources = [];
    updated.scrapers.web_sources.push({
      name: newWebName,
      url: newWebUrl,
      depth: newWebDepth
    });
    handleSaveConfig(updated);
    setNewWebName('');
    setNewWebUrl('');
    setNewWebDepth(2);
  };

  const removeWebSource = (index: number) => {
    if (!config) return;
    const updated = { ...config };
    if (!updated.scrapers.web_sources) return;
    updated.scrapers.web_sources.splice(index, 1);
    handleSaveConfig(updated);
  };

  const updateTesterConfig = (key: keyof TesterConfig, value: any) => {
    if (!config) return;
    const updated = {
      ...config,
      tester: {
        ...config.tester,
        [key]: value
      }
    };
    handleSaveConfig(updated);
  };

  // Filter nodes
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          node.server.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          node.country.toLowerCase().includes(searchQuery.toLowerCase());
    
    const targetProto = protocolFilter === 'all' ? true : 
                        protocolFilter === 'hysteria2' ? (node.protocol === 'hysteria2' || node.protocol === 'hy2') : 
                        node.protocol === protocolFilter;
    
    return matchesSearch && targetProto;
  }).sort((a, b) => {
    if (sortField === 'speed') {
      return b.speed - a.speed;
    } else {
      return a.ping - b.ping;
    }
  });

  const getCountryEmoji = (code: string) => {
    const map: Record<string, string> = {
      HK: "🇭🇰 HongKong",
      JP: "🇯🇵 Japan",
      SG: "🇸🇬 Singapore",
      US: "🇺🇸 United States",
      CN: "🇨🇳 China",
      TW: "🇹🇼 Taiwan",
      KR: "🇰🇷 South Korea",
      GB: "🇬🇧 United Kingdom",
      DE: "🇩🇪 Germany",
      UN: "🌐 Global Node"
    };
    return map[code] || "🌐 Global Node";
  };

  const isDevUrl = typeof window !== 'undefined' && window.location.origin.includes('-dev-');

  const getSubUrl = (path: string) => {
    if (typeof window === 'undefined') return path;
    const origin = window.location.origin;
    if (origin.includes('-dev-')) {
      return origin.replace('-dev-', '-pre-') + path;
    }
    return origin + path;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="autoproxy-generator-app">
      {/* Upper Navigation Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Zap className="h-5 w-5 text-indigo-100 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              AutoProxyGenerator
              <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full font-mono">
                v1.1.0-Release
              </span>
            </h1>
            <p className="text-xs text-slate-400">自动化免费代理采集、物理测速筛选与多格式定义分发引擎</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button 
            id="btn-nav-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-900 text-slate-400 hover:text-slate-100'}`}
          >
            控制中心
          </button>
          <button 
            id="btn-nav-config"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'config' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-900 text-slate-400 hover:text-slate-100'}`}
          >
            爬虫与测速规则
          </button>
          <button 
            id="btn-nav-preview"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-900 text-slate-400 hover:text-slate-100'}`}
          >
            订阅代码预览
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 gap-6">
        
        {/* Banner with general links for distribution */}
        <section className="bg-gradient-to-r from-indigo-950/40 via-purple-950/10 to-transparent border border-indigo-900/30 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -z-10" />
          
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-400" />
              智能订阅分发就绪 (Live Outlets)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              客户端可以直接配置以下静态链接。订阅由 GitHub Actions / 本地引擎全天候多线程测速筛选，仅保留下载速度最快的前 30 强可用节点。
            </p>
            {isDevUrl && (
              <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-3 text-[11px] text-amber-300 max-w-xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-semibold text-amber-200">⚠️ Clash / 外部客户端导入失败提示：</span>
                  您当前处于 AI Studio 的内部开发沙箱环境。因为带有 <code className="bg-slate-950 px-1 py-0.2 rounded mx-0.5 text-rose-400 font-mono">-dev-</code> 的链接被 Google 权限保护，
                  如果直接在 <strong>Clash Verge</strong> 中导入会获取到登录页面导致 <code>invalid yaml</code> 报错。
                  <div className="mt-1.5 text-slate-300 font-sans">
                    下方的按钮已<strong>自动为您生成并复制免验证的公共共享链接 (<code className="bg-slate-950 px-1 py-0.2 rounded mx-0.5 text-green-400 font-mono">-pre-</code> 域名)</strong>。请点击复制后直接去 Clash Verge 重新导入即可！
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 self-stretch md:self-auto md:w-auto">
            <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-xl flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-indigo-400 uppercase">Clash YAML</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Port 7890</span>
              </div>
              <div className="flex gap-1.5 items-center mt-1">
                <button
                  id="btn-copy-clash"
                  onClick={() => handleCopy(getSubUrl('/clash.yaml'), 'clash_link')}
                  className="flex-1 py-1.5 px-3 rounded bg-slate-800 text-slate-200 hover:bg-indigo-600 text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                >
                  {copiedLink === 'clash_link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedLink === 'clash_link' ? '已复制' : '复制 Clash'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-xl flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-indigo-400 uppercase">Sing-box JSON</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Port 2080</span>
              </div>
              <div className="flex gap-1.5 items-center mt-1">
                <button
                  id="btn-copy-singbox"
                  onClick={() => handleCopy(getSubUrl('/singbox.json'), 'singbox_link')}
                  className="flex-1 py-1.5 px-3 rounded bg-slate-800 text-slate-200 hover:bg-indigo-600 text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                >
                  {copiedLink === 'singbox_link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedLink === 'singbox_link' ? '已复制' : '复制 Sing-box'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-xl flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-indigo-400 uppercase">Base64 Link</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Mutil Protocol</span>
              </div>
              <div className="flex gap-1.5 items-center mt-1">
                <button
                  id="btn-copy-base64"
                  onClick={() => handleCopy(getSubUrl('/sub.txt'), 'base64_link')}
                  className="flex-1 py-1.5 px-3 rounded bg-slate-800 text-slate-200 hover:bg-indigo-600 text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                >
                  {copiedLink === 'base64_link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedLink === 'base64_link' ? '已复制' : '复制 Base64'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left Console Frame */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Manual controller actions */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-indigo-400" />
                    云测速内核调试
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    本地手动拉取代理，此操作会从网络实时爬取，并将结果输出至静态文件存储。
                  </p>
                  
                  <div className="flex flex-col gap-2">
                    <button
                      id="btn-trigger-scraper"
                      onClick={() => triggerScrape()}
                      disabled={isScraping}
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isScraping ? 'animate-spin' : ''}`} />
                      {isScraping ? '正在拼命爬取测速中...' : '开始爬取并测试极速'}
                    </button>
                  </div>
                </div>

                {/* Scraper overview metrics */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
                    当前通道列表
                  </h3>
                  
                  {config ? (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">GitHub 仓库订阅源:</span>
                          <span className="text-slate-200 font-medium font-mono">{(config.scrapers.github_sources || []).length} 条</span>
                        </div>
                        <div className="space-y-1">
                          {(config.scrapers.github_sources || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="bg-slate-950 px-2.5 py-1.5 rounded text-[11px] font-mono text-slate-400 truncate">
                              {item.name}
                            </div>
                          ))}
                          {(config.scrapers.github_sources?.length || 0) > 3 && (
                            <div className="text-[10px] text-slate-400 italic font-mono pl-1">等有更多源...</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Telegram 消息预览频道:</span>
                          <span className="text-slate-200 font-medium font-mono">{(config.scrapers.telegram_channels || []).length} 个</span>
                        </div>
                        <div className="space-y-1">
                          {(config.scrapers.telegram_channels || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="bg-slate-950 px-2.5 py-1.5 rounded text-[11px] font-mono text-slate-400 truncate">
                              @{item.channel}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">网络博客/通用网页源:</span>
                          <span className="text-slate-200 font-medium font-mono">{(config.scrapers.web_sources || []).length} 个</span>
                        </div>
                        <div className="space-y-1">
                          {(config.scrapers.web_sources || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="bg-slate-950 px-2.5 py-1.5 rounded text-[11px] font-mono text-slate-400 truncate flex justify-between items-center">
                              <span className="truncate">{item.name}</span>
                              <span className="text-[9px] text-indigo-400 bg-indigo-950/40 px-1 rounded shrink-0">深:{item.depth}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex justify-between text-[11px] text-slate-400">
                        <span>合格速度阈值:</span>
                        <span className="text-green-400 text-xs font-mono">{config.tester.min_download_mbps} MB/s</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>合格最大延迟:</span>
                        <span className="text-green-400 text-xs font-mono">{config.tester.max_ping_ms} ms</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-4 text-center">正在加载配置文件...</div>
                  )}
                </div>

                {/* Log panel in retro blackbox */}
                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex flex-col h-[280px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-900 text-xs">
                    <span className="text-slate-300 font-semibold font-mono flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                      SYSTEM_CONSOLES_LOGS
                    </span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto mt-2 text-[10px] font-mono leading-relaxed space-y-1 text-slate-300">
                    {scrapeLogs.length === 0 ? (
                      <div className="text-slate-500 text-center py-10">终端空闲，点击“开始爬取”按钮拉取并运行测速...</div>
                    ) : (
                      scrapeLogs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap">
                          {log}
                        </div>
                      ))
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </div>

              </div>

              {/* Right Nodes Table list */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Advanced Search Filter controls */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row gap-4 justify-between items-center">
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input 
                      id="input-search-query"
                      type="text"
                      placeholder="检索节点名、域名、区域..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                    {(['all', 'vmess', 'vless', 'ss', 'trojan', 'hysteria2'] as const).map(proto => (
                      <button
                        key={proto}
                        id={`btn-filter-proto-${proto}`}
                        onClick={() => setProtocolFilter(proto)}
                        className={`px-3 py-1.5 rounded-lg text-xs capitalize whitespace-nowrap transition ${protocolFilter === proto ? 'bg-indigo-600 font-semibold' : 'bg-slate-950 hover:bg-slate-800 text-slate-400'}`}
                      >
                        {proto}
                      </button>
                    ))}
                  </div>

                  {/* Sorting dropdown */}
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <span className="text-slate-400 text-xs">排序:</span>
                    <select
                      id="select-sort-field"
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 text-xs px-2.5 py-1.5 rounded-lg text-slate-200 outline-none"
                    >
                      <option value="speed">极速最高 (MB/s)</option>
                      <option value="ping">延迟最低 (Ping)</option>
                    </select>
                  </div>
                </div>

                {/* Nodes Display grid/list */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
                    <span className="text-xs font-semibold text-white">
                      已验证节点明细 ({filteredNodes.length} / {nodes.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      双端测速机制 100% 模拟，延迟极度精准
                    </span>
                  </div>

                  {filteredNodes.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <AlertCircle className="h-8 w-8 text-slate-600 mx-auto" />
                      <p className="text-slate-400 text-xs">暂无筛选合格的可用高速节点。点击左侧“测试极速”进行一键测速！</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60 max-h-[550px] overflow-y-auto">
                      {filteredNodes.map((node, i) => (
                        <div key={i} className="p-4 hover:bg-slate-950/40 transition flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Flag or protocol label */}
                            <div className="h-8 w-8 rounded-lg bg-slate-950 flex flex-col items-center justify-center border border-slate-800 font-mono text-[9px] font-bold text-slate-400 uppercase">
                              {node.protocol}
                            </div>
                            
                            <div className="min-w-0 space-y-1">
                              <div className="text-xs font-semibold text-slate-100 truncate flex items-center gap-2">
                                <span className="text-slate-200">{node.name}</span>
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                                  {node.server}:{node.port}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 shrink-0">
                                <span className="flex items-center gap-1">
                                  <Languages className="h-3 w-3 text-emerald-400" />
                                  {getCountryEmoji(node.country)}
                                </span>
                                <span className="text-slate-500">
                                  UUID: {node.uuid ? node.uuid.slice(0, 10) + '...' : 'None'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Stats */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-mono">
                                {node.speed} MB/s
                              </span>
                              <span className={`text-[10px] font-mono ${node.ping < 150 ? 'text-cyan-400' : 'text-amber-400'}`}>
                                {node.ping} ms
                              </span>
                            </div>

                            {/* Copy single raw Uri */}
                            <button
                              id={`btn-copy-node-${i}`}
                              onClick={() => handleCopy(node.raw, `node_${i}`)}
                              className="p-2 rounded-lg bg-slate-950 hover:bg-indigo-600 hover:text-white border border-slate-800 transition"
                              title="复制原始协议连接URI"
                            >
                              {copiedLink === `node_${i}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {isStaticMode && (
                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-indigo-200">
                  <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">⚙️ 静态托管运行提示 (GitHub Pages Mode)</span>
                    <p className="mt-1">
                      您当前的控制台部署在无服务器的 GitHub Pages 环境中。在这里添加、移除或修改采集源，仅作为<strong>当前页面的浏览器沙箱内模拟及预览</strong>，无法写入存储在您 GitHub 仓库的物理配置文件。
                    </p>
                    <p className="mt-1.5 text-slate-300">
                      若要永久追加或剔除某个采集源，可以直接在您的 GitHub 仓库的 <code className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300 font-mono">config.yaml</code> 配置文件中修改。GitHub Actions 会在提交后重新编译并更新此处。
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* GitHub sources config panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">GitHub 订阅采集源</h3>
                  <p className="text-xs text-slate-400">爬虫抓取的 Base64 订阅链接以及行分割 (Raw) 的标准网络节点页</p>
                </div>

                <div className="space-y-3">
                  {config?.scrapers.github_sources.map((src, i) => (
                    <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                          {src.name}
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 uppercase font-mono rounded">
                            {src.type}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-lg">
                          {src.url}
                        </div>
                      </div>
                      <button
                        id={`btn-remove-gh-${i}`}
                        onClick={() => removeGithubSource(i)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new source input blocks */}
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-3">
                  <h4 className="text-xs font-semibold text-indigo-400 font-mono">APPEND NEW SOURCE</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      id="input-new-gh-name"
                      type="text"
                      placeholder="源名称 (例如: v2ray-hub)"
                      value={newGhName}
                      onChange={(e) => setNewGhName(e.target.value)}
                      className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                    />
                    <select
                      id="select-new-gh-type"
                      value={newGhType}
                      onChange={(e) => setNewGhType(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-300"
                    >
                      <option value="base64">Base64 Encode 订阅</option>
                      <option value="raw">Raw 明文断行列表</option>
                    </select>
                  </div>
                  <input 
                    id="input-new-gh-url"
                    type="text"
                    placeholder="请输入订阅URL (e.g. https://raw.githubusercontent.com/...)"
                    value={newGhUrl}
                    onChange={(e) => setNewGhUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                  />
                  <button
                    id="btn-add-gh-src"
                    onClick={addGithubSource}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    添加 GitHub 采集源
                  </button>
                </div>
              </div>

              {/* Telegram and speed thresholds configuration */}
              <div className="space-y-6">
                
                {/* Telegram channels config */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-semibold text-white">Telegram 网页消息爬取频段</h3>
                    <p className="text-xs text-slate-400 font-mono">无需任何外部 Telegram API 模块，利用 BeautifulSoup 高速提取消息链接</p>
                  </div>

                  <div className="space-y-3">
                    {config?.scrapers.telegram_channels.map((chan, i) => (
                      <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-semibold text-slate-200">
                            {chan.name}
                          </div>
                          <div className="text-[10px] font-mono text-indigo-400">
                            @t.me/s/{chan.channel}
                          </div>
                        </div>
                        <button
                          id={`btn-remove-tg-${i}`}
                          onClick={() => removeTelegramChannel(i)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-semibold text-indigo-400 font-mono">APPEND NEW TG CHANNEL</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        id="input-new-tg-name"
                        type="text"
                        placeholder="频道名称 (例如：免费VPN)"
                        value={newTgName}
                        onChange={(e) => setNewTgName(e.target.value)}
                        className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                      />
                      <input 
                        id="input-new-tg-channel"
                        type="text"
                        placeholder="频道ID/Username (例如：ssr_sub)"
                        value={newTgChannel}
                        onChange={(e) => setNewTgChannel(e.target.value)}
                        className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      id="btn-add-tg-chan"
                      onClick={addTelegramChannel}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      添加 Telegram 频道
                    </button>
                  </div>
                </div>

                {/* Web/Blog Scraper config */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-semibold text-white">通用网页与独立博客采集 (Web Crawler)</h3>
                    <p className="text-xs text-slate-400 font-mono">支持对各种博客网关、Tag 列表页面进行多级递归和 Clash YAML 节点反向结构提取</p>
                  </div>

                  <div className="space-y-3">
                    {(config?.scrapers.web_sources || []).map((ws, i) => (
                      <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{ws.name}</span>
                            <span className="text-[9px] bg-slate-900 border border-slate-800 px-1 py-0.2 rounded text-indigo-400 font-mono">递归层数: {ws.depth}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs md:max-w-md">
                            {ws.url}
                          </div>
                        </div>
                        <button
                          id={`btn-remove-web-${i}`}
                          onClick={() => removeWebSource(i)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {(config?.scrapers.web_sources || []).length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-500 italic">暂无博客或通用网页爬虫注册</div>
                    )}
                  </div>

                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-semibold text-indigo-400 font-mono">REGISTER NEW WEB SCRAPER SOURCE</h4>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          id="input-new-web-name"
                          type="text"
                          placeholder="数据源名称 (例如：优雅数字派)"
                          value={newWebName}
                          onChange={(e) => setNewWebName(e.target.value)}
                          className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                        />
                        <select 
                          id="select-new-web-depth"
                          value={newWebDepth}
                          onChange={(e) => setNewWebDepth(parseInt(e.target.value))}
                          className="bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-300"
                        >
                          <option value={1}>深度 1 (直抓当前页)</option>
                          <option value={2}>深度 2 (递归抓取内页文章)</option>
                          <option value={3}>深度 3 (全面渗透追踪)</option>
                        </select>
                      </div>
                      <input 
                        id="input-new-web-url"
                        type="text"
                        placeholder="请输入博客列表或 Tag 页面 URL (例如：https://yoyapai.com/...)"
                        value={newWebUrl}
                        onChange={(e) => setNewWebUrl(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      id="btn-add-web-src"
                      onClick={addWebSource}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      添加网页/博客采集源
                    </button>
                  </div>
                </div>

                {/* Tester threshold specs config */}
                {config && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">
                      多核评定测速阈值参数 (Filter Thresholds)
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400 block">测试最大线程并发 (Threads)</label>
                        <input 
                          id="input-threads"
                          type="number"
                          value={config.tester.threads}
                          onChange={(e) => updateTesterConfig('threads', parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400 block">网络诊断最大丢包超时 (ms)</label>
                        <input 
                          id="input-timeout-ms"
                          type="number"
                          value={config.tester.timeout_ms}
                          onChange={(e) => updateTesterConfig('timeout_ms', parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400 block">优质筛选最低下载 (MB/s)</label>
                        <input 
                          id="input-min-download"
                          type="number"
                          step="0.1"
                          value={config.tester.min_download_mbps}
                          onChange={(e) => updateTesterConfig('min_download_mbps', parseFloat(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400 block">优质最大延迟 PING (ms)</label>
                        <input 
                          id="input-max-ping"
                          type="number"
                          value={config.tester.max_ping_ms}
                          onChange={(e) => updateTesterConfig('max_ping_ms', parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </motion.div>
          )}

          {activeTab === 'preview' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <div className="bg-slate-900/60 p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button 
                    id="btn-preview-clash"
                    onClick={() => setPreviewFile('clash')}
                    className={`px-3 py-1.5 rounded-lg text-xs transition ${previewFile === 'clash' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Clash 专属配置 (YAML)
                  </button>
                  <button 
                    id="btn-preview-singbox"
                    onClick={() => setPreviewFile('singbox')}
                    className={`px-3 py-1.5 rounded-lg text-xs transition ${previewFile === 'singbox' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Sing-box 极客配置 (JSON)
                  </button>
                  <button 
                    id="btn-preview-raw"
                    onClick={() => setPreviewFile('raw')}
                    className={`px-3 py-1.5 rounded-lg text-xs transition ${previewFile === 'raw' ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Base64 订阅源内容
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-copy-preview-content"
                    onClick={() => {
                      const t = previewFile === 'clash' ? (reports?.clash_yaml || '') : 
                                previewFile === 'singbox' ? (reports?.singbox_json || '') : 
                                (reports?.sub_txt || '');
                      handleCopy(t, 'code_preview');
                    }}
                    className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition flex items-center justify-center gap-1"
                  >
                    {copiedLink === 'code_preview' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink === 'code_preview' ? '已成功复制' : '复制当前配置代码'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950 overflow-x-auto max-h-[600px]">
                {reports ? (
                  <pre className="text-[11px] font-mono leading-relaxed text-slate-300">
                    {previewFile === 'clash' && (reports.clash_yaml || '当前 Clash 配置文件尚未生成。请返回控制中心开始测速！')}
                    {previewFile === 'singbox' && (reports.singbox_json || '当前 Sing-box 配置文件尚未生成。请返回控制中心开始测速！')}
                    {previewFile === 'raw' && (reports.sub_txt || '当前 Base64 订阅源文件尚未生成。请返回控制中心开始测速！')}
                  </pre>
                ) : (
                  <div className="py-20 text-center text-slate-500 space-y-2">
                    <FileText className="h-10 w-10 text-slate-600 mx-auto animate-pulse" />
                    <p className="text-xs">代理节点配置空空如也，请返回控制中心点击抓取，即刻一键生成多端规则！</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer System Status details */}
      <footer className="mt-12 border-t border-slate-900 bg-slate-950 p-6 text-center text-slate-500 text-[10px] font-mono">
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 AutoProxyGenerator. 零侵入轻量物理测速筛选专案.</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> ENGINE: LIVE</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span> COGNITIVE PROCESSORS: OK</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
