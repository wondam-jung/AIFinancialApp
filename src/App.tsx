import { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  MessageSquare,
  Plus,
  ArrowRight,
  Wallet,
  Settings,
  Bell,
  Search,
  ChevronRight,
  Lightbulb,
  Zap,
  AlertCircle,
  CheckCircle2,
  Send,
  FileUp
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { read, utils } from 'xlsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { GoogleGenAI } from '@google/genai';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Mock Data
const MOCK_TRANSACTIONS = [
  { id: 1, date: '2025-04-20', category: '식비', amount: -15000, title: '스타벅스' },
  { id: 2, date: '2025-04-20', category: '교통', amount: -2500, title: '지하철' },
  { id: 3, date: '2025-04-21', category: '수입', amount: 3500000, title: '급여' },
  { id: 4, date: '2025-04-21', category: '쇼핑', amount: -45000, title: '무신사' },
  { id: 5, date: '2025-04-22', category: '식비', amount: -12000, title: '김밥천국' },
  { id: 6, date: '2025-04-23', category: '여가', amount: -60000, title: '영화관' },
  { id: 7, date: '2025-04-24', category: '식비', amount: -25000, title: '치킨' },
  { id: 8, date: '2025-04-25', category: '생활', amount: -8000, title: '편의점' },
];

const DAILY_STATS = [
  { name: '월', amount: 45000 },
  { name: '화', amount: 32000 },
  { name: '수', amount: 15000 },
  { name: '목', amount: 68000 },
  { name: '금', amount: 12000 },
  { name: '토', amount: 85000 },
  { name: '일', amount: 42000 },
];

const CATEGORY_DATA = [
  { name: '식비', value: 45, color: '#7F77DD' },
  { name: '교통', value: 15, color: '#5DCAA5' },
  { name: '쇼핑', value: 20, color: '#EF9F27' },
  { name: '여가', value: 20, color: '#D4537E' },
];

interface Insight {
  title: string;
  content: string;
  type: 'warning' | 'success' | 'info';
}

interface Transaction {
  id: number;
  date: string;
  category: string;
  amount: number;
  title: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isImported, setIsImported] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: '안녕하세요! 당신의 소비 내역을 분석해 드릴까요? 엑셀 파일을 import 하거나 무엇이든 물어보세요.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const COLORS = ['#6366F1', '#10B981', '#F43F5E', '#F59E0B', '#0EA5E9', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6', '#84CC16'];
  const analysis = useMemo(() => {
    if (transactions.length === 0) return null;

    const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
    const uniqueDates = new Set(transactions.map(t => t.date));
    const dayCount = uniqueDates.size || 1;

    // Category breakdown
    const catMap: Record<string, number> = {};
    transactions.filter(t => t.amount < 0 && t.category !== '수입').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
    });

    const categoryStats = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalExpense = categoryStats.reduce((acc, curr) => acc + curr.value, 0);
    const categoryChartData = categoryStats.map(cat => ({
      ...cat,
      percent: totalExpense > 0 ? Math.round((cat.value / totalExpense) * 100) : 0
    }));

    // Daily Pattern (Day of Week)
    const dayMap: Record<string, number> = { '일': 0, '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0 };
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    transactions.filter(t => t.amount < 0).forEach(t => {
      const d = new Date(t.date);
      const dayName = dayNames[d.getDay()];
      dayMap[dayName] += Math.abs(t.amount);
    });

    const dailyPattern = dayNames.map(name => ({ name, amount: dayMap[name] }));

    console.log("Pie Chart Data (Category Stats):", categoryChartData);

    return {
      totalIncome: income,
      totalExpense: expense,
      netSavings: income - expense,
      totalCount: transactions.length,
      avgCountPerDay: (transactions.length / dayCount).toFixed(1),
      categoryChartData,
      dailyPattern
    };
  }, [transactions]);

  useEffect(() => {
    if (isImported && transactions.length > 0) {
      fetchInsights(transactions);
    }
  }, [isImported, transactions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setChartReady(true), 500);
    return () => clearTimeout(timer);
  }, [activeTab, isImported]);

  const fetchInsights = async (data: Transaction[]) => {
    setLoadingInsights(true);
    const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const prompt = `당신은 전문 금융 분석가입니다. 다음 소비 내역을 분석하여 3가지 핵심 인사이트(절약 팁, 패턴 분석 등)를 제공해주세요. 
        모든 금액은 반드시 천 단위 콤마와 '원'을 붙여서 표현하세요 (예: 80,000원). 
        한국어로 답변하고, 친근하면서도 전문적인 어조를 사용하세요. 답변은 JSON 형식으로만 해주세요. 
        JSON 형식: { "insights": [{ "title": "제목", "content": "내용", "type": "warning|success|info" }] }
        
        거래 내역: ${JSON.stringify(data.slice(0, 20))}`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const text = response.text.trim();
        const result = JSON.parse(text);
        if (result.insights) {
          setInsights(result.insights);
          setLoadingInsights(false);
          return;
        }
      } catch (error) {
        console.warn(`Model ${modelName} failed:`, error);
        lastError = error;
      }
    }

    setInsights([
      { title: '지출 분석 완료', content: '데이터 분석 중 일시적인 오류가 발생했습니다. 기본 분석 결과를 확인해주세요.', type: 'info' },
      { title: '식비 주의', content: '외식 지출이 높은 편입니다.', type: 'warning' },
    ]);
    setLoadingInsights(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsAnalyzing(true);
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Get raw rows including headers
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // 1. Single AI Analysis Call (Mapping + Categorization Rules)
        let aiConfig = null;
        const aiModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
        const sampleRows = rawRows.slice(0, 15);
        const uniqueTitlesSample = Array.from(new Set(rawRows.slice(1).map(r => r.find(c => typeof c === 'string' && c.length > 1)).filter(Boolean))).slice(0, 100);

        for (const modelName of aiModels) {
          try {
            const prompt = `당신은 금융 데이터 전문가입니다. 다음 엑셀 샘플을 분석하여 두 가지 작업을 수행하세요.
            1. 컬럼 매핑: 날짜, 항목명, 금액이 들어있는 인덱스(0부터)를 찾으세요. { "dateIdx": n, "titleIdx": n, "amountIdx": n, "withdrawalIdx": n, "depositIdx": n }
            2. 카테고리 분류 규칙: 다음 항목 리스트를 보고 가장 적합한 카테고리를 JSON 맵으로 만드세요. 
               카테고리는 반드시 다음 목록 중에서만 선택하세요: [고정비, 교통비, 생필품비, 식비, 자기개발, 여가, 꾸밈비, 의료, 관계비, 경조사비, 이벤트비, 수입, 기타]
               '기타'는 정말 분류가 불가능한 경우에만 사용하세요.
            
            데이터 샘플: ${JSON.stringify(sampleRows)}
            항목 리스트: ${JSON.stringify(uniqueTitlesSample)}
            
            반드시 다음 형식의 JSON으로만 응답하세요:
            { "mapping": { "dateIdx": 0, "titleIdx": 1, ... }, "categories": { "스타벅스": "식비", "통신비": "고정비", "헬스장": "자기개발", ... } }`;

            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: { responseMimeType: "application/json" }
            });
            aiConfig = JSON.parse(response.text.trim());
            break;
          } catch (e) { console.warn(`Model ${modelName} failed:`, e); }
        }

        // 2. Data Processing
        const mappedData: Transaction[] = rawRows.slice(1).map((row, idx) => {
          if (!row || row.length === 0) return null;
          const parseNum = (val: any) => {
            const cleaned = String(val || 0).replace(/[^0-9.-]/g, "");
            return cleaned ? Number(cleaned) : 0;
          };

          let dateVal, titleVal, amount = 0, category = '기타';

          if (aiConfig?.mapping) {
            const m = aiConfig.mapping;
            dateVal = m.dateIdx !== null ? row[m.dateIdx] : null;
            titleVal = m.titleIdx !== null ? row[m.titleIdx] : '항목 없음';
            if (m.amountIdx !== null && m.amountIdx !== undefined) {
              amount = parseNum(row[m.amountIdx]);
              // If amount is positive but it's a common withdrawal merchant, consider it negative
              // Or if both withdrawalIdx and depositIdx are null, we trust amountIdx sign
            }

            // Priority for dedicated columns
            if (m.withdrawalIdx !== null && m.withdrawalIdx !== undefined && row[m.withdrawalIdx]) {
              amount = -Math.abs(parseNum(row[m.withdrawalIdx]));
            } else if (m.depositIdx !== null && m.depositIdx !== undefined && row[m.depositIdx]) {
              amount = Math.abs(parseNum(row[m.depositIdx]));
            }

            category = aiConfig.categories?.[String(titleVal)] || '기타';
          } else {
            // Manual Fallback
            dateVal = row.find(c => c instanceof Date || (typeof c === 'string' && /^\d{4}/.test(c)));
            titleVal = row.find(c => typeof c === 'string' && c.length > 1) || '항목 없음';
            amount = Number(row.find(c => typeof c === 'number' && c !== 0) || 0);
          }

          let d = new Date(dateVal || new Date());
          return {
            id: idx + 1,
            date: isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0],
            category,
            amount,
            title: String(titleVal)
          };
        }).filter((t): t is Transaction => t !== null && t.amount !== 0);

        if (mappedData.length === 0) {
          alert("데이터를 분석할 수 없습니다.");
        } else {
          console.log("Categorized as '기타':", mappedData.filter(t => t.category === '기타').map(t => t.title));
          setTransactions(mappedData);
          setIsImported(true);
        }
      } catch (err) {
        console.error("Critical Parsing Error:", err);
        alert("분석 중 오류가 발생했습니다.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const userMessage = inputText;
    setInputText('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsSending(true);

    try {
      const prompt = `사용자의 질문: "${userMessage}"
      현재 컨텍스트(최근 거래 내역): ${JSON.stringify(transactions.slice(0, 10))}
      금융 전문가로서 조언해주세요. 3문장 이내로 짧게 한국어로 답변하세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setChatMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', text: '죄송합니다. 요청을 처리하는 중에 오류가 발생했습니다.' }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans selection:bg-[#F3F4F6]">
      {/* Sidebar / Nav */}
      <nav className="fixed bottom-0 left-0 right-0 lg:top-0 lg:bottom-0 lg:left-0 lg:w-[260px] bg-white border-t lg:border-t-0 lg:border-r border-[#E5E7EB] z-50 p-6 flex lg:flex-col justify-around lg:justify-start gap-1">
        <div className="hidden lg:flex items-center gap-3 mb-12 px-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Orizon Pay</span>
        </div>

        {[
          { id: 'overview', icon: TrendingUp, label: 'Overview' },
          { id: 'analytics', icon: PieChartIcon, label: 'Analytics' },
          { id: 'chat', icon: MessageSquare, label: 'AI Advisor' },
          { id: 'settings', icon: Settings, label: 'Settings', disabled: true },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => !item.disabled && setActiveTab(item.id)}
            className={cn(
              "flex flex-col lg:flex-row items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === item.id
                ? "bg-[#F3F4F6] text-[#111827] font-medium"
                : item.disabled
                  ? "opacity-30 cursor-not-allowed grayscale"
                  : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-black" : "text-[#9CA3AF]")} />
            <span className="text-sm">{item.label}</span>
          </button>
        ))}

        <div className="hidden lg:block mt-auto p-4 bg-gray-50 rounded-2xl border border-[#F3F4F6]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Usage Plan</p>
          <p className="text-sm font-medium">Starter Pro</p>
          <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-black h-full w-3/4"></div>
          </div>
          <p className="text-[11px] text-[#6B7280] mt-2">75% of limit used</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:ml-[260px] pb-24 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 bg-[#F9FAFB]/90 backdrop-blur-md z-40 p-6 lg:p-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">좋은 아침입니다! 👋</h1>
            <p className="text-[#6B7280] mt-1 text-sm">재정 상태를 한눈에 확인해보세요.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">김가계</p>
              <p className="text-xs text-[#6B7280]">마스터 계정</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-200 border border-[#E5E7EB] overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent('user')}`} alt="profile" />
            </div>
          </div>
        </header>

        <div className="px-6 lg:px-10 pb-10 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {!isImported ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-6">
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="max-w-2xl w-full bg-white rounded-[2.5rem] border border-[#F3F4F6] p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] text-center relative overflow-hidden"
                    >
                      {/* Decorative elements */}
                      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60" />
                      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-60" />

                      <div className="relative z-10">
                        <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl transform hover:scale-105 transition-transform duration-500">
                          <FileUp className="w-12 h-12 text-white" />
                        </div>

                        <h1 className="text-4xl font-bold tracking-tight text-[#111827] mb-6">스마트한 가계부의 시작.</h1>
                        <p className="text-[#6B7280] mb-12 max-w-md mx-auto leading-relaxed text-lg font-light">
                          엑셀 파일을 업로드하면 AI가 즉시 카테고리를 분류하고 당신의 소비 패턴을 아름답게 분석합니다.
                        </p>

                        <div className="flex flex-col items-center gap-8">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isAnalyzing}
                            className={cn(
                              "group relative w-full sm:w-auto px-12 py-5 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-3 overflow-hidden transition-all hover:shadow-xl active:scale-[0.98]",
                              isAnalyzing && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {isAnalyzing ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>데이터 분석 중...</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                                <span>엑셀 파일 가져오기</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-8 text-[10px] uppercase tracking-[0.2em] font-black text-gray-300">
                            <span>Excel Support</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span>AI Categorization</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span>Safe & Private</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-[#111827]">Financial Summary</h2>
                        <p className="text-sm text-[#6B7280] font-light">분석된 기간 동안의 재정 현황 요약입니다.</p>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group p-3 hover:bg-black hover:text-white border border-gray-100 rounded-2xl transition-all duration-300 shadow-sm"
                        title="다른 파일 업로드"
                      >
                        <FileUp className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Enhanced Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {[
                        {
                          label: '총 수입',
                          value: analysis?.totalIncome || 0,
                          color: 'text-emerald-600',
                          bg: 'bg-emerald-50',
                          icon: TrendingUp
                        },
                        {
                          label: '총 지출',
                          value: analysis?.totalExpense || 0,
                          color: 'text-rose-600',
                          bg: 'bg-rose-50',
                          icon: TrendingDown
                        },
                        {
                          label: '순 저축',
                          value: analysis?.netSavings || 0,
                          color: 'text-indigo-600',
                          bg: 'bg-indigo-50',
                          icon: Wallet
                        }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                          <div className="flex items-center justify-between mb-8">
                            <p className="text-xs font-black text-[#6B7280] uppercase tracking-widest">{item.label}</p>
                            <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", item.bg)}>
                              <item.icon className={cn("w-5 h-5", item.color)} />
                            </div>
                          </div>
                          <p className="text-4xl font-bold tracking-tighter text-[#111827]">
                            {item.value.toLocaleString()}
                            <span className="text-sm ml-1.5 font-medium text-gray-400">원</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {/* Weekly Consumption Chart */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">주간 지출 추이</h2>
                            <p className="text-xs text-[#6B7280]">최근 7일간의 소비 변화입니다.</p>
                          </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm">
                          <div className="h-[300px] w-full">
                            {chartReady && (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analysis?.dailyPattern || []}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                  <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }}
                                  />
                                  <YAxis hide />
                                  <Tooltip
                                    formatter={(value: number) => value.toLocaleString() + '원'}
                                    contentStyle={{
                                      borderRadius: '16px',
                                      border: 'none',
                                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                      padding: '12px'
                                    }}
                                    cursor={{ fill: '#F9FAFB' }}
                                  />
                                  <Bar
                                    dataKey="amount"
                                    name="소비 금액"
                                    fill="#111827"
                                    radius={[6, 6, 0, 0]}
                                    barSize={24}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AI Insights Panel */}
                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">AI 소비 분석 리포트</h2>
                            <p className="text-xs text-[#6B7280]">AI가 제안하는 맞춤형 재정 가이드입니다.</p>
                          </div>
                          {loadingInsights && (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1 }}
                              className="w-4 h-4 border-2 border-black border-t-transparent rounded-full ml-auto"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {insights.length > 0 ? insights.map((insight, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-[1.5rem] border border-[#F3F4F6] flex gap-5 items-start shadow-sm hover:shadow-md transition-all duration-300 group">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                                insight.type === 'warning' ? "bg-orange-50" :
                                  insight.type === 'success' ? "bg-emerald-50" :
                                    "bg-indigo-50"
                              )}>
                                {insight.type === 'warning' ? (
                                  <TrendingDown className="w-6 h-6 text-orange-500" />
                                ) : insight.type === 'success' ? (
                                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                                ) : (
                                  <Zap className="w-6 h-6 text-indigo-500" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-[#111827] mb-1 group-hover:text-black transition-colors">{insight.title}</h4>
                                <p className="text-sm text-[#6B7280] leading-relaxed font-light">{insight.content}</p>
                              </div>
                            </div>
                          )) : (
                            <div className="p-12 text-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Lightbulb className="w-6 h-6 text-gray-300" />
                              </div>
                              <p className="text-sm font-medium text-gray-500">
                                아직 생성된 인사이트가 없습니다.
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                파일 업로드 후 잠시 기다리면 AI 분석 결과가 표시됩니다.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-[#F3F4F6] shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-[#F3F4F6] flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-[#111827]">최근 거래 내역</h2>
                          <p className="text-xs text-[#6B7280]">최근 5개의 거래를 먼저 보여드립니다.</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>

                      <div className="divide-y divide-[#F3F4F6]">
                        {transactions.slice(0, 5).map((tx) => (
                          <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                                {tx.category === '식비' ? '🍜' : tx.category === '교통' ? '🚌' : tx.category === '수입' ? '💰' : tx.category === '쇼핑' ? '🛍' : '📦'}
                              </div>
                              <div>
                                <div className="font-bold text-[#111827] mb-0.5">{tx.title}</div>
                                <div className="text-xs text-[#6B7280] flex items-center gap-2">
                                  <span className="font-medium px-2 py-0.5 bg-gray-100 rounded-md">{tx.category}</span>
                                  <span className="opacity-40">•</span>
                                  <span>{tx.date}</span>
                                </div>
                              </div>
                            </div>
                            <div className={cn(
                              "text-lg font-bold tracking-tight",
                              tx.amount > 0 ? "text-emerald-600" : "text-[#111827]"
                            )}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}원
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 bg-gray-50/50 text-center">
                        <button onClick={() => setActiveTab('analytics')} className="text-xs font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest">
                          모든 내역 보기
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-10"
              >
                {!isImported ? (
                  <div className="p-20 text-center bg-white rounded-3xl border border-dashed border-[#E5E7EB]">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <PieChartIcon className="w-8 h-8 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">분석할 데이터가 없습니다</h3>
                    <p className="text-sm text-[#6B7280] mb-8">오버뷰 탭에서 엑셀 파일을 먼저 import 해주세요.</p>
                    <button
                      onClick={() => setActiveTab('overview')}
                      className="px-6 py-3 bg-black text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
                    >
                      오버뷰로 이동하기
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: '총 수입', value: analysis?.totalIncome, color: 'text-green-600' },
                        { label: '총 지출', value: analysis?.totalExpense, color: 'text-red-600' },
                        { label: '순 저축', value: analysis?.netSavings, color: 'text-blue-600' },
                        { label: '거래 건수', value: analysis?.totalCount, unit: '건' },
                        { label: '일 평균 거래', value: analysis?.avgCountPerDay, unit: '건' }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl border border-[#F3F4F6] shadow-sm">
                          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">{item.label}</p>
                          <p className={cn("text-2xl font-bold tracking-tight", item.color)}>
                            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                            <span className="text-sm ml-1 font-normal text-gray-500">{item.unit || '원'}</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                      <div className="bg-white p-10 rounded-2xl border border-[#F3F4F6] flex flex-col items-center shadow-sm w-full">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-10 self-start">카테고리별 지출 비중</h3>
                        <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
                          {chartReady && (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analysis?.categoryChartData}
                                  innerRadius={70}
                                  outerRadius={100}
                                  paddingAngle={10}
                                  dataKey="value"
                                  stroke="none"
                                  onClick={(data) => setSelectedCategory(data.name)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {analysis?.categoryChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => value.toLocaleString() + '원'} />
                              </PieChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full mt-10">
                          {analysis?.categoryChartData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-xs text-[#6B7280]">{item.name}</span>
                              </div>
                              <span className="text-xs font-semibold">{item.percent}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-2xl border border-[#F3F4F6] shadow-sm flex flex-col w-full">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
                            {selectedCategory || analysis?.categoryChartData[0]?.name} 상세 내역
                          </h2>
                          <span className="text-xs text-gray-400">차트를 클릭하여 카테고리를 변경하세요</span>
                        </div>

                        <div className="flex-1 max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {transactions.filter(t => t.amount < 0 && t.category === (selectedCategory || analysis?.categoryChartData[0]?.name)).length > 0 ? (
                            transactions.filter(t => t.amount < 0 && t.category === (selectedCategory || analysis?.categoryChartData[0]?.name)).map((t, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">{t.title}</p>
                                  <p className="text-[10px] text-gray-500">{t.date}</p>
                                </div>
                                <p className="text-xs font-bold text-red-600">
                                  {t.amount.toLocaleString()}원
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-20">해당 카테고리에 내역이 없습니다.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                      <div className="bg-white p-10 rounded-2xl border border-[#F3F4F6] shadow-sm flex flex-col w-full">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-10">요일별 소비 패턴</h3>
                        <div className="h-[250px] w-full" style={{ minHeight: '250px' }}>
                          {chartReady && (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analysis?.dailyPattern}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis hide />
                                <Tooltip formatter={(value: number) => value.toLocaleString() + '원'} cursor={{ fill: '#F9FAFB' }} />
                                <Bar
                                  dataKey="amount"
                                  name="소비 금액"
                                  radius={[4, 4, 0, 0]}
                                  barSize={32}
                                  onClick={(data) => setSelectedDay(data.name)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {analysis?.dailyPattern.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                        <div className="mt-auto pt-8 border-t border-gray-50">
                          <p className="text-sm text-[#111827] font-medium mb-2">오늘의 분석</p>
                          <p className="text-xs text-[#6B7280] leading-relaxed">
                            가장 지출이 많은 요일은 <span className="font-bold text-black">{
                              [...(analysis?.dailyPattern || [])].sort((a, b) => b.amount - a.amount)[0]?.name
                            }요일</span> 입니다.
                            주말 지출 관리에 유의하시면 목표 저축액 달성에 큰 도움이 될 것 같습니다.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-2xl border border-[#F3F4F6] shadow-sm flex flex-col w-full">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
                            {selectedDay || '일'}요일 상세 내역
                          </h2>
                          <span className="text-xs text-gray-400">차트를 클릭하여 요일을 변경하세요</span>
                        </div>

                        <div className="flex-1 max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {(() => {
                            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                            const targetDay = selectedDay || dayNames[new Date().getDay()];
                            const filtered = transactions.filter(t => {
                              const d = new Date(t.date);
                              return t.amount < 0 && dayNames[d.getDay()] === targetDay;
                            });

                            return filtered.length > 0 ? (
                              filtered.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-800">{t.title}</p>
                                    <p className="text-[10px] text-gray-500">{t.date}</p>
                                  </div>
                                  <p className="text-xs font-bold text-red-600">
                                    {t.amount.toLocaleString()}원
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-20">해당 요일에 지출 내역이 없습니다.</p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 p-8 rounded-2xl text-white">
                      <p className="text-xs opacity-60 uppercase font-bold tracking-widest mb-4">AI Analysis Strategy</p>
                      <h3 className="text-xl font-medium leading-tight mb-4">지출 최적화 전략</h3>
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">1</div>
                          <p className="text-xs opacity-80 leading-normal">상위 3개 카테고리 지출이 전체의 {
                            analysis?.categoryChartData.slice(0, 3).reduce((acc, curr) => acc + curr.percent, 0)
                          }%를 차지합니다.</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">2</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_4px_20px_rgba(0,0,0,0.04)] h-[calc(100vh-280px)] flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-[#F3F4F6] bg-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">재정 어드바이저</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Online</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={cn(
                      "flex gap-4 max-w-[80%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                      {msg.role === 'ai' && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">AI</div>
                      )}
                      <div className={cn(
                        "px-5 py-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'ai'
                          ? "bg-[#F3F4F6] text-[#111827] rounded-tl-none"
                          : "bg-black text-white rounded-tr-none"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 border-t border-[#F3F4F6] bg-white">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="무엇이든 물어보세요..."
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black/20"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending}
                      className="bg-black text-white p-3 rounded-xl hover:opacity-90 active:scale-95 transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Action Button (Mobile) */}
      <button className="lg:hidden fixed bottom-28 right-6 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90 transition-transform">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
