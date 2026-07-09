## scan-images-and-pdfs

Totalum provides powerful AI document scanning capabilities that can extract structured JSON data from images and PDF files.


### Scan structured data from an image or PDF document

**Use Case:**

Extract specific fields from a document image (e.g., invoice, passport, receipt) as structured JSON data.

```javascript

// Step 1: Upload the image (if not already uploaded)
const fileName = 'invoice_scan.jpg';
const file = yourFileBlob;
const formData = new FormData();
formData.append('file', file, fileName);

const uploadResult = await totalumSdk.files.uploadFile(formData);
const fileNameId = uploadResult.data;

// Step 2: Define the data structure you want to extract (JSON Schema format)
const properties = {
    invoice_number: {
        type: "string",
        description: "the invoice number visible at the top of the document"
    },
    invoice_date: {
        type: "string",
        format: "date",
        description: "the date when the invoice was issued"
    },
    total_amount: {
        type: "number",
        description: "the total amount to be paid shown at the bottom"
    },
    currency: {
        type: "string",
        enum: ["EUR", "USD", "GBP", "OTHER"],
        description: "the currency of the total amount, set to 'OTHER' if not in the list"
    },
    vendor_name: {
        type: "string",
        description: "the name of the company or vendor issuing the invoice"
    }
};

// Step 3: Scan the document
const scanResult = await totalumSdk.files.scanDocument(fileNameId, properties);
const extractedData = scanResult.data;

console.log('Extracted invoice data:', extractedData);
// Output example:
// {
//   invoice_number: "INV-2024-001",
//   invoice_date: "2024-01-15",
//   total_amount: 1250.50,
//   currency: "USD",
//   vendor_name: "Acme Corporation"
// }

```


### Scan document with array of items (e.g., invoice line items)

**Use Case:**

Extract structured data that includes arrays of items, such as products in an invoice or entries in a list.

```javascript

const fileName = 'detailed_invoice.pdf';

const properties = {
    invoice_number: {
        type: "string",
        description: "the invoice number"
    },
    customer_name: {
        type: "string",
        description: "the customer name"
    },
    line_items: {
        type: "array",
        description: "all items listed in the invoice",
        items: {
            type: "object",
            properties: {
                description: {
                    type: "string",
                    description: "the product or service description"
                },
                quantity: {
                    type: "number",
                    description: "the quantity of the item"
                },
                unit_price: {
                    type: "number",
                    description: "the price per unit"
                },
                total: {
                    type: "number",
                    description: "the total price for this line item"
                }
            }
        }
    },
    subtotal: {
        type: "number",
        description: "the subtotal before taxes"
    },
    tax_amount: {
        type: "number",
        description: "the total tax amount"
    },
    total_amount: {
        type: "number",
        description: "the final total amount"
    }
};

const scanResult = await totalumSdk.files.scanDocument(fileName, properties);
const invoiceData = scanResult.data;

console.log('Detailed invoice data:', invoiceData);
// Output includes:
// - invoice_number, customer_name
// - line_items array with each item's details
// - subtotal, tax_amount, total_amount

```

### Advanced scanning options

**Use Case:**

Use advanced configuration options to control how documents are scanned.

```javascript

const fileName = 'complex_document.pdf';

const properties = {
    // your properties definition here
    document_title: {
        type: "string",
        description: "the title of the document"
    },
    summary: {
        type: "string",
        description: "a brief summary of the document content"
    }
};

const options = {
    model: 'scanum', // default model, good for general documents and text extraction
    // model: 'scanum-pro', // use for more complex extraction
    // model: 'scanum-eye-pro', // use for images with colors/shapes (images only, not PDFs)

    removeFileAfterScan: false, // set true to delete the file after scanning

    returnOcrFullResult: false, // set true to get detailed OCR data with coordinates

    maxPages: 5, // limit scanning to first 5 pages of PDF

    pdfPages: [1, 3, 5], // scan only specific pages (page 1, 3, and 5)

    scanDescription: "This is a research paper about climate change published in 2024", // additional context to help extraction

    processEveryPdfPageAsDifferentScan: false // set true to get array of results, one per page
};

const scanResult = await totalumSdk.files.scanDocument(fileName, properties, options);
const extractedData = scanResult.data;

```

### Model selection guide

**Use Case:**

Choose the right scanning model for your document type.

**Model: `scanum` (default)**
- Best for: General documents, invoices, contracts, forms
- Works with: PDFs
- Good for: Large text extraction, structured documents
- Use when: Text is in straight lines, good quality scans

**Model: `scanum-pro`**
- Best for: General documents, invoices, contracts, forms
- Works with: PDFs
- Good for: Large text extraction, structured documents
- Use when: Complex or large pdfs

**Model: `scanum-eye-pro`**
- Best for: Complex images with colors and shapes, handwritten text
- Works with: Images only (not PDFs)
- Good for: Documents with poor quality, non-standard layouts
- Use when: For any image

```javascript

// Example: Using scanum-eye-pro for a handwritten note
const fileName = 'handwritten_note.jpg';

const properties = {
    note_content: {
        type: "string",
        description: "the content of the handwritten note"
    },
    author: {
        type: "string",
        description: "the name signed at the bottom of the note"
    },
    date: {
        type: "string",
        format: "date",
        description: "the date written on the note"
    }
};

const options = {
    model: 'scanum-eye-pro' // better for handwritten or complex documents
};

const scanResult = await totalumSdk.files.scanDocument(fileName, properties, options);

```

### Scan and save to database

**Use Case:**

Automatically scan a document and save the extracted data to your database.

```javascript

// Upload and scan document
const fileName = 'customer_form.jpg';
const file = yourFileBlob;
const formData = new FormData();
formData.append('file', file, fileName);

const uploadResult = await totalumSdk.files.uploadFile(formData);
const fileNameId = uploadResult.data;

// Define extraction properties
const properties = {
    customer_name: {
        type: "string",
        description: "the customer's full name"
    },
    email: {
        type: "string",
        description: "the customer's email address"
    },
    phone: {
        type: "string",
        description: "the customer's phone number"
    },
    address: {
        type: "string",
        description: "the customer's full address"
    },
    service_requested: {
        type: "string",
        description: "the service the customer is requesting"
    }
};

// Scan the document
const scanResult = await totalumSdk.files.scanDocument(fileNameId, properties);
const extractedData = scanResult.data;

// Save to database
const tableElementName = 'customer';
const customerRecord = {
    name: extractedData.customer_name,
    email: extractedData.email,
    phone: extractedData.phone,
    address: extractedData.address,
    service_requested: extractedData.service_requested,
    scanned_document: {
        name: fileNameId
    },
    created_at: new Date()
};

const createResult = await totalumSdk.crud.createRecord(tableElementName, customerRecord);

console.log('Customer record created:', createResult.data._id);

```

### Important notes

- **File formats**: Works with images (JPG, PNG, etc.) and PDF files
- **OCR vs Scan**: OCR extracts raw text, Scan extracts structured data based on your schema
- **Property definitions**: Use JSON Schema format to define what data to extract
- **Descriptions**: Clear, detailed descriptions help the AI extract data more accurately
- **Data types**: Supported types are `string`, `number`, `date`, `options` (enum), `array`, `object`
- **Arrays**: Can extract lists of items with nested properties
- **Enums**: Use `enum` to limit values to specific options
- **Model selection**: `scanum` for general documents, `scanum-eye-pro` for complex/handwritten content
- **Page limits**: Use `maxPages` or `pdfPages` to limit scanning in multi-page PDFs
- **Context**: Use `scanDescription` to provide additional context that helps extraction accuracy
- **File cleanup**: Set `removeFileAfterScan: true` to automatically delete files after processing
- **OCR details**: Set `returnOcrFullResult: true` to get detailed coordinates and positioning data (it uses Google Vision OCR under the hood, and it returns the full OCR result from Google on result.metadata.ocrFullResult)
