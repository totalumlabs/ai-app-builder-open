## edit-data

### edit item by id

**Use Case:**

Edit an item by id from your element table.

```javascript
// edit item by id from your_element_table_name, you can edit 1 or multiple properties at the same time (like a patch)
const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
let your_item_id = 'your_item_id'; // replace 'your_item_id' with the id of the item object
const result = await totalumSdk.crud.editRecordById(tableElementName, your_item_id, {your_item_property: 'new value'});

// The response contains the full updated record
const updatedRecord = result.data;
console.log('Updated record:', updatedRecord);

```

### Add or edit an item reference to another item (add or edit reference) (One to Many reference)

**Use Case:**

THIS IS ONLY FOR ONE TO MANY OR MANY TO ONE REFERENCES, IF YOU WANT TO ADD OR EDIT A MANY TO MANY REFERENCE, SEE THE NEXT SECTION.

Imagine you have a table called `client` and other called `order` that are referenced in a one to many relationship, (one client can have many orders).

`client` table properties:

- `name` (text)
- `email` (text)
- `phone` (text)
- `birthday` (date)

`order` table properties:

- `summary` (text)
- `date` (date)
- `import` (number)
- `client` (reference to client table)

As is a one to many relationship, this tables are linked by a reference in the `order` table. So you see a property called `client` in the `order` table that is a reference to the `client` table.


So, If you want to create a new `order` and link it to a `client` you can do it like this:

```javascript

let clientIdToAddInOrder = '5f9b2b1b9c6f6b0001a3b2b1';

const orderToCreate = {
    summary: 'my order summary',
    date: new Date(),
    import: 1000,
    client: clientIdToAddInOrder // this is the reference to the client
};

const result = await totalumSdk.crud.createRecord('order', orderToCreate);

```

### Add or edit an item to another item (add or edit reference) (Many to Many reference)

**Use Case:**

THIS IS ONLY FOR MANY TO MANY REFERENCES, IF YOU WANT TO ADD OR EDIT A ONE TO MANY OR MANY TO ONE REFERENCE, SEE THE PREVIOUS SECTION.

Imagine you have a table called `client` and other called `product` that are referenced in a many to many relationship, (one client can have many products, and one product can have many clients).

`client` table properties:

- `name` (text)
- `email` (text)
- `phone` (text)
- `birthday` (date)

`product` table properties:

- `name` (text)
- `price` (number)
- `category` (options)

As is a many to many relationship, this tables are linked by a a third join table. So you don't see id reference in the `client` or `product` tables.

So, if you want to create a new `product` and link it to a `client` you can do it like this:

```javascript

const productToCreate = {
    name: 'my product name',
    price: 1000,
    category: 'my category'
};

const result = await totalumSdk.crud.createRecord('product', productToCreate);

// The response contains the full created record
const createdProduct = result.data;
const productId = createdProduct._id;

const clientId = '5f9b2b1b9c6f6b0001a3b2b1';

const propertyName = 'products'; // this is the name of the property in the client table that references the product table

const result = await totalumSdk.crud.addManyToManyReferenceRecord('client', clientId, propertyName, productId);

```
