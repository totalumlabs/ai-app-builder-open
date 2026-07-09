## delete-data

# delete item by id

**Use Case:**

Delete an item by id from your element table.

```javascript
// delete item by id from your_element_table_name
const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
let your_item_id = 'your_item_id'; // replace 'your_item_id' with the id of the item object
const result = await totalumSdk.crud.deleteRecordById(tableElementName, your_item_id);

```

# delete item reference to another item (One to Many reference)

**Use Case:**

THIS IS ONLY FOR ONE TO MANY OR MANY TO ONE REFERENCES, IF YOU WANT TO DELETE A MANY TO MANY REFERENCE, SEE THE NEXT SECTION.

Imagine you have a table called `client` and other called `order` that are referenced in a one to many relationship, (one client can have many orders).

You want to delete the reference of the client to the order with id `5f9b2b1b9c6f6b0001a3b2b2`. That means that you only want to delete the reference, the client and the order will not be deleted.

```javascript

const tableElementName = 'order'

let orderItemId = '5f9b2b1b9c6f6b0001a3b2b2';

const result = await totalumSdk.crud.editItemById(tableElementName, orderItemId, {client: null});

```

# delete item reference to another item (Many to Many reference)

**Use Case:**

THIS IS ONLY FOR MANY TO MANY REFERENCES, IF YOU WANT TO DELETE A ONE TO MANY OR MANY TO ONE REFERENCE, SEE THE PREVIOUS SECTION.

Imagine you have a table called `client` and other called `product` that are referenced in a many to many relationship, (one client can have many products, and one product can have many clients).


You want to delete the reference of the client to the product with id `5f9b2b1b9c6f6b0001a3b2b2`. That means that you only want to delete the reference, the client and the product will not be deleted.

```javascript

const tableElementName = 'client'

let clientItemId = '5f9b2b1b9c6f6b0001a3b2b2';

const propertyName = 'products'; // this is the name of the property in the client table that is a reference to the product table

const productId = '5f9b2b1b9c6f6b0001a3b2b2';

const result = await totalumSdk.crud.dropManyToManyReferenceRecord(tableElementName, clientItemId, propertyName, productId);

```
