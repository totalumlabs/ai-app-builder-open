# Totalum MCP Guide


## How to correct modeling the database structure
Don't add too much complexity to the database. 


Also not forget to link user table with others if is necessary.
The database schema is for then create a Totalum database that has this fields types: string, number, date, longString, file, multipleFile, options (a,b,c), multipleOptions (the same that options but you can select multiple), and tableLink (oneToMany, manyToOne, manyToMany). There is no boolean, so if is needed, create an options with option yes and no.

If you need to create a many to many relationship, NOT create a junction table, as totalum automatically create and manage the junction table under the hood. Just create a tableLink field with manyToMany type.

Recommendations to follow for create the database schema: 1.only create a table when really is necessary not redundant tables that can be just a table field. For example, instead of create client and clientCategory tables, just create client and in client table  add a category field. Another example: instead of create product and productPhotos, create table products and a field of photos of multiple files field type. Remember to link all tables needed between as expected using always foreign keys. Use a schema output similar that the Totalum field types.`;

Super important: ALWAYS you MUST use foreign keys (objectReference) to link tables between them. Never use text fields to store ids of other tables. Always use foreign keys.

Take care that every totalum database table already has by default _id, createdAt, updatedAt fields, so never create them manually.


Important: For the Auth tables (user, session, etc...), create exactly this tables calling to totalum mcp:

SUPER MANDATORY: If the project has authentication and users accounts, you MUST link all necessary tables with the `user` table using foreign keys (objectReference). If you don't do this, the project data will not be linked to users!

## Auth Tables (user, session, account, verification)
MANDATORY: To set up authentication in Totalum, you MUST to create this exact 4 specific database tables: `user`, `session`, `account`, and `verification`. 

**🚨 IMPORTANT: Execute these MCP calls in order, not in parallel. Copy-paste each call exactly as shown.**

**Table 1: user** - Execute this MCP call:
```typescript
mcp__totalum__createDatabaseTable({
  type: "user",
  label: "User",
  description: "Table used for Auth. Stores users",
  icon: "fa-solid fa-user",
  mustTheTableBeVisibleOnBackOffice: true,
  properties: [
    {
      name: "email",
      label: "Email",
      propertyType: "string",
      typeExtras: {
        string: { type: "text" }
      }
    },
    {
      name: "name",
      label: "Name",
      propertyType: "string",
      typeExtras: {
        string: { type: "text" }
      }
    },
    {
      name: "email_verified",
      label: "Email Verified",
      propertyType: "number"
    },
    {
      name: "image",
      label: "Image",
      propertyType: "string",
      typeExtras: {
        string: { type: "link" }
      }
    }
  ]
})
```

**Table 2: session** - Execute this MCP call:
```typescript
mcp__totalum__createDatabaseTable({
  type: "session",
  label: "Session",
  description: "Table used for Auth. Stores user auth sessions",
  icon: "fa-solid fa-clock",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    {
      name: "user_id",
      label: "User ID",
      propertyType: "string"
    },
    {
      name: "token",
      label: "Token",
      propertyType: "string"
    },
    {
      name: "expires_at",
      label: "Expires At",
      propertyType: "date",
      typeExtras: {
        date: { includeHour: true }
      }
    },
    {
      name: "ip_address",
      label: "IP Address",
      propertyType: "string"
    },
    {
      name: "user_agent",
      label: "User Agent",
      propertyType: "string"
    }
  ]
})
```

**Table 3: account** - Execute this MCP call:
```typescript
mcp__totalum__createDatabaseTable({
  type: "account",
  label: "Account",
  description: "Table used for Auth. Stores accounts tokens",
  icon: "fa-solid fa-id-card",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    {
      name: "user_id",
      label: "User ID",
      propertyType: "string"
    },
    {
      name: "account_id",
      label: "Account ID",
      propertyType: "string"
    },
    {
      name: "provider_id",
      label: "Provider ID",
      propertyType: "string"
    },
    {
      name: "password",
      label: "Password",
      propertyType: "string"
    },
    {
      name: "access_token",
      label: "Access Token",
      propertyType: "long-string",
      typeExtras: {
        "long-string": { type: "text" }
      }
    },
    {
      name: "refresh_token",
      label: "Refresh Token",
      propertyType: "long-string",
      typeExtras: {
        "long-string": { type: "text" }
      }
    },
    {
      name: "id_token",
      label: "ID Token",
      propertyType: "long-string",
      typeExtras: {
        "long-string": { type: "text" }
      }
    },
    {
      name: "access_token_expires_at",
      label: "Access Token Expires At",
      propertyType: "date",
      typeExtras: {
        date: { includeHour: true }
      }
    },
    {
      name: "refresh_token_expires_at",
      label: "Refresh Token Expires At",
      propertyType: "date",
      typeExtras: {
        date: { includeHour: true }
      }
    },
    {
      name: "scope",
      label: "Scope",
      propertyType: "string"
    }
  ]
})
```

**Table 4: verification** - Execute this MCP call:
```typescript
mcp__totalum__createDatabaseTable({
  type: "verification",
  label: "Verification",
  icon: "fa-solid fa-check-circle",
  description: "Table used for Auth. Stores verification tokens",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    {
      name: "identifier",
      label: "Identifier",
      propertyType: "string",
      typeExtras: {
        string: { type: "email" }
      }
    },
    {
      name: "value",
      label: "Value",
      propertyType: "string"
    },
    {
      name: "expires_at",
      label: "Expires At",
      propertyType: "date",
      typeExtras: {
        date: { includeHour: true }
      }
    }
  ]
})
```

