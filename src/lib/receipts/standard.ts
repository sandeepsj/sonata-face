// Copy of the built-in "Standard" receipt template (sonata-brain migration V9__receipt_templates.sql, REQ-091.AC1).
// Used only when templates can't be loaded (no read on /api/receipt-templates/**, or the request failed), so a
// receipt can always be printed. The backend's copy is the one users see and edit.
export const STANDARD_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt {{receipt.id}}</title>
<style>
  @page { size: A5 landscape; margin: 10mm; }
  body { margin: 0; padding: 10mm; font-family: Arial, sans-serif; background: white; }
  @media print { body { padding: 0; } }
  .receipt { font-size: 9pt; }
  .header { text-align: center; margin-bottom: 15px; }
  .header h1 { font-size: 14pt; margin: 0 0 3px 0; font-weight: bold; }
  .header h2 { font-size: 11pt; margin: 0 0 3px 0; font-weight: 600; }
  .header p { font-size: 8pt; margin: 0 0 2px 0; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .meta p, .name p { margin: 2px 0; }
  .name { margin-bottom: 10px; }
  .right { text-align: right; }
  table { font-size: 8pt; width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { padding: 3px 5px; border: 1px solid #000; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  th.right, td.right { text-align: right; }
  tfoot tr { border-top: 2px solid #000; font-weight: bold; }
  .discounts { padding-left: 20px; color: #666; font-size: 7pt; font-style: italic; }
  .footer { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .footer p { margin: 2px 0; font-size: 8pt; }
  .signature { border-top: 1px solid #000; margin-top: 30px; padding-top: 5px; text-align: center; font-size: 8pt; }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <h1>REVATHI EDUCATION ART &amp; CULTURAL TRUST</h1>
    <h2>INSTITUTE OF ARTS</h2>
    <p>In Collaboration with Kalai Kaviri School Of Fine Arts, Tiruchirappalli, Tamilnadu</p>
    <p>Reg.No. 46/4/2000</p>
  </div>

  <div class="meta">
    <p><strong>Receipt ID:</strong> {{receipt.id}}</p>
    <p class="right"><strong>Admn No:</strong> {{student.admissionNo}}</p>
  </div>
  <div class="name">
    <p><strong>Name:</strong> {{student.name}}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Subject/Course</th>
        <th>Description</th>
        <th class="right">Fee</th>
        <th class="right">Discount</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each payments}}
      <tr>
        <td>{{date}}</td>
        <td>{{courseName}}</td>
        <td>{{#if label}}{{label}}{{else}}-{{/if}}</td>
        <td class="right" style="font-weight: 600;">₹{{fee}}</td>
        <td class="right">{{#if discount}}₹{{discount}}{{else}}-{{/if}}</td>
        <td class="right">₹{{amountPaid}}</td>
      </tr>
      {{#if hasDiscounts}}
      <tr>
        <td colspan="6" class="discounts">Discounts applied:
          {{#each discounts}}{{label}} (₹{{amount}}){{#unless @last}}, {{/unless}}{{/each}}
        </td>
      </tr>
      {{/if}}
      {{/each}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="right">Total Amount Paid:</td>
        <td class="right">₹{{totals.paid}}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <p><strong>Date:</strong> {{receipt.printedDate}}</p>
    <div class="right"><div class="signature">Secretary/Clerk</div></div>
  </div>
</div>
</body>
</html>
`;
