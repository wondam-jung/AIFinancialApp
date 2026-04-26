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
  FileUp,
  BarChart2
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
  Cell,
  Legend
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

interface MonthData {
  monthKey: string;
  label: string;
  dateRangeLabel: string;
  transactions: Transaction[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [monthlyHistory, setMonthlyHistory] = useState<MonthData[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const transactions = useMemo(
    () => monthlyHistory.find(m => m.monthKey === selectedMonthKey)?.transactions || [],
    [monthlyHistory, selectedMonthKey]
  );
  const isImported = monthlyHistory.length > 0;
  const [insightCache, setInsightCache] = useState<Record<string, Insight[]>>({});
  const insights = selectedMonthKey ? (insightCache[selectedMonthKey] || []) : [];
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: '안녕하세요! 당신의 소비 내역을 분석해 드릴까요? 엑셀 파일을 import 하거나 무엇이든 물어보세요.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [trendInsight, setTrendInsight] = useState<{ summary: string; tips: string[] } | null>(null);
  const [loadingTrendInsight, setLoadingTrendInsight] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const injectMockData = () => {
    console.log('[Dev Mode] Injecting mock data...');
    const mockMonth1: MonthData = {
      monthKey: '2025-04',
      label: '2025년 4월',
      dateRangeLabel: '2025.04.01 ~ 2025.04.30',
      transactions: [
        { id: 1, date: '2025-04-01', category: '고정비', title: '월세', amount: -850000 },
        { id: 2, date: '2025-04-02', category: '식비', title: '스타벅스', amount: -15000 },
        { id: 3, date: '2025-04-03', category: '생필품비', title: '쿠팡', amount: -45000 },
        { id: 4, date: '2025-04-04', category: '교통비', title: '택시', amount: -12000 },
        { id: 5, date: '2025-04-05', category: '수입', title: '급여', amount: 3500000 },
        { id: 6, date: '2025-04-12', category: '식비', title: '배달의민족', amount: -28000 },
        { id: 7, date: '2025-04-15', category: '여가', title: '넷플릭스', amount: -17000 },
        { id: 8, date: '2025-04-18', category: '꾸밈비', title: '올리브영', amount: -54000 },
        { id: 9, date: '2025-04-20', category: '식비', title: '스타벅스', amount: -8000 },
        { id: 10, date: '2025-04-22', category: '생필품비', title: '이마트', amount: -125000 },
        { id: 11, date: '2025-04-25', category: '자기개발', title: '교보문고', amount: -22000 },
        { id: 12, date: '2025-04-28', category: '교통비', title: '지하철', amount: -45000 }
      ]
    };

    const mockMonth2: MonthData = {
      monthKey: '2025-03',
      label: '2025년 3월',
      dateRangeLabel: '2025.03.01 ~ 2025.03.31',
      transactions: [
        { id: 101, date: '2025-03-01', category: '고정비', title: '월세', amount: -850000 },
        { id: 102, date: '2025-03-05', category: '수입', title: '급여', amount: 3500000 },
        { id: 103, date: '2025-03-10', category: '식비', title: '배달의민족', amount: -45000 },
        { id: 104, date: '2025-03-12', category: '생필품비', title: '쿠팡', amount: -85000 },
        { id: 105, date: '2025-03-20', category: '식비', title: '스타벅스', amount: -25000 },
        { id: 106, date: '2025-03-25', category: '여가', title: '영화관', amount: -30000 },
      ]
    };

    const mockMonth3: MonthData = {
      monthKey: '2025-02',
      label: '2025년 2월',
      dateRangeLabel: '2025.02.01 ~ 2025.02.28',
      transactions: [
        { id: 201, date: '2025-02-01', category: '고정비', title: '월세', amount: -850000 },
        { id: 202, date: '2025-02-05', category: '수입', title: '급여', amount: 3500000 },
        { id: 203, date: '2025-02-08', category: '식비', title: '식당', amount: -150000 },
        { id: 204, date: '2025-02-14', category: '여가', title: '호텔', amount: -250000 },
        { id: 205, date: '2025-02-28', category: '생필품비', title: '이마트', amount: -65000 },
      ]
    };

    setMonthlyHistory([mockMonth3, mockMonth2, mockMonth1]);
    setSelectedMonthKey('2025-04');
    
    setInsightCache({
      '2025-04': [
        { title: '[개발 모드] 지출 방어 성공!', content: '이번 달은 지난달보다 식비를 15% 줄였습니다.', type: 'success' },
        { title: '[개발 모드] 구독 서비스 점검', content: '여가 카테고리의 넷플릭스 결제가 발생했습니다.', type: 'info' },
        { title: '[개발 모드] 생필품 지출 경고', content: '이마트 등 생필품 지출 비중이 높습니다. 불필요한 소비가 없었는지 확인해보세요.', type: 'warning' }
      ]
    });
  };

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

    // Top Merchants
    const merchantMap: Record<string, { count: number; total: number }> = {};
    transactions.filter(t => t.amount < 0 && t.category !== '수입').forEach(t => {
      if (!merchantMap[t.title]) merchantMap[t.title] = { count: 0, total: 0 };
      merchantMap[t.title].count += 1;
      merchantMap[t.title].total += Math.abs(t.amount);
    });
    const topMerchants = Object.entries(merchantMap)
      .map(([name, { count, total }]) => ({ name, count, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    // Date range
    const sortedDates = transactions
      .map(t => t.date)
      .filter(Boolean)
      .sort();
    const firstDate = sortedDates[0] || '';
    const lastDate = sortedDates[sortedDates.length - 1] || '';
    const fmtDate = (d: string) => {
      if (!d) return '';
      const [y, m, day] = d.split('-');
      return `${y}.${m}.${day}`;
    };
    const dateRangeLabel = firstDate && lastDate
      ? firstDate === lastDate
        ? fmtDate(firstDate)
        : `${fmtDate(firstDate)} ~ ${fmtDate(lastDate)}`
      : '';

    return {
      totalIncome: income,
      totalExpense: expense,
      netSavings: income - expense,
      totalCount: transactions.length,
      avgCountPerDay: (transactions.length / dayCount).toFixed(1),
      categoryChartData,
      dailyPattern,
      topMerchants,
      dateRangeLabel
    };
  }, [transactions]);

  const monthlyTrendsData = useMemo(() => {
    return monthlyHistory.map(m => {
      const income = m.transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
      const expense = Math.abs(m.transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
      return {
        month: m.monthKey,
        label: m.label,
        수입: income,
        지출: expense,
        저축: income - expense
      };
    }).sort((a, b) => a.month.localeCompare(b.month));
  }, [monthlyHistory]);

  const overallTrends = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const catMap: Record<string, number> = {};

    monthlyHistory.forEach(m => {
      m.transactions.forEach(t => {
        if (t.amount > 0) totalIncome += t.amount;
        if (t.amount < 0) {
          totalExpense += Math.abs(t.amount);
          if (t.category !== '수입') {
            catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
          }
        }
      });
    });

    const categoryStats = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalCatExpense = categoryStats.reduce((acc, curr) => acc + curr.value, 0);
    const categoryChartData = categoryStats.map(cat => ({
      ...cat,
      percent: totalCatExpense > 0 ? Math.round((cat.value / totalCatExpense) * 100) : 0
    }));

    return {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      categoryChartData
    };
  }, [monthlyHistory]);

  useEffect(() => {
    if (selectedMonthKey && transactions.length > 0 && !insightCache[selectedMonthKey] && !loadingInsights) {
      fetchInsights(selectedMonthKey, transactions);
    }
  }, [selectedMonthKey, transactions.length, insightCache, loadingInsights]);

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

  const fetchInsights = async (monthKey: string, data: Transaction[]) => {
    setLoadingInsights(true);

    if (import.meta.env.DEV) {
      setTimeout(() => {
        setInsightCache(prev => ({ ...prev, [monthKey]: [
          { title: '[개발 모드] 지출 방어 성공!', content: '이번 달은 지난달보다 식비를 15% 줄였습니다.', type: 'success' },
          { title: '[개발 모드] 구독 서비스 점검', content: '여가 카테고리의 넷플릭스 결제가 발생했습니다.', type: 'info' },
          { title: '[개발 모드] 생필품 지출 경고', content: '생필품 지출 비중이 높습니다. 불필요한 소비가 없었는지 확인해보세요.', type: 'warning' }
        ]}));
        setLoadingInsights(false);
      }, 800);
      return;
    }

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
          setInsightCache(prev => ({ ...prev, [monthKey]: result.insights }));
          setLoadingInsights(false);
          return;
        }
      } catch (error: any) {
        lastError = error;
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
          console.log('[Info] AI API Rate limit reached. Using fallback insights.');
          break; // Stop trying other models if rate limited
        } else {
          console.warn(`Model ${modelName} failed:`, error);
        }
      }
    }

    setInsightCache(prev => ({ ...prev, [monthKey]: [
      { title: '지출 분석 완료', content: '데이터 분석 중 일시적인 오류가 발생했습니다. 기본 분석 결과를 확인해주세요.', type: 'info' },
      { title: '식비 주의', content: '외식 지출이 높은 편입니다.', type: 'warning' },
    ]}));
    setLoadingInsights(false);
  };

  const fetchTrendInsights = async () => {
    if (trendInsight || loadingTrendInsight || monthlyTrendsData.length === 0) return;
    setLoadingTrendInsight(true);

    if (import.meta.env.DEV) {
      setTimeout(() => {
        setTrendInsight({
          summary: "전체적으로 식비 비중이 가장 높으며, 최근 3개월간 지출이 소폭 증가하는 추세입니다.",
          tips: [
            "배달의민족, 외식 등 불필요한 식비를 주 1회 줄이는 것을 목표로 해보세요.",
            "고정비 중 안 쓰는 구독 서비스(넷플릭스 등)가 있는지 정기적으로 점검하세요."
          ]
        });
        setLoadingTrendInsight(false);
      }, 1000);
      return;
    }

    const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
    for (const modelName of modelsToTry) {
      try {
        const prompt = `당신은 전문 재무 관리사입니다. 다음은 사용자의 월별 수입/지출 트렌드 요약 데이터입니다.
        데이터: ${JSON.stringify(monthlyTrendsData)}
        
        이 데이터를 바탕으로 두 가지를 분석해주세요:
        1. "summary": 전체적인 소비 패턴과 수입/지출 트렌드 요약 (2-3문장 내외, 존댓말 사용)
        2. "tips": 즉각적으로 실행 가능한 구체적인 지출 절감 방법 2-3가지 (배열 형태)
        
        결과는 반드시 JSON 형식으로만 응답하세요:
        { "summary": "요약 내용...", "tips": ["팁1", "팁2"] }`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const text = response.text.trim();
        const result = JSON.parse(text);
        if (result.summary && result.tips) {
          setTrendInsight(result);
          setLoadingTrendInsight(false);
          return;
        }
      } catch (e: any) {
        if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
           console.log('[Info] AI API Rate limit reached for trends.');
           break;
        } else {
           console.warn(`Model ${modelName} failed:`, e);
        }
      }
    }
    
    // Fallback if all fail or rate limited
    setTrendInsight({
      summary: "전체적으로 밸런스 있는 지출을 유지하고 있으나, 특정 카테고리의 비중이 다소 높습니다.",
      tips: ["외식 횟수 줄이기", "안 쓰는 구독 서비스 해지하기", "충동 구매 예산 한도 정하기"]
    });
    setLoadingTrendInsight(false);
  };

  useEffect(() => {
    if (activeTab === 'trends' && monthlyTrendsData.length > 0 && !trendInsight && !loadingTrendInsight) {
      fetchTrendInsights();
    }
  }, [activeTab, monthlyTrendsData.length, trendInsight, loadingTrendInsight]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input value so same file can be re-selected
    e.target.value = '';

    const reader = new FileReader();
    setIsAnalyzing(true);
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Get raw rows including headers
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // 1. Single AI Analysis Call (Mapping + Categorization Rules)
        let aiConfig = null;
        
        if (import.meta.env.DEV) {
          console.log('[Dev Mode] Skipping AI API call for file upload. Using mock categories.');
          aiConfig = {
            mapping: null,
            categories: {
              "월세": "고정비", "관리비": "고정비", "가스요금": "고정비", "전기요금": "고정비",
              "쿠팡": "생필품비", "이마트": "생필품비", "다이소": "생필품비", "네이버": "생필품비",
              "맥도날드": "식비", "스타벅스": "식비", "배달의민족": "식비", "식당": "식비", "카페": "식비",
              "급여": "수입", "용돈": "수입", "보너스": "수입", "월급": "수입",
              "교통카드": "교통비", "택시": "교통비", "버스": "교통비", "지하철": "교통비", "주유": "교통비",
              "넷플릭스": "고정비", "유튜브": "고정비", "통신비": "고정비",
              "올리브영": "꾸밈비", "미용실": "꾸밈비", "옷": "꾸밈비",
              "병원": "의료", "약국": "의료", "치과": "의료",
              "영화": "여가", "게임": "여가", "도서": "자기개발", "학원": "자기개발"
            }
          };
          await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
        } else {
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
            } catch (e: any) { 
              if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
                console.log('[Info] AI API Rate limit reached. Using mock categorization fallback.');
                aiConfig = {
                  mapping: null,
                  categories: {
                    "월세": "고정비", "관리비": "고정비", "가스요금": "고정비", "전기요금": "고정비",
                    "쿠팡": "생필품비", "이마트": "생필품비", "다이소": "생필품비", "네이버": "생필품비",
                    "맥도날드": "식비", "스타벅스": "식비", "배달의민족": "식비", "식당": "식비", "카페": "식비",
                    "급여": "수입", "용돈": "수입", "보너스": "수입", "월급": "수입",
                    "교통카드": "교통비", "택시": "교통비", "버스": "교통비", "지하철": "교통비", "주유": "교통비",
                    "넷플릭스": "고정비", "유튜브": "고정비", "통신비": "고정비",
                    "올리브영": "꾸밈비", "미용실": "꾸밈비", "옷": "꾸밈비",
                    "병원": "의료", "약국": "의료", "치과": "의료",
                    "영화": "여가", "게임": "여가", "도서": "자기개발", "학원": "자기개발"
                  }
                };
                break; // Stop trying other models if rate limited
              } else {
                console.warn(`Model ${modelName} failed:`, e); 
              }
            }
          }
        }

        // 2. Data Processing
        const mappedData: Transaction[] = rawRows.slice(1).map((row, idx) => {
          if (!row || row.length === 0) return null;
          const parseNum = (val: any) => {
            const cleaned = String(val || 0).replace(/[^0-9.-]/g, "");
            return cleaned ? Number(cleaned) : 0;
          };

          let dateVal, titleVal, amount = 0;

          if (aiConfig?.mapping) {
            const m = aiConfig.mapping;
            dateVal = m.dateIdx !== null ? row[m.dateIdx] : null;
            titleVal = m.titleIdx !== null ? row[m.titleIdx] : '항목 없음';
            if (m.amountIdx !== null && m.amountIdx !== undefined) {
              amount = parseNum(row[m.amountIdx]);
            }

            // Priority for dedicated columns
            if (m.withdrawalIdx !== null && m.withdrawalIdx !== undefined && row[m.withdrawalIdx]) {
              amount = -Math.abs(parseNum(row[m.withdrawalIdx]));
            } else if (m.depositIdx !== null && m.depositIdx !== undefined && row[m.depositIdx]) {
              amount = Math.abs(parseNum(row[m.depositIdx]));
            }
          } else {
            // Manual Fallback
            dateVal = row.find(c => c instanceof Date || (typeof c === 'string' && (c.includes('-') || c.includes('.'))));
            titleVal = row.find(c => typeof c === 'string' && c.length > 1 && isNaN(parseNum(c)) && c !== dateVal) || '항목 없음';
            const nums = row.map(parseNum).filter(n => n !== 0 && !isNaN(n));
            amount = nums.length > 0 ? nums[nums.length - 1] : 0;
          }

          let category = '기타';
          if (aiConfig?.categories) {
            const titleStr = String(titleVal).trim();
            // Try exact match first, then partial match
            category = aiConfig.categories[titleStr] 
               || Object.entries(aiConfig.categories).find(([k]) => titleStr.includes(k))?.[1] 
               || '기타';
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
          // Detect dominant month from data
          const monthCounts: Record<string, number> = {};
          mappedData.forEach(t => {
            const k = t.date.substring(0, 7);
            monthCounts[k] = (monthCounts[k] || 0) + 1;
          });
          const monthKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
            || new Date().toISOString().substring(0, 7);
          const [y, m] = monthKey.split('-');
          const label = `${y}년 ${parseInt(m)}월`;

          // Compute actual date range from data
          const sortedDates = mappedData.map(t => t.date).filter(Boolean).sort();
          const fmtD = (d: string) => { const [yy, mm, dd] = d.split('-'); return `${yy}.${mm}.${dd}`; };
          const dateRangeLabel = sortedDates.length > 0
            ? sortedDates[0] === sortedDates[sortedDates.length - 1]
              ? fmtD(sortedDates[0])
              : `${fmtD(sortedDates[0])} ~ ${fmtD(sortedDates[sortedDates.length - 1])}`
            : label;

          setMonthlyHistory(prev => {
            const next = prev.filter(p => p.monthKey !== monthKey);
            return [...next, { monthKey, label, dateRangeLabel, transactions: mappedData }]
              .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
          });
          setSelectedMonthKey(monthKey);
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
      {/* Global Loading Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center gap-6 shadow-2xl max-w-xs w-full mx-4">
            <div className="w-16 h-16 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-bold text-[#111827] text-lg mb-1">AI 분석 중...</p>
              <p className="text-sm text-[#6B7280]">거래 데이터를 파악하고 카테고리를 분류하고 있어요.</p>
            </div>
          </div>
        </div>
      )}
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
          { id: 'trends', icon: BarChart2, label: 'Trends' },
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
        {/* Always-mounted hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />
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

                        <div className="flex flex-col items-center gap-4">
                          <button
                            onClick={() => { if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); } }}
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

                          {import.meta.env.DEV && (
                            <button
                              onClick={injectMockData}
                              className="mt-2 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors underline underline-offset-4"
                            >
                              [개발 모드] 가짜 데이터로 채우기
                            </button>
                          )}

                          <div className="flex items-center gap-8 text-[10px] uppercase tracking-[0.2em] font-black text-gray-300 mt-4">
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
                        <p className="text-sm text-[#6B7280] font-light">
                          {analysis?.dateRangeLabel
                            ? `📅 데이터 기간: ${analysis.dateRangeLabel}`
                            : '분석된 기간 동안의 재정 현황 요약입니다.'}
                        </p>
                      </div>
                      <button
                        onClick={() => { if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); } }}
                        className="group flex items-center gap-2 px-4 py-2.5 hover:bg-black hover:text-white text-gray-600 border border-gray-200 rounded-2xl transition-all duration-300 shadow-sm text-sm font-medium"
                        title="월별 파일 추가"
                      >
                        <FileUp className="w-4 h-4" />
                        <span>파일 추가</span>
                      </button>
                    </div>

                    {/* Month Tabs */}
                    {monthlyHistory.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {monthlyHistory.map(m => (
                          <button
                            key={m.monthKey}
                            onClick={() => { setSelectedMonthKey(m.monthKey); }}
                            className={cn(
                              "px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-start text-left",
                              selectedMonthKey === m.monthKey
                                ? "bg-black text-white shadow-md"
                                : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800"
                            )}
                          >
                            <span>{m.label}</span>
                            <span className={cn(
                              "text-[10px] font-normal mt-0.5",
                              selectedMonthKey === m.monthKey ? "text-gray-300" : "text-gray-400"
                            )}>{m.dateRangeLabel}</span>
                          </button>
                        ))}
                        {monthlyHistory.length > 1 && (
                          <span className="text-xs text-gray-400 ml-2">{monthlyHistory.length}개월 로드됨</span>
                        )}
                      </div>
                    )}

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
                      {/* Category Chart */}
                      <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <PieChartIcon className="w-5 h-5 text-rose-500" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">카테고리별 지출</h2>
                            <p className="text-xs text-[#6B7280]">가장 큰 비중을 차지하는 항목을 확인하세요.</p>
                          </div>
                        </div>
                        <div className="h-[250px] w-full">
                          {chartReady && (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                              <PieChart>
                                <Pie
                                  data={analysis?.categoryChartData}
                                  innerRadius={60}
                                  outerRadius={90}
                                  paddingAngle={5}
                                  dataKey="value"
                                  stroke="none"
                                  onClick={(data) => setSelectedCategory(data.name)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {(analysis?.categoryChartData || []).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => value.toLocaleString() + '원'} />
                              </PieChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-6">
                          {(analysis?.categoryChartData || []).slice(0, 6).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-xs text-[#6B7280]">{item.name}</span>
                              </div>
                              <span className="text-xs font-semibold">{item.percent}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Category Details */}
                      <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">{selectedCategory || analysis?.categoryChartData?.[0]?.name || '카테고리'} 상세 내역</h2>
                            <p className="text-xs text-[#6B7280]">차트를 클릭하여 변경하세요.</p>
                          </div>
                        </div>
                        <div className="flex-1 max-h-[350px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {(() => {
                            const targetCat = selectedCategory || analysis?.categoryChartData?.[0]?.name;
                            const filtered = transactions.filter(t => t.amount < 0 && t.category === targetCat);
                            return filtered.length > 0 ? (
                              filtered.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{t.title}</p>
                                    <p className="text-[11px] text-gray-500 mt-1">{t.date}</p>
                                  </div>
                                  <p className="text-sm font-bold text-rose-600">
                                    {Math.abs(t.amount).toLocaleString()}원
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-10">내역이 없습니다.</p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {/* Daily Pattern Chart */}
                      <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">요일별 소비 패턴</h2>
                            <p className="text-xs text-[#6B7280]">지출이 가장 많은 요일을 확인하세요.</p>
                          </div>
                        </div>
                        <div className="h-[250px] w-full">
                          {chartReady && (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                              <BarChart data={analysis?.dailyPattern || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis hide />
                                <Tooltip formatter={(value) => value.toLocaleString() + '원'} cursor={{ fill: '#F9FAFB' }} />
                                <Bar
                                  dataKey="amount"
                                  name="소비 금액"
                                  radius={[6, 6, 0, 0]}
                                  barSize={32}
                                  onClick={(data) => setSelectedDay(data.name)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {(analysis?.dailyPattern || []).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>

                      {/* Daily Pattern Details */}
                      <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">{selectedDay || '일'}요일 상세 내역</h2>
                            <p className="text-xs text-[#6B7280]">차트를 클릭하여 요일을 변경하세요.</p>
                          </div>
                        </div>
                        <div className="flex-1 max-h-[350px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {(() => {
                            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                            const targetDay = selectedDay || dayNames[new Date().getDay()];
                            const filtered = transactions.filter(t => {
                              const d = new Date(t.date);
                              return t.amount < 0 && dayNames[d.getDay()] === targetDay;
                            });

                            return filtered.length > 0 ? (
                              filtered.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{t.title}</p>
                                    <p className="text-[11px] text-gray-500 mt-1">{t.date}</p>
                                  </div>
                                  <p className="text-sm font-bold text-rose-600">
                                    {Math.abs(t.amount).toLocaleString()}원
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-10">해당 요일에 지출 내역이 없습니다.</p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {/* Top Merchants */}
                      <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-[#111827]">주요 거래처 Top 3</h2>
                            <p className="text-xs text-[#6B7280]">가장 많이 지출한 가맹점입니다.</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {(analysis?.topMerchants || []).map((merchant, idx) => (
                            <div key={idx} className="flex items-center gap-5 p-5 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0",
                                idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'
                              )}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-[#111827] truncate">{merchant.name}</p>
                                <p className="text-xs text-[#6B7280] mt-0.5">{merchant.count}회 방문</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-[#111827]">{merchant.total.toLocaleString()}원</p>
                                <p className="text-xs text-rose-400 font-medium mt-0.5">
                                  {analysis?.totalExpense ? Math.round((merchant.total / analysis.totalExpense) * 100) : 0}%
                                </p>
                              </div>
                            </div>
                          ))}
                          {(!analysis?.topMerchants || analysis.topMerchants.length === 0) && (
                            <p className="text-sm text-gray-400 text-center py-8">거래 데이터가 없습니다.</p>
                          )}
                        </div>
                      </div>

                      {/* AI Insights Panel */}
                      <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <Lightbulb className="w-5 h-5 text-indigo-500" />
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

                        <div className="grid grid-cols-1 gap-4 flex-1">
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
                            <div className="p-12 text-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200 h-full flex flex-col items-center justify-center">
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

                    <div className="bg-white rounded-[2rem] border border-[#F3F4F6] shadow-sm overflow-hidden mt-10">
                      <div className="p-6 border-b border-[#F3F4F6] flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-[#111827]">최근 거래 내역</h2>
                          <p className="text-xs text-[#6B7280]">가장 최근의 10개 거래를 보여드립니다.</p>
                        </div>
                      </div>

                      <div className="divide-y divide-[#F3F4F6]">
                        {transactions.slice(0, 10).map((tx) => (
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
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'trends' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {!isImported ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                      <BarChart2 className="w-10 h-10 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-[#111827] mb-2">데이터가 없습니다</h2>
                    <p className="text-[#6B7280]">엑셀 파일을 업로드하여 트렌드를 확인해보세요.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Overall Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#6B7280] mb-1 font-medium">총 수입</p>
                          <h3 className="text-2xl font-bold text-[#111827]">{overallTrends.totalIncome.toLocaleString()}원</h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-emerald-500" />
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#6B7280] mb-1 font-medium">총 지출</p>
                          <h3 className="text-2xl font-bold text-[#111827]">{overallTrends.totalExpense.toLocaleString()}원</h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
                          <TrendingDown className="w-6 h-6 text-rose-500" />
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-[2rem] border border-[#F3F4F6] shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#6B7280] mb-1 font-medium">순 저축</p>
                          <h3 className={cn("text-2xl font-bold", overallTrends.netSavings >= 0 ? "text-indigo-600" : "text-rose-600")}>
                            {overallTrends.netSavings > 0 ? '+' : ''}{overallTrends.netSavings.toLocaleString()}원
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-indigo-500" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm">
                      <div className="mb-8">
                        <h2 className="text-xl font-bold text-[#111827]">월별 입출금 추이</h2>
                        <p className="text-sm text-[#6B7280] mt-1">업로드된 모든 데이터의 전체 흐름을 한눈에 파악하세요.</p>
                      </div>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart data={monthlyTrendsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#6B7280' }}
                              tickFormatter={(value) => `${(value / 10000).toLocaleString()}만`}
                            />
                            <Tooltip
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '16px' }}
                              formatter={(value: number) => [`${value.toLocaleString()}원`]}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="수입" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={60} />
                            <Bar dataKey="지출" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={60} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm">
                      <div className="mb-6">
                        <h2 className="text-xl font-bold text-[#111827]">누적 카테고리별 지출</h2>
                        <p className="text-sm text-[#6B7280] mt-1">전체 기간 동안의 지출 비율입니다.</p>
                      </div>
                      <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-[240px] h-[240px] flex-shrink-0 relative">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                              <Pie
                                data={overallTrends.categoryChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={90}
                                dataKey="value"
                                stroke="none"
                              >
                                {overallTrends.categoryChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(value: number) => `${value.toLocaleString()}원`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-sm text-[#6B7280]">총 지출</span>
                            <span className="text-lg font-bold text-[#111827]">
                              {overallTrends.categoryChartData.length > 0 ? '100%' : '0%'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 w-full grid grid-cols-2 gap-x-4 gap-y-4">
                          {overallTrends.categoryChartData.slice(0, 8).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-sm font-medium text-[#111827]">{item.name}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-[#111827]">{item.percent}%</div>
                                <div className="text-xs text-[#6B7280]">{item.value.toLocaleString()}원</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-[#F3F4F6] shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                          <Zap className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[#111827]">AI 트렌드 요약 & 절약 솔루션</h2>
                          <p className="text-sm text-[#6B7280]">전체적인 소비 패턴을 분석하여 맞춤형 조언을 제공합니다.</p>
                        </div>
                      </div>

                      {loadingTrendInsight ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                          <p className="text-sm text-[#6B7280] font-medium">전체 지출 트렌드를 분석하고 있어요...</p>
                        </div>
                      ) : trendInsight ? (
                        <div className="space-y-6">
                          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <p className="text-[#111827] leading-relaxed text-[15px] font-medium pl-2">{trendInsight.summary}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#111827] mb-4 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              지출 절감을 위한 액션 플랜
                            </h3>
                            <div className="space-y-3">
                              {trendInsight.tips.map((tip, idx) => (
                                <div key={idx} className="flex gap-4 items-start bg-gray-50 p-4 rounded-xl border border-gray-100/50">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-emerald-700 text-xs font-bold">{idx + 1}</span>
                                  </div>
                                  <p className="text-[14px] text-[#374151] pt-0.5 leading-relaxed font-medium">{tip}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-[#6B7280]">트렌드 분석 데이터가 부족합니다.</p>
                        </div>
                      )}
                    </div>
                  </div>
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
