---
name: totalum-database
description: "Database schema design and Totalum MCP operations. Use when creating/modifying database tables, designing schemas, creating table properties, managing database structure, or querying/creating/editing/deleting records via MCP. Activates for database modeling, table creation, field definitions, relationship setup, and MCP data operations."
---


## SUPER MANDATORY RULES TO FOLLOW

1. [ ] Call `getAllDatabaseTables()` first to check existing database structure
2. [ ] Design schema with snake_case names
3. [ ] Even if user direct specifies the relationships with string id fields, you need to change them to objectReference type with the correct relation type and target table.
4. [ ] Always use objectReference for all relationships
5. [ ] Never add _id, createdAt, updatedAt
6. [ ] Add includeHour: true for all datetime fields
7. [ ] Use options for boolean fields
8. [ ] Link user table to other tables if auth is enabled
9. [ ] Always check and Link all necessary tables together using objectReference fields
10. [ ] Update TypeScript interfaces after DB changes
11. [ ] Never forget to all relations between tables
12. [ ] Always use property type file for fields that needs to store files/images, never store as a string URL. The only exception is when you need to store external URLs or that the file to be upload is bigger than 50MB.


### Never use a different proporty type from objectReference for relationships between tables
- Always use `objectReference` type for foreign key relationships
- NEVER use `string` or other types to store IDs of related records
- Even if user direct specifies the relationships with string id fields, you need to change them to objectReference type with the correct relation type and target table.

### Naming Conventions
- **ALWAYS use snake_case** for table names and field names
- Examples: `client_order`, `product_category`, `created_at`

### Auto-Created Fields
- Every Totalum table automatically has: `_id`, `createdAt`, `updatedAt`
- **NEVER create these manually**

### Field Types Available
| Type | Usage | Notes |
|------|-------|-------|
| `string` | Short text, emails, links | Use typeExtras for text/link/email |
| `number` | Integers, decimals | |
| `date` | Dates and datetimes | Use `includeHour: true` for timestamps |
| `long-string` | Long text, JSON, rich text | Use typeExtras for text/rich-text/json |
| `file` | Single or multiple file upload | Max 50MB |
| `options` | Single or multiple select dropdown | Define color + value |
| `objectReference` | Foreign key relationship | oneToMany, manyToOne, manyToMany |

### No Boolean Type!
- Use `options` with values `"yes"` and `"no"` instead

### Relationships
Even if user direct specifies the relationships with string id fields, you need to change them to objectReference type with the correct relation type and target table.


- **One-to-Many**: Field on the "many" side references the "one" side
- **Many-to-Many**: Totalum auto-creates junction tables - NEVER create manually
- **ALWAYS use objectReference** for relationships, never text fields to store IDs

## MCP Tools Reference

### Check Existing Database Structure (ALWAYS DO FIRST)
```typescript
mcp__totalum__getAllDatabaseTables()
```

### Create New Table
```typescript
mcp__totalum__createDatabaseTable({
  type: "table_name",           // snake_case
  label: "Human Label",         // Display name
  description: "Purpose of table",
  icon: "fa-solid fa-icon",     // FontAwesome free icon
  mustTheTableBeVisibleOnBackOffice: true/false,
  properties: [
    {
      name: "field_name",       // snake_case
      label: "Field Label",
      propertyType: "string",   // See types above
      description: "Optional description",
      typeExtras: { /* type-specific config */ }
    }
  ]
})
```

### Add Property to Existing Table
```typescript
mcp__totalum__createTableProperty({
  structureId: "table_id_from_getAllDatabaseTables",
  property: {
    name: "new_field",
    label: "New Field",
    propertyType: "string",
    typeExtras: { string: { type: "text" } }
  }
})
```

### Edit Existing Property
```typescript
mcp__totalum__editTableProperty({
  structureId: "table_id",
  propertyId: "property_id",
  property: {
    name: "field_name",
    label: "Updated Label",
    propertyType: "string",
    // ALL fields required, not just changed ones
  }
})
```

### Delete Property
```typescript
mcp__totalum__deleteTableProperty({
  structureId: "table_id",
  propertyId: "property_id"
})
```

### Delete Entire Table
```typescript
mcp__totalum__deleteDatabaseTableById({
  structureId: "table_id"
})
```


### Query Records

```typescript
mcp__totalum__query({
  tableName: "your_table",
  queryOptions: {
    _filter: { status: "active", name: { regex: "john", options: "i" } },
    _sort: { name: "asc" },
    _limit: 10,
    _offset: 0,
    // Nested relations (use table name as key):
    child_table: {
      _filter: { /* child filters */ },
      _sort: { createdAt: "desc" },
      _limit: 5,
      _count: true,
      _has: true
    }
  }
})
```

**queryOptions reference:**
- `_filter`: Object filter. Operators: exact match, `{ regex, options }`, `{ gte, lte }`, `{ ne }`, `{ in: [] }`, `{ nin: [] }`. Use `_or: [...]` for OR conditions.
- `_sort`: `{ field: "asc" | "desc" }`
- `_limit` / `_offset`: pagination
- `_has`: filter parent by children (`true`, `"some"`, `"none"`, `"every"`)
- `_count`: include child count
- `_select` / `_omit`: include/exclude fields `{ field: true }`
- `_aggregate`: `{ _sum: { field: true }, _avg: { field: true }, _count: true }`
- `_groupBy`: `"field"` or `["field1", "field2"]`
- Any other key = nested child table expansion


### Upload File from URL
```typescript
mcp__totalum__uploadFileFromUrl({
  fileUrl: "https://example.com/document.pdf",
  fileName: "my-document.pdf"  // optional
})
// Returns: fileName to use in record file fields as { name: fileName }
```

## Property Type Examples

### String Field
```typescript
{
  name: "email",
  label: "Email",
  propertyType: "string",
  typeExtras: {
    string: { type: "text" }  // or "link" for URLs
  }
}
```

### Date Field with Time
```typescript
{
  name: "expires_at",
  label: "Expires At",
  propertyType: "date",
  typeExtras: {
    date: { includeHour: true }  // CRITICAL for timestamps!
  }
}
```

### Options Field (Boolean Alternative)
```typescript
{
  name: "is_active",
  label: "Is Active",
  propertyType: "options",
  typeExtras: {
    options: [
      { value: "yes", color: "#22c55e" },
      { value: "no", color: "#ef4444" }
    ],
    optionsConfig: { multiple: false }
  }
}
```

### Long String (JSON/Rich Text)
```typescript
{
  name: "metadata",
  label: "Metadata",
  propertyType: "long-string",
  typeExtras: {
    "long-string": { type: "json" }  // or "text", "rich-text"
  }
}
```

### File Field
```typescript
{
  name: "document",
  label: "Document",
  propertyType: "file",
  typeExtras: {
    file: {
      multiple: false,  // or true for multiple files
      compress: true    // compress images
    }
  }
}
```

### Object Reference (Foreign Key)
```typescript
{
  name: "client",
  label: "Client",
  propertyType: "objectReference",
  objectReference: {
    objectReferenceTypeId: "client",  // target table name
    objectReferenceRelation: "manyToOne"  // or "oneToMany", "manyToMany"
  }
}
```



