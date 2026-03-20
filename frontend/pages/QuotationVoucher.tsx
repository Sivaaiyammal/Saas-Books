import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Select from "react-select";
import {
  Save,
  X,
  Plus,
  Trash2,
  Calendar,
  User,
  ChevronDown,
  MapPin,
  Phone,
  PackageCheck,
  Package,
  ArrowLeft,
  Loader2,
  Settings,
} from "lucide-react";
import { VoucherRow, createEmptyRow } from "../data/voucher-data";
import { mastersApi, quotationsApi, settingsApi } from "../services/api";

interface Party {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst_no?: string;
  gst_number?: string;
  phone?: string;
}

interface StockItem {
  id: number;
  name: string;
  unit_id?: number;
  unit_name?: string;
  rate?: number;
  colour?: string;
  gsm?: string;
  dia?: string;
  count?: string;
  opening_stock?: number;
}

interface Unit {
  id: number;
  name: string;
  symbol?: string;
}

const customSelectStyles = {
  control: (provided: any, state: { isFocused: any }) => ({
    ...provided,
    backgroundColor: "#f8fafc",
    border: state.isFocused ? "1px solid #4f46e5" : "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(79, 70, 229, 0.1)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#4f46e5" : "#cbd5e1",
    },
    minHeight: "34px",
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    padding: "0 0.5rem",
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    height: "32px",
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    padding: "4px",
  }),
  clearIndicator: (provided: any) => ({
    ...provided,
    padding: "4px",
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: "#0f172a",
    fontSize: "0.75rem",
    fontWeight: "700",
  }),
  input: (provided: any) => ({
    ...provided,
    color: "#0f172a",
    fontSize: "0.75rem",
    fontWeight: "700",
    margin: "0",
    padding: "0",
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: "#94a3b8",
    fontSize: "0.75rem",
    fontWeight: "700",
  }),
  option: (provided: any, state: { isSelected: any; isFocused: any }) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "#4f46e5"
      : state.isFocused
        ? "#f1f5f9"
        : "white",
    color: state.isSelected ? "white" : "#0f172a",
    fontSize: "0.75rem",
    fontWeight: "700",
    "&:active": {
      backgroundColor: "#eef2ff",
    },
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: "0.75rem",
    boxShadow:
      "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    border: "1px solid #e2e8f0",
    zIndex: 9999,
  }),
  menuPortal: (provided: any) => ({
    ...provided,
    zIndex: 9999,
  }),
};

const QuotationVoucher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editQuotation = (location.state as { editQuotation?: any })
    ?.editQuotation;

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(
    null,
  );

  // API Data State
  const [parties, setParties] = useState<Party[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [businessDetails, setBusinessDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<VoucherRow[]>([createEmptyRow()]);
  const rowSelectRefs = useRef<any[]>([]);

  const [prefix, setPrefix] = useState("QTN");
  const [sequence, setSequence] = useState("");
  const [customVoucherNo, setCustomVoucherNo] = useState<string | null>(null);
  const [showVoucherSettings, setShowVoucherSettings] = useState(false);
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [referenceNo, setReferenceNo] = useState("");
  const [narration, setNarration] = useState("");

  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const selectedParty = parties.find((p) => p.id === selectedPartyId) || null;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [partiesRes, itemsRes, unitsRes, settingsRes] = await Promise.all(
          [
            mastersApi.getLedgersByGroup(2, 3), // group_id=2 for billing
            mastersApi.getItems(),
            mastersApi.getUnits(),
            settingsApi.getGstSettings(),
          ],
        );

        if (partiesRes.success && partiesRes.data.ledgers) {
          setParties(partiesRes.data.ledgers);
        }
        if (itemsRes.success && itemsRes.data.items) {
          setStockItems(itemsRes.data.items);
        }
        if (unitsRes.success && unitsRes.data.units) {
          setUnits(unitsRes.data.units);
        }
        if (settingsRes.success && settingsRes.data) {
          setBusinessDetails(settingsRes.data);
        }

        if (!editQuotation) {
          const nextVoucherRes = await quotationsApi.getNextQuotationNo();
          if (nextVoucherRes.success && nextVoucherRes.data?.next_voucher_no) {
            const fullVoucher = nextVoucherRes.data.next_voucher_no;
            const parts = fullVoucher.split("-");
            if (parts.length >= 2) {
              setPrefix(parts[0]);
              setSequence(parts[1]);
            }
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [editQuotation]);

  // Populate for edit
  useEffect(() => {
    if (editQuotation && !loading && parties.length > 0) {
      setIsEditing(true);
      setEditingQuotationId(editQuotation.id);
      setCustomVoucherNo(editQuotation.voucher_no);

      const parts = (editQuotation.voucher_no || "").split("-");
      if (parts.length >= 2) {
        setPrefix(parts[0]);
        setSequence(parts[1]);
      }

      setSelectedPartyId(
        editQuotation.party_ledger_id || editQuotation.party_id,
      );
      if (editQuotation.voucher_date) {
        setVoucherDate(editQuotation.voucher_date.split("T")[0]);
      }
      setReferenceNo(editQuotation.reference_no || "");
      setNarration(editQuotation.narration || "");

      if (editQuotation.items && editQuotation.items.length > 0) {
        const editRows = editQuotation.items.map(
          (item: any, index: number) => ({
            id: index + 1,
            itemId: String(item.product_id || ""),
            item: item.item_name || "",
            colour: item.colour || "",
            gsm: item.gsm || "",
            dia: item.dia || "",
            count: item.count || "",
            qty: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            unit: item.unit_symbol || item.unit_name || "Pcs",
            amount: parseFloat(item.amount) || 0,
            gst: 0, // No GST splits in Quotation
          }),
        );
        setRows(editRows);
      }
    }
  }, [editQuotation, loading, parties]);

  const addRow = () => {
    const newRows = [...rows, createEmptyRow()];
    setRows(newRows);
    setTimeout(() => {
      rowSelectRefs.current[newRows.length - 1]?.focus();
    }, 50);
  };
  const removeRow = (id: number) => {
    if (rows.length > 1) setRows(rows.filter((r) => r.id !== id));
  };

  const handleItemChange = (idx: number, itemId: string) => {
    const newRows = [...rows];
    const selected = stockItems.find((item) => item.id === parseInt(itemId));
    if (selected) {
      const defaultUnit = units.find((u) => u.id === selected.unit_id);
      newRows[idx] = {
        ...newRows[idx],
        itemId,
        item: selected.name,
        colour: selected.colour || "",
        gsm: selected.gsm || "",
        dia: selected.dia || "",
        count: selected.count || "",
        rate: selected.rate || 0,
        unit: defaultUnit?.symbol || defaultUnit?.name || "Pcs",
        amount: newRows[idx].qty * (selected.rate || 0),
      };
    } else {
      newRows[idx] = {
        ...newRows[idx],
        itemId: "",
        item: "",
        colour: "",
        gsm: "",
        dia: "",
        count: "",
        rate: 0,
        amount: 0,
      };
    }
    setRows(newRows);
  };

  const updateRowValue = (idx: number, field: keyof VoucherRow, value: any) => {
    const newRows = [...rows];
    (newRows[idx] as any)[field] = value;
    if (field === "qty" || field === "rate") {
      newRows[idx].amount = newRows[idx].qty * newRows[idx].rate;
    }
    setRows(newRows);
  };

  const currentVoucherNo =
    customVoucherNo !== null ? customVoucherNo : `${prefix}-${sequence}`;
  const subtotal = rows.reduce((acc, curr) => acc + curr.amount, 0);

  const handleSave = async () => {
    if (!selectedPartyId) {
      alert("Please select a party");
      return;
    }
    if (rows.length === 0 || !rows.some((r) => r.itemId)) {
      alert("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        voucher_no: currentVoucherNo,
        voucher_date: voucherDate,
        party_ledger_id: selectedPartyId,
        reference_no: referenceNo,
        narration: narration,
        items: rows
          .filter((r) => r.itemId)
          .map((row) => ({
            product_id: parseInt(row.itemId),
            item_name: row.item,
            colour: row.colour,
            gsm: row.gsm,
            dia: row.dia,
            count: row.count,
            roll: row.roll,
            quantity: row.qty,
            unit_id:
              units.find((u) => u.symbol === row.unit || u.name === row.unit)
                ?.id || 1,
            rate: row.rate,
            amount: row.amount,
          })),
      };

      let response;
      if (isEditing && editingQuotationId) {
        response = await quotationsApi.updateQuotation(
          editingQuotationId,
          payload,
        );
      } else {
        response = await quotationsApi.createQuotation(payload);
      }

      if (response.success) {
        alert(`Quotation ${isEditing ? "updated" : "created"} successfully!`);
        navigate("/reports/quotation-register");
      } else {
        alert(response.message || "Failed to save quotation");
      }
    } catch (err: any) {
      alert(err.message || "Error saving quotation");
    } finally {
      setSaving(false);
    }
  };

  const stockItemOptions = stockItems.map((item) => ({
    value: item.id,
    label: item.name,
    qty: item.opening_stock ?? 0,
    unit: item.unit_name || "Pcs",
  }));

  const formatOptionLabel = (
    option: { value: number; label: string; qty: number; unit: string },
    { context }: { context: string },
  ) => {
    if (context === "menu") {
      return (
        <div className="flex justify-between items-center w-full">
          <span>{option.label}</span>
          <span className="text-[10px] text-slate-400 font-bold ml-2">
            {option.qty} {option.unit}
          </span>
        </div>
      );
    }
    return option.label;
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );

  return (
    <div className="max-w-[1600px] mx-auto space-y-2 p-2 md:p-4 md:space-y-4 lg:p-6 lg:space-y-6">
      {/* Header */}
      <div className="hidden lg:flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            Q
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditing ? "Edit Quotation" : "New Quotation"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-slate-400">No:</span>
              <input
                type="text"
                value={currentVoucherNo}
                onChange={(e) => setCustomVoucherNo(e.target.value)}
                className="text-lg font-black text-indigo-600 bg-transparent border-b border-transparent focus:border-indigo-600 outline-none w-64"
              />
              <button
                onClick={() => setShowVoucherSettings(!showVoucherSettings)}
                className="text-slate-300 hover:text-indigo-600"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 font-bold transition-all flex items-center gap-2"
          >
            <X size={18} /> Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}{" "}
            {isEditing ? "Update" : "Save"} Quotation
          </button>
        </div>
      </div>

      <div className="hidden md:flex lg:hidden flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            Q
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {isEditing ? "Edit Quotation" : "New Quotation"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-slate-400">No:</span>
              <input
                type="text"
                value={currentVoucherNo}
                onChange={(e) => setCustomVoucherNo(e.target.value)}
                className="text-xs font-black text-indigo-600 bg-transparent border-b border-transparent focus:border-indigo-600 outline-none w-32"
              />
              <button
                onClick={() => setShowVoucherSettings(!showVoucherSettings)}
                className="text-slate-300 hover:text-indigo-600"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 font-bold transition-all flex items-center gap-2"
          >
            <X size={16} /> Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}{" "}
            {isEditing ? "Update" : "Save"} Quotation
          </button>
        </div>
      </div>
      {/* mobile view */}
      <div className="flex md:hidden flex-col items-start md:items-center justify-between gap-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex w-full gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex flex-row-reverse w-full justify-between">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              Q
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                {isEditing ? "Edit Quotation" : "New Quotation"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-slate-400">No:</span>
                <input
                  type="text"
                  value={currentVoucherNo}
                  onChange={(e) => setCustomVoucherNo(e.target.value)}
                  className="text-xs font-black text-indigo-600 bg-transparent border-b border-transparent focus:border-indigo-600 outline-none w-[50%]"
                />
                <button
                  onClick={() => setShowVoucherSettings(!showVoucherSettings)}
                  className="text-slate-300 hover:text-indigo-600"
                >
                  <Settings size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center w-full  gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 px-4 py-2.5 rounded-xl text-slate-600 bg-slate-50 border border-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}{" "}
            {isEditing ? "Update" : "Save"} Quotation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Info */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Party */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <User size={16} /> Customer / Party
            </h3>
            <Select
              options={parties.map((p) => ({ value: p.id, label: p.name }))}
              value={
                selectedPartyId
                  ? {
                      value: selectedPartyId,
                      label: parties.find((p) => p.id === selectedPartyId)
                        ?.name,
                    }
                  : null
              }
              onChange={(opt) => setSelectedPartyId(opt?.value || null)}
              styles={customSelectStyles}
              placeholder="Select Customer..."
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
            {selectedParty && (
              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
                {selectedParty.address}, {selectedParty.city}{" "}
                {selectedParty.pincode}
                {selectedParty.phone && (
                  <div className="mt-1 flex items-center gap-1">
                    <Phone size={10} /> {selectedParty.phone}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
                Date
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                  size={16}
                />
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
                Reference
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Ref No..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="md:col-span-12 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Package size={18} className="text-indigo-600" /> Line Items
            </h3>
            {/* <button onClick={addRow} className="bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl flex items-center gap-2"><Plus size={14} /> Add Row</button> */}
          </div>
          <div className="hidden xl:block w-full overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-4 w-[50px]">#</th>
                  <th className="px-4 py-4 w-[250px]">Product / Service</th>
                  <th className="px-4 py-4 w-[100px]">Colour</th>
                  <th className="px-4 py-4 w-[80px]">GSM</th>
                  <th className="px-4 py-4 w-[80px]">DIA</th>
                  <th className="px-4 py-4 w-[80px]">COUNT</th>
                  <th className="px-4 py-4 w-[80px]">Roll</th>
                  <th className="px-4 py-4 w-[100px]">Qty</th>
                  <th className="px-4 py-4 w-[100px]">Unit</th>
                  <th className="px-4 py-4 w-[120px]">Rate</th>
                  <th className="px-4 py-4 w-[150px] text-right">Amount</th>
                  <th className="px-4 py-4 w-[50px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="group">
                    <td className="px-4 py-4 text-[10px] font-bold text-slate-300">
                      {idx + 1}
                    </td>
                    <td className="px-1 py-4">
                      <Select
                        ref={(el) => {
                          rowSelectRefs.current[idx] = el;
                        }}
                        options={stockItemOptions}
                        value={stockItemOptions.find(
                          (o) => String(o.value) === row.itemId,
                        )}
                        onChange={(opt) =>
                          handleItemChange(idx, String(opt?.value || ""))
                        }
                        styles={customSelectStyles}
                        placeholder="Search item..."
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        formatOptionLabel={formatOptionLabel}
                      />
                    </td>
                    <td className="px-1 py-4">
                      <input
                        type="text"
                        value={row.colour}
                        onChange={(e) =>
                          updateRowValue(idx, "colour", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      />
                    </td>
                    <td className="px-1 py-4">
                      <input
                        type="text"
                        value={row.gsm}
                        onChange={(e) =>
                          updateRowValue(idx, "gsm", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      />
                    </td>
                    <td className="px-1 py-4">
                      <input
                        type="text"
                        value={row.dia}
                        onChange={(e) =>
                          updateRowValue(idx, "dia", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      />
                    </td>
                    <td className="px-1 py-4">
                      <input
                        type="text"
                        value={row.count}
                        onChange={(e) =>
                          updateRowValue(idx, "count", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      />
                    </td>
                    <td className="px-1 py-4">
                      <input
                        type="number"
                        value={row.roll}
                        onChange={(e) =>
                          updateRowValue(
                            idx,
                            "roll",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      />
                    </td>
                    <td className="px-1 py-4">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) =>
                          updateRowValue(
                            idx,
                            "qty",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                      />
                    </td>
                    <td className="px-1 py-4">
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          updateRowValue(idx, "unit", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.symbol || u.name}>
                            {u.symbol || u.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-4">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={row.rate}
                          onChange={(e) =>
                            updateRowValue(
                              idx,
                              "rate",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full pl-5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-black text-slate-900 text-sm">
                      ₹{row.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hidden md:block xl:hidden w-full overflow-x-auto">
            <table className="w-full text-left table-fixed min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-1 py-4 w-[35px] text-center">#</th>
                  <th className="px-1 py-4 w-[160px]">Stock Item</th>
                  <th className="px-1 py-4 w-[80px]">Colour</th>
                  <th className="px-1 py-4 w-[40px]">GSM</th>
                  <th className="px-1 py-4 w-[40px]">Dia</th>
                  <th className="px-1 py-4 w-[50px]">Qty</th>
                  <th className="px-1 py-4 w-[40px]">Unit</th>
                  <th className="px-1 py-4 w-[70px]">Rate</th>
                  <th className="px-1 py-4 w-[40px]">GST%</th>
                  <th className="px-1 py-4 w-[80px] text-right pr-4">Amount</th>
                  <th className="px-1 py-4 w-[40px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr
                    key={`tablet-${row.id}`}
                    className="group hover:bg-slate-50/30 transition-colors z-10"
                  >
                    <td className="px-1 py-4 text-[10px] font-bold text-slate-300 text-center">
                      {idx + 1}
                    </td>
                    <td className="px-0.5 py-4">
                      <Select
                        options={stockItemOptions}
                        value={stockItemOptions.find(
                          (option) => option.value === parseInt(row.itemId),
                        )}
                        onChange={(selectedOption) =>
                          handleItemChange(
                            idx,
                            String(selectedOption?.value || ""),
                          )
                        }
                        styles={customSelectStyles}
                        placeholder="Select Item..."
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        filterOption={(option, inputValue) =>
                          option.label
                            .toLowerCase()
                            .includes(inputValue.toLowerCase())
                        }
                        formatOptionLabel={formatOptionLabel}
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="text"
                        value={row.colour}
                        placeholder="e.g. Navy"
                        onChange={(e) =>
                          updateRowValue(idx, "colour", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="text"
                        value={row.gsm}
                        placeholder="--"
                        onChange={(e) =>
                          updateRowValue(idx, "gsm", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[11px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="text"
                        value={row.dia}
                        placeholder="--"
                        onChange={(e) =>
                          updateRowValue(idx, "dia", e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[11px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) =>
                          updateRowValue(
                            idx,
                            "qty",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative group">
                        <select
                          value={row.unit}
                          onChange={(e) =>
                            updateRowValue(idx, "unit", e.target.value)
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none appearance-none pr-5 cursor-pointer transition-all"
                        >
                          {units.map((u) => (
                            <option key={`tablet-u-${u.id}`} value={u.name}>
                              {u.symbol || u.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={10}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                      </div>
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={row.rate}
                          onChange={(e) =>
                            updateRowValue(
                              idx,
                              "rate",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full pl-5 pr-1 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative group">
                        <select
                          value={row.gst}
                          onChange={(e) =>
                            updateRowValue(
                              idx,
                              "gst",
                              parseFloat(e.target.value),
                            )
                          }
                          className="w-full bg-indigo-50/30 border border-indigo-100 rounded-lg px-2 py-2 text-[10px] font-black text-indigo-600 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none appearance-none pr-5 cursor-pointer transition-all"
                        ></select>
                        <ChevronDown
                          size={10}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none"
                        />
                      </div>
                    </td>
                    <td className="px-1 py-4 text-right pr-4">
                      <span className="text-xs font-black text-slate-900">
                        ₹{row.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-1 py-4 text-right">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end px-4 py-3 border-t border-slate-100">
              <button
                onClick={addRow}
                className="bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Add Row
              </button>
            </div>
          </div>

          {/* Mobile View (sm and below) */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100 bg-slate-50/30">
            {rows.map((row, idx) => (
              <div
                key={`mobile-${row.id}`}
                className="p-4 flex flex-col gap-3 relative"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <Select
                      options={stockItemOptions}
                      value={stockItemOptions.find(
                        (option) => option.value === parseInt(row.itemId),
                      )}
                      onChange={(selectedOption) =>
                        handleItemChange(
                          idx,
                          String(selectedOption?.value || ""),
                        )
                      }
                      styles={customSelectStyles}
                      placeholder="Select Item..."
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                    />
                  </div>
                  <button
                    onClick={() => removeRow(row.id)}
                    className="mt-1 p-1.5 text-slate-400 hover:text-rose-500 bg-white border border-slate-200 rounded-md transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Colour
                    </label>
                    <input
                      type="text"
                      value={row.colour}
                      placeholder="e.g. Navy"
                      onChange={(e) =>
                        updateRowValue(idx, "colour", e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-4 col-span-1 gap-1">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        GSM
                      </label>
                      <input
                        type="text"
                        value={row.gsm}
                        placeholder="--"
                        onChange={(e) =>
                          updateRowValue(idx, "gsm", e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-2 text-[10px] font-bold font-mono text-center text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Dia
                      </label>
                      <input
                        type="text"
                        value={row.dia}
                        placeholder="--"
                        onChange={(e) =>
                          updateRowValue(idx, "dia", e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-2 text-[10px] font-bold font-mono text-center text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Cnt
                      </label>
                      <input
                        type="text"
                        value={row.count}
                        placeholder="--"
                        onChange={(e) =>
                          updateRowValue(idx, "count", e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-2 text-[10px] font-bold font-mono text-center text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Roll
                      </label>
                      <input
                        type="number"
                        value={row.roll}
                        placeholder="0"
                        onChange={(e) =>
                          updateRowValue(
                            idx,
                            "roll",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-2 text-[10px] font-bold font-mono text-center text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) =>
                        updateRowValue(
                          idx,
                          "qty",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-slate-900 outline-none text-center"
                    />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Unit
                    </label>
                    <select
                      value={row.unit}
                      onChange={(e) =>
                        updateRowValue(idx, "unit", e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-900 outline-none appearance-none pr-4"
                    >
                      {units.map((u) => (
                        <option key={`mobile-u-${u.id}`} value={u.name}>
                          {u.symbol || u.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={10}
                      className="absolute right-2 bottom-3 text-slate-400 pointer-events-none"
                    />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Rate
                    </label>
                    <span className="absolute left-2 bottom-2 text-[10px] text-slate-400 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={row.rate}
                      onChange={(e) =>
                        updateRowValue(
                          idx,
                          "rate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-full pl-5 pr-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 outline-none"
                    />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      GST%
                    </label>
                    <select
                      value={row.gst}
                      onChange={(e) =>
                        updateRowValue(idx, "gst", parseFloat(e.target.value))
                      }
                      className="w-full bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-2 text-[10px] font-black text-indigo-600 outline-none appearance-none pr-4"
                    ></select>
                    <ChevronDown
                      size={10}
                      className="absolute right-2 bottom-3 text-indigo-300 pointer-events-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    Amount
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    ₹{row.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}

            <div className="p-4 bg-white md:hidden">
              <button
                onClick={addRow}
                className="w-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus size={14} /> Add New Item
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 bg-slate-50/30 border-t border-slate-100 flex flex-col md:flex-row justify-between gap-10">
            <div className="flex-1 max-w-lg">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">
                Narration
              </label>
              <textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm h-24 resize-none"
                placeholder="Notes..."
              />
            </div>
            <div className="w-full md:w-80 space-y-4">
              <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase text-indigo-400">
                    Total Quotation Value
                  </span>
                </div>
                <div className="text-3xl font-black mb-1">
                  ₹{subtotal.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase ring-offset-indigo-600">
                  No GST / Tax Split Applied
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationVoucher;