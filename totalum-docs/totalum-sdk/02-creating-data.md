## create-data

### create item

**Use Case:**

Create an for from your element table.


```javascript
// create item from your_element_table_name, you need to pass at least the required properties
const tableElementName = 'your_element_table_name'; // replace 'your_element_table_name' with the name of your element table
const result = await totalumSdk.crud.createRecord(tableElementName, {your_item_property: 'new value'});
/*
IMPORTANT: the result has this format:
{
    data: RecordType; // the created record
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

```

**Example:**

Imagine you have a table called `client` with the following properties:

- `name` (text)
- `email` (text)
- `phone` (text)
- `birthday` (date)

And you want to create a new client with name `John Doe`, the email `jhon@gmail.com`, the phone `+34 123 456 789`, and the birthday `1990-01-01`.

```javascript

const tableElementName = 'client';

const clientToCreate = {
    name: 'John Doe',
    email: 'jhon@gmail.com',
    phone: '+34 123 456 789',
    birthday: new Date('1990-01-01')
};

const result = await totalumSdk.crud.createRecord(tableElementName, clientToCreate);

/*
IMPORTANT: the result has this format:
{
    data: RecordType; // the created record
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

// The response contains the full created record
const createdClient = result.data;
const insertedId = createdClient._id; // this is the id of the client you just created
console.log('Created client:', createdClient);

```

### create item and add reference to another item (Many to Many reference)

**Use Case:**

THIS IS ONLY FOR MANY TO MANY REFERENCES, IF YOU WANT TO CREATE A ONE TO MANY OR MANY TO ONE REFERENCE, SEE THE PREVIOUS SECTION.

Imagine you have a table called `client` and other called `product` that are referenced in a many to many relationship, (one client can have many orders, and one order can have many clients).

`client` table properties:

- `name` (text)
- `email` (text)
- `phone` (text)
- `birthday` (date)

`product` table properties:

- `summary` (text)
- `date` (date)
- `import` (number)


As is a many to many relationship, this tables are linked by a a third join table. So you don't see id reference in the `client` or `product` tables.

So if you want to create a new `client` and link it to a `product` you can do it like this:

```javascript

const productToCreate = {
    summary: 'my product summary',
    date: new Date(),
    import: 1000
};

const result = await totalumSdk.crud.createRecord('product', productToCreate);
/*
IMPORTANT: the result has this format:
{
    data: RecordType; // the created record
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

// The response contains the full created record
const createdProduct = result.data;
const productId = createdProduct._id; // this is the id of the product you just created

const clientIdToAddInProduct = '5f9b2b1b9c6f6b0001a3b2b1'; // this is just an example

const propertyName =  'client'; // this is the name of the property in the product table that is a reference to the client table

const result2 = await totalumSdk.crud.addManyToManyReferenceRecord('product', productId, propertyName, clientIdToAddInProduct);

/*
IMPORTANT: the result2 has this format:
{
    data: {acknowledged?: boolean};
    errors?: { //internal totalum sdk errors (like simple validation errors) is useful always to log it
        errorCode: string,
        errorMessage: string
    }
}
*/

```
