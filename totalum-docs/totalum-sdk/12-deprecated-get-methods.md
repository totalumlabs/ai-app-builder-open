## deprecated-get-methods

The following methods still work but are **deprecated**. Use `totalumSdk.crud.query()` instead.

If you get an error like `query is not a function`, update the SDK: `npm install totalum-api-sdk@latest`

---

### ~~getRecords~~ (Deprecated)

Get items from a table with optional filtering, sorting, and pagination.

```javascript
const result = await totalumSdk.crud.getRecords('client', {
    filter: [
        { name: 'John' },
        { status: { regex: 'active', options: 'i' } },
        { age: { gte: 18 } },
        { country: { ne: 'Spain' } },
    ],
    sort: { name: 1 },           // 1 = asc, -1 = desc
    pagination: { limit: 50, page: 0 }
});
const items = result.data;

// OR filter:
const result2 = await totalumSdk.crud.getRecords('client', {
    filter: [
        { or: [{ status: 'active' }, { status: 'pending' }] }
    ]
});
```

**Migrate to `query()`:**
```javascript
const result = await totalumSdk.crud.query('client', {
    _filter: { name: 'John', status: { regex: 'active', options: 'i' }, age: { gte: 18 }, country: { ne: 'Spain' } },
    _sort: { name: 'asc' },
    _limit: 50
});
```

---

### ~~getNestedData~~ (Deprecated)

Get data with nested related tables in one query. Works for oneToMany, manyToOne, and manyToMany.

```javascript
const nestedQuery = {
    client: {
        order: {
            product: {}
        }
    }
};
const result = await totalumSdk.crud.getNestedData(nestedQuery);
const clients = result.data;
// clients[0].orders[0].products[0]...

// With filters per level:
const nestedQuery2 = {
    client: {
        tableFilter: {
            filter: [{ name: 'John' }],
            sort: { name: 1 },
            pagination: { limit: 10, page: 0 }
        },
        order: {
            product: {}
        }
    }
};
const result2 = await totalumSdk.crud.getNestedData(nestedQuery2);
```

**Migrate to `query()`:**
```javascript
const result = await totalumSdk.crud.query('client', {
    _filter: { name: 'John' },
    _sort: { name: 'asc' },
    _limit: 10,
    order: {
        product: true
    }
});
```

---

### ~~getManyToManyReferencesRecords~~ (Deprecated)

Get manyToMany related records for a specific item.

```javascript
const result = await totalumSdk.crud.getManyToManyReferencesRecords(
    'client',        // table name
    clientId,        // record id
    'books',         // manyToMany property name
    {                // optional query
        filter: [{ title: { regex: 'javascript', options: 'i' } }],
        sort: { title: 1 },
        pagination: { limit: 50, page: 0 }
    }
);
const books = result.data;
```

**Migrate to `query()`:**
```javascript
const result = await totalumSdk.crud.query('client', {
    _filter: { _id: clientId },
    books: true
});
const books = result.data[0]?.books;
```

---

### ~~nestedFilter~~ (Deprecated)

Filter parent records based on conditions in child/nested tables.

```javascript
const nestedFilter = {
    client: {
        order: {
            tableFilter: [{ state: 'completed' }],
            product: {
                tableFilter: [{ name: 'Cocacola' }]
            }
        }
    }
};
const result = await totalumSdk.filter.nestedFilter(nestedFilter, 'client', {
    pagination: { limit: 50, page: 0 }
});
const clients = result.data;
```

**Migrate to `query()`:**
```javascript
const result = await totalumSdk.crud.query('client', {
    _limit: 50,
    order: {
        _filter: { state: 'completed' },
        _has: true,
        product: {
            _filter: { name: 'Cocacola' },
            _has: true
        }
    }
});
```
