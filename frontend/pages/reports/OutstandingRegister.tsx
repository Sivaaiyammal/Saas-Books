import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Printer,
  ArrowLeft,
  Search,
  ChevronDown,
  RotateCcw,
  Building2,
  Loader2,
  ShieldCheck,
  Wallet,
  TrendingDown,
  Clock,
  ChevronRight,
  Hash,
  AlertTriangle,
  ArrowUpRight,
  FileDown,
  Activity,
  X,
  MapPin,
  Phone,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  Users,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  Layers,
  Banknote,
  LayoutGrid,
  Filter,
  Share,
  Share2,
} from "lucide-react";
import { mastersApi, vouchersApi, settingsApi } from "../../services/api";
import OutstandingTemplate from "../../components/OutstandingTemplate";
import html2pdf from "html2pdf.js";

// --- Types ---
interface OutstandingBill {
  allocation_id: number;
  bill_no: string;
  bill_date: string;
  bill_amount: string | number;
  pending_amount: string | number;
  voucher_id: number;
  voucher_no: string;
  voucher_date: string;
  voucher_type?: string;
  age_days?: number;
}

interface OutstandingData {
  bills: OutstandingBill[];
  total_outstanding: string | number;
  bill_count: number;
}

interface LedgerWithBalance {
  id: number;
  name: string;
  group_name: string;
  outstanding_balance: number;
  bill_count: number;
  max_age: number;
  [key: string]: any;
}

type NavigationLevel = "type_selection" | "ledger_list" | "bill_details";
type ReportCategory = "receivable" | "payable" | null;
type AgeFilter = "all" | "30" | "90" | "120";

const numberToWords = (num: number): string => {
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    let s = b[Math.floor(n / 10)];
    if (n % 10 > 0) s += "-" + a[n % 10];
    return s + " ";
  };
  const n = Math.floor(num);
  if (n === 0) return "Zero";
  let str = "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n / 100000) % 100);
  const thousand = Math.floor((n / 1000) % 100);
  const hundred = Math.floor((n / 100) % 10);
  const rest = n % 100;
  if (crore > 0) str += convert(crore) + "Crore ";
  if (lakh > 0) str += convert(lakh) + "Lakh ";
  if (thousand > 0) str += convert(thousand) + "Thousand ";
  if (hundred > 0) str += convert(hundred) + "Hundred ";
  if (rest > 0) str += convert(rest);
  return str.trim() + " Rupees Only";
};

// --- Component ---
const OutstandingReport: React.FC = () => {
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Navigation & Category
  const [navLevel, setNavLevel] = useState<NavigationLevel>("type_selection");
  const [activeCategory, setActiveCategory] = useState<ReportCategory>(null);

  // Data States
  const [ledgers, setLedgers] = useState<LedgerWithBalance[]>([]);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);
  const [reportData, setReportData] = useState<OutstandingData | null>(null);

  // Loading States
  const [isLoadingLedgers, setIsLoadingLedgers] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const [businessDetails, setBusinessDetails] = useState<any>(null);
  const [defaultBank, setDefaultBank] = useState<any>(null);

  const calculateAge = (dateStr: string) => {
    try {
      const billDate = new Date(dateStr);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - billDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
      return 0;
    }
  };

  // Fetch balances for all relevant ledgers in the selected category
  const fetchCategorySummary = async (category: ReportCategory) => {
    setIsLoadingLedgers(true);
    setError(null);
    try {
      const mastersRes = await mastersApi.getLedgers();
      if (!mastersRes.success)
        throw new Error("Failed to load account masters");

      const allLedgers = Array.isArray(mastersRes.data)
        ? mastersRes.data
        : (mastersRes.data as any)?.ledgers || [];

      const targetLedgers = allLedgers.filter((l: any) => {
        const group = (l.group_name || "").toLowerCase();
        if (category === "receivable")
          return group.includes("debtor") || l.group_id === 2;
        if (category === "payable")
          return group.includes("creditor") || l.group_id === 3;
        return false;
      });

      const reconciledList = await Promise.all(
        targetLedgers.map(async (ledger: any) => {
          try {
            const balanceRes = await mastersApi.getLedgerOutstanding(ledger.id);
            if (balanceRes.success && balanceRes.data) {
              const bills = balanceRes.data.bills || [];
              const ages = bills.map(
                (b: any) => b.age_days || calculateAge(b.bill_date),
              );
              const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

              return {
                ...ledger,
                outstanding_balance: parseFloat(
                  String(balanceRes.data.total_outstanding || 0),
                ),
                bill_count: balanceRes.data.bill_count || 0,
                max_age: maxAge,
              };
            }
          } catch (e) {
            console.error(`Error fetching balance for ${ledger.name}`);
          }
          return {
            ...ledger,
            outstanding_balance: 0,
            bill_count: 0,
            max_age: 0,
          };
        }),
      );

      setLedgers(reconciledList.filter((l) => l.outstanding_balance > 0));
    } catch (err: any) {
      setError(err.message || "Analysis failed.");
    } finally {
      setIsLoadingLedgers(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, mastersRes] = await Promise.all([
          settingsApi.getGstSettings(),
          mastersApi.getLedgers(),
        ]);
        if (settingsRes.success) setBusinessDetails(settingsRes.data);
        if (mastersRes.success && mastersRes.data && mastersRes.data.ledgers) {
          const bank = mastersRes.data.ledgers.find(
            (l: any) =>
              l.group_name === "Bank Accounts" &&
              (l.is_default_bank === 1 ||
                l.is_default_bank === true ||
                l.is_default_bank === "1"),
          );
          if (bank) setDefaultBank(bank);
        }
      } catch (err) {
        console.error("Error fetching settings", err);
      }
    };
    fetchSettings();
  }, []);

  const fetchReportDetails = async (id: number) => {
    setIsLoadingReport(true);
    setError(null);
    try {
      const res = await mastersApi.getLedgerOutstanding(id);
      if (res.success && res.data) {
        const bills = res.data.bills || [];
        const processedBills = bills.map((b: any) => ({
          ...b,
          age_days: b.age_days || calculateAge(b.bill_date),
        }));

        setReportData({
          bills: processedBills,
          total_outstanding: res.data.total_outstanding || 0,
          bill_count: res.data.bill_count || 0,
        });
      } else {
        setError(res.message || "Failed to fetch details");
      }
    } catch (err: any) {
      setError("Server connection failed.");
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleShare = async () => {
    if (!selectedLedgerObject || !reportData || !invoiceRef.current) return;

    try {
      const opt = {
        margin: [0, 0, 0, 0],
        filename: `Statement_${selectedLedgerObject.name}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 5, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      // @ts-ignore
      const pdfBlob: Blob = await html2pdf()
        .set(opt)
        .from(invoiceRef.current)
        .outputPdf("blob");

      const pdfFile = new File(
        [pdfBlob],
        `Statement_${selectedLedgerObject.name}.pdf`,
        { type: "application/pdf" },
      );

      if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
        });
      } else {
        const url = URL.createObjectURL(pdfFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdfFile.name;
        a.click();
        URL.revokeObjectURL(url);

        const message = encodeURIComponent(
          `📊 Outstanding Statement — ${selectedLedgerObject.name}\n` +
            `💰 Total Due: ₹${totalOutstandingValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
            `📋 Pending Bills: ${reportData.bill_count}\n\n` +
            `Please find the attached PDF statement.`,
        );
        window.open(`https://wa.me/?text=${message}`, "_blank");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("Share failed:", err);
    }
  };
  const handleOpenVoucher = async (bill: OutstandingBill) => {
    setIsViewModalOpen(true);
    setIsLoadingDetails(true);
    setSelectedVoucher(bill);
    try {
      let res;
      if (bill.voucher_type?.toLowerCase().includes("sale")) {
        res = await vouchersApi.getSalesVoucher(bill.voucher_id);
      } else {
        res = await vouchersApi.getPurchaseVoucher(bill.voucher_id);
      }
      if (res.success && res.data) {
        setSelectedVoucher({
          ...bill,
          ...res.data,
          items: res.data.items || [],
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const filteredLedgerList = useMemo(() => {
    const s = (ledgerSearchQuery || "").toLowerCase();
    const ageThreshold = ageFilter === "all" ? 0 : parseInt(ageFilter);

    return ledgers.filter((l) => {
      const matchesSearch = (l.name || "").toLowerCase().includes(s);
      const matchesAge = ageFilter === "all" || l.max_age >= ageThreshold;
      return matchesSearch && matchesAge;
    });
  }, [ledgerSearchQuery, ledgers, ageFilter]);

  const categoryOverallOutstanding = useMemo(() => {
    return filteredLedgerList.reduce(
      (sum, l) => sum + l.outstanding_balance,
      0,
    );
  }, [filteredLedgerList]);

  const selectedLedgerObject = useMemo(() => {
    return ledgers.find((l) => Number(l.id) === Number(selectedLedgerId));
  }, [ledgers, selectedLedgerId]);

  const totalOutstandingValue = useMemo(() => {
    const val = reportData?.total_outstanding;
    return val ? parseFloat(String(val)) : 0;
  }, [reportData]);

  const handleBack = () => {
    if (navLevel === "bill_details") {
      setNavLevel("ledger_list");
      setReportData(null);
    } else if (navLevel === "ledger_list") {
      setNavLevel("type_selection");
      setActiveCategory(null);
      setLedgers([]);
      setAgeFilter("all");
    } else {
      navigate("/reports");
    }
  };

  const selectCategory = (category: ReportCategory) => {
    setActiveCategory(category);
    setNavLevel("ledger_list");
    fetchCategorySummary(category);
  };

  const selectLedger = (id: number) => {
    setSelectedLedgerId(id);
    setNavLevel("bill_details");
    fetchReportDetails(id);
  };

  // Fix: Added missing resetFilters function to clear search and age filters
  const resetFilters = () => {
    setLedgerSearchQuery("");
    setAgeFilter("all");
  };

  return (
    <div
      className={`${!isReportPreviewOpen && !isViewModalOpen ? "space-y-8" : "space-y-0"} animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0 no-print`}
    >
      {/* Header */}
      {/* Hidden off-screen render for share/PDF generation — never visible to user */}
      {selectedLedgerObject && reportData && (
        <div
          style={{
            position: "fixed",
            top: "-9999px",
            left: "-9999px",
            width: "800px",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <OutstandingTemplate
            ref={invoiceRef}
            ledger={{
              name: selectedLedgerObject.name,
              group_name: selectedLedgerObject.group_name,
              address: selectedLedgerObject.address,
              city: selectedLedgerObject.city,
              pincode: selectedLedgerObject.pincode,
              phone: selectedLedgerObject.phone,
              gstin: selectedLedgerObject.gstin,
            }}
            bills={reportData.bills}
            totalOutstanding={totalOutstandingValue}
            businessDetails={businessDetails}
            title={`${activeCategory === "receivable" ? "Receivable" : "Payable"} Statement`}
          />
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={handleBack}
            className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">
              {navLevel === "type_selection"
                ? "Outstanding Hub"
                : navLevel === "ledger_list"
                  ? `${activeCategory === "receivable" ? "Receivable" : "Payable"} Portfolio`
                  : "Bill Audit"}
            </h1>
            <p className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
              <ShieldCheck size={12} className="text-emerald-500" />
              {navLevel === "type_selection"
                ? "Choose Analysis Direction"
                : navLevel === "ledger_list"
                  ? `Monitoring ${filteredLedgerList.length} Accounts with Filter`
                  : `Viewing settlement history for ${selectedLedgerObject?.name}`}
            </p>
          </div>
        </div>

        {navLevel === "bill_details" && (
          <div className="flex items-center gap-3">
            <button
              disabled={isLoadingReport}
              onClick={() =>
                selectedLedgerId && fetchReportDetails(selectedLedgerId)
              }
              className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500 disabled:opacity-50"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={() => setIsReportPreviewOpen(true)}
              className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all hover:border-indigo-100"
            >
              <Printer size={18} /> Print Record
            </button>
            <button
              onClick={() => handleShare()}
              className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all hover:border-indigo-100"
            >
              <Share2 size={18} /> Share
            </button>
          </div>
        )}
      </div>

      {/* LEVEL 1: Category Selection */}
      {navLevel === "type_selection" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-12">
          <div
            onClick={() => selectCategory("receivable")}
            className="group relative bg-white p-12 rounded-[4rem] border-2 border-slate-100 hover:border-emerald-200 shadow-2xl shadow-slate-200/40 cursor-pointer transition-all hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700 opacity-50" />
            <div className="relative z-10 space-y-8">
              <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-inner">
                <ArrowUpCircle size={48} />
              </div>
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
                  Receivables
                </h2>
                <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-xs">
                  Customer Collection Audit
                </p>
              </div>
              <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full tracking-widest">
                  Sundry Debtors
                </span>
                <ChevronRight
                  size={24}
                  className="text-slate-300 group-hover:text-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>
          <div
            onClick={() => selectCategory("payable")}
            className="group relative bg-white p-12 rounded-[4rem] border-2 border-slate-100 hover:border-rose-200 shadow-2xl shadow-slate-200/40 cursor-pointer transition-all hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700 opacity-50" />
            <div className="relative z-10 space-y-8">
              <div className="w-24 h-24 bg-rose-100 rounded-[2.5rem] flex items-center justify-center text-rose-600 shadow-inner">
                <ArrowDownCircle size={48} />
              </div>
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
                  Payables
                </h2>
                <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-xs">
                  Supplier Liability Audit
                </p>
              </div>
              <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-4 py-2 rounded-full tracking-widest">
                  Sundry Creditors
                </span>
                <ChevronRight
                  size={24}
                  className="text-slate-300 group-hover:text-rose-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 2: Ledger List with Balances */}
      {navLevel === "ledger_list" && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
          {/* Overall Category Outstanding Banner */}
          {!isLoadingLedgers && ledgers.length > 0 && (
            <div className="bg-slate-900 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white relative overflow-hidden shadow-2xl">
              <div
                className={`absolute left-0 top-0 w-64 h-64 rounded-full -ml-32 -mt-32 opacity-20 ${activeCategory === "receivable" ? "bg-emerald-500" : "bg-rose-500"}`}
              />
              <div className="relative z-10 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  Filtered Portfolio Exposure
                </p>
                <div className="flex items-baseline gap-4">
                  <h2 className="text-5xl font-black tracking-tighter">
                    ₹
                    {categoryOverallOutstanding.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </h2>
                  <div
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${activeCategory === "receivable" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border-rose-500/30"}`}
                  >
                    {activeCategory === "receivable" ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {activeCategory === "receivable"
                      ? "Total Receivables"
                      : "Total Payables"}
                  </div>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-6 pr-6 md:border-r border-white/10">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Selected Accounts
                  </p>
                  <p className="text-2xl font-black">
                    {filteredLedgerList.length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400">
                  <Users size={24} />
                </div>
              </div>
            </div>
          )}

          {/* TOOLBAR: SEARCH & AGEING FILTERS */}
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="glass-panel p-4 rounded-3xl shadow-lg border-white/50 w-full lg:max-w-md">
              <div className="relative group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  value={ledgerSearchQuery}
                  onChange={(e) => setLedgerSearchQuery(e.target.value)}
                  placeholder={`Search accounts...`}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-400 outline-none transition-all shadow-inner placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="glass-panel p-2 rounded-3xl shadow-lg border-white/50 flex items-center gap-1 overflow-x-auto no-scrollbar">
              <div className="px-4 text-[10px] font-black uppercase text-slate-400 border-r border-slate-200 mr-2 flex items-center gap-2">
                <Clock size={14} className="text-indigo-500" /> Ageing
              </div>
              {[
                { id: "all", label: "Show All" },
                { id: "30", label: "> 30 Days" },
                { id: "90", label: "> 90 Days" },
                { id: "120", label: "> 120 Days" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAgeFilter(f.id as AgeFilter)}
                  className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    ageFilter === f.id
                      ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105"
                      : "bg-white/50 text-slate-500 hover:bg-white hover:text-indigo-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoadingLedgers ? (
            <div className="py-40 text-center flex flex-col items-center gap-6">
              <Loader2 size={64} className="animate-spin text-indigo-600" />
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  Reconciling Account Balances
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Performing Ageing Analysis in cloud vault...
                </p>
              </div>
            </div>
          ) : filteredLedgerList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredLedgerList.map((l) => (
                <div
                  key={l.id}
                  onClick={() => selectLedger(l.id)}
                  className="group bg-white p-10 rounded-[3.5rem] border-2 border-transparent hover:border-indigo-100 shadow-xl shadow-slate-200/30 cursor-pointer transition-all hover:-translate-y-2 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-50/50 transition-colors" />
                  <div className="space-y-10 relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                        {l.name[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-slate-900 truncate uppercase tracking-tight text-lg">
                          {l.name}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                          {l.group_name}
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Individual Dues
                        </p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter">
                          ₹{l.outstanding_balance.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right space-y-2">
                        <div
                          className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${l.max_age > 90 ? "bg-rose-50 text-rose-600 border-rose-100" : l.max_age > 30 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}
                        >
                          {l.max_age} Days Old
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {l.bill_count} Pending Bills
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-indigo-600 group-hover:translate-x-2 transition-transform duration-300">
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        View Detailed Audit
                      </span>
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-40 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 text-center flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase">
                  Analysis Complete
                </h3>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                  No accounts match the selected criteria.
                </p>
              </div>
              <button
                onClick={resetFilters}
                className="mt-4 px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl"
              >
                Reset Selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* LEVEL 3: Details */}
      {navLevel === "bill_details" && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          {/* Detailed Summary Header */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-8 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mb-8 opacity-40" />
              <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 font-black text-3xl z-10 uppercase">
                {selectedLedgerObject?.name?.[0]}
              </div>
              <div className="flex-1 z-10">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight">
                  {selectedLedgerObject?.name}
                </h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">
                  {selectedLedgerObject?.group_name}
                </p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-600">
                      {selectedLedgerObject?.phone || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-600">
                      {selectedLedgerObject?.city || "India"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 bg-white p-8 rounded-[3rem] border border-slate-200 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Net O/S Amount
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tighter">
                  ₹
                  {totalOutstandingValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h3>
              </div>
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm border border-rose-100/50">
                <TrendingDown size={20} />
              </div>
            </div>

            <div className="md:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-200 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Unsettled
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tighter">
                  {reportData?.bill_count || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                <FileText size={20} />
              </div>
            </div>

            <div className="md:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-200 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Max Age
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tighter">
                  {Math.max(
                    ...(reportData?.bills?.map((b) => b.age_days || 0) || [0]),
                  )}{" "}
                  <span className="text-[10px] opacity-40 font-bold tracking-normal uppercase">
                    Days
                  </span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100/50">
                <Clock size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl shadow-slate-200/30 overflow-hidden bento-item relative z-10">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">
                Bill-wise Detailed Breakdown
              </h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-6 pr-6 border-r border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Normal
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Late
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Critical
                    </span>
                  </div>
                </div>
                <button className="px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2 shadow-sm">
                  <FileDown size={14} /> Export Dataset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed min-w-[1200px]">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-6 w-[160px]">Bill Date</th>
                    <th className="px-4 py-6 w-[180px]">Reference No</th>
                    <th className="px-4 py-6 w-[180px]">Voucher Details</th>
                    <th className="px-4 py-6 w-[150px] text-right">
                      Bill Value
                    </th>
                    <th className="px-4 py-6 w-[150px] text-right">
                      Balance Due
                    </th>
                    <th className="px-8 py-6 w-[180px] text-center">
                      Ageing Analysis
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoadingReport ? (
                    <tr>
                      <td colSpan={6} className="py-40 text-center">
                        <Loader2
                          className="animate-spin text-indigo-600 mx-auto"
                          size={48}
                        />
                        <p className="text-xs font-black text-slate-400 uppercase mt-4 tracking-widest">
                          Loading...
                        </p>
                      </td>
                    </tr>
                  ) : (
                    reportData?.bills.map((bill) => {
                      const ageColor =
                        bill.age_days! > 90
                          ? "text-rose-600 bg-rose-50 border-rose-100"
                          : bill.age_days! > 30
                            ? "text-amber-600 bg-amber-50 border-amber-100"
                            : "text-emerald-600 bg-emerald-50 border-emerald-100";
                      return (
                        <tr
                          key={bill.allocation_id}
                          onClick={() => handleOpenVoucher(bill)}
                          className="hover:bg-indigo-50/30 transition-all group cursor-pointer border-l-4 border-transparent hover:border-indigo-500"
                        >
                          <td className="px-8 py-6">
                            <span className="text-[11px] font-black text-slate-900 tracking-tight">
                              {bill.bill_date}
                            </span>
                          </td>
                          <td className="px-4 py-6">
                            <div className="flex items-center gap-2">
                              <Hash size={12} className="text-slate-300" />
                              <span className="text-xs font-black text-indigo-600 tracking-tighter uppercase underline decoration-indigo-100 underline-offset-4 group-hover:text-indigo-800 transition-colors">
                                {bill.bill_no}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-600">
                                {bill.voucher_no}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {bill.voucher_date}
                                </span>
                                <span className="text-[8px] px-1 bg-slate-100 text-slate-400 rounded uppercase font-black">
                                  {bill.voucher_type}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6 text-right">
                            <span className="text-sm font-bold text-slate-400 italic">
                              ₹
                              {parseFloat(
                                String(bill.bill_amount),
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-6 text-right">
                            <span className="text-sm font-black text-slate-900">
                              ₹
                              {parseFloat(
                                String(bill.pending_amount),
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest border shadow-sm ${ageColor}`}
                              >
                                {bill.age_days} Days
                              </div>
                              <div className="w-full max-w-[100px] h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-1000 ${bill.age_days! > 90 ? "bg-rose-500" : bill.age_days! > 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{
                                    width: `${Math.min(100, (bill.age_days! / 120) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
              <div className="flex items-center gap-12 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-[0.2em]">
                    Total Ledger Exposure
                  </span>
                  <div className="flex items-baseline gap-4">
                    <span className="text-5xl font-black tracking-tighter text-white">
                      ₹
                      {totalOutstandingValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    {totalOutstandingValue > 0 && (
                      <div className="px-4 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle size={12} /> High Alert
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  navigate(
                    activeCategory === "payable"
                      ? "/vouchers/payment"
                      : "/vouchers/receipt",
                  )
                }
                className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-95 transform"
              >
                {activeCategory === "payable"
                  ? "Clear Liability"
                  : "Register Collection"}{" "}
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (Voucher Passport) */}
      {isViewModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg"
            onClick={() => setIsViewModalOpen(false)}
          />
          <div className="relative w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Document Passport
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedVoucher.voucher_no || selectedVoucher.bill_no}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-3 text-slate-400 hover:text-rose-500 transition-all bg-white border border-slate-200 rounded-2xl"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 custom-scrollbar">
              {isLoadingDetails ? (
                <div className="py-40 text-center">
                  <Loader2
                    className="animate-spin text-indigo-600 mx-auto"
                    size={48}
                  />
                  <p className="text-xs font-black text-slate-400 uppercase mt-4 tracking-widest">
                    Accessing Document History...
                  </p>
                </div>
              ) : (
                <div
                  ref={invoiceRef}
                  className="bg-white border-2 border-slate-900 mx-auto max-w-[800px] shadow-sm text-[11px] font-medium text-slate-900 p-8 space-y-8"
                >
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">
                        Saas Books
                      </h2>
                      <p className="font-bold text-slate-600">
                        P. N Road, Tirupur - 641602
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase">
                        Voucher ID
                      </p>
                      <p className="font-black text-lg">
                        {selectedVoucher.voucher_no || selectedVoucher.bill_no}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div>
                      <p className="text-[9px] font-black text-indigo-600 uppercase mb-2">
                        Participant Details
                      </p>
                      <h3 className="text-base font-black uppercase">
                        {selectedVoucher.party_name ||
                          selectedLedgerObject?.name}
                      </h3>
                      <p className="text-slate-500 font-bold mt-1">
                        {selectedVoucher.billing_address ||
                          "Address registered in database."}
                      </p>
                    </div>
                    <div className="text-right font-bold space-y-1">
                      <p>
                        <span className="text-slate-400 uppercase text-[9px]">
                          Date:
                        </span>{" "}
                        {selectedVoucher.voucher_date ||
                          selectedVoucher.bill_date}
                      </p>
                      <p>
                        <span className="text-slate-400 uppercase text-[9px]">
                          Type:
                        </span>{" "}
                        {selectedVoucher.voucher_type || "Invoice"}
                      </p>
                    </div>
                  </div>
                  <table className="w-full border-collapse border-t-2 border-b-2 border-slate-900">
                    <thead>
                      <tr className="text-[9px] font-black uppercase bg-slate-50 text-slate-500">
                        <th className="py-2 px-4 text-left border-r-2 border-slate-900 w-10">
                          #
                        </th>
                        <th className="py-2 px-4 text-left border-r-2 border-slate-900">
                          Particulars
                        </th>
                        <th className="py-2 px-4 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVoucher.items?.map((item: any, i: number) => (
                        <tr
                          key={i}
                          className="font-bold border-t border-slate-100"
                        >
                          <td className="py-3 px-4 border-r-2 border-slate-900 text-slate-300">
                            {i + 1}
                          </td>
                          <td className="py-3 px-4 border-r-2 border-slate-900 uppercase">
                            {item.item_name} (Qty: {item.quantity})
                          </td>
                          <td className="py-3 px-4 text-right">
                            ₹{parseFloat(item.amount || "0").toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-end pt-4">
                    <div className="w-64 p-6 bg-slate-900 text-white rounded-3xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                        Transaction Value
                      </p>
                      <p className="text-3xl font-black">
                        ₹
                        {parseFloat(
                          String(
                            selectedVoucher.total_amount ||
                              selectedVoucher.bill_amount ||
                              "0",
                          ),
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="w-full sm:w-auto px-10 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all bg-slate-50 rounded-[1.5rem]"
              >
                Close Preview
              </button>
              <div className="flex-1" />
              <button
                onClick={() => {
                  if (!invoiceRef.current) return;
                  const w = window.open();
                  w?.document.write(
                    `<html><head><script src="https://cdn.tailwindcss.com"></script></head><body>${invoiceRef.current.innerHTML}</body></html>`,
                  );
                  w?.print();
                }}
                className="w-full sm:w-auto px-16 py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Preview Modal (Statement View) */}
      {isReportPreviewOpen && selectedLedgerObject && reportData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg"
            onClick={() => setIsReportPreviewOpen(false)}
          />
          <div className="relative w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Statement Detail
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedLedgerObject.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (invoiceRef.current) {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Statement_${selectedLedgerObject.name}</title>
                              <script src="https://cdn.tailwindcss.com"></script>
                              <style>
                                @page { size: A4; margin: 0; }
                                body { margin: 0; padding: 0; }
                                .invoice-page { margin: 0 !important; border: none !important; }
                              </style>
                            </head>
                            <body>
                              ${invoiceRef.current.innerHTML}
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.onload = () => {
                          printWindow.print();
                        };
                      }
                    }
                  }}
                  className="p-3 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all flex items-center gap-2 shadow-sm"
                  title="Print Statement"
                >
                  <Printer size={20} />
                  <span className="text-xs font-black uppercase tracking-widest hidden md:inline">
                    Print
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (invoiceRef.current) {
                      const element = invoiceRef.current;

                      const opt = {
                        margin: [0, 0, 0, 0],
                        filename: `Statement_${selectedLedgerObject.name}.pdf`,
                        image: { type: "jpeg", quality: 1 },
                        html2canvas: {
                          scale: 5,
                          useCORS: true,
                          scrollY: 0,
                        },
                        jsPDF: {
                          unit: "mm",
                          format: "a4",
                          orientation: "portrait",
                        },
                        pagebreak: {
                          mode: ["avoid-all", "css", "legacy"],
                        },
                      };

                      // @ts-ignore
                      html2pdf().set(opt).from(element).save();
                    }
                  }}
                  className="p-3 bg-slate-50 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all flex items-center gap-2 shadow-sm"
                  title="Save as PDF"
                >
                  <Download size={20} />
                  <span className="text-xs font-black uppercase tracking-widest hidden md:inline">
                    Save PDF
                  </span>
                </button>
                <button
                  onClick={() => setIsReportPreviewOpen(false)}
                  className="p-3 text-slate-400 hover:text-rose-500 transition-all bg-white border border-slate-200 rounded-2xl shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div
              id="statement-preview-body"
              className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 custom-scrollbar"
            >
              <div className="max-w-[800px] mx-auto">
                <OutstandingTemplate
                  ref={invoiceRef}
                  ledger={{
                    name: selectedLedgerObject.name,
                    group_name: selectedLedgerObject.group_name,
                    address: selectedLedgerObject.address,
                    city: selectedLedgerObject.city,
                    pincode: selectedLedgerObject.pincode,
                    phone: selectedLedgerObject.phone,
                    gstin: selectedLedgerObject.gstin,
                  }}
                  bills={reportData.bills}
                  totalOutstanding={totalOutstandingValue}
                  businessDetails={businessDetails}
                  title={`${activeCategory === "receivable" ? "Receivable" : "Payable"} Statement`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          .font-black { font-weight: 900 !important; }
        }
      `}</style>
    </div>
  );
};

export default OutstandingReport;
