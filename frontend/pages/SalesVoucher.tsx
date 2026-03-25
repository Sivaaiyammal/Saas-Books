
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Select from 'react-select';
import printJS from 'print-js';
import {
  Save, X, Plus, Trash2, Calendar, User, ChevronDown, Settings,
  Truck, Zap, MapPin, Building2, Phone, PackageCheck, Package, ArrowLeft, Loader2, TriangleAlert,
  Eye, Printer, XCircle
} from 'lucide-react';
import { indianStates, VoucherRow, createEmptyRow } from '../data/voucher-data';
import { mastersApi, vouchersApi, settingsApi } from '../services/api';
import EWayBillComponent from '../components/EWayBillComponent';
import EWayBillTemplate from '../components/EWayBillTemplate';

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
  tax_id?: number;
  tax_percent?: number;
  rate?: number;
  colour?: string;
  opening_stock?: number;
}

interface Unit {
  id: number;
  name: string;
  symbol?: string;
}

interface Tax {
  id: number;
  name: string;
  rate: number;
}

interface Godown {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst_no?: string;
  gstin?: string;
}

const customSelectStyles = {
  control: (provided: any, state: { isFocused: any; }) => ({
    ...provided,
    backgroundColor: '#f8fafc', // bg-slate-50
    border: state.isFocused ? '1px solid #4f46e5' : '1px solid #e2e8f0', // border-slate-200, focus:border-indigo-600
    borderRadius: '0.5rem', // rounded-lg
    boxShadow: state.isFocused ? '0 0 0 2px rgba(79, 70, 229, 0.1)' : 'none', // focus:ring-2 focus:ring-indigo-600/10
    '&:hover': {
      borderColor: state.isFocused ? '#4f46e5' : '#cbd5e1',
    },
    minHeight: '34px', // match input height with py-2
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    padding: '0 0.5rem', // px-2
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    height: '32px',
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    padding: '4px',
  }),
  clearIndicator: (provided: any) => ({
    ...provided,
    padding: '4px',
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: '#0f172a', // text-slate-900
    fontSize: '0.75rem', // text-xs
    fontWeight: '700', // font-bold
  }),
  input: (provided: any) => ({
    ...provided,
    color: '#0f172a',
    fontSize: '0.75rem',
    fontWeight: '700',
    margin: '0',
    padding: '0',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#94a3b8', // placeholder:text-slate-400
    fontSize: '0.75rem',
    fontWeight: '700',
  }),
  option: (provided: any, state: { isSelected: any; isFocused: any; }) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? 'white' : '#0f172a',
    fontSize: '0.75rem',
    fontWeight: '700',
    '&:active': {
      backgroundColor: '#eef2ff',
    },
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: '0.75rem', // rounded-xl
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', // shadow-xl
    border: '1px solid #e2e8f0', // border-slate-200
    zIndex: 9999,
  }),
  menuPortal: (provided: any) => ({
    ...provided,
    zIndex: 9999,
  }),
};

const SalesVoucher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editVoucher = (location.state as { editVoucher?: any })?.editVoucher;

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null);

  // API Data State
  const [parties, setParties] = useState<Party[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [businessDetails, setBusinessDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEwbModalOpen, setIsEwbModalOpen] = useState(false);
  const [savedVoucherForEwb, setSavedVoucherForEwb] = useState<any>(null);
  const [showEwbWarning, setShowEwbWarning] = useState(false);
  const [isEwbPreviewModalOpen, setIsEwbPreviewModalOpen] = useState(false);
  const [ewbViewLoading, setEwbViewLoading] = useState(false);
  const [viewEwbFullData, setViewEwbFullData] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('2');
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelUsername, setCancelUsername] = useState('');
  const [cancelPassword, setCancelPassword] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const ewbPrintRef = useRef<HTMLDivElement>(null);
  const rowSelectRefs = useRef<any[]>([]);

  const [rows, setRows] = useState<VoucherRow[]>([createEmptyRow()]);

  const [prefix, setPrefix] = useState('INV');
  const [suffix, setSuffix] = useState('24-25');
  const [sequence, setSequence] = useState('');
  const [customInvoiceNo, setCustomInvoiceNo] = useState<string | null>(null);
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [showInvoiceSettings, setShowInvoiceSettings] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState('33');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [narration, setNarration] = useState('');

  const [isEInvoice, setIsEInvoice] = useState(false);
  const [isGSTInvoice, setIsGSTInvoice] = useState(true);
  const [isEWayBill, setIsEWayBill] = useState(() => {
    if (!editVoucher) return false;
    const status = editVoucher.ewaybill?.status || editVoucher.ewaybill_status;
    const ewbNo = editVoucher.ewaybill?.ewb_no || editVoucher.ewb_no;
    return status === 'generated' || !!ewbNo;
  });
  const [isConsigneeSame, setIsConsigneeSame] = useState(true);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [isCancelledVoucher, setIsCancelledVoucher] = useState(false);
  const [createNewFromCancelled, setCreateNewFromCancelled] = useState(false);

  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [selectedConsigneeId, setSelectedConsigneeId] = useState<number | null>(null);
  const [selectedGodownId, setSelectedGodownId] = useState<number | null>(null);

  const selectedParty = parties.find(p => p.id === selectedPartyId) || null;
  const selectedConsignee = parties.find(p => p.id === selectedConsigneeId) || null;
  const selectedGodown = godowns.find(g => g.id === selectedGodownId) || null;

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all required data in parallel
        const [partiesRes, itemsRes, unitsRes, taxesRes, godownsRes, settingsRes] = await Promise.all([
          mastersApi.getLedgersByGroup(2, 3), // group_id=2 for billing/consignee
          mastersApi.getItems(),
          mastersApi.getUnits(),
          mastersApi.getTaxes(),
          mastersApi.getGodowns(),
          settingsApi.getGstSettings()
        ]);

        if (partiesRes.success && partiesRes.data.ledgers) {
          setParties(partiesRes.data.ledgers);
          if (partiesRes.data.ledgers.length > 0) {
            setSelectedPartyId(partiesRes.data.ledgers[0].id);
            setSelectedConsigneeId(partiesRes.data.ledgers[0].id);
          }
        }
        if (itemsRes.success && itemsRes.data.items) {
          setStockItems(itemsRes.data.items);
        }
        if (unitsRes.success && unitsRes.data.units) {
          setUnits(unitsRes.data.units);
        }
        if (taxesRes.success && taxesRes.data.taxes) {
          setTaxes(taxesRes.data.taxes);
        }
        if (godownsRes.success && godownsRes.data.godowns) {
          setGodowns(godownsRes.data.godowns);
          if (godownsRes.data.godowns.length > 0) {
            setSelectedGodownId(godownsRes.data.godowns[0].id);
          }
        }
        if (settingsRes.success && settingsRes.data) {
          setBusinessDetails(settingsRes.data);
        }

        // Only fetch next voucher number if NOT editing
        if (!editVoucher) {
          const nextVoucherRes = await vouchersApi.getNextSalesVoucherNo();
          if (nextVoucherRes.success && nextVoucherRes.data?.next_voucher_no) {
            const fullVoucher = nextVoucherRes.data.next_voucher_no;
            // console.log('API Response voucher:', fullVoucher);
            // Parse the voucher number (e.g., "INV-0007")
            const parts = fullVoucher.split('-');
            // console.log('Parsed parts:', parts);
            if (parts.length >= 2) {
              // console.log('Setting prefix:', parts[0], 'sequence:', parts[1]);
              setPrefix(parts[0]); // INV
              setSequence(parts[1]); // 0007
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [editVoucher]);

  // Populate form when editing
  useEffect(() => {
    if (editVoucher && !loading && parties.length > 0 && stockItems.length > 0) {
      // console.log('Edit voucher data:', editVoucher);
      setIsEditing(true);
      setEditingVoucherId(editVoucher.id);

      // Parse voucher number (e.g., "INV/0012/24-25" or "INV-0012")
      const voucherNo = editVoucher.voucher_no || '';
      // console.log('Parsing voucher_no:', voucherNo);

      // Set the custom invoice number directly so user can edit it
      setCustomInvoiceNo(voucherNo);

      // Try slash format first
      let voucherParts = voucherNo.split('/');
      if (voucherParts.length >= 3) {
        setPrefix(voucherParts[0]);
        setSequence(voucherParts[1]);
        setSuffix(voucherParts[2]);
        // console.log('Parsed as slash format:', voucherParts);
      } else {
        // Try hyphen format (e.g., "INV-0012")
        voucherParts = voucherNo.split('-');
        if (voucherParts.length >= 2) {
          setPrefix(voucherParts[0]);
          setSequence(voucherParts[1]);
          // console.log('Parsed as hyphen format:', voucherParts);
        }
      }

      // Set party - check both party_id and party_ledger_id
      const partyId = editVoucher.party_id || editVoucher.party_ledger_id;
      if (partyId) {
        setSelectedPartyId(partyId);
      } else if (editVoucher.party_name || editVoucher.billing_name) {
        // Try to find party by name
        const partyByName = parties.find(p =>
          p.name === editVoucher.party_name || p.name === editVoucher.billing_name
        );
        if (partyByName) {
          setSelectedPartyId(partyByName.id);
        }
      }

      // Set consignee
      const consigneeId = editVoucher.consignee_id || editVoucher.consignee_ledger_id;
      if (consigneeId) {
        setSelectedConsigneeId(consigneeId);
        setIsConsigneeSame(partyId === consigneeId);
      } else if (editVoucher.consignee_same_as_billing === 0 && editVoucher.consignee_name) {
        // Try to find consignee by name
        const consigneeByName = parties.find(p => p.name === editVoucher.consignee_name);
        if (consigneeByName) {
          setSelectedConsigneeId(consigneeByName.id);
          setIsConsigneeSame(false);
        }
      } else {
        setIsConsigneeSame(editVoucher.consignee_same_as_billing !== 0);
      }

      // Set godown - check items for godown_id if not on main object
      const godownId = editVoucher.godown_id || (editVoucher.items?.[0]?.godown_id);
      if (godownId) {
        setSelectedGodownId(godownId);
      }

      // Set other fields
      if (editVoucher.voucher_date) {
        setVoucherDate(editVoucher.voucher_date.split('T')[0]);
      }
      if (editVoucher.reference_no) {
        setReferenceNo(editVoucher.reference_no);
      }
      if (editVoucher.narration) {
        setNarration(editVoucher.narration);
      }
      if (editVoucher.vehicle_no) {
        setVehicleNo(editVoucher.vehicle_no);
      }
      if (editVoucher.place_of_supply) {
        // Find state code from state name
        const stateMatch = indianStates.find(s => s.name === editVoucher.place_of_supply);
        if (stateMatch) {
          setPlaceOfSupply(stateMatch.code);
        }
      }

      // Set E-Invoice and E-Way Bill status
      if (editVoucher.einvoice?.status === 'generated') {
        setIsEInvoice(true);
      }
      const ewbStatus = editVoucher.ewaybill?.status || editVoucher.ewaybill_status;
      const ewbNo = editVoucher.ewaybill?.ewb_no || editVoucher.ewb_no;
      if (ewbStatus === 'generated' || !!ewbNo) {
        setIsEWayBill(true);
      }

      // Check if voucher is cancelled
      if (editVoucher.status === 'cancelled' || editVoucher.is_cancelled) {
        setIsCancelledVoucher(true);
        setCreateNewFromCancelled(true); // Default to creating new when editing cancelled
      }

      // Set items/rows
      if (editVoucher.items && editVoucher.items.length > 0) {
        // console.log('Setting items:', editVoucher.items);
        // console.log('Available stockItems:', stockItems.map(s => ({ id: s.id, name: s.name })));
        const editRows = editVoucher.items.map((item: any, index: number) => {
          // API returns product_id, not item_id
          const itemIdStr = String(item.product_id || item.item_id || '');
          // console.log(`Item ${index}: product_id=${item.product_id}, itemIdStr=${itemIdStr}`);
          return {
            id: index + 1,
            itemId: itemIdStr,
            item: item.item_name || '',
            colour: item.colour || '',
            qty: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            unit: item.unit_name || 'Pcs',
            gst: parseFloat(item.tax_percent) || 0,
            amount: parseFloat(item.quantity) * parseFloat(item.rate) || 0,
          };
        });
        setRows(editRows);
      }
    }
  }, [editVoucher, loading, parties, stockItems]);

  const addRow = () => {
    const newRows = [...rows, createEmptyRow()];
    setRows(newRows);
    setTimeout(() => {
      rowSelectRefs.current[newRows.length - 1]?.focus();
    }, 50);
  };

  const removeRow = (id: number) => {
    if (rows.length > 1) setRows(rows.filter(r => r.id !== id));
  };

  const handleItemChange = (idx: number, itemId: string) => {
    const newRows = [...rows];
    const selected = stockItems.find(item => item.id === parseInt(itemId));
    if (selected) {
      const defaultUnit = units.find(u => u.id === selected.unit_id);
      const defaultTax = taxes.find(t => t.id === selected.tax_id);
      newRows[idx] = {
        ...newRows[idx],
        itemId,
        item: selected.name,
        colour: selected.colour || '',
        rate: selected.rate || 0,
        unit: defaultUnit?.name || 'Pcs',
        gst: defaultTax?.rate || 0,
        amount: newRows[idx].qty * (selected.rate || 0)
      };
    } else {
      newRows[idx] = { ...newRows[idx], itemId: '', item: '', colour: '', rate: 0, amount: 0 };
    }
    setRows(newRows);
  };

  const updateRowValue = (idx: number, field: keyof VoucherRow, value: any) => {
    const newRows = [...rows];
    (newRows[idx] as any)[field] = value;
    if (field === 'qty' || field === 'rate') {
      newRows[idx].amount = newRows[idx].qty * newRows[idx].rate;
    }
    setRows(newRows);
  };

  const getPartyAddress = (party: Party | null) => {
    if (!party) return '';
    const parts = [party.address, party.city, party.state, party.pincode].filter(Boolean);
    return parts.join(', ');
  };

  const getStateName = (stateCode: string | undefined) => {
    if (!stateCode) return undefined;
    // Check if it's already a state name
    const isAlreadyName = indianStates.some(s => s.name === stateCode);
    if (isAlreadyName) return stateCode;
    // Otherwise treat it as a code
    const state = indianStates.find(s => s.code === stateCode);
    return state?.name || stateCode;
  };

  const fetchEwbDetails = async (invoiceId: number) => {
    setEwbViewLoading(true);
    setViewEwbFullData(null);
    try {
      const res = await settingsApi.getEWayBillViewDetails(invoiceId);
      if (res.success && res.data) {
        setViewEwbFullData(res.data);
        return res.data;
      } else {
        const fallback = {
          header: {
            ewb_no: savedVoucherForEwb?.ewaybill?.ewb_no,
            ewb_date: savedVoucherForEwb?.ewaybill?.ewb_date,
            status: 'generated'
          },
          part_a: {
            supplier_gstin: businessDetails?.gstin,
            supplier_name: businessDetails?.from_trade_name,
            document_no: savedVoucherForEwb?.voucher_no,
            document_date: savedVoucherForEwb?.voucher_date,
            value_of_goods: savedVoucherForEwb?.total_amount
          },
          part_b: []
        };
        setViewEwbFullData(fallback);
        return fallback;
      }
    } catch {
      return null;
    } finally {
      setEwbViewLoading(false);
    }
  };

  const handlePrintEwb = async () => {
    if (!savedVoucherForEwb) return;
    let data = viewEwbFullData;
    if (!data) {
      data = await fetchEwbDetails(savedVoucherForEwb.id);
    }
    if (!data) return;
    setTimeout(() => {
      if (!ewbPrintRef.current) return;
      printJS({
        printable: ewbPrintRef.current.innerHTML,
        type: 'raw-html',
        style: `
          @page { margin: 0 !important; }
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { padding: 0; font-family: "Times New Roman", Times, serif; color: black; }
          .ewb-print-container { width: 190mm; margin: 0 auto; padding: 10mm 0; }
          .ewb-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .ewb-table th, .ewb-table td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; }
          .ewb-section-header { background-color: #e0e0e0; font-weight: bold; padding: 4px 8px; font-size: 12px; border: 1px solid #333; border-bottom: none; }
          .part-b-table th { background-color: #f2f2f2; text-align: center; }
        `,
        scanStyles: false
      });
    }, 150);
  };

  const handleViewEwb = async () => {
    if (!savedVoucherForEwb) return;
    setIsEwbPreviewModalOpen(true);
    await fetchEwbDetails(savedVoucherForEwb.id);
  };

  const handleCancelEwb = async () => {
    if (!savedVoucherForEwb?.ewaybill?.ewb_no) return;
    setCancelLoading(true);
    try {
      const username = cancelUsername || businessDetails?.username || '';
      const password = cancelPassword || '';
      if (!username || !password) {
        alert('Please enter Username and Password for verification');
        setCancelLoading(false);
        return;
      }
      const tokenRes = await settingsApi.getEWayBillToken(username, password);
      let authToken = tokenRes.data?.auth_token;
      if (!authToken && tokenRes.data?.provider_response?.authtoken) {
        authToken = tokenRes.data.provider_response.authtoken;
      }
      if (!authToken && tokenRes.data?.provider_response?.auth_token) {
        authToken = tokenRes.data.provider_response.auth_token;
      }
      if (!tokenRes.success || !authToken) {
        alert('Failed to get E-Way Bill Access Token: ' + (tokenRes.message || 'Unknown error'));
        setCancelLoading(false);
        return;
      }
      const payload = {
        gstin: businessDetails?.gstin || '',
        username,
        authtoken: authToken,
        payload: {
          ewbNo: savedVoucherForEwb.ewaybill.ewb_no,
          cancelRsnCode: cancelReason,
          cancelRmrk: cancelRemark
        }
      };
      const res = await settingsApi.cancelEWayBill(payload);
      if (res.success) {
        alert('E-Way Bill Cancelled Successfully');
        setIsCancelModalOpen(false);
        setIsEwbModalOpen(false);
      } else {
        alert('Cancellation Failed: ' + res.message);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || String(error) || 'Unknown error';
      alert('Cancellation Error: ' + msg);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPartyId) {
      alert('Please select a billing party');
      return;
    }
    if (rows.length === 0 || !rows.some(r => r.itemId)) {
      alert('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      // Get godown state for company_state
      const godownState = selectedGodown?.state || 'Tamil Nadu';
      const godownStateCode = indianStates.find(s => s.name === godownState || s.code === godownState)?.code;
      const isInterStateSale = godownStateCode !== placeOfSupply;

      const items = rows
        .filter(r => r.itemId)
        .map(row => {
          const stockItem = stockItems.find(i => i.id === parseInt(row.itemId));
          const unit = units.find(u => u.name === row.unit);
          const tax = taxes.find(t => t.rate === row.gst);

          return {
            item_id: parseInt(row.itemId),
            item_name: row.item,
            colour: row.colour || undefined,
            quantity: row.qty,
            unit_id: unit?.id || stockItem?.unit_id || 1,
            rate: row.rate,
            discount_amount: 0,
            tax_id: tax?.id || stockItem?.tax_id || 1,
            tax_percent: row.gst,
            godown_id: selectedGodownId || 1,
          };
        });

      // Build billing details from selected party
      const billingParty = selectedParty;
      const consigneeParty = isConsigneeSame ? selectedParty : selectedConsignee;

      // Get state names with fallback to company/godown state
      const billingState = getStateName(billingParty?.state) || getStateName(godownStateCode);
      const consigneeState = getStateName(consigneeParty?.state) || getStateName(godownStateCode);

      const payload: any = {
        voucher_no: currentInvoiceNo,
        party_ledger_id: selectedPartyId,
        voucher_date: voucherDate,
        company_state: getStateName(godownStateCode),
        party_state: billingState,
        place_of_supply: getStateName(placeOfSupply),
        round_off: roundOff,

        // Billing address details
        billing_name: billingParty?.name || '',
        billing_address: billingParty?.address || '',
        billing_city: billingParty?.city || '',
        billing_state: billingState,
        billing_pincode: billingParty?.pincode || '',
        billing_gstin: billingParty?.gst_number || '',
        billing_phone: billingParty?.phone || '',

        // Consignee flag
        consignee_same_as_billing: isConsigneeSame,

        items,
      };

      // Add optional fields only if they have values
      if (referenceNo) {
        payload.reference_no = referenceNo;
      }
      if (narration) {
        payload.narration = narration;
      }
      if (vehicleNo) {
        payload.vehicle_no = vehicleNo;
      }

      // Add consignee details if different from billing
      if (!isConsigneeSame && consigneeParty) {
        payload.consignee_name = consigneeParty.name || '';
        payload.consignee_address = consigneeParty.address || '';
        payload.consignee_city = consigneeParty.city || '';
        payload.consignee_state = consigneeState;
        payload.consignee_pincode = consigneeParty.pincode || '';
        payload.consignee_gstin = consigneeParty.gst_number || '';
        payload.consignee_phone = consigneeParty.phone || '';
      }

      // Log payload for debugging
      // console.log('=== SALES VOUCHER PAYLOAD ===');
      // console.log('Company State (Warehouse):', payload.company_state);
      // console.log('Party State (Billing):', payload.party_state);
      // console.log('Place of Supply (Consignee):', payload.place_of_supply);
      // console.log('Consignee Same as Billing:', payload.consignee_same_as_billing);
      // console.log('GST Type (Frontend calc):', gstType);
      // console.log('Total CGST:', totalCgst);
      // console.log('Total SGST:', totalSgst);
      // console.log('Total IGST:', totalIgst);
      // console.log('Items:', payload.items);
      // console.log('Full Payload:', JSON.stringify(payload, null, 2));
      // console.log('===========================');
      console.log('Submitting payload:', payload);

      let response;
      if (isEditing && editingVoucherId && !createNewFromCancelled) {
        // Block update if EWB is already generated
        const ewbStatus = editVoucher?.ewaybill?.status || editVoucher?.ewaybill_status;
        const ewbNo = editVoucher?.ewaybill?.ewb_no || editVoucher?.ewb_no;
        if (ewbStatus === 'generated' || !!ewbNo) {
          setSaving(false);
          setShowEwbWarning(true);
          return;
        }
        response = await vouchersApi.updateSalesVoucher(editingVoucherId, payload);
        if (response.success) {
          if (isEWayBill) {
            const consigneePartyForEwb = isConsigneeSame ? selectedParty : selectedConsignee;
            const billingPartyForEwb = selectedParty;
            const invoiceForEwb = {
              id: editingVoucherId,
              voucher_no: currentInvoiceNo,
              voucher_date: voucherDate,
              party_name: billingPartyForEwb?.name || '',
              party_gstin: billingPartyForEwb?.gst_number || '',
              billing_name: billingPartyForEwb?.name || '',
              billing_gstin: billingPartyForEwb?.gst_number || '',
              billing_state: getStateName(billingPartyForEwb?.state) || '',
              billing_address: billingPartyForEwb?.address || '',
              billing_city: billingPartyForEwb?.city || '',
              billing_pincode: billingPartyForEwb?.pincode || '',
              consignee_name: consigneePartyForEwb?.name || '',
              consignee_gstin: consigneePartyForEwb?.gst_number || '',
              consignee_state: getStateName(consigneePartyForEwb?.state) || '',
              consignee_address: consigneePartyForEwb?.address || '',
              consignee_city: consigneePartyForEwb?.city || '',
              consignee_pincode: consigneePartyForEwb?.pincode || '',
              total_amount: finalTotal.toString(),
              ewaybill: editVoucher?.ewaybill || { status: 'not_generated' },
            };
            setSavedVoucherForEwb(invoiceForEwb);
            setIsEwbModalOpen(true);
          } else {
            alert('Sales voucher updated successfully!');
            navigate(-1);
          }
        } else {
          alert(response.message || 'Failed to update voucher');
        }
      } else {
        // Create new voucher (also used when re-creating from cancelled)
        response = await vouchersApi.createSalesVoucher(payload);
        if (response.success) {
          if (isEWayBill && response.data) {
            // Build the invoice object EWayBillComponent expects
            const savedId = response.data.id || response.data.voucher_id;
            const consigneePartyForEwb = isConsigneeSame ? selectedParty : selectedConsignee;
            const billingPartyForEwb = selectedParty;
            const invoiceForEwb = {
              id: savedId,
              voucher_no: currentInvoiceNo,
              voucher_date: voucherDate,
              party_name: billingPartyForEwb?.name || '',
              party_gstin: billingPartyForEwb?.gst_number || '',
              billing_name: billingPartyForEwb?.name || '',
              billing_gstin: billingPartyForEwb?.gst_number || '',
              billing_state: getStateName(billingPartyForEwb?.state) || '',
              billing_address: billingPartyForEwb?.address || '',
              billing_city: billingPartyForEwb?.city || '',
              billing_pincode: billingPartyForEwb?.pincode || '',
              consignee_name: consigneePartyForEwb?.name || '',
              consignee_gstin: consigneePartyForEwb?.gst_number || '',
              consignee_state: getStateName(consigneePartyForEwb?.state) || '',
              consignee_address: consigneePartyForEwb?.address || '',
              consignee_city: consigneePartyForEwb?.city || '',
              consignee_pincode: consigneePartyForEwb?.pincode || '',
              total_amount: finalTotal.toString(),
              ewaybill: { status: 'not_generated' },
            };
            setSavedVoucherForEwb(invoiceForEwb);
            setIsEwbModalOpen(true);
          } else {
            alert(createNewFromCancelled ? 'New voucher created from cancelled invoice!' : 'Sales voucher created successfully!');
            navigate(-1);
          }
        } else {
          alert(response.message || 'Failed to create voucher');
        }
      }
    } catch (err: any) {
      alert(err.message || `Failed to ${isEditing ? 'update' : 'create'} voucher`);
    } finally {
      setSaving(false);
    }
  };

  // Check if form has any data entered
  const hasFormData = () => {
    return selectedPartyId || rows.some(r => r.itemId) || narration || referenceNo;
  };

  // Handle back button click - show confirmation if data exists
  const handleBack = () => {
    if (hasFormData()) {
      setShowDraftConfirm(true);
    } else {
      navigate(-1);
    }
  };

  // Handle save as draft
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      // Get godown state for company_state
      const godownState = selectedGodown?.state || 'Tamil Nadu';
      const godownStateCode = indianStates.find(s => s.name === godownState || s.code === godownState)?.code;

      const items = rows
        .filter(r => r.itemId)
        .map(row => {
          const stockItem = stockItems.find(i => i.id === parseInt(row.itemId));
          const unit = units.find(u => u.name === row.unit);
          const tax = taxes.find(t => t.rate === row.gst);

          return {
            item_id: parseInt(row.itemId),
            item_name: row.item,
            colour: row.colour || undefined,
            quantity: row.qty,
            unit_id: unit?.id || stockItem?.unit_id || 1,
            rate: row.rate,
            discount_amount: 0,
            tax_id: tax?.id || stockItem?.tax_id || 1,
            tax_percent: row.gst,
            godown_id: selectedGodownId || 1,
          };
        });

      // Build billing details from selected party
      const billingParty = selectedParty;

      // Get state names with fallback to company/godown state
      const billingState = getStateName(billingParty?.state) || getStateName(godownStateCode);

      const payload: any = {

        voucher_no: currentInvoiceNo,
        party_ledger_id: selectedPartyId || null,
        voucher_date: voucherDate,
        company_state: getStateName(godownStateCode),
        party_state: billingState,
        place_of_supply: getStateName(placeOfSupply),
        round_off: roundOff,
        status: 'draft',

        // Billing address details
        billing_name: billingParty?.name || '',
        billing_address: billingParty?.address || '',
        billing_city: billingParty?.city || '',
        billing_state: billingState,
        billing_pincode: billingParty?.pincode || '',
        billing_gstin: billingParty?.gst_no || '',
        billing_phone: billingParty?.phone || '',

        consignee_same_as_billing: isConsigneeSame,
        items,
      };

      if (referenceNo) payload.reference_no = referenceNo;
      if (narration) payload.narration = narration;
      if (vehicleNo) payload.vehicle_no = vehicleNo;

      let response: { success: boolean; message?: string };
      if (isEditing && editingVoucherId) {
        response = await vouchersApi.updateSalesVoucher(editingVoucherId, payload);
        if (response.success) {
          setShowDraftConfirm(false);
          navigate(-1);
        } else {
          alert(response.message || 'Failed to save');
        }
      } else {
        response = await vouchersApi.createSalesVoucher(payload);
        if (response.success) {
          setShowDraftConfirm(false);
          navigate(-1);
        } else {
          alert(response.message || 'Failed to save draft');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setSavingDraft(false);
    }
  };

  // Get godown state for reference
  const godownStateCode = selectedGodown?.state ?
    indianStates.find(s => s.name === selectedGodown.state || s.code === selectedGodown.state)?.code : null;

  // Get party/consignee state for GST determination
  const consigneeParty = isConsigneeSame ? selectedParty : selectedConsignee;
  const partyStateCode = consigneeParty?.state ?
    indianStates.find(s => s.name === consigneeParty.state || s.code === consigneeParty.state)?.code : null;

  // Get company/godown state
  const companyStateCode = selectedGodown?.state ?
    indianStates.find(s => s.name === selectedGodown.state || s.code === selectedGodown.state)?.code : null;

  // Calculate total amount from rows
  const totalAmount = rows.reduce((acc, curr) => acc + curr.amount, 0);

  // Determine if inter-state (IGST) or intra-state (CGST+SGST)
  // Based on: Company/Godown state vs Place of Supply (consignee state)
  // If they are the same, it's same-state (CGST+SGST), otherwise inter-state (IGST)
  const isSameState = companyStateCode === placeOfSupply;
  const gstType = isSameState ? 'CGST+SGST' : 'IGST';

  // Calculate taxes based on GST type
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;

  rows.forEach(row => {
    const taxableAmount = row.amount; // amount is base amount without tax
    const taxPercent = row.gst;

    if (isSameState) {
      // CGST + SGST: each is half of the tax rate
      const cgst = (taxableAmount * (taxPercent / 2)) / 100;
      const sgst = (taxableAmount * (taxPercent / 2)) / 100;
      totalCgst += cgst;
      totalSgst += sgst;
      totalTax += cgst + sgst;
    } else {
      // IGST: full tax rate
      const igst = (taxableAmount * taxPercent) / 100;
      totalIgst += igst;
      totalTax += igst;
    }
  });

  const subtotal = totalAmount;
  const totalWithTax = isGSTInvoice ? subtotal + totalTax : subtotal;
  const roundedTotal = Math.round(totalWithTax);
  const roundOff = roundedTotal - totalWithTax;
  const finalTotal = roundedTotal;
  const currentInvoiceNo = customInvoiceNo !== null ? customInvoiceNo : `${prefix}-${sequence}`;

  const stockItemOptions = stockItems.map(item => ({
    value: item.id,
    label: item.name,
    qty: item.opening_stock ?? 0,
    unit: item.unit_name || 'Pcs',
  }));

  const formatOptionLabel = (option: { value: number; label: string; qty: number; unit: string }, { context }: { context: string }) => {
    if (context === 'menu') {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500">Loading voucher data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      {/* Desktop View */}
      <div className="hidden lg:flex items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
            S
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{isEditing ? 'Edit Sales Voucher' : 'Sales Voucher'}</h1>
              <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${isEditing ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{isEditing ? 'Editing' : 'Draft'}</span>
              {isCancelledVoucher && (
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border bg-rose-100 text-rose-600 border-rose-200">Cancelled → New</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-slate-400">Invoice No:</span>
              <div className="group relative flex items-center gap-2">
                <input
                  type="text"
                  value={currentInvoiceNo}
                  onChange={(e) => {
                    setCustomInvoiceNo(e.target.value);
                  }}
                  className="text-xs font-black text-indigo-600 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-600 p-0 focus:ring-0 w-32 cursor-text outline-none transition-colors"
                />
                <button onClick={() => setShowInvoiceSettings(!showInvoiceSettings)} className="text-slate-300 hover:text-indigo-600 transition-colors" title="Invoice Settings">
                  <Settings size={14} />
                </button>
                {showInvoiceSettings && (
                  <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl p-4 z-50 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voucher Settings</p>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600">Prefix</label>
                      <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <button onClick={() => setShowInvoiceSettings(false)} className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl tracking-widest">Apply</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <X size={18} /> Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? (createNewFromCancelled ? 'Creating...' : isEditing ? 'Updating...' : 'Saving...') : (createNewFromCancelled ? 'Create New Voucher' : isEditing ? 'Update Voucher' : 'Save & Print')}
          </button>
        </div>
      </div>

      {/* Tablet View */}
      <div className="hidden md:flex lg:hidden flex-row items-center justify-between gap-4 bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-90"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-inner bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{isEditing ? 'Edit Sales Voucher' : 'Sales Voucher'}</h1>
              <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md border ${isEditing ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{isEditing ? 'Editing' : 'Draft'}</span>
              {isCancelledVoucher && (
                <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md border bg-rose-100 text-rose-600 border-rose-200">Cancelled → New</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-bold text-slate-400">Invoice No:</span>
              <div className="group relative flex items-center gap-1.5">
                <input
                  type="text"
                  value={currentInvoiceNo}
                  onChange={(e) => {
                    setCustomInvoiceNo(e.target.value);
                  }}
                  className="text-[11px] font-black text-indigo-600 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-600 p-0 focus:ring-0 w-28 cursor-text outline-none transition-colors"
                />
                <button onClick={() => setShowInvoiceSettings(!showInvoiceSettings)} className="text-slate-300 hover:text-indigo-600 transition-colors" title="Invoice Settings">
                  <Settings size={12} />
                </button>
                {showInvoiceSettings && (
                  <div className="absolute top-full mt-2 left-0 w-60 bg-white border border-slate-200 shadow-xl rounded-2xl p-4 z-50 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voucher Settings</p>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600">Prefix</label>
                      <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                    </div>
                    <button onClick={() => setShowInvoiceSettings(false)} className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl tracking-widest">Apply</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBack}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <X size={16} /> Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? (createNewFromCancelled ? 'Creating...' : isEditing ? 'Updating...' : 'Saving...') : (createNewFromCancelled ? 'Create New' : isEditing ? 'Update Voucher' : 'Save & Print')}
          </button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">{isEditing ? 'Edit Sales' : 'Sales Voucher'}</h1>
                <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md border ${isEditing ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{isEditing ? 'Editing' : 'Draft'}</span>
                {isCancelledVoucher && (
                  <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md border bg-rose-100 text-rose-600 border-rose-200">New</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold text-slate-400">INV:</span>
                <input
                  type="text"
                  value={currentInvoiceNo}
                  onChange={(e) => {
                    setCustomInvoiceNo(e.target.value);
                  }}
                  className="text-[10px] font-black text-indigo-600 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-600 p-0 focus:ring-0 w-24 cursor-text outline-none transition-colors"
                />
                <button onClick={() => setShowInvoiceSettings(!showInvoiceSettings)} className="text-slate-300 hover:text-indigo-600 transition-colors" title="Invoice Settings">
                  <Settings size={12} />
                </button>
              </div>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0">
            S
          </div>
        </div>

        {showInvoiceSettings && (
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Voucher Settings</p>
            <div className="flex gap-2">
              <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Prefix" />
              <button onClick={() => setShowInvoiceSettings(false)} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg tracking-widest">Apply</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleBack}
            className="flex-1 px-4 py-2.5 rounded-xl text-slate-600 bg-slate-50 border border-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? (createNewFromCancelled ? 'Creating...' : isEditing ? 'Updating...' : 'Saving...') : (createNewFromCancelled ? 'Create New' : isEditing ? 'Update' : 'Save & Print')}
          </button>
        </div>
      </div>

      {/* Address Panels Container */}
      <div className="w-full">
        {/* Desktop View Header (xl) */}
        <div className="hidden xl:grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-8 grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group h-full">
              {businessDetails ? (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <div className="text-xs font-black text-slate-700 uppercase">{businessDetails.from_trade_name || 'Trade Name'}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <MapPin size={12} /> {businessDetails.from_addr1}, {businessDetails.from_addr2}, {businessDetails.from_place} - {businessDetails.from_pincode}
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">GST: {businessDetails.gstin || 'N/A'}</div>
                </div>
              ) : (selectedGodown && (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <MapPin size={12} /> {selectedGodown.address + ' ' + selectedGodown.city + ', ' + selectedGodown.state + '-' + selectedGodown.pincode || 'Address not available'}
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">GST: {selectedGodown.gstin || 'N/A'}</div>
                </div>
              ))}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">To (Billing)</h3>
                <User size={16} className="text-emerald-400" />
              </div>
              <div className="relative">
                <select
                  value={selectedPartyId || ''}
                  onChange={(e) => setSelectedPartyId(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none pr-10"
                >
                  <option value="">Select Party...</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
              {selectedParty && (
                <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold leading-tight">
                    <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    {getPartyAddress(selectedParty) || 'Address not available'}
                  </div>
                  <div className="pt-1 border-t border-emerald-100/50 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                      <Zap size={10} /> GST: {selectedParty.gst_number || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                      <Phone size={10} /> {selectedParty.phone || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6 flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className={isConsigneeSame ? "text-indigo-600" : "text-slate-400"} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Same for Delivery</span>
                </div>
                <button
                  onClick={() => setIsConsigneeSame(!isConsigneeSame)}
                  className={`w-9 h-5 rounded-full transition-all relative ${isConsigneeSame ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isConsigneeSame ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-4 h-full">
            {!isConsigneeSame ? (
              <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-lg shadow-indigo-100/50 relative group h-full animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500">Ship To (Consignee)</h3>
                  <Truck size={16} className="text-indigo-500" />
                </div>
                <div className="relative">
                  <select
                    value={selectedConsigneeId || ''}
                    onChange={(e) => setSelectedConsigneeId(parseInt(e.target.value))}
                    className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none pr-10"
                  >
                    <option value="">Select Consignee...</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={16} />
                </div>
                {selectedConsignee && (
                  <div className="mt-4 p-4 bg-white rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold leading-tight">
                      <MapPin size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                      {getPartyAddress(selectedConsignee) || 'Address not available'}
                    </div>
                    <div className="pt-1 border-t border-indigo-50 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase">
                        <Zap size={10} /> GST: {selectedConsignee.gst_number || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                        <Phone size={10} /> {selectedConsignee.phone || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-indigo-50/50 rounded-3xl border border-dashed border-indigo-200 p-8 h-full flex flex-col items-center justify-center text-center">
                <PackageCheck size={48} className="text-indigo-200 mb-4" />
                <p className="text-xs font-black text-indigo-300 uppercase tracking-widest leading-relaxed">Billing and Shipping addresses<br />are synchronized</p>
              </div>
            )}
          </div>
        </div>

        {/* Tablet View Header (md) */}
        <div className="hidden md:grid xl:hidden grid-cols-2 gap-6 mb-6">
          <div className="col-span-2 h-full">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group h-full">
              {businessDetails ? (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <div className="text-xs font-black text-slate-700 uppercase">{businessDetails.from_trade_name || 'Trade Name'}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <MapPin size={12} /> {businessDetails.from_addr1}, {businessDetails.from_addr2}, {businessDetails.from_place} - {businessDetails.from_pincode}
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">GST: {businessDetails.gstin || 'N/A'}</div>
                </div>
              ) : (selectedGodown && (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <MapPin size={12} /> {selectedGodown.address + ' ' + selectedGodown.city + ', ' + selectedGodown.state + '-' + selectedGodown.pincode || 'Address not available'}
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">GST: {selectedGodown.gstin || 'N/A'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-1 h-full">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">To (Billing)</h3>
                <User size={16} className="text-emerald-400" />
              </div>
              <div className="relative">
                <select
                  value={selectedPartyId || ''}
                  onChange={(e) => setSelectedPartyId(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none pr-10"
                >
                  <option value="">Select Party...</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
              {selectedParty && (
                <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold leading-tight">
                    <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    {getPartyAddress(selectedParty) || 'Address not available'}
                  </div>
                  <div className="pt-1 border-t border-emerald-100/50 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                      <Zap size={10} /> GST: {selectedParty.gst_number || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                      <Phone size={10} /> {selectedParty.phone || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6 flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className={isConsigneeSame ? "text-indigo-600" : "text-slate-400"} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Same for Delivery</span>
                </div>
                <button
                  onClick={() => setIsConsigneeSame(!isConsigneeSame)}
                  className={`w-9 h-5 rounded-full transition-all relative ${isConsigneeSame ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isConsigneeSame ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-1 h-full">
            {!isConsigneeSame ? (
              <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-lg shadow-indigo-100/50 relative group h-full animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500">Ship To (Consignee)</h3>
                  <Truck size={16} className="text-indigo-500" />
                </div>
                <div className="relative">
                  <select
                    value={selectedConsigneeId || ''}
                    onChange={(e) => setSelectedConsigneeId(parseInt(e.target.value))}
                    className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none pr-10"
                  >
                    <option value="">Select Consignee...</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={16} />
                </div>
                {selectedConsignee && (
                  <div className="mt-4 p-4 bg-white rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold leading-tight">
                      <MapPin size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                      {getPartyAddress(selectedConsignee) || 'Address not available'}
                    </div>
                    <div className="pt-1 border-t border-indigo-50 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase">
                        <Zap size={10} /> GST: {selectedConsignee.gst_number || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                        <Phone size={10} /> {selectedConsignee.phone || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-indigo-50/50 rounded-3xl border border-dashed border-indigo-200 p-8 h-full flex flex-col items-center justify-center text-center">
                <PackageCheck size={48} className="text-indigo-200 mb-4" />
                <p className="text-xs font-black text-indigo-300 uppercase tracking-widest leading-relaxed">Billing and Shipping addresses<br />are synchronized</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Header (sm) */}
        <div className="flex flex-col md:hidden gap-6 mb-6">
          <div className="h-full">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group h-full">
              {businessDetails ? (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <div className="text-xs font-black text-slate-700 uppercase">{businessDetails.from_trade_name || 'Trade Name'}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <MapPin size={12} /> {businessDetails.from_addr1}, {businessDetails.from_addr2}, {businessDetails.from_place} - {businessDetails.from_pincode}
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">GST: {businessDetails.gstin || 'N/A'}</div>
                </div>
              ) : (selectedGodown && (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <MapPin size={12} /> {selectedGodown.address + ' ' + selectedGodown.city + ', ' + selectedGodown.state + '-' + selectedGodown.pincode || 'Address not available'}
                  </div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">GST: {selectedGodown.gstin || 'N/A'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-full">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">To (Billing)</h3>
                <User size={16} className="text-emerald-400" />
              </div>
              <div className="relative">
                <select
                  value={selectedPartyId || ''}
                  onChange={(e) => setSelectedPartyId(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none pr-10"
                >
                  <option value="">Select Party...</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
              {selectedParty && (
                <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold leading-tight">
                    <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    {getPartyAddress(selectedParty) || 'Address not available'}
                  </div>
                  <div className="pt-1 border-t border-emerald-100/50 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                      <Zap size={10} /> GST: {selectedParty.gst_number || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                      <Phone size={10} /> {selectedParty.phone || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6 flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className={isConsigneeSame ? "text-indigo-600" : "text-slate-400"} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Same for Delivery</span>
                </div>
                <button
                  onClick={() => setIsConsigneeSame(!isConsigneeSame)}
                  className={`w-9 h-5 rounded-full transition-all relative ${isConsigneeSame ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isConsigneeSame ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="h-full">
            {!isConsigneeSame ? (
              <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-lg shadow-indigo-100/50 relative group h-full animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500">Ship To (Consignee)</h3>
                  <Truck size={16} className="text-indigo-500" />
                </div>
                <div className="relative">
                  <select
                    value={selectedConsigneeId || ''}
                    onChange={(e) => setSelectedConsigneeId(parseInt(e.target.value))}
                    className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none pr-10"
                  >
                    <option value="">Select Consignee...</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={16} />
                </div>
                {selectedConsignee && (
                  <div className="mt-4 p-4 bg-white rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold leading-tight">
                      <MapPin size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                      {getPartyAddress(selectedConsignee) || 'Address not available'}
                    </div>
                    <div className="pt-1 border-t border-indigo-50 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase">
                        <Zap size={10} /> GST: {selectedConsignee.gst_number || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                        <Phone size={10} /> {selectedConsignee.phone || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-indigo-50/50 rounded-3xl border border-dashed border-indigo-200 p-8 h-full flex flex-col items-center justify-center text-center">
                <PackageCheck size={48} className="text-indigo-200 mb-4" />
                <p className="text-xs font-black text-indigo-300 uppercase tracking-widest leading-relaxed">Billing and Shipping addresses<br />are synchronized</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid container for remaining components: Metadata, Item Particulars Table, Footer */}
      <div className="flex flex-col xl:grid xl:grid-cols-12 gap-6">
        {/* Metadata */}
        <div className="xl:col-span-12 bg-white p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voucher Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full pl-10 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ref / Bill No</label>
              <input
                type="text"
                placeholder="External Ref (Manual)"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
              />
            </div>
            {/* <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sales Order</label>
              <select className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none appearance-none">
                <option>Select Pending SO...</option>
                <option>SO-2024-001 (Open)</option>
                <option>SO-2024-045 (Partially)</option>
              </select>
            </div> */}
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle Number</label>
              <input
                type="text"
                placeholder="Enter Vehicle Number"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Place of Supply</label>
              <select
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
              >
                {indianStates.map((state) => (
                  <option key={state.code} value={state.code}>{state.name} ({state.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-8 md:gap-12 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsGSTInvoice(!isGSTInvoice)}>
              <div className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${isGSTInvoice ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isGSTInvoice ? 'right-1' : 'left-1'}`} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider group-hover:text-indigo-600 transition-colors">GST Invoice</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsEInvoice(!isEInvoice)}>
              <div className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${isEInvoice ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isEInvoice ? 'right-1' : 'left-1'}`} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider group-hover:text-emerald-600 transition-colors">E-Invoice</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsEWayBill(!isEWayBill)}>
              <div className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${isEWayBill ? 'bg-amber-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isEWayBill ? 'right-1' : 'left-1'}`} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider group-hover:text-amber-600 transition-colors">E-Way Bill</span>
            </div>
          </div>
        </div>

        {/* Item Particulars Table */}
        <div className="xl:col-span-12 bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
              <Package size={18} className="text-indigo-600" />
              Item Particulars
            </h3>
          </div>

          {/* Desktop View (xl and above) */}
          <div className="hidden xl:block w-full overflow-x-auto">
            <table className="w-full text-left table-fixed min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-1 py-4 w-[35px] text-center">#</th>
                  <th className="px-1 py-4 w-[180px]">Stock Item</th>
                  <th className="px-1 py-4 w-[130px]">Colour</th>
                  <th className="px-1 py-4 w-[60px]">Qty</th>
                  <th className="px-1 py-4 w-[40px]">Unit</th>
                  <th className="px-1 py-4 w-[80px]">Rate</th>
                  <th className="px-1 py-4 w-[40px]">GST%</th>
                  <th className="px-1 py-4 w-[80px] text-right pr-4">Amount</th>
                  <th className="px-1 py-4 w-[40px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={`desktop-${row.id}`} className="group hover:bg-slate-50/30 transition-colors z-10">
                    <td className="px-1 py-4 text-[10px] font-bold text-slate-300 text-center">{idx + 1}</td>
                    <td className="px-0.5 py-4">
                      <Select
                        ref={(el) => { rowSelectRefs.current[idx] = el; }}
                        options={stockItemOptions}
                        value={stockItemOptions.find(option => option.value === parseInt(row.itemId))}
                        onChange={(selectedOption) => handleItemChange(idx, String(selectedOption?.value || ''))}
                        styles={customSelectStyles}
                        placeholder="Select Item..."
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        filterOption={(option, inputValue) =>
                          option.label.toLowerCase().includes(inputValue.toLowerCase())
                        }
                        formatOptionLabel={formatOptionLabel}
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="text"
                        value={row.colour}
                        placeholder="e.g. Navy"
                        onChange={(e) => updateRowValue(idx, 'colour', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => updateRowValue(idx, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative group">
                        <select
                          value={row.unit}
                          onChange={(e) => updateRowValue(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none appearance-none pr-5 cursor-pointer transition-all"
                        >
                          {units.map(u => <option key={`desktop-u-${u.id}`} value={u.name}>{u.symbol || u.name}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 font-bold">₹</span>
                        <input
                          type="number"
                          value={row.rate}
                          onChange={(e) => updateRowValue(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full pl-5 pr-1 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative group">
                        <select
                          value={row.gst}
                          onChange={(e) => updateRowValue(idx, 'gst', parseFloat(e.target.value))}
                          className="w-full bg-indigo-50/30 border border-indigo-100 rounded-lg px-2 py-2 text-[10px] font-black text-indigo-600 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none appearance-none pr-5 cursor-pointer transition-all"
                        >
                          {taxes.map(t => <option key={`desktop-t-${t.id}`} value={t.rate}>{t.rate}%</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-1 py-4 text-right pr-4">
                      <span className="text-xs font-black text-slate-900">₹{row.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-1 py-4 text-right">
                      <button onClick={() => removeRow(row.id)} className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
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

          {/* Tablet View (md to xl) */}
          <div className="hidden md:block xl:hidden w-full overflow-x-auto">
            <table className="w-full text-left table-fixed min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-1 py-4 w-[35px] text-center">#</th>
                  <th className="px-1 py-4 w-[160px]">Stock Item</th>
                  <th className="px-1 py-4 w-[120px]">Colour</th>
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
                  <tr key={`tablet-${row.id}`} className="group hover:bg-slate-50/30 transition-colors z-10">
                    <td className="px-1 py-4 text-[10px] font-bold text-slate-300 text-center">{idx + 1}</td>
                    <td className="px-0.5 py-4">
                      <Select
                        options={stockItemOptions}
                        value={stockItemOptions.find(option => option.value === parseInt(row.itemId))}
                        onChange={(selectedOption) => handleItemChange(idx, String(selectedOption?.value || ''))}
                        styles={customSelectStyles}
                        placeholder="Select Item..."
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        filterOption={(option, inputValue) =>
                          option.label.toLowerCase().includes(inputValue.toLowerCase())
                        }
                        formatOptionLabel={formatOptionLabel}
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="text"
                        value={row.colour}
                        placeholder="e.g. Navy"
                        onChange={(e) => updateRowValue(idx, 'colour', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => updateRowValue(idx, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                      />
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative group">
                        <select
                          value={row.unit}
                          onChange={(e) => updateRowValue(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none appearance-none pr-5 cursor-pointer transition-all"
                        >
                          {units.map(u => <option key={`tablet-u-${u.id}`} value={u.name}>{u.symbol || u.name}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 font-bold">₹</span>
                        <input
                          type="number"
                          value={row.rate}
                          onChange={(e) => updateRowValue(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full pl-5 pr-1 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-0.5 py-4">
                      <div className="relative group">
                        <select
                          value={row.gst}
                          onChange={(e) => updateRowValue(idx, 'gst', parseFloat(e.target.value))}
                          className="w-full bg-indigo-50/30 border border-indigo-100 rounded-lg px-2 py-2 text-[10px] font-black text-indigo-600 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none appearance-none pr-5 cursor-pointer transition-all"
                        >
                          {taxes.map(t => <option key={`tablet-t-${t.id}`} value={t.rate}>{t.rate}%</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-1 py-4 text-right pr-4">
                      <span className="text-xs font-black text-slate-900">₹{row.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-1 py-4 text-right">
                      <button onClick={() => removeRow(row.id)} className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
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
              <div key={`mobile-${row.id}`} className="p-4 flex flex-col gap-3 relative">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <Select
                      options={stockItemOptions}
                      value={stockItemOptions.find(option => option.value === parseInt(row.itemId))}
                      onChange={(selectedOption) => handleItemChange(idx, String(selectedOption?.value || ''))}
                      styles={customSelectStyles}
                      placeholder="Select Item..."
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                    />
                  </div>
                  <button onClick={() => removeRow(row.id)} className="mt-1 p-1.5 text-slate-400 hover:text-rose-500 bg-white border border-slate-200 rounded-md transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Colour</label>
                    <input
                      type="text"
                      value={row.colour}
                      placeholder="e.g. Navy"
                      onChange={(e) => updateRowValue(idx, 'colour', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div className="col-span-1" />
                </div>

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                    <input type="number" value={row.qty} onChange={(e) => updateRowValue(idx, 'qty', parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-black text-slate-900 outline-none text-center" />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
                    <select value={row.unit} onChange={(e) => updateRowValue(idx, 'unit', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-900 outline-none appearance-none pr-4">
                      {units.map(u => <option key={`mobile-u-${u.id}`} value={u.name}>{u.symbol || u.name}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 bottom-3 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rate</label>
                    <span className="absolute left-2 bottom-2 text-[10px] text-slate-400 font-bold">₹</span>
                    <input type="number" value={row.rate} onChange={(e) => updateRowValue(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-full pl-5 pr-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 outline-none" />
                  </div>
                  <div className="col-span-3 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">GST%</label>
                    <select value={row.gst} onChange={(e) => updateRowValue(idx, 'gst', parseFloat(e.target.value))} className="w-full bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-2 text-[10px] font-black text-indigo-600 outline-none appearance-none pr-4">
                      {taxes.map(t => <option key={`mobile-t-${t.id}`} value={t.rate}>{t.rate}%</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 bottom-3 text-indigo-300 pointer-events-none" />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Amount</span>
                  <span className="text-sm font-black text-slate-900">₹{row.amount.toLocaleString()}</span>
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
        </div>

        {/* Footer */}
        <div className="xl:col-span-12 p-4 sm:p-6 bg-slate-50/30 border border-slate-200 rounded-2xl md:rounded-3xl flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-10 items-start shadow-sm">
          <div className="space-y-2 md:space-y-3 w-full order-2 md:order-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Narration / Remarks</label>
            <textarea
              placeholder="Being goods sold on credit to customer..."
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-medium focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none h-24 md:h-28 resize-none shadow-sm"
            />
          </div>

          <div className="space-y-4 md:space-y-6 w-full order-1 md:order-2">
            <div className="bg-slate-900 p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] text-white shadow-xl md:shadow-2xl relative overflow-hidden group w-full">
              <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-indigo-500/10 rounded-full -mr-12 -mt-12 md:-mr-16 md:-mt-16 group-hover:scale-110 transition-transform duration-500" />
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Final Summary</h3>
                <span className="px-2 md:px-3 py-0.5 md:py-1 bg-white/10 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/50">Post-Tax</span>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <p className="text-2xl sm:text-3xl font-black tracking-tighter">₹{finalTotal.toLocaleString()}</p>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 md:mt-1">Net Receivable Amount</p>
                </div>
                <div className="space-y-1.5 md:space-y-2 pt-1 border-t border-slate-700/50 sm:border-0 sm:pt-1 mt-2 sm:mt-0">
                  <div className="flex justify-between text-[10px] md:text-[11px] font-bold text-slate-400">
                    <span>Taxable</span>
                    <span>₹{totalAmount.toLocaleString()}</span>
                  </div>
                  {isGSTInvoice && (
                    isSameState ? (
                      <>
                        <div className="flex justify-between text-[10px] md:text-[11px] font-bold text-indigo-400">
                          <span>CGST ({rows[0]?.gst ? (rows[0].gst / 2).toFixed(1) : 0}%)</span>
                          <span>₹{totalCgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[10px] md:text-[11px] font-bold text-indigo-400">
                          <span>SGST ({rows[0]?.gst ? (rows[0].gst / 2).toFixed(1) : 0}%)</span>
                          <span>₹{totalSgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-[10px] md:text-[11px] font-bold text-amber-400">
                        <span>IGST ({rows[0]?.gst}%)</span>
                        <span>₹{totalIgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )
                  )}
                  <div className="flex justify-between text-[10px] md:text-[11px] font-bold text-slate-500 border-t border-slate-700 pt-1.5 md:pt-2 mt-0.5 md:mt-1">
                    <span>Round Off</span>
                    <span className={roundOff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {roundOff >= 0 ? '+' : ''}₹{roundOff.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 md:mt-6 bg-indigo-500/10 p-3 md:p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0 transition-all hover:bg-indigo-500/20">
                <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-300">New Ledger Balance</div>
                <div className="text-xs md:text-sm font-black text-emerald-400">₹{(12450 + finalTotal).toLocaleString()} Cr</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-emerald-50 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-emerald-100 flex items-center gap-2 md:gap-3 transition-all hover:shadow-md">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-md md:shadow-lg shadow-emerald-200 shrink-0"><Zap size={12} className="md:w-3.5 md:h-3.5" /></div>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-emerald-600 tracking-wider">GST Portal</p>
                  <p className="text-[9px] md:text-[10px] font-bold text-emerald-900 leading-none mt-0.5">Status: OK</p>
                </div>
              </div>
              <div className="bg-amber-50 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-amber-100 flex items-center gap-2 md:gap-3 transition-all hover:shadow-md">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-md md:shadow-lg shadow-amber-200 shrink-0"><Truck size={12} className="md:w-3.5 md:h-3.5" /></div>
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-amber-600 tracking-wider">Tracking</p>
                  <p className="text-[9px] md:text-[10px] font-bold text-amber-900 leading-none mt-0.5">Verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >

      {/* E-Way Bill Modal */}
      < EWayBillComponent
        isOpen={isEwbModalOpen}
        onClose={() => {
          setIsEwbModalOpen(false);
          navigate(-1);
        }}
        invoice={savedVoucherForEwb}
        businessDetails={businessDetails}
        onSuccess={() => {
          setIsEwbModalOpen(false);
          navigate(-1);
        }}
        onPrintEwb={handlePrintEwb}
        onViewEwb={handleViewEwb}
        onCancelEwb={() => {
          setIsEwbModalOpen(false);
          setCancelReason('2');
          setCancelRemark('');
          setCancelUsername(businessDetails?.username || '');
          setCancelPassword('');
          setIsCancelModalOpen(true);
        }}
      />

      {/* Cancel E-Way Bill Modal */}
      {
        isCancelModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800">Cancel E-Way Bill</h3>
                <button onClick={() => setIsCancelModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="1">Due to Breakage</option>
                    <option value="2">Due to Transporter Change</option>
                    <option value="3">Others</option>
                    <option value="4">Order Cancelled</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remark</label>
                  <textarea
                    value={cancelRemark}
                    onChange={(e) => setCancelRemark(e.target.value)}
                    placeholder="Enter cancellation remark..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">EWB Username</label>
                  <input
                    type="text"
                    value={cancelUsername}
                    onChange={(e) => setCancelUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">EWB Password</label>
                  <input
                    type="password"
                    value={cancelPassword}
                    onChange={(e) => setCancelPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-wider transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleCancelEwb}
                  disabled={cancelLoading}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-rose-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* E-Way Bill Preview Modal */}
      {
        isEwbPreviewModalOpen && savedVoucherForEwb && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg" onClick={() => setIsEwbPreviewModalOpen(false)} />
            <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-100">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">E-Way Bill Preview</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {savedVoucherForEwb.ewaybill?.ewb_no || 'Draft Mode'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintEwb}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                  >
                    <Printer size={16} /> Print EWB
                  </button>
                  <button
                    onClick={() => setIsEwbPreviewModalOpen(false)}
                    className="p-3 text-slate-400 hover:text-rose-500 transition-all ml-4 bg-slate-50 rounded-2xl"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-[800px] mx-auto min-h-[400px] flex flex-col items-center justify-center">
                  {ewbViewLoading ? (
                    <div className="flex flex-col items-center gap-4 py-20">
                      <Loader2 size={48} className="text-indigo-600 animate-spin" />
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading E-Way Bill...</p>
                    </div>
                  ) : viewEwbFullData ? (
                    <EWayBillTemplate
                      invoice={savedVoucherForEwb}
                      businessDetails={businessDetails}
                      ewbData={viewEwbFullData}
                    />
                  ) : (
                    <div className="text-center py-20">
                      <XCircle size={48} className="text-rose-500 mx-auto mb-4" />
                      <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Failed to Load Details</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-white flex justify-end z-20">
                <button
                  onClick={() => setIsEwbPreviewModalOpen(false)}
                  className="px-10 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all bg-slate-50 rounded-[1.5rem]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Hidden EWB Template for Printing */}
      <div style={{ display: 'none' }}>
        <EWayBillTemplate
          ref={ewbPrintRef}
          invoice={savedVoucherForEwb}
          businessDetails={businessDetails}
          ewbData={viewEwbFullData}
        />
      </div>

      {/* EWB Already Generated Warning */}
      {
        showEwbWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowEwbWarning(false)} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-100">
                <TriangleAlert size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">E-Way Bill Generated</h3>
                {(editVoucher?.ewaybill?.ewb_no || editVoucher?.ewb_no) && (
                  <p className="text-sm font-black text-indigo-600">
                    EWB No: {editVoucher?.ewaybill?.ewb_no || editVoucher?.ewb_no}
                  </p>
                )}
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  An E-Way Bill has already been generated for this voucher. You must <span className="font-black text-rose-600">cancel the E-Way Bill</span> before making any updates.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowEwbWarning(false);
                    const consigneePartyForEwb = isConsigneeSame ? selectedParty : selectedConsignee;
                    const billingPartyForEwb = selectedParty;
                    setSavedVoucherForEwb({
                      id: editingVoucherId,
                      voucher_no: currentInvoiceNo,
                      voucher_date: voucherDate,
                      party_name: billingPartyForEwb?.name || '',
                      party_gstin: billingPartyForEwb?.gst_number || '',
                      billing_name: billingPartyForEwb?.name || '',
                      billing_gstin: billingPartyForEwb?.gst_number || '',
                      billing_state: getStateName(billingPartyForEwb?.state) || '',
                      billing_address: billingPartyForEwb?.address || '',
                      billing_city: billingPartyForEwb?.city || '',
                      billing_pincode: billingPartyForEwb?.pincode || '',
                      consignee_name: consigneePartyForEwb?.name || '',
                      consignee_gstin: consigneePartyForEwb?.gst_number || '',
                      consignee_state: getStateName(consigneePartyForEwb?.state) || '',
                      consignee_address: consigneePartyForEwb?.address || '',
                      consignee_city: consigneePartyForEwb?.city || '',
                      consignee_pincode: consigneePartyForEwb?.pincode || '',
                      total_amount: finalTotal.toString(),
                      ewaybill: {
                        status: 'generated',
                        ewb_no: editVoucher?.ewaybill?.ewb_no || editVoucher?.ewb_no || null,
                        ewb_date: editVoucher?.ewaybill?.ewb_date || editVoucher?.ewb_date || null,
                      },
                    });
                    setIsEwbModalOpen(true);
                  }}
                  className="w-full py-3.5 bg-rose-600 text-white text-sm font-black uppercase rounded-2xl tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                >
                  <Truck size={18} /> View / Cancel E-Way Bill
                </button>
                <button
                  onClick={() => setShowEwbWarning(false)}
                  className="w-full py-3 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Draft Confirmation Dialog */}
      {
        showDraftConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowDraftConfirm(false)} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-100">
                <Save size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {isEditing ? 'Save Changes?' : 'Save as Draft?'}
                </h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  {isEditing
                    ? 'You have unsaved changes. Would you like to save before leaving?'
                    : 'You have unsaved changes. Would you like to save this voucher as a draft before leaving?'}
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="w-full py-3.5 bg-indigo-600 text-white text-sm font-black uppercase rounded-2xl tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingDraft ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {savingDraft ? 'Saving...' : (isEditing ? 'Save' : 'Save as Draft')}
                </button>
                <button
                  onClick={() => {
                    setShowDraftConfirm(false);
                    navigate(-1);
                  }}
                  className="w-full py-3.5 bg-rose-50 text-rose-600 text-sm font-black uppercase rounded-2xl tracking-widest hover:bg-rose-100 transition-all"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => setShowDraftConfirm(false)}
                  className="w-full py-3 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default SalesVoucher;
