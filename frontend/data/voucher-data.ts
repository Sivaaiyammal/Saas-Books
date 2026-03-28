
export const stockItems = [
  { id: 'S1', name: 'Premium Cotton Blue', rate: 450, unit: 'Meters', stock: 1250, gst: 5 },
  { id: 'S2', name: 'Silk Saree Red', rate: 4200, unit: 'Pcs', stock: 45, gst: 12 },
  { id: 'S3', name: 'Linen Yarn White', rate: 850, unit: 'Kgs', stock: 85, gst: 5 },
  { id: 'S4', name: 'Velvet Black 10m', rate: 1200, unit: 'Rolls', stock: 12, gst: 12 },
  { id: 'S5', name: 'Polyester Thread', rate: 150, unit: 'Cones', stock: 500, gst: 18 },
];

export const gstRates = [0, 5, 12, 18, 28];

export const unitsList = ['Meters', 'Pcs', 'Kgs', 'Rolls', 'Cones', 'Bags', 'Bundles'];

export const indianStates = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" }
];

export const parties = [
  { id: '1', name: 'Silk Emporium', address: '123 Textile Market, Surat, GJ', gst: '24AAAAA0000A1Z5', phone: '+91 98765 43210' },
  { id: '2', name: 'Modern Weaves', address: '45 Fashion Street, Mumbai, MH', gst: '27BBBBB1111B2Z6', phone: '+91 88888 77777' },
  { id: '3', name: 'Delivery Hub Surat', address: 'Plot 89, GIDC Ichhapore, Surat', gst: '24CCCCC2222C3Z7', phone: '+91 77777 66666' },
];

export const suppliers = [
  { id: '1', name: 'Laxmi Textiles Co.', address: 'GIDC, Pandesara, Surat', gst: '24BBBBB5678B1Z9', phone: '+91 99999 88888' },
  { id: '2', name: 'Global Fabrics Ltd.', address: 'Ring Road, Ahmedabad', gst: '24DDDDD1234D1Z5', phone: '+91 77777 55555' },
  { id: '3', name: 'Supreme Threads', address: 'Textile Park, Surat', gst: '24EEEEE4567E1Z8', phone: '+91 88888 66666' },
];

export interface VoucherRow {
  id: number;
  itemId: string;
  item: string;
  colour: string;
  qty: number;
  unit: string;
  rate: number;
  gst: number;
  amount: number;
  discount_percent: number;
  discount_amount: number;
}

export const createEmptyRow = (): VoucherRow => ({
  id: Date.now(),
  itemId: '',
  item: '',
  colour: '',
  qty: 0,
  unit: 'Meters',
  rate: 0,
  gst: 5,
  amount: 0,
  discount_percent: 0,
  discount_amount: 0
});
