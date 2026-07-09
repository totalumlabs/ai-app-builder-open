## File Uploads & Display

### CRITICAL: How file fields work in Totalum

When you **upload** a file and attach it to a record, you only set `{ name: fileNameId }`.
When you **fetch** a record that has a file field, Totalum returns **both** `name` and `url`:

```typescript
// Fetching a record with a file field:
const result = await totalumSdk.crud.getRecordById('client', clientId);
const client = result.data;

// Single file field:
console.log(client.photo);
// → { name: "file-abc-123.png", url: "https://storage.googleapis.com/...signed-url..." }

// Multiple file field:
console.log(client.gallery);
// → [{ name: "img1.png", url: "https://..." }, { name: "img2.png", url: "https://..." }]
```

### `getDownloadUrl()` returns the URL inside an array

```typescript
const result = await totalumSdk.files.getDownloadUrl(fileNameId);
// result.data is an ARRAY like ["https://..."], NOT a plain string
const url = Array.isArray(result.data) ? result.data[0] : result.data;
```

### Displaying files/images — ALWAYS use the `url` field

```typescript
// CORRECT — use the url field from the record
<img src={client.photo.url} alt="Photo" />

// CORRECT — multiple files
{client.gallery.map((file: any, i: number) => (
  <img key={i} src={file.url} alt={`Image ${i + 1}`} />
))}
```

**NEVER construct file URLs manually. This is WRONG:**


---

## upload-files


### 1.1 Get the file as a Blob

#### From a file input (Frontend)

```javascript
    const fileInput = document.getElementById('fileInput');
    const fileBlob = fileInput.files[0];
```

#### From a remote file (Backend)

```javascript
    const response = await axios.get('your_file_url', { responseType: 'stream' });
    const fileBlob = response.data;
```

#### From a base64 string (Frontend/Backend)

```javascript
    // Convert base64 to binary
    const binaryStr = atob(base64String);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    let fileBlob;

    // Environment check: Node.js or Browser
    if (typeof process === 'object' && process.version) {
        // Node.js environment
        // Convert Uint8Array to Buffer for Node.js usage
        const buffer = Buffer.from(bytes.buffer);
        // Here, 'buffer' can be used similarly to how you'd use a Blob in the browser
        // Note: Direct Blob emulation isn't possible in Node.js, but Buffer is a close alternative for file handling
        fileBlob = buffer;
    } else {
        // Browser environment
        // Create a Blob from the Uint8Array
        const blob = new Blob([bytes], { type: fileType });
        fileBlob = blob;
    }
```


### 1.2 Upload the file to Totalum


```javascript

    //SUPER IMPORTANT: even if you are on backend and/or nodejs, NEVER import 'form-data' package, use the default FormData that no requires any import 

    const fileName = 'your_file_name.png'; // replace 'your_file_name' with the name of your file, replace .png with the extension of your file
    const file = yourFileBlob // your blob file created in the previous step
    const formData = new FormData();
    formData.append('file', file, fileName);
    const result = await totalumSdk.files.uploadFile(formData);
    /*
        IMPORTANT: the result has this format:
        {
            data: string; // the file name id
            errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
                errorCode: string,
                errorMessage: string
            }
        }
    */
    const fileNameId = result.data;
```

### 1.3 link the uploaded file to a record
PD: usually, when you link a file to an item property, the property automatically generates a file url that you can use to download the file.

Imagine you have a table called client with the following properties:

name (text)
email (text)
phone (text)
photo (file)
And you want to create a new client with name John Doe, the email jhon@gmail.com, the phone +34 123 456 789, and the birthday 1990-01-01, and you want to link a photo to the client.

SUPER IMPORTANT: if the property is a file property, with the database property structure with typeExtras.file.multiple equal to false, to link the file to the property, you need file_property_name: { name: fileNameId }, if is multiple equal to true, you need file_property_name: [ { name: fileNameId } ]. Important: you must not set the url or any other property as is added automatically by totalum. For multiple files, every time you edit the files, you must set the complete array of files you want to have linked to the property, including existing files you don't want to lose.

```javascript

//SUPER IMPORTANT: even if you are on backend and/or nodejs, NEVER import 'form-data' package, use the default FormData that no requires any import 
// first, we upload the file
const fileName = 'your_file_name.png';
const file = yourFileBlob
formData.append('file', file, fileName);
const result = await totalumClient.files.uploadFile(formData);
/*
IMPORTANT: the result has this format:
{
    data: string; // the file name id
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/
const fileNameId = result.data;
//SUPER IMPORTANT: for link the file to the item property, you only need the file name id returned by the uploadFile method, nothing else, not set url or any other property


// then, we create the client
const tableElementName = 'client';
const clientToCreate = {
    name: 'John Doe',
    email: 'jhon@gmail.com',
    phone: '+34 123 456 789',
    photo: {
        name: fileNameId 
        //SUPER IMPORTANT: with this is enough to link the file to the property, you must not set the url or any other property as is added automatically by totalum
    }
};

const result2 = await totalumClient.crud.createRecord(tableElementName, clientToCreate);

// now the client is created and the photo is linked to the client

//what happens if your_file_property_name is a multiple file property?
const clientToCreate = {
    name: 'John Doe',
    email: 'jhon@gmail.com',
    phone: '+34 123 456 789',
    photo: [{
        name: fileNameId
        //SUPER IMPORTANT: with this is enough to link the file to the property, you must not set the url or any other property as is added automatically by totalum
    }]
};
// in this case, you must set an array of files, but if you don't want to lost existing files, you can set the existing files in the array and add the new file at the end of the array
```


#### If you want to remove a file linked to an item property, you can do it like this:

```javascript
const tableElementName = 'client';
let your_item_id = '5f9b2b1b9c6f6b0001a3b2b1';
const result = await totalumClient.crud.editRecordById(tableElementName, your_item_id, {'photo': null});
// this will remove the photo from the client with id '5f9b2b1b9c6f6b0001a3b2b1'

//if the property is a multiple file property, just remove the file you want to remove from the array and set the new array
const clientToEdit = {
    photo: [] // set the new array of files, in this case, we are removing all files
};
const result = await totalumClient.crud.editRecordById(tableElementName, your_item_id, clientToEdit);


```