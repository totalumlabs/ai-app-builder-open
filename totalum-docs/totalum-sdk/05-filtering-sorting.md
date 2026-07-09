## filter-pagination-data

All filtering, sorting, and pagination is done through `totalumSdk.crud.query()`. Filters work at **every nesting level** — you can filter, sort, and paginate parent records AND their nested children/grandchildren (up to 6 levels deep) all in a single query call. Always use nested expansions with per-level filters instead of making multiple separate queries.

**Important:** If you get an error like `query is not a function`, update the SDK: `npm install totalum-api-sdk@latest`

> **Legacy code:** If the existing project already uses `getRecords`, `getNestedData`, `getManyToManyReferencesRecords`, or `nestedFilter`, keep them as-is — do NOT refactor working code. Only use `query()` for **new code**. See [12-deprecated-get-methods.md](./12-deprecated-get-methods.md) for legacy method docs.

**IMPORTANT: Always filter at the database level using `_filter`** instead of fetching all records and filtering in JavaScript. `_filter` supports ALL field types including objectReference fields and `_id`. Filtering in JS wastes bandwidth, is slower, breaks pagination, and doesn't scale. Only do it if there is no alternative.

---

### Index

1. [Basic structure](#1-basic-structure)
2. [Pagination](#2-pagination) — `_limit`, `_offset`, `_count._total`
3. [Sorting](#3-sorting) — `_sort`
4. [Filter by exact value](#4-filter-by-exact-value) — string, number, date
5. [Filter by partial string](#5-filter-by-partial-string) — `regex`, `startsWith`, `endsWith`, `contains`
6. [Filter by range](#6-filter-by-range) — `gte`, `lte`, `gt`, `lt`
7. [Filter by not equal](#7-filter-by-not-equal) — `ne`
8. [Filter by list](#8-filter-by-list) — `in`, `nin`
9. [Filter objectReference fields and _id](#9-filter-objectreference-fields-and-_id) — exact match, `ne`, `in`, `nin`, `_or` on relation fields
10. [Combining filters](#10-combining-filters) — AND, OR, AND+OR, complex OR
11. [Full example](#11-full-example)

---

### 1. Basic structure

```javascript
const result = await totalumSdk.crud.query('your_table', {
    _filter: { /* filter conditions */ },
    _sort: { property_name: 'asc' },  // 'asc' or 'desc'
    _limit: 50,
    _offset: 0,
});
```

### 2. Pagination

Use `_limit` to set the number of items per page and `_offset` to skip items. Default limit is 50 (max 1000).

```javascript
// Page 1: items 0-49
{ _limit: 50, _offset: 0 }

// Page 2: items 50-99
{ _limit: 50, _offset: 50 }
```

Use `_count: true` at root level to get `_count._total` (total matching records before pagination) — useful for building pagination UIs.

### 3. Sorting

Use `_sort` with `'asc'` (ascending) or `'desc'` (descending):

```javascript
{ _sort: { name: 'asc' } }
{ _sort: { createdAt: 'desc' } }
```

### 4. Filter by exact value

String, number, or date:

```javascript
{ _filter: { name: 'John' } }
{ _filter: { age: 25 } }
{ _filter: { date: '2024-01-01T00:00:00.000Z' } }
```

### 5. Filter by partial string

```javascript
// Regex (most flexible)
{ _filter: { name: { regex: 'john', options: 'i' } } }
// options: 'i' = case insensitive

// Shortcuts (all case-insensitive)
{ _filter: { name: { startsWith: 'Jo' } } }
{ _filter: { email: { endsWith: '@gmail.com' } } }
{ _filter: { name: { contains: 'test' } } }
```

### 6. Filter by range

```javascript
{ _filter: { price: { gte: 10, lte: 100 } } }
{ _filter: { date: { gte: '2024-01-01T00:00:00.000Z', lte: '2024-12-31T00:00:00.000Z' } } }
```

Available: `gte` (>=), `lte` (<=), `gt` (>), `lt` (<). Can combine multiple in one object.

### 7. Filter by not equal

```javascript
{ _filter: { status: { ne: 'inactive' } } }
```

### 8. Filter by list

```javascript
{ _filter: { status: { in: ['active', 'pending'] } } }
{ _filter: { status: { nin: ['deleted'] } } }
```

### 9. Filter objectReference fields and _id

**`_filter` works on objectReference fields and `_id`.** Pass string IDs — the backend auto-converts them to ObjectId. All operators work: exact match, `ne`, `in`, `nin`, etc.

**9.1 Filter by _id:**
```javascript
const result = await totalumSdk.crud.query('post', {
    _filter: { _id: postId },
    user_id: true,
    comment: { user_id: true },
});
const post = result.data[0]; // result.data is always an array
```

**9.2 Filter by objectReference field (one-to-many):**
```javascript
const result = await totalumSdk.crud.query('order', {
    _filter: { client_id: clientId },
});
```

**9.3 Exclude IDs (nin):**
```javascript
const result = await totalumSdk.crud.query('user', {
    _filter: { _id: { nin: excludedIds } },
    _limit: 20,
});
```

**9.4 Not equal on objectReference:**
```javascript
const result = await totalumSdk.crud.query('message', {
    _filter: {
        conversation_id: conversationId,
        sender_id: { ne: currentUserId },
        is_read: 'no',
    },
});
```

**9.5 OR with objectReference fields (bidirectional lookup):**
```javascript
const result = await totalumSdk.crud.query('friendship', {
    _filter: {
        status: 'accepted',
        _or: [
            { requester_id: userId },
            { receiver_id: userId },
        ],
    },
    requester_id: true,
    receiver_id: true,
});
```

**9.6 Check bidirectional relationship between two users:**
```javascript
const result = await totalumSdk.crud.query('friendship', {
    _filter: {
        _or: [
            { requester_id: userA, receiver_id: userB },
            { requester_id: userB, receiver_id: userA },
        ],
    },
});
const exists = result.data.length > 0;
```

**9.7 Exclude self from search results:**
```javascript
const result = await totalumSdk.crud.query('user', {
    _filter: {
        _id: { ne: currentUserId },
        _or: [
            { name: { regex: query, options: 'i' } },
            { email: { regex: query, options: 'i' } },
        ],
    },
    _limit: 20,
});
```

### 10. Combining filters

**10.1 AND condition (all must match):**
```javascript
{
    _filter: {
        status: 'active',
        country: 'Spain',
        age: { gte: 18 },
    }
}
```

**10.2 OR condition (at least one must match):**
```javascript
{
    _filter: {
        _or: [
            { status: 'active' },
            { status: 'pending' },
        ]
    }
}
```

**10.3 AND + OR combined:**
```javascript
{
    _filter: {
        country: 'Spain',               // AND this
        _or: [
            { status: 'active' },        // OR this
            { status: 'pending' },        // OR this
        ]
    }
}
// Returns items where country is Spain AND status is active or pending
```

**10.4 Complex OR with multiple fields per branch:**
```javascript
// Feed: public posts + friends' posts + own posts
{
    _filter: {
        _or: [
            { privacy: 'public' },
            { user_id: { in: friendIds }, privacy: { in: ['public', 'friends'] } },
            { user_id: currentUserId },
        ]
    }
}
```

Each `_or` branch can have multiple fields (AND within that branch).

### 11. Full example

```javascript
const result = await totalumSdk.crud.query('product', {
    _filter: {
        category: 'electronics',
        price: { gte: 10, lte: 500 },
        name: { regex: 'phone', options: 'i' },
    },
    _sort: { price: 'asc' },
    _limit: 20,
    _offset: 0,
});
const items = result.data;
```
