## advanced-queries

Always use `query()` first. It supports nested relations (up to 6 levels), filters/sorts/limits at every level, aggregations, groupBy, parent filtering by children, and efficient counting — all in one call. Only fall back to custom MongoDB aggregation if `query()` cannot express what you need.

---

### Advanced `query()` patterns

#### Root-level aggregation

Get totals, averages, min/max across all matching records without fetching the records themselves:

```javascript
const result = await totalumSdk.crud.query('order', {
    _filter: { status: 'paid' },
    _aggregate: { _sum: { amount: true }, _avg: { amount: true }, _count: true },
});
// result.data = [{ _aggregate: { _sum: { amount: 50000 }, _avg: { amount: 250 }, _count: 200 } }]
// If no matches: result.data = [] (empty array)
const total = result.data.length > 0 ? result.data[0]._aggregate._sum.amount : 0;
```

#### Group by

Split aggregations by a field:

```javascript
const result = await totalumSdk.crud.query('order', {
    _groupBy: 'status',
    _aggregate: { _count: true, _sum: { amount: true } },
});
// result.data = [
//   { _group: { status: 'paid' }, _aggregate: { _count: 15, _sum: { amount: 3000 } } },
//   { _group: { status: 'pending' }, _aggregate: { _count: 5, _sum: { amount: 1000 } } },
// ]
```

#### Child-level aggregation

Aggregate over children per parent (e.g. total salary per company):

```javascript
const result = await totalumSdk.crud.query('company', {
    employee: {
        _aggregate: { _sum: { salary: true }, _count: true },
        _include: false,  // don't return employee records
    }
});
// Each company: { _id, name, _aggregate: { employee: { _sum: { salary: 500000 }, _count: 10 } } }
```

Note: `_groupBy` is NOT supported at child level.

#### Nested filtering, sorting, limiting

Each nested level supports its own `_filter`, `_sort`, `_limit`, `_offset` — these filter the **children**, not the parent:

```javascript
const result = await totalumSdk.crud.query('client', {
    _filter: { country: 'Spain' },
    order: {
        _filter: { status: 'paid', amount: { gte: 100 } },
        _sort: { date: 'desc' },
        _limit: 5,
        order_line: {                        // 3rd level
            _filter: { quantity: { gte: 2 } },
            product: true,                   // 4th level
        },
    },
});
```

#### Per-parent child counts without fetching children

```javascript
const result = await totalumSdk.crud.query('post', {
    _filter: { user: userId },
    post_like: { _count: true, _include: false },
    post_comment: { _count: true, _include: false },
});
// Each post: { ..., _count: { post_like: 10, post_comment: 3 } }
// No like/comment records transferred — only the counts
```

#### Filter parents by children existence (_has)

```javascript
// Only clients that have at least one paid order
const result = await totalumSdk.crud.query('client', {
    order: {
        _has: true,
        _filter: { status: 'paid' },
    },
});
// _has modes: true/'some' = at least one, 'none' = zero, 'every' = all children match
```

#### Combining everything in one call

```javascript
const result = await totalumSdk.crud.query('client', {
    _filter: { status: 'active' },
    _sort: { name: 'asc' },
    _limit: 20,
    _count: true,                            // _count._total = real total before pagination
    order: {
        _filter: { date: { gte: '2024-01-01T00:00:00.000Z' } },
        _sort: { date: 'desc' },
        _limit: 10,
        _count: true,                        // _count.order per client
        order_line: { product: true },       // 3rd level
    },
    invoice: {
        _filter: { is_paid: 'no' },
        _aggregate: { _sum: { amount: true }, _count: true },
        _include: false,                     // only aggregates, no invoice records
    },
});
// Each client has:
//   ._count._total  = total active clients
//   ._count.order   = number of recent orders
//   .order[]        = last 10 orders with products
//   ._aggregate.invoice = { _sum: { amount: 5000 }, _count: 3 }
```

For full filter operators (regex, in, nin, gte, lte, _or, etc.) see [05-filtering-sorting.md](./05-filtering-sorting.md). For all `query()` options see [01-getting-data.md](./01-getting-data.md).

---

### Custom MongoDB aggregation queries

If you need a query that `query()` cannot express, use `runCustomMongoAggregationQuery()` as a last resort.
You need to know how to write MongoDB aggregation queries. See: https://docs.mongodb.com/manual/aggregation/

**Note:**

In Totalum mongoDb Database the tables and items has the following structure:

```json

"_id": 2342342342342,
// here goes all the properties of the item with the custom names and values that you have defined
"property_name": "value",
"property_name2": "value2",
"property_name2": "value2"
//etc...
"createdAt": "2021-01-01T00:00:00.000Z",
"updatedAt": "2021-01-01T00:00:00.000Z"

```

#### Each table in Totalum is a mongoDb collection (adding data_ prefix), and each record in the table is a document in the collection.
#### So for example, if you have a table named `product`, in the mongoDb database the collection will be named `data_product`.

#### Important Information:

- **For match by Id (ObjectId)**, as the mongoDb query is a string, you need to put: ObjectId('your_id') in the query string, instead of just 'your_id'.
- **For match by date**, you need to put the date in the format: Date('your_date') in the query string, instead of just 'your_date'. Ideally provide a iso date string like '2021-01-01T00:00:00.000Z' for avoid time zone issues.

```javascript

// filter results from your_element_table_name applying a filter query (a custom mongodb aggregation query)
const customMongoDbAggregationQueryInString = `

  your custom mongo aggregation query in string, for more info:
    https://docs.mongodb.com/manual/aggregation/

`;

const result = await totalumSdk.filter.runCustomMongoAggregationQuery(tableElementName, customMongoDbAggregationQueryInString);

```

**example**

Imagine you have a table named `product`, with properties `name` (text), `price` (number), `provider` (many to one relation with relationship with the table `provider`).

And you want to get all the products that have a price greater than 10, and that have a provider that have the name 'John', and also return all products with the full provider autofill, so you can do this:

```javascript

const tableElementName = 'product';
const customMongoDbAggregationQueryInString = `
    [
        {
            $match: {
                "price": {$gte: 10}
            }
        },
          // Join the data_product with data_provider using provider as the linking _id
        {
            $lookup: {
                from: "data_provider", // we add the prefix "data_" to the table name
                localField: "provider",
                foreignField: "_id",
                as: "provider"  // Now storing the result directly in the "provider" field
            }
        },
        {
            $match: {
                "provider.name": "John"
            }
        },
        // Simplify the provider to be an object instead of an array
        {
            $addFields: {
              "provider": {
                $arrayElemAt: ["$provider", 0]
              }
            }
        }
    ]
`;

const result = await totalumSdk.filter.runCustomMongoAggregationQuery(tableElementName, customMongoDbAggregationQueryInString);
const items = result.data;

```


If a call returns a 400 suggesting a different name (e.g., "Do you mean: contactsubmission?"), convert your intended name to snake_case and retry (contact_submission), not a smashed string.
