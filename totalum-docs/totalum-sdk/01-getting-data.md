## get-data

The recommended way to get data is `totalumSdk.crud.query()`. It supports **nested relations up to 6 levels deep** with filtering, sorting, and pagination at every level — all in a single call. Always use nested expansions to fetch related data instead of making multiple separate queries.

**Important:** If you get an error like `query is not a function`, update the SDK: `npm install totalum-api-sdk@latest`

**Tip:** To quickly test `query()` input/output behavior, you can call the `mcp__totalum__query` MCP tool directly with the same `tableName` and `queryOptions` parameters. This lets you verify filters, nested relations, and response shape before writing SDK code.

> **Legacy code:** If the existing project already uses `getRecords`, `getNestedData`, `getManyToManyReferencesRecords`, or `nestedFilter`, keep them as-is — do NOT refactor working code. Only use `query()` for **new code**. See [12-deprecated-get-methods.md](./12-deprecated-get-methods.md) for legacy method docs.

---

### CRITICAL RULES — Read before writing any query code

1. **NEVER count with `.length`** — Use `_count: true` (child counts) or `_aggregate: { _count: true }` (total counts). A common mistake is adding `_count: true` but then reading `.data.length` instead of `_count._total` — `.data.length` is capped by `_limit` (default 50) and silently returns wrong numbers. Always read `_count._total` or `_aggregate._count`.
2. **When you ONLY need a total count (no records), use `_aggregate: { _count: true }`** — This returns just the count without fetching any records. `_count: true` still fetches records up to the limit. Use `_aggregate` for standalone counts (e.g. "how many friends?"), use child `_count` + `_include: false` for per-parent counts (e.g. "likes per post").
3. **NEVER query inside a loop** — If you need data per item (counts, existence checks, related records), use nested expansions, `_count`, `_aggregate`, or batch with `_filter: { field: { in: allIds } }` in ONE query. Looping N queries is an N+1 anti-pattern.
4. **Always nest related data inside the same query** — Instead of making a separate query for child records, nest them with child-level `_filter`, `_sort`, `_limit` (up to 6 levels). Example: to get a parent with its latest child, do `child: { _sort: { createdAt: 'desc' }, _limit: 1, other_relation: true }` inside the parent query — NOT a separate query per parent.
5. **`_include: false` IS A VALID CORE FEATURE** — Use `_include: false` at child level to get `_count` or `_aggregate` without returning child records. This is essential for efficient counting. Do NOT remove it or replace it with loop queries.
6. **Batch existence checks with `in`** — To check if records exist for multiple IDs, query once with `{ in: allIds }` then check results in JS. Never query one ID at a time in a loop.
7. **NEVER fetch all records to group/aggregate in JS if you can do it with query() method**

8. **When fetching a single record, nest all needed related data** — Don't return a bare record and make the frontend call separate endpoints for comments, likes, etc. if is not necessary. Once posible everything in one nested query. (remember filter, pagination, aggregation, etc. works at any level of the nested query)

---

### Index

1. [Get item by id](#1-get-item-by-id) — `getRecordById()`
2. [Query items](#2-query-items) — basic `query()` usage and response format
3. [Default limits](#3-default-limits) — 50 root, 300 child, max 1000, 6 depth
4. [Filtering, sorting, pagination](#4-filtering-sorting-and-pagination) — `_filter`, `_sort`, `_limit`, `_offset`
5. [Filtering objectReference fields and _id](#5-filtering-objectreference-fields-and-_id) — exact match, `ne`, `in`, `nin` on relation fields
6. [OR and AND+OR filters](#6-or-and-andor-filters) — `_or` conditions
7. [Nested relations](#7-nested-relations) — expand child/parent data in one call
8. [Expanded fields change type](#8-expanded-fields-change-type) — string ID becomes object when expanded
9. [Nested filters per level](#9-nested-filters-per-level) — `_filter`, `_sort`, `_limit`, `_include` on children
10. [Hide child records (_include: false)](#10-hide-child-records-_include-false) — get counts/aggregates without returning records
11. [Avoid N+1 queries](#11-avoid-n1-queries) — nested expansions, batch `in`, child `_count`
12. [Filter parent by children (_has)](#12-filter-parent-by-children-_has) — `true`, `'some'`, `'none'`, `'every'`
13. [Count children (_count)](#13-count-children-_count) — `_count._total` and `_count.childName`
14. [Select or omit fields](#14-select-or-omit-fields) — `_select`, `_omit`
15. [Aggregations](#15-aggregations) — `_aggregate` with `_sum`, `_avg`, `_min`, `_max`, `_count`
16. [Group by](#16-group-by) — `_groupBy` with `_aggregate`
17. [Child-level aggregation](#17-child-level-aggregation) — aggregate over children
18. [Get historic updates](#18-get-historic-updates) — `getHistoricRecordUpdatesById()`
19. [query() input reference](#19-query-input-reference) — full reference of all options

---

### 1. Get item by id

```javascript
const result = await totalumSdk.crud.getRecordById('your_table', 'your_item_id');
const item = result.data;

/*
Result format:
{
    data: RecordType,
    errors?: { errorCode: string, errorMessage: string }
}
*/
```

### 2. Query items

Get items with optional filtering, sorting, pagination, and nested relations.
**IMPORTANT: Always do as much work as possible in a single `query()` call** — use `_filter` on objectReference fields, nested expansions, `_count`, `_has`, etc. instead of making multiple queries and filtering in JavaScript. Never fetch all records and filter in JS. Only do it if there is no alternative.

```javascript
const result = await totalumSdk.crud.query('your_table');
const items = result.data;

/*
Result format:
{
    data: RecordType[],
    errors?: { errorCode: string, errorMessage: string }
}
*/
```

### 3. Default limits

- Root: **50** records (max 1000 via `_limit`)
- Children: **300** records per relation (max 300)
- Max nesting depth: **6** levels

If you need more than 50 root records, set `_limit` explicitly (up to 1000).

**WARNING:** `.data.length` only tells you how many records were returned, NOT how many exist. If you query without `_limit`, `.data.length` caps at 50. If you need the real total, use `_count: true` and read `_count._total`, or use `_aggregate: { _count: true }` if you don't need the records at all.

### 4. Filtering, sorting and pagination

```javascript
const result = await totalumSdk.crud.query('your_table', {
    _filter: { status: 'active', name: { regex: 'john', options: 'i' } },
    _sort: { name: 'asc' },
    _limit: 10,
    _offset: 0,
});
const items = result.data;
```

See [05-filtering-sorting.md](./05-filtering-sorting.md) for all filter operators and examples.

### 5. Filtering objectReference fields and _id

`_filter` works on objectReference (relation) fields and `_id`. Pass the referenced record's `_id` as a string — the backend auto-converts it to ObjectId. All filter operators work: exact match, `ne`, `in`, `nin`, etc.

```javascript
// Get all orders for a specific client (client is an objectReference field)
const result = await totalumSdk.crud.query('order', {
    _filter: { client_id: clientId },
});

// Filter by _id
const result = await totalumSdk.crud.query('post', {
    _filter: { _id: postId },
    user_id: true,  // expand author
    comment: { user_id: true, _sort: { createdAt: 'desc' } },
});

// Exclude specific IDs
const result = await totalumSdk.crud.query('user', {
    _filter: { _id: { nin: excludedUserIds } },
    _limit: 20,
});

// Not equal on objectReference
const result = await totalumSdk.crud.query('message', {
    _filter: { sender_id: { ne: currentUserId }, is_read: 'no' },
});

// OR with objectReference fields (e.g. bidirectional friendship lookup)
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

### 6. OR and AND+OR filters

```javascript
// OR filter
const result = await totalumSdk.crud.query('your_table', {
    _filter: {
        _or: [
            { status: 'active' },
            { status: 'pending' },
        ]
    },
});

// AND + OR combined
const result = await totalumSdk.crud.query('your_table', {
    _filter: {
        country: 'Spain',
        _or: [
            { status: 'active' },
            { status: 'pending' },
        ]
    },
});
```

### 7. Nested relations

Works for `one to many`, `many to one` and `many to many` relationships. No junction tables needed — Totalum manages them.

**Nesting works up to 6 levels deep.** Each level supports its own `_filter`, `_sort`, `_limit`, `_offset`, `_count`, `_has`, `_aggregate`, `_include`. Use nested expansions to avoid N+1 query problems — expand related data in a single query instead of looping.

Example: get clients → orders → products (3 levels deep, with filters at each level).

```javascript
const result = await totalumSdk.crud.query('client', {
    _filter: { status: 'active' },
    order: {
        _filter: { status: 'paid' },
        _sort: { date: 'desc' },
        _limit: 10,
        product: {
            _filter: { category: 'electronics' },
            supplier_id: true,  // 4th level: expand supplier inside product
        }
    }
});
const clients = result.data;

/*
clients structure (each level can have its own filters, sorts, limits):
[
    {
        _id: 'client_id_1',
        name: 'Client 1',
        order: [                            // oneToMany: array of objects (filtered, sorted, limited)
            {
                _id: 'order_id_1',
                date: '2023-01-01',
                product: [                  // nested expansion (filtered)
                    {
                        _id: 'product_id_1',
                        name: 'Product 1',
                        supplier_id: { _id: '...', name: 'Supplier X' }  // manyToOne expanded
                    },
                ]
            }
        ]
    }
]
*/
```

### 8. Expanded fields change type

- **manyToOne** field NOT expanded: `user_id: "64a1b2c3..."` (string ID)
- **manyToOne** field expanded (`user_id: true`): `user_id: { _id: "64a1b2c3...", name: "John", ... }` (full object)
- **oneToMany / manyToMany** expanded: array of objects

If you need the raw ID for later use (e.g. to pass in another `_filter`), **don't expand that field** or extract `_id` from the expanded object.

### 9. Nested filters per level

You can add `_filter`, `_sort`, `_limit`, `_offset`, `_count`, `_has`, `_aggregate`, `_include` at any child level. Child-level `_filter` filters the **children**, not the parent. **This is the primary way to get related data — always prefer nesting over separate queries.**

You can expand **multiple child relations at once**, each with its own independent `_filter`, `_sort`, `_limit`. This is the key to avoiding multiple separate queries.

```javascript
// Expand MULTIPLE children at once — each with its own filters, sorts, limits
const result = await totalumSdk.crud.query('client', {
    _filter: { status: 'active' },
    _sort: { name: 'asc' },
    order: {                             // 1st child relation
        _filter: { status: 'paid' },
        _sort: { date: 'desc' },
        _limit: 5,
        product: true,                   // 3rd level: expand inside child
    },
    invoice: {                           // 2nd child relation (independent options)
        _filter: { is_paid: 'no' },
        _count: true,
        _include: false,                 // only count unpaid invoices, don't return them
    },
    note: {                              // 3rd child relation
        _sort: { createdAt: 'desc' },
        _limit: 1,                       // only the most recent note
        author: true,                    // expand author inside note (3rd level), you can expand as many levels as needed up to 6
    },
});
// result: each client has:
//   .order[]        = last 5 paid orders with product expanded
//   ._count.invoice = number of unpaid invoices
//   .note[0]        = most recent note with author expanded
```

### 10. Hide child records (`_include: false`)

`_include: false` is a **valid core feature**. Use it at child level to get `_count` or `_aggregate` results **without returning the actual child records**. This is essential for efficient counting and aggregation.

```javascript
// Get posts with like count and comment count — WITHOUT fetching all likes/comments
const result = await totalumSdk.crud.query('post', {
    _filter: { user_id: { in: feedUserIds } },
    _sort: { createdAt: 'desc' },
    user_id: true,
    post_like: {
        _count: true,
        _include: false,  // VALID — only returns count, not the actual like records
    },
    post_comment: {
        _count: true,
        _include: false,  // VALID — only returns count, not the actual comment records
    },
});
// Each post has post._count.post_like and post._count.post_comment
```

You can also combine `_include: false` with `_filter` on children:
```javascript
// Count unread messages per conversation without fetching message records
message: {
    _filter: { is_read: 'no', sender_id: { ne: userId } },
    _count: true,
    _include: false,
}
// Result: _count.message = number of unread messages
```

### 11. Avoid N+1 queries

**RULE: NEVER query inside a loop.** Use nested expansions, `_count` + `_include: false`, or batch with `{ in: ids }`.

**BAD — N+1 for child counts (don't do this):**
```javascript
// WRONG: 100 extra queries for 50 posts (2 per post)
const posts = (await totalumSdk.crud.query('post', { ... })).data;
for (const post of posts) {
    const { data: likes } = await totalumSdk.crud.query('post_like', { _filter: { post_id: post._id } });
    post.likes_count = likes.length;  // ALSO WRONG: counting with .length
    const { data: comments } = await totalumSdk.crud.query('post_comment', { _filter: { post_id: post._id } });
    post.comments_count = comments.length;
}
```

**GOOD — child `_count` + `_include: false` in single query:**
```javascript
// CORRECT: 1 query total, counts included automatically
const result = await totalumSdk.crud.query('post', {
    _filter: { user_id: { in: feedUserIds } },
    _sort: { createdAt: 'desc' },
    user_id: true,
    post_like: { _count: true, _include: false },
    post_comment: { _count: true, _include: false },
});
// Each post has post._count.post_like and post._count.post_comment
```

**BAD — N+1 for existence checks (don't do this):**
```javascript
// WRONG: 20 queries to check friendship per user
const users = (await totalumSdk.crud.query('user', { ... })).data;
for (const user of users) {
    const { data: friendship } = await totalumSdk.crud.query('friendship', {
        _filter: { _or: [{ requester_id: me, receiver_id: user._id }, { requester_id: user._id, receiver_id: me }] },
        _limit: 1,
    });
    user.is_friend = friendship.length > 0;
}
```

**GOOD — batch with `in` in one query, then check in JS:**
```javascript
// CORRECT: 1 extra query total, then check in JS
const userIds = users.map(u => u._id);
const { data: friendships } = await totalumSdk.crud.query('friendship', {
    _filter: {
        status: 'accepted',
        _or: [
            { requester_id: me, receiver_id: { in: userIds } },
            { requester_id: { in: userIds }, receiver_id: me },
        ],
    },
});
const friendIdSet = new Set();
for (const f of friendships) {
    friendIdSet.add(f.requester_id === me ? f.receiver_id : f.requester_id);
}
for (const user of users) {
    user.is_friend = friendIdSet.has(user._id);
}
```

**BAD — N+1 for counting records (don't do this):**
```javascript
// WRONG: fetches all likes just to count them
const { data: allLikes } = await totalumSdk.crud.query('post_like', { _filter: { post_id: postId } });
const count = allLikes.length;  // NEVER use .length to count
```

**GOOD — use `_aggregate` for filtered counts:**
```javascript
// CORRECT: returns only the count, no records transferred
const { data } = await totalumSdk.crud.query('post_like', {
    _filter: { post_id: postId },
    _aggregate: { _count: true },
});
const count = data.length > 0 ? data[0]._aggregate._count : 0;
```

**GOOD — single query with nested expansion:**
```javascript
// Get conversations with last message and unread count in ONE query
const result = await totalumSdk.crud.query('conversation', {
    _filter: { _or: [{ participant_one: userId }, { participant_two: userId }] },
    _sort: { last_message_at: 'desc' },
    participant_one: true,
    participant_two: true,
    message: {
        _sort: { createdAt: 'desc' },
        _limit: 1,
        sender_id: true,
    },
});
```

**GOOD — get a post with all related data in one call:**
```javascript
const result = await totalumSdk.crud.query('post', {
    _filter: { _id: postId },
    user_id: true,
    post_comment: { _sort: { createdAt: 'desc' }, user_id: true },
    post_like: { _count: true, _include: false },
});
```

### 12. Filter parent by children (_has)

Get only clients that have at least one order:

```javascript
const result = await totalumSdk.crud.query('client', {
    order: {
        _has: true,
    }
});
```

Modes: `true` or `'some'` = at least one child, `'none'` = no children, `'every'` = all children match filter.

### 13. Count children (_count)

**NEVER count with `.length`** — use `_count: true` or `_aggregate: { _count: true }`.

```javascript
const result = await totalumSdk.crud.query('client', {
    _count: true,   // adds _count._total (total matching clients before pagination)
    order: {
        _count: true,       // adds _count.order per client
        _include: false,    // don't return order records, just the count
    }
});

/*
Response shape:
[
    {
        _id: 'client_id_1',
        name: 'Client 1',
        _count: {
            _total: 100,    // total clients matching filter (before _limit/_offset)
            order: 5        // number of orders for this client
        }
    }
]
*/
```

**BAD — adding `_count: true` but reading `.length` (common mistake):**
```javascript
// WRONG: _count: true is there but the code reads .length instead!
const result = await totalumSdk.crud.query('friendship', {
    _filter: { status: 'accepted', _or: [{ requester: me }, { receiver: me }] },
    _count: true,     // adds _count._total but...
});
const count = result.data.length;  // WRONG! Capped at 50 (default limit). User with 80 friends shows 50.
```

**GOOD — use `_aggregate` when you only need the count:**
```javascript
// CORRECT: returns only the count, no records fetched
const result = await totalumSdk.crud.query('friendship', {
    _filter: { status: 'accepted', _or: [{ requester: me }, { receiver: me }] },
    _aggregate: { _count: true },
});
const count = result.data.length > 0 ? result.data[0]._aggregate._count : 0;
```

**GOOD — if you also need the records, read `_count._total`:**
```javascript
const result = await totalumSdk.crud.query('post', {
    _filter: { user: userId },
    _count: true,
    _limit: 50,
});
const posts = result.data;                                     // up to 50 posts
const totalPosts = result.data[0]?._count?._total ?? 0;       // REAL total (e.g. 1500)
// Use totalPosts for display, NOT posts.length
```

### 14. Select or omit fields

```javascript
// Only return name and email (not recommended to use a lot of _select because if all the fields are needed, it's easier to just return everything instead of listing all fields in _select)
const result = await totalumSdk.crud.query('client', {
    _select: { name: true, email: true }
});

// Return everything except notes
const result2 = await totalumSdk.crud.query('client', {
    _omit: { notes: true }
});
```

`_select` and `_omit` are mutually exclusive (cannot use both at the same level). Also avoid to use _select as can be easy to produce bugs if you forget to include a field that is needed.

### 15. Aggregations

**When to use `_aggregate` vs `_count`:**
- **Only need a total count, no records** → `_aggregate: { _count: true }` (most efficient, returns just the number)
- **Need records + total count** → `_count: true` on root (adds `_count._total` to each record)
- **Need per-parent child counts** → child `_count: true` + `_include: false` (adds `_count.childName` per parent)

**IMPORTANT — response shape is an array, not a single object:**

```javascript
const result = await totalumSdk.crud.query('order', {
    _filter: { status: 'paid' },
    _aggregate: {
        _sum: { total: true },
        _avg: { total: true },
        _min: { total: true },
        _max: { total: true },
        _count: true,
    }
});

/*
result.data is ALWAYS an array:
[
    {
        _aggregate: {
            _sum: { total: 5000 },
            _avg: { total: 250 },
            _min: { total: 10 },
            _max: { total: 1000 },
            _count: 20
        }
    }
]

If no records match the filter, result.data = [] (empty array, NOT [{ _aggregate: { _count: 0 } }])
*/

// Correct way to read the count:
const count = result.data.length > 0 ? result.data[0]._aggregate._count : 0;
```

### 16. Group by

```javascript
const result = await totalumSdk.crud.query('order', {
    _groupBy: 'status',
    _aggregate: { _count: true, _sum: { total: true } },
});

/*
result.data:
[
    { _group: { status: 'paid' }, _aggregate: { _count: 15, _sum: { total: 3000 } } },
    { _group: { status: 'pending' }, _aggregate: { _count: 5, _sum: { total: 1000 } } },
]
*/
```

`_groupBy` requires `_aggregate`. Can be a string or array of strings.

### 17. Child-level aggregation

Aggregate over children without fetching all child records:

```javascript
const result = await totalumSdk.crud.query('company', {
    employee: {
        _aggregate: { _sum: { salary: true }, _avg: { salary: true }, _count: true },
        _include: false,  // don't return individual employee records
    }
});

/*
result.data:
[
    {
        _id: 'company_1',
        name: 'Acme Corp',
        _aggregate: {
            employee: { _sum: { salary: 500000 }, _avg: { salary: 50000 }, _count: 10 }
        }
    }
]
*/
```

Note: `_groupBy` is NOT supported at child level.

### 18. Get historic updates

```javascript
const result = await totalumSdk.crud.getHistoricRecordUpdatesById(yourRecordId);

/*
Result format:
{
    data: {
        objectId: string,
        typeId: string,
        updatesRecord: [{
            timestamp: Date | string,
            userId: string,
            changes: {
                old?: any,
                new: any
            }
        }]
    },
    errors?: { errorCode: string, errorMessage: string }
}
*/
```

### 19. query() input reference

```typescript
// All fields are optional
{
    _filter: {
        property: 'exact value',
        property: { regex: 'partial', options: 'i' },  // case-insensitive partial match
        property: { gte: 10, lte: 100 },                // number/date range
        property: { ne: 'excluded_value' },              // not equal
        property: { in: ['val1', 'val2'] },              // in list
        property: { nin: ['val1'] },                     // not in list
        property: { startsWith: 'Jo' },                  // case-insensitive prefix
        property: { endsWith: '.com' },                  // case-insensitive suffix
        property: { contains: 'test' },                  // case-insensitive substring
        _or: [{ status: 'a' }, { status: 'b' }],        // OR conditions
        // All operators work on objectReference fields and _id (string IDs auto-converted to ObjectId)
    },
    _sort: { property: 'asc' | 'desc' },
    _limit: 50,     // default: 50, max: 1000
    _offset: 0,
    _select: { property: true },      // only return these fields (recommended to avoid using a lot of _select, if you need most fields, it's easier to just return everything instead of listing all fields in _select)
    _omit: { property: true },        // exclude these fields (_select and _omit are mutually exclusive)
    _count: true,                      // at root: adds _count._total; at child: adds _count.childName
    _has: true | 'some' | 'none' | 'every',  // filter parent by children existence
    _aggregate: { _sum: { field: true }, _avg: { field: true }, _min: { field: true }, _max: { field: true }, _count: true },
    _groupBy: 'field' | ['field1', 'field2'],  // requires _aggregate
    _include: false,                   // VALID FEATURE: hides child records, use with _count or _aggregate to get counts without data

    // Nested child tables (use the objectReference property name as key):
    child_property: true,              // shorthand for {}
    child_property: {
        // same options recursively (filters, sort, limit, expansions, etc.)
    }
}
```

More information of how to use filters in [05-filtering-sorting.md](./05-filtering-sorting.md)

---

## Deprecated methods

If the existing project already uses `getRecords`, `getNestedData`, `getManyToManyReferencesRecords`, or `nestedFilter`, **keep them as-is** — do NOT refactor working legacy code to `query()`. Only use `query()` for new code you write.

See [12-deprecated-get-methods.md](./12-deprecated-get-methods.md) for legacy method docs.
