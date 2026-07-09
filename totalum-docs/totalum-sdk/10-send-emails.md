## send-emails

Totalum allows you to send emails programmatically using the Totalum SDK. The email service supports custom HTML content, attachments, CC, BCC, and reply-to options.

IMPORTANT CONSIDERATIONS:

This method send an email using default totalum domain, not client domain (sendEmail not need any third party api key, is integrated on Totalum). If the client request to send emails using their own domain, use the npm library that they propose for do that, and if they dont propose any library, use resend (https://resend.com/docs). Remember to ask for api key and the email domain to the client.
Depending on the library, then ask to the user the api key or the smtp credentials.


### Send a basic email

**Use Case:**

Send a simple email with subject and HTML content to one or multiple recipients.

```javascript

const emailPayload = {
    to: ['recipient@example.com'], // array of recipient email addresses
    subject: 'Welcome to our service',
    html: '<h1>Welcome!</h1><p>Thank you for joining our service. We are excited to have you on board.</p>'
};

const result = await totalumSdk.email.sendEmail(emailPayload);

console.log('Email sent successfully:', result.data);

```

### Send email to multiple recipients

**Use Case:**

Send the same email to multiple recipients at once.

```javascript

const emailPayload = {
    to: [
        'recipient1@example.com',
        'recipient2@example.com',
        'recipient3@example.com'
    ],
    subject: 'Monthly Newsletter',
    html: `
        <h1>Monthly Newsletter - January 2024</h1>
        <p>Here are the highlights from this month...</p>
        <ul>
            <li>New feature: Advanced reporting</li>
            <li>Product update: Mobile app released</li>
            <li>Company news: Expansion to new markets</li>
        </ul>
    `
};

const result = await totalumSdk.email.sendEmail(emailPayload);

```

### Send email with all options

**Use Case:**

Send an email with custom sender name, CC, BCC, reply-to address, and attachments.

```javascript

const emailPayload = {
    to: ['customer@example.com'],
    subject: 'Order Confirmation #12345',
    html: `
        <h1>Order Confirmation</h1>
        <p>Thank you for your order!</p>
        <p>Order Number: #12345</p>
        <p>Total: $199.99</p>
        <p>Your order will be shipped within 2-3 business days.</p>
    `,
    fromName: 'Acme Store', // optional: custom sender name (instead of default)
    cc: ['sales@example.com'], // optional: carbon copy recipients
    bcc: ['archive@example.com'], // optional: blind carbon copy recipients
    replyTo: 'support@example.com', // optional: reply-to address
    attachments: [ // optional: array of attachments (max 10, each up to 15MB)
        {
            filename: 'invoice.pdf',
            url: 'https://example.com/files/invoice_12345.pdf',
            contentType: 'application/pdf' // optional: MIME type
        },
        {
            filename: 'receipt.pdf',
            url: 'https://example.com/files/receipt_12345.pdf',
            contentType: 'application/pdf'
        }
    ]
};

const result = await totalumSdk.email.sendEmail(emailPayload);

```

### Send email with attachments from Totalum storage

**Use Case:**

Send an email with files that are stored in Totalum. First, get the download URL of the file, then include it in the email attachments.

```javascript

// Step 1: Get the download URL of the file uploaded to Totalum
const fileNameId = 'report_2024_q1.pdf'; // the file name ID from Totalum storage
const fileUrlResult = await totalumSdk.files.getDownloadUrl(fileNameId);
const fileUrl = fileUrlResult.data;

// Step 2: Send the email with the attachment
const emailPayload = {
    to: ['manager@example.com'],
    subject: 'Q1 2024 Financial Report',
    html: `
        <h1>Q1 2024 Financial Report</h1>
        <p>Dear Manager,</p>
        <p>Please find attached the financial report for Q1 2024.</p>
        <p>Best regards,<br>Finance Team</p>
    `,
    fromName: 'Finance Department',
    attachments: [
        {
            filename: 'Q1_2024_Report.pdf',
            url: fileUrl,
            contentType: 'application/pdf'
        }
    ]
};

const result = await totalumSdk.email.sendEmail(emailPayload);

console.log('Email sent with Totalum file attachment');

```


### Important notes

- **Recipients**: The `to` field must be an array of email addresses, even for a single recipient
- **HTML content**: Full HTML and CSS styling is supported in the email body
- **Maximum attachments**: 10 attachments per email
- **Maximum attachment size**: 15MB per attachment
- **Attachment URLs**: All attachments must be provided as valid HTTP/HTTPS URLs
- **Content types**: Common MIME types include:
  - `application/pdf` for PDF files
  - `image/jpeg` or `image/jpg` for JPEG images
  - `image/png` for PNG images
  - `application/zip` for ZIP archives
  - `text/plain` for text files
- **From name**: The `fromName` field customizes the sender name displayed to recipients
- **CC/BCC**: Use CC for visible copies and BCC for hidden copies
- **Reply-to**: Set a different email address for replies
- **Email validation**: Make sure all email addresses are valid before sending
