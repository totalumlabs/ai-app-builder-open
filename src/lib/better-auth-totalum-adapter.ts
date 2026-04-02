import "server-only";
import { TotalumApiSdk } from "totalum-api-sdk";
import type { Adapter } from "better-auth";
import { createAdapterFactory } from "better-auth/adapters";

// ==================== Type Definitions ====================

interface Where {
  operator?:
    | "eq"
    | "ne"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "in"
    | "not_in"
    | "contains"
    | "starts_with"
    | "ends_with";
  value: string | number | boolean | string[] | number[] | Date | null;
  field: string;
  connector?: "AND" | "OR";
}

interface TotalumAdapterConfig {
  /**
   * Enable debug logs for the adapter
   * @default false
   */
  debugLogs?: boolean;
  /**
   * Prefix for Totalum collections (usually "data_")
   * @default "data_"
   */
  collectionPrefix?: string;
}

// ==================== Utility Functions ====================

/**
 * Convert camelCase field names to snake_case for Totalum
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Convert snake_case field names to camelCase for Better Auth
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if a field is a Totalum auto-generated field that should stay in camelCase
 */
function isTotalumAutoField(field: string): boolean {
  return field === '_id' || field === 'id' || field === 'createdAt' || field === 'updatedAt' || field === 'createdBy';
}

/**
 * Convert an object's keys from camelCase to snake_case
 * IMPORTANT: Totalum auto-fields (_id, createdAt, updatedAt, createdBy) stay in camelCase
 * Custom fields get converted to snake_case
 */
function objectToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip auto-generated Totalum fields - they stay in camelCase
    if (isTotalumAutoField(key)) {
      result[key] = value;
      continue;
    }

    const snakeKey = key === "id" ? "_id" : toSnakeCase(key);

    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (Array.isArray(value)) {
        result[snakeKey] = value.map((item) =>
          typeof item === "object" && item !== null
            ? objectToSnakeCase(item)
            : item
        );
      } else {
        result[snakeKey] = objectToSnakeCase(value);
      }
    } else if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Convert an object's keys from snake_case to camelCase
 * IMPORTANT: Totalum auto-fields (_id, createdAt, updatedAt, createdBy) stay as-is
 * Custom fields get converted from snake_case to camelCase
 */
function objectToCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Keep Totalum auto-fields as-is, but map _id to id for Better Auth compatibility
    if (key === "_id") {
      result["id"] = value;
      continue;
    }
    if (isTotalumAutoField(key)) {
      result[key] = value;
      continue;
    }

    const camelKey = toCamelCase(key);

    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (Array.isArray(value)) {
        result[camelKey] = value.map((item) =>
          typeof item === "object" && item !== null
            ? objectToCamelCase(item)
            : item
        );
      } else {
        result[camelKey] = objectToCamelCase(value);
      }
    } else if (typeof value === "string" && isISODate(value)) {
      result[camelKey] = new Date(value);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Check if a string is an ISO date string
 */
function isISODate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str);
}

/**
 * Convert Better Auth where clauses to Totalum query _filter format
 */
function convertWhereToQueryFilter(where: Where[]): Record<string, any> {
  if (!where || where.length === 0) return {};

  const result: Record<string, any> = {};
  const orFilters: any[] = [];

  for (const clause of where) {
    // Handle field name conversion: id -> _id, auto-fields stay as-is, others to snake_case
    let field: string;
    if (clause.field === "id") {
      field = "_id";
    } else if (isTotalumAutoField(clause.field)) {
      field = clause.field;
    } else {
      field = toSnakeCase(clause.field);
    }

    const value =
      clause.value instanceof Date
        ? clause.value.toISOString()
        : clause.value;

    let filterValue: any;

    switch (clause.operator) {
      case "eq":
      case undefined:
        filterValue = value;
        break;
      case "ne":
        filterValue = { ne: value };
        break;
      // Note: Totalum only supports gte/lte, not strict gt/lt
      // So we map lt -> lte and gt -> gte (best approximation)
      case "lt":
        filterValue = { lte: value };
        break;
      case "lte":
        filterValue = { lte: value };
        break;
      case "gt":
        filterValue = { gte: value };
        break;
      case "gte":
        filterValue = { gte: value };
        break;
      case "in":
        if (Array.isArray(value) && value.length > 0) {
          filterValue = { in: value };
        } else {
          filterValue = null;
        }
        break;
      case "not_in":
        if (Array.isArray(value) && value.length > 0) {
          filterValue = { nin: value };
        } else {
          continue; // Empty array - no exclusions needed
        }
        break;
      // We use regex patterns to emulate contains/starts_with/ends_with
      case "contains":
        filterValue = { regex: String(value), options: "i" };
        break;
      case "starts_with":
        filterValue = { regex: `^${String(value)}`, options: "i" };
        break;
      case "ends_with":
        filterValue = { regex: `${String(value)}$`, options: "i" };
        break;
      default:
        filterValue = value;
    }

    if (filterValue === undefined) continue;

    if (clause.connector === "OR") {
      orFilters.push({ [field]: filterValue });
    } else {
      // If field already exists with an operator object, merge them
      if (result[field] && typeof result[field] === "object" && typeof filterValue === "object" && filterValue !== null) {
        result[field] = { ...result[field], ...filterValue };
      } else {
        result[field] = filterValue;
      }
    }
  }

  if (orFilters.length > 0) {
    result._or = orFilters;
  }

  return result;
}

/**
 * Unwrap Totalum SDK response
 * Note: Response structure is result.data (not result.data.data)
 */
function unwrapTotalumResponse<T>(response: any): T | null {
  return response?.data ?? null;
}

// ==================== Totalum Adapter Implementation ====================

export function totalumAdapter(
  client: TotalumApiSdk,
  config: TotalumAdapterConfig = {}
) {
  const { debugLogs = false } = config;

  const log = (...args: any[]) => {
    if (debugLogs) {
      // SUPER IMPORTANT: THIS LINE IS COMMENTED BECAUSE IT GENERATES A LOT OF LOGS AND CONTAMINATES THE OUTPUT. ONLY UNCOMMENT IF SOMETHING ON AUTH IS NOT WORKING AND YOU NEED TO DEBUG IT.
      //console.log("[Totalum Adapter]", ...args);
    }
  };

  /**
   * Get the Totalum table name from Better Auth model name
   */
  const getTableName = (model: string): string => {
    // Convert model name to snake_case
    const tableName = toSnakeCase(model);
    log(`Model "${model}" -> Table "${tableName}"`);
    return tableName;
  };

  return createAdapterFactory({
    config: {
      adapterId: "totalum",
      supportsJSON: false,
      supportsDates: true,
      supportsBooleans: false,
      supportsNumericIds: false,
      disableIdGeneration: true,
    },
    adapter: () => {
      return {
        id: "totalum",

        /**
         * Create a new record
         */
        async create<T extends Record<string, any>, R = T>(data: {
          model: string;
          data: Omit<T, "id">;
          select?: string[];
          forceAllowId?: boolean;
        }): Promise<R> {
          log("CREATE", data);
          const tableName = getTableName(data.model);
          const snakeCaseData = objectToSnakeCase(data.data);

          // Remove _id if present (Totalum auto-generates)
          if (!data.forceAllowId) {
            delete snakeCaseData._id;
          }

          const response = await client.crud.createRecord(
            tableName,
            snakeCaseData
          );

          // createRecord now returns the full created record
          const record = unwrapTotalumResponse(response);

          if (!record) {
            throw new Error(`Failed to create ${data.model}`);
          }

          const result = objectToCamelCase(record);
          log("CREATE result:", result);
          return result as R;
        },

        /**
         * Find a single record
         */
        async findOne<T>(data: {
          model: string;
          where: Where[];
          select?: string[];
        }): Promise<T | null> {
          log("FIND_ONE", data);
          const tableName = getTableName(data.model);
          const filter = convertWhereToQueryFilter(data.where);

          const response = await client.crud.query(tableName, {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _limit: 1,
          });

          const items = unwrapTotalumResponse<any[]>(response) || [];
          const record = items[0] || null;

          if (!record) {
            log("FIND_ONE: Not found");
            return null;
          }

          const result = objectToCamelCase(record);
          log("FIND_ONE result:", result);
          return result as T;
        },

        /**
         * Find multiple records
         */
        async findMany<T>(data: {
          model: string;
          where?: Where[];
          limit?: number;
          sortBy?: {
            field: string;
            direction: "asc" | "desc";
          };
          offset?: number;
        }): Promise<T[]> {
          log("FIND_MANY", data);
          const tableName = getTableName(data.model);
          const filter = convertWhereToQueryFilter(data.where || []);

          const queryOptions: any = {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _limit: data.limit || 50,
            _offset: data.offset || 0,
          };

          if (data.sortBy) {
            const sortField =
              data.sortBy.field === "id" ? "_id" : toSnakeCase(data.sortBy.field);
            queryOptions._sort = {
              [sortField]: data.sortBy.direction,
            };
          }

          const response = await client.crud.query(tableName, queryOptions);
          const items = unwrapTotalumResponse<any[]>(response) || [];

          let result = items.map((item) => objectToCamelCase(item));
          log("FIND_MANY result count:", result.length);
          // Sort credential accounts first so Better Auth picks the right password
          // Better Auth's credential login calls findMany by userId without providerId filter,
          // then uses the first account's password. If a Google/social account comes first
          // (with no password), login always fails.
          if (data.model === "account" && result.length > 1) {
            result = result.sort((a: any, b: any) => {
              if (a.providerId === "credential" && b.providerId !== "credential") return -1;
              if (a.providerId !== "credential" && b.providerId === "credential") return 1;
              return 0;
            });
          }
          return result as T[];
        },

        /**
         * Count records
         */
        async count(data) {
          log("COUNT", data);
          const tableName = getTableName(data.model);
          const filter = convertWhereToQueryFilter(data.where || []);

          const response = await client.crud.query(tableName, {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _select: { _id: true },
            _count: true,
            _limit: 1,
          });

          const items = unwrapTotalumResponse<any[]>(response) || [];
          const count = items[0]?._count?._total ?? items.length;

          log("COUNT result:", count);
          return count;
        },

        /**
         * Update a single record
         */
        async update<T>(data: {
          model: string;
          where: Where[];
          update: Record<string, any>;
        }): Promise<T | null> {
          log("UPDATE", data);
          const tableName = getTableName(data.model);

          // Find the record first
          const filter = convertWhereToQueryFilter(data.where);
          const findResponse = await client.crud.query(tableName, {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _limit: 1,
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];
          const record = items[0];

          if (!record) {
            log("UPDATE: Record not found");
            return null;
          }

          const recordId = record._id;
          const snakeCaseUpdate = objectToSnakeCase(data.update);
          delete snakeCaseUpdate._id; // Don't update ID

          // editRecordById now returns the full updated record
          const updateResponse = await client.crud.editRecordById(tableName, recordId, snakeCaseUpdate);
          const updatedRecord = unwrapTotalumResponse(updateResponse);

          if (!updatedRecord) {
            log("UPDATE: Failed to update record");
            return null;
          }

          const result = objectToCamelCase(updatedRecord);
          log("UPDATE result:", result);
          return result as T;
        },

        /**
         * Update multiple records
         */
        async updateMany(data) {
          log("UPDATE_MANY", data);
          const tableName = getTableName(data.model);
          const filter = convertWhereToQueryFilter(data.where);

          // Find all matching records
          const findResponse = await client.crud.query(tableName, {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _limit: 1000,
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];
          const snakeCaseUpdate = objectToSnakeCase(data.update);
          delete snakeCaseUpdate._id;

          // Update each record
          let updateCount = 0;
          for (const item of items) {
            try {
              await client.crud.editRecordById(tableName, item._id, snakeCaseUpdate);
              updateCount++;
            } catch (error) {
              log("UPDATE_MANY error for item", item._id, error);
            }
          }

          log("UPDATE_MANY result count:", updateCount);
          return updateCount;
        },

        /**
         * Delete a single record
         */
        async delete(data) {
          log("DELETE", data);
          const tableName = getTableName(data.model);
          const filter = convertWhereToQueryFilter(data.where);

          // Find the record first
          const findResponse = await client.crud.query(tableName, {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _limit: 1,
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];
          const record = items[0];

          if (!record) {
            log("DELETE: Record not found");
            return;
          }

          await client.crud.deleteRecordById(tableName, record._id);
          log("DELETE: Success");
        },

        /**
         * Delete multiple records
         */
        async deleteMany(data) {
          log("DELETE_MANY", data);
          const tableName = getTableName(data.model);
          const filter = convertWhereToQueryFilter(data.where);

          // Find all matching records
          const findResponse = await client.crud.query(tableName, {
            ...(Object.keys(filter).length > 0 ? { _filter: filter } : {}),
            _limit: 1000,
          });

          const items = unwrapTotalumResponse<any[]>(findResponse) || [];

          // Delete each record
          let deleteCount = 0;
          for (const item of items) {
            try {
              await client.crud.deleteRecordById(tableName, item._id);
              deleteCount++;
            } catch (error) {
              log("DELETE_MANY error for item", item._id, error);
            }
          }

          log("DELETE_MANY result count:", deleteCount);
          return deleteCount;
        },

        /**
         * Transaction support (fallback to sequential operations)
         * Note: Totalum doesn't support real transactions, so we execute operations sequentially
         */
        async transaction(callback) {
          log("TRANSACTION: Starting (sequential fallback)");

          try {
            // Pass the same adapter instance for operations within the "transaction"
            const result = await callback({
              id: this.id,
              create: this.create,
              findOne: this.findOne,
              findMany: this.findMany,
              count: this.count,
              update: this.update,
              updateMany: this.updateMany,
              delete: this.delete,
              deleteMany: this.deleteMany,
            });

            log("TRANSACTION: Completed successfully");
            return result;
          } catch (error) {
            log("TRANSACTION: Failed", error);
            throw error;
          }
        },
      } satisfies Adapter;
    },
  });
}
