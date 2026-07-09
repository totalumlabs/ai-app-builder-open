## generate-custom-pdfs

Totalum allows you to create fully customizable and dynamic PDFs from directly from HTML code.
After generating a PDF, you can link it to a record in your database (e.g., attach an invoice PDF to an order record).


### Generate PDF directly from HTML

It can be any html without limitations (as the createPdfFromHtml api uses puppeteer under the hood).

```javascript

// Create HTML content dynamically
const htmlContent = `
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .invoice-details {
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
        .total {
            text-align: right;
            font-weight: bold;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Invoice</h1>
        <p>Invoice #INV-2024-001</p>
    </div>
    <div class="invoice-details">
        <p><strong>Customer:</strong> John Doe</p>
        <p><strong>Date:</strong> January 15, 2024</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Product A</td>
                <td>2</td>
                <td>$50.00</td>
                <td>$100.00</td>
            </tr>
            <tr>
                <td>Product B</td>
                <td>1</td>
                <td>$75.00</td>
                <td>$75.00</td>
            </tr>
        </tbody>
    </table>
    <div class="total">
        <p>Total: $175.00</p>
    </div>
</body>
</html>
`;

const fileName = 'direct_invoice.pdf'; // replace with your desired file name

const result = await totalumSdk.files.createPdfFromHtml({
    html: htmlContent,
    name: fileName
});

const fileResult = result.data;
const pdfUrl = fileResult.url;
console.log('PDF created from HTML:', fileResult.fileName);

// If you want to link this pdf to a record, use editRecordById as shown in previous examples
const tableElementName = 'order';
const recordId = 'your_record_id';
const result2 = await totalumSdk.crud.editRecordById(tableElementName, recordId, {
    'invoice_pdf': {
        name: fileResult.fileName
    }
});

```
