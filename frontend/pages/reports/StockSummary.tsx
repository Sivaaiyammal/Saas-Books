import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  ArrowLeft,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  Loader2,
  Package,
  Layers,
  ChevronRight,
  Eye,
  X,
  FileDown,
  Printer,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  PackageSearch,
  LayoutGrid,
  Palette,
  Calculator,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Plus,
  Share2,
} from "lucide-react";
import { vouchersApi, mastersApi } from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Interfaces ---
interface StockSummaryItem {
  id: number;
  item_code: string;
  name: string;
  alias: string | null;
  colour: string | null;
  item_group_name: string;
  unit_name: string;
  unit_symbol: string;
  variant_of: number | null;
  opening_qty: number;
  opening_rate: number;
  opening_value: number;
  purchase_qty: number;
  purchase_value: number;
  purchase_rate: number;
  sales_qty: number;
  sales_value: number;
  sales_rate: number;
  closing_qty: number;
  closing_value: number;
  closing_rate: number;
}

const StockSummary: React.FC = () => {
  const navigate = useNavigate();

  // States
  const [items, setItems] = useState<StockSummaryItem[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Detail Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockSummaryItem | null>(
    null,
  );

  // Fetch Data
  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, groupsRes] = await Promise.all([
        vouchersApi.getStockSummary(
          startDate,
          endDate,
          selectedGroupId || undefined,
          page,
          limit,
        ),
        mastersApi.getStockGroups(),
      ]);

      if (summaryRes.success) {
        setItems(summaryRes.data.items);
        setTotals(summaryRes.data.totals);
      } else {
        // Fix: Property 'message' now exists on the return type in services/api.ts
        setError(summaryRes.message || "Analysis failed");
      }

      if (groupsRes.success) {
        setGroups(groupsRes.data.item_groups);
      }
    } catch (err: any) {
      setError(err.message || "Audit sync failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = useMemo(() => {
    return () => {
      const doc = new jsPDF({ orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Stock summary Report", pageW / 2, 20, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(new Date().toLocaleString(), pageW / 2, 27, { align: "center" });

      // ── Divider ──────────────────────────────────────────────────────────────
      doc.setDrawColor(220, 220, 220);
      doc.line(14, 32, pageW - 14, 32);

      // ── Items table ──────────────────────────────────────────────────────────
      autoTable(doc, {
        startY: 40,
        head: [
          [
            "#",
            "Item Code",
            "Name",
            "Group",
            "Opening",
            "Inward",
            "Outward",
            "Closing",
          ],
        ],
        body: items.map((item, idx) => [
          idx + 1,
          item.item_code || "—",
          item.name || "—",
          item.item_group_name || "—",
          item.opening_qty ?? "—",
          `+${item.purchase_qty ?? 0}`,
          `-${item.sales_qty ?? 0}`,
          item.closing_qty ?? "—",
        ]),
        styles: { fontSize: 8, cellPadding: 3, halign: "center" },
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        tableWidth: "auto",
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          const ph = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(180, 180, 180);
          doc.text(`Page ${data.pageNumber}`, pageW / 2, ph - 6, {
            align: "center",
          });
        },
      });

      return doc;
    };
  }, [items]);

  const handleShare = async () => {
    const doc = handleExportData();

    const pdfBlob = doc.output("blob");
    const pdfFile = new File([pdfBlob], `item-report-${Date.now()}.pdf`, {
      type: "application/pdf",
    });

    if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          doc.save(`item-report-${Date.now()}.pdf`);
        }
      }
    } else {
      doc.save(`item-report-${Date.now()}.pdf`);
      alert(
        "Your browser doesn't support native sharing. The PDF has been downloaded instead.",
      );
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedGroupId, startDate, endDate, page, limit]);

  const filteredItems = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return items.filter(
      (i) =>
        (i.item_code || "").toLowerCase().includes(s) ||
        (i.name || "").toLowerCase().includes(s) ||
        (i.alias || "").toLowerCase().includes(s) ||
        (i.item_group_name || "").toLowerCase().includes(s),
    );
  }, [items, searchTerm]);

  const handleOpenDetail = (item: StockSummaryItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedGroupId(null);
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/reports")}
            className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
              Stock Summary
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
              <ShieldCheck size={12} className="text-emerald-500" /> Active
              Inventory Assets
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSummary}
            className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={handleShare}
            className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 shadow-sm"
          >
            <Share2 size={18} /> Share
          </button>
          <button
            onClick={() => navigate("/masters/items")}
            className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 transform"
          >
            <Plus size={20} /> Add Item
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex items-center justify-between group hover:shadow-lg transition-all shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Total Purchase Value
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tighter">
              ₹{totals?.total_purchase_value.toLocaleString() || "0"}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              +{totals?.total_purchase_qty.toLocaleString()} Units Inward
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex items-center justify-between group hover:shadow-lg transition-all shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Total Sales Value
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tighter">
              ₹{totals?.total_sales_value.toLocaleString() || "0"}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              -{totals?.total_sales_qty.toLocaleString()} Units Outward
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowDownRight size={20} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex items-center justify-between group hover:shadow-lg transition-all shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Inventory Density
            </p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1 tracking-tighter">
              {totals?.total_closing_qty.toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-400">Units</span>
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Items In-Stock
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
            <Package size={20} />
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex items-center justify-between group hover:shadow-xl transition-all shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
              Net Asset Value
            </p>
            <h3 className="text-2xl font-black text-white mt-1 tracking-tighter">
              ₹{totals?.total_closing_value.toLocaleString() || "0"}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
              Reconciled Audit
            </p>
          </div>
          <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-indigo-400 relative z-10">
            <Boxes size={24} />
          </div>
        </div>
      </div>

      {/* Advanced Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-40">
        <div className="md:col-span-8 glass-panel p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex items-center gap-6 border-white/50">
          <div className="relative flex-1 group">
            <Search
              className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors"
              size={20}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Item Code, Alias or Fabric Name..."
              className="w-full pl-14 pr-6 py-3.5 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner placeholder:text-slate-300"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3.5 border rounded-[1.2rem] transition-all transform active:scale-90 ${showFilters ? "bg-indigo-600 text-white border-indigo-600 shadow-xl" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm"}`}
          >
            <Filter size={24} />
          </button>
        </div>

        <div className="md:col-span-4 bg-white p-6 rounded-[2.5rem] border border-slate-200 flex items-center justify-between shadow-sm">
          <div className="flex-1 space-y-1">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
              Active Stock Group
            </p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-100">
                {selectedGroupId
                  ? groups.find((g) => g.id === selectedGroupId)?.name
                  : "Consolidated View"}
              </span>
            </div>
          </div>
          <button
            onClick={fetchSummary}
            className="p-3 bg-slate-50 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl animate-in slide-in-from-top-6 duration-500 overflow-hidden relative z-30">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <SlidersHorizontal size={20} />
              </div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">
                Inventory Segmentation
              </h4>
            </div>
            <button
              onClick={resetFilters}
              className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 px-4 py-2 bg-rose-50 rounded-lg transition-all"
            >
              Clear Filters
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Stock Category
              </label>
              <div className="relative">
                <Layers
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <select
                  value={selectedGroupId || ""}
                  onChange={(e) =>
                    setSelectedGroupId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none appearance-none transition-all focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600"
                >
                  <option value="">All Stock Groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={16}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none uppercase"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none uppercase"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table Interface */}
      <div className="bg-white rounded-[4rem] border border-slate-200 shadow-xl overflow-hidden bento-item relative z-10">
        <div className="overflow-x-auto overflow-visible">
          <table className="w-full text-left table-fixed min-w-[1300px]">
            <thead className="bg-slate-50/80 text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
              <tr>
                <th className="px-8 py-8 w-[280px]">Product Identity</th>
                <th className="px-4 py-8 w-[140px] text-right">Inwards (+)</th>
                <th className="px-4 py-8 w-[140px] text-right">Outwards (-)</th>
                <th className="px-8 py-8 w-[160px] text-right">
                  Current Asset
                </th>
                <th className="px-4 py-8 w-[180px] text-center">
                  Technical Matrix
                </th>
                <th className="px-8 py-8 w-[80px] text-right">Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-40 text-center">
                    <Loader2
                      className="animate-spin text-indigo-600 mx-auto"
                      size={48}
                    />
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">
                      Loading...
                    </p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-40 text-center text-slate-300">
                    <Boxes size={64} className="mx-auto opacity-20" />
                    <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">
                      No stock points detected in current scope
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    className="hover:bg-indigo-50/30 transition-all group cursor-pointer border-l-4 border-transparent hover:border-indigo-500"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner uppercase">
                          {item.name?.[0] ||
                            item.alias?.[0] ||
                            item.item_code?.[0] ||
                            "S"}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate uppercase tracking-tight">
                            {item.name || item.alias || "Unnamed Fabric"}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                              {item.item_code}
                            </span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase truncate">
                              | {item.item_group_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-right">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-emerald-600">
                          +{item.purchase_qty.toLocaleString()}{" "}
                          <span className="text-[8px] opacity-50 uppercase">
                            {item.unit_symbol}
                          </span>
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          Val: ₹{item.purchase_value.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-right">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-rose-500">
                          -{item.sales_qty.toLocaleString()}{" "}
                          <span className="text-[8px] opacity-50 uppercase">
                            {item.unit_symbol}
                          </span>
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          Val: ₹{item.sales_value.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-slate-900 tracking-tight">
                          {item.closing_qty.toLocaleString()}{" "}
                          <span className="text-[9px] opacity-40 uppercase">
                            {item.unit_symbol}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-lg mt-1 ${item.closing_qty < 0 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"}`}
                        >
                          ₹{item.closing_value.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase">--</span>
                    </td>
                    <td className="px-8 py-6 text-right relative">
                      <div className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm transition-all">
                        <Eye size={16} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dark Summary Footer */}
        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 relative overflow-hidden z-10">
          <div className="absolute right-0 bottom-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32" />
          <div className="flex items-center gap-12 relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-[0.2em]">
                Aggregate Asset Holding
              </span>
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-black tracking-tighter text-white">
                  ₹{totals?.total_closing_value.toLocaleString() || "0"}
                </span>
                <div className="px-4 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={12} /> Audit Reconciled
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <button className="px-10 py-5 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border border-white/5 shadow-inner">
              <FileDown size={18} /> Export Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Item Passport Modal */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl"
            onClick={() => setIsDetailModalOpen(false)}
          />
          <div className="relative w-full max-w-4xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                  <Package size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                    Item Summary Passport
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-100 tracking-widest">
                      {selectedItem.item_code}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-500" />{" "}
                      Catalog Verified point
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-3.5 text-slate-400 hover:text-rose-500 transition-all bg-slate-50 border border-slate-200 rounded-2xl"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 custom-scrollbar space-y-10">
              {/* Detail Header Grid */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-10 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />
                <div className="md:col-span-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-8 md:pb-0 md:pr-10">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    {selectedItem.name ||
                      selectedItem.alias ||
                      "Standard Fabric"}
                  </h3>
                  <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-3 flex items-center gap-2">
                    <Tag size={12} /> {selectedItem.item_group_name}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                        <Palette size={10} className="text-indigo-500" /> Colour
                        Shade
                      </p>
                      <p className="text-xs font-black text-slate-900">
                        {selectedItem.colour || "Mixed"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                        <Tag size={10} className="text-indigo-500" /> Variant
                      </p>
                      <p className="text-xs font-black text-slate-900">--</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-4 bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-center text-center shadow-2xl">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">
                    Available Balance
                  </p>
                  <h4 className="text-4xl font-black tracking-tighter text-white">
                    {selectedItem.closing_qty.toLocaleString()}
                  </h4>
                  <p className="text-[10px] font-black uppercase text-slate-500 mt-2 tracking-widest">
                    {selectedItem.unit_name}s ({selectedItem.unit_symbol})
                  </p>
                </div>
              </div>

              {/* Activity Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ArrowUpRight size={16} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Inwards Performance
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-slate-900">
                      {selectedItem.purchase_qty.toLocaleString()}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      Rate Average: ₹{selectedItem.purchase_rate.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <ArrowDownRight size={16} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Outwards Velocity
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-slate-900">
                      {selectedItem.sales_qty.toLocaleString()}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      Rate Average: ₹{selectedItem.sales_rate.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-indigo-900 text-white flex items-center justify-center">
                      <Calculator size={16} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Valuation Basis
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-slate-900">
                      ₹{selectedItem.closing_rate.toFixed(2)}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      Inventory FIFO/Avg Cost
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-4 sticky bottom-0">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-full sm:w-auto px-10 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all bg-slate-50 rounded-[1.5rem]"
              >
                Close Summary
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
                <Calculator size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Asset Value: ₹{selectedItem.closing_value.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default StockSummary;