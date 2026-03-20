import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

interface EWayBillTemplateProps {
    invoice: any;
    businessDetails: any;
    ewbData: any; // Data from generate response or existing ewb info
}

const EWayBillTemplate = forwardRef<HTMLDivElement, EWayBillTemplateProps>(
    ({ invoice, businessDetails, ewbData }, ref) => {
        if (!invoice || !ewbData) return null;

        // Format date carefully - handles ISO and DD/MM/YYYY formats
        const formatDate = (dateStr: string | null) => {
            if (!dateStr || dateStr === 'N/A') return 'N/A';

            // If it's already in a friendly format like 19/02/2026 08:17:00 PM, return it
            if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;

            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr; // Fallback to raw string if invalid

                return date.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                }).replace(',', '');
            } catch (e) {
                return dateStr;
            }
        };

        const ewbNo = invoice.ewaybill?.ewb_no || ewbData.ewbNo || ewbData.ewb_no || 'N/A';
        const ewbDate = invoice.ewaybill?.ewb_date || ewbData.ewbDate || ewbData.ewb_date || 'N/A';

        // Detect if we are using the new structured API payload or the old flat structure
        const isStructured = !!ewbData.header;

        // Data mapping helper
        const header = isStructured ? ewbData.header : {
            ewb_no: ewbNo,
            ewb_date: ewbDate,
            generated_by: `${businessDetails?.gstin} - ${businessDetails?.from_trade_name}`,
            valid_from: ewbDate,
            valid_until: ewbData.valid_until || 'N/A',
            portal: ewbData.portal || '1'
        };

        const partA = isStructured ? ewbData.part_a : {
            supplier_gstin: businessDetails?.gstin,
            supplier_name: businessDetails?.from_trade_name,
            place_of_dispatch: `${businessDetails?.from_place}, ${businessDetails?.from_state} - ${businessDetails?.from_pincode}`,
            recipient_gstin: invoice.consignee_gstin || invoice.billing_gstin || invoice.party_gstin,
            recipient_name: invoice.consignee_name || invoice.billing_name || invoice.party_name,
            place_of_delivery: `${invoice.consignee_city || invoice.billing_city}, ${invoice.consignee_state || invoice.billing_state} - ${invoice.consignee_pincode || invoice.billing_pincode}`,
            document_no: invoice.voucher_no,
            document_date: invoice.voucher_date,
            transaction_type: 'Regular',
            value_of_goods: invoice.total_amount,
            hsn_code: invoice.items?.[0]?.hsn_code || 'N/A',
            reason_for_transport: 'Outward - Supply',
            transporter: ewbData.transporter_name || 'N/A'
        };

        const partB = isStructured ? (ewbData.part_b || []) : [{
            mode: ewbData.trans_mode === '1' ? 'Road' : ewbData.trans_mode === '2' ? 'Rail' : ewbData.trans_mode === '3' ? 'Air' : 'Ship',
            vehicle_no: ewbData.vehicle_no || ewbData.trans_doc_no || 'N/A',
            from: businessDetails?.from_place,
            entered_date: header.ewb_date,
            entered_by: businessDetails?.gstin?.substring(0, 15),
            portal: ewbData.portal || '1'
        }];

        // QR Code Content
        const qrContent = `${header.ewb_no}|${partA.supplier_gstin}|${formatDate(header.ewb_date)}`;

        return (
            <div ref={ref} className="ewb-print-container">
                <style>
                    {`
            @media print {
              .ewb-print-container {
                padding: 0;
                margin: 0;
                width: 100%;
              }
              @page {
                size: portrait;
                margin: 1cm;
              }
            }
            .ewb-print-container {
              font-family: 'Times New Roman', Times, serif;
              color: black;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            .ewb-header {
              text-align: center;
              margin-bottom: 10px;
            }
            .ewb-header h2 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .ewb-qr-wrapper {
              display: flex;
              justify-content: center;
              margin-bottom: 15px;
            }
            .ewb-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .ewb-table th, .ewb-table td {
              border: 1px solid #333;
              padding: 6px 8px;
              text-align: left;
              font-size: 12px;
            }
            .ewb-table th {
              background-color: #f2f2f2;
              width: 35%;
              font-weight: bold;
            }
            .ewb-section-header {
              background-color: #e0e0e0;
              font-weight: bold;
              padding: 4px 8px;
              font-size: 12px;
              border: 1px solid #333;
              border-bottom: none;
            }
            .ewb-section-header.part-b {
              margin-top: 10px;
            }
            .part-b-table th {
              background-color: #f2f2f2;
              text-align: center;
              font-size: 10px;
              padding: 4px;
            }
            .part-b-table td {
              text-align: center;
              font-size: 10px;
              padding: 4px;
            }
            .ewb-barcode-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: 20px;
            }
            .ewb-footer-note {
              font-size: 10px;
              text-align: center;
              margin-top: 10px;
              font-style: italic;
            }
            .prepared-by {
              font-size: 9px;
              margin-top: 40px;
              text-align: left;
              color: #666;
            }
          `}
                </style>

                <div className="ewb-header">
                    <h2>e-Way Bill</h2>
                </div>

                <div className="ewb-qr-wrapper">
                    <QRCodeSVG value={qrContent} size={120} />
                </div>

                <table className="ewb-table">
                    <tbody>
                        <tr>
                            <th>E-Way Bill No:</th>
                            <td>{header.ewb_no}</td>
                        </tr>
                        <tr>
                            <th>E-Way Bill Date:</th>
                            <td>{formatDate(header.ewb_date)}</td>
                        </tr>
                        <tr>
                            <th>Generated By:</th>
                            <td>{header.generated_by}</td>
                        </tr>
                        <tr>
                            <th>Valid From:</th>
                            <td>{formatDate(header.valid_from)}</td>
                        </tr>
                        <tr>
                            <th>Valid Until:</th>
                            <td>{formatDate(header.valid_until)}</td>
                        </tr>
                        <tr>
                            <th>Portal:</th>
                            <td>{header.portal}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="ewb-section-header">PART - A</div>
                <table className="ewb-table">
                    <tbody>
                        <tr>
                            <th>GSTIN of Supplier</th>
                            <td>{partA.supplier_gstin}, {partA.supplier_name}</td>
                        </tr>
                        <tr>
                            <th>Place of Dispatch</th>
                            <td>{partA.place_of_dispatch}</td>
                        </tr>
                        <tr>
                            <th>GSTIN of Recipient</th>
                            <td>{partA.recipient_gstin}, {partA.recipient_name}</td>
                        </tr>
                        <tr>
                            <th>Place of Delivery</th>
                            <td>{partA.place_of_delivery}</td>
                        </tr>
                        <tr>
                            <th>Document No.</th>
                            <td>{partA.document_no}</td>
                        </tr>
                        <tr>
                            <th>Document Date</th>
                            <td>{partA.document_date}</td>
                        </tr>
                        <tr>
                            <th>Transaction Type:</th>
                            <td>{partA.transaction_type}</td>
                        </tr>
                        <tr>
                            <th>Value of Goods</th>
                            <td>₹ {parseFloat(partA.value_of_goods).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <th>HSN Code</th>
                            <td>{partA.hsn_code}</td>
                        </tr>
                        <tr>
                            <th>Reason for Transportation</th>
                            <td>{partA.reason_for_transport}</td>
                        </tr>
                        <tr>
                            <th>Transporter</th>
                            <td>{partA.transporter}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="ewb-section-header part-b">PART - B</div>
                <table className="ewb-table part-b-table">
                    <thead>
                        <tr>
                            <th>Mode</th>
                            <th>Vehicle / Trans Doc No & Dt</th>
                            <th>From</th>
                            <th>Entered Date</th>
                            <th>Entered By</th>
                            <th>CEWB No. (if any)</th>
                            <th>Multi Veh.Info(If any)</th>
                            <th>Portal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partB.map((b: any, idx: number) => (
                            <tr key={idx}>
                                <td>{b.mode}</td>
                                <td>{b.vehicle_no || b.trans_doc_no || 'N/A'}</td>
                                <td>{b.from}</td>
                                <td>{formatDate(b.entered_date)}</td>
                                <td>{b.entered_by}</td>
                                <td>{b.cewb_no || '0'}</td>
                                <td>{b.multi_veh_info || ''}</td>
                                <td>{b.portal}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="ewb-barcode-wrapper">
                    <Barcode value={header.ewb_no} width={1.5} height={40} fontSize={12} displayValue={true} />
                </div>

                <div className="ewb-footer-note">
                    Note*: If any discrepancy in information please try after sometimes.
                </div>

                <div className="prepared-by">
                    Prepared using GSP eWay Bill API
                </div>
            </div>
        );
    }
);

EWayBillTemplate.displayName = 'EWayBillTemplate';

export default EWayBillTemplate;
