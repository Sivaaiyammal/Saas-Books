
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'viewer';
}

export enum VoucherType {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT'
}

export interface MasterItem {
  id: number;
  item_group_id: number;
  name: string;
  alias: string | null;
  description: string | null;
  item_code: string;
  hsn_code: string | null;
  gsm: string | null;
  count: string | null;
  dia: string | null;
  colour: string | null;
  unit_id: number;
  opening_stock: string | number;
  opening_value: string | number;
  opening_rate: string | number;
  minimum_level: string | number;
  maximum_level: string | number;
  reorder_level: string | number;
  standard_cost: string | number;
  standard_price: string | number;
  tax_id: number;
  is_service: boolean | number;
  track_inventory: boolean | number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  item_group_name: string;
  unit_name: string;
  unit_symbol: string;
  tax_name: string;
  tax_rate: string | number;
}

export interface Ledger {
  id: number;
  name: string;
  group_id: number;
  group_name: string;
  group_nature: string;
  opening_balance: string;
  opening_type: 'Dr' | 'Cr';
  bill_by_bill: boolean;
  gst_applicable: boolean;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: VoucherType;
  party: string;
  amount: number;
  status: 'draft' | 'posted' | 'cancelled';
}

export interface ChartData {
  name: string;
  sales: number;
  purchase: number;
}

export interface Tax {
  id: number;
  name: string;
  rate: string | number;
  tax_type: 'GST' | 'IGST' | 'CGST' | 'SGST' | 'Cess';
  is_default: boolean | number;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string;
  unit_type: 'Quantity' | 'Length' | 'Weight' | 'Area' | 'Volume' | 'Others' | string;
  decimal_places: number;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface StockItemGroup {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  group_type: 'Raw Material' | 'Finished Goods' | 'Work in Progress' | 'Consumables' | 'Services' | 'Other';
  item_count: number;
  description: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface LedgerGroup {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  nature: 'Asset' | 'Liability' | 'Income' | 'Expense' | string;
  affects_gross_profit: number;
  is_system: number;
  created_at: string;
  child_count: number;
}

export interface Godown {
  id: number;
  name: string;
  code: string;
  gst_no: string | null;
  address: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  capacity: string | null;
  is_default: boolean | number;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}