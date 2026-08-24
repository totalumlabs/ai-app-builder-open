import type { DbProperty, DbTable } from "@/lib/vcaas-types";

/**
 * ═══ THE TOTALUM FIELD-TYPE MODEL (Feature H3) ══════════════════════════════
 *
 * ⚠️ THE DOCUMENTED TYPE NAMES ARE NOT THE API's TYPE NAMES, and conflating the
 * two is the single easiest way to break this panel. `totalum-docs` and the MCP
 * docs describe the field types a *user* picks:
 *
 *   string · number · date · longString · file · multipleFile · options ·
 *   multipleOptions · tableLink
 *
 * The API's `propertyType` only ever holds:
 *
 *   string · number · date · long-string · options · file · objectReference ·
 *   boolean
 *
 * The mapping — verified against a LIVE Totalum schema, not inferred:
 *
 * | documented     | propertyType      | discriminator                              |
 * | -------------- | ----------------- | ------------------------------------------ |
 * | longString     | `long-string`     | hyphenated, not camelCase                  |
 * | file           | `file`            | `typeExtras.file.multiple` falsy           |
 * | multipleFile   | `file`            | `typeExtras.file.multiple === true`        |
 * | options        | `options`         | `typeExtras.optionsConfig.multiple` falsy  |
 * | multipleOptions| `options`         | `typeExtras.optionsConfig.multiple === true` |
 * | tableLink      | `objectReference` | `objectReference.objectReferenceRelation`  |
 *
 * ⚠️ **THERE IS NO BOOLEAN FIELD TYPE.** The docs are explicit: model a yes/no
 * as an `options` field with `yes`/`no`. `boolean` exists in the backend enum as
 * a legacy artefact and real schemas do not use it, but records CAN still hold
 * raw booleans, so rendering handles the value without offering the type.
 *
 * Pure module: no React, no fetch. Unit-tested by `src/lib/__tests__/db-cms.test.ts`.
 */

/** What the UI actually needs to decide how to render and edit a field. */
export type FieldKind =
    | "string"
    | "number"
    | "date"
    | "datetime"
    | "longString"
    | "file"
    | "multipleFile"
    | "options"
    | "multipleOptions"
    | "tableLink"
    | "boolean"
    | "json";

export type RelationKind = "manyToMany" | "oneToMany" | "manyToOne" | "oneToOne";

/** Fields Totalum manages itself. Never editable, never offered in a form. */
export const SYSTEM_FIELDS = new Set([
    "_id",
    "createdAt",
    "updatedAt",
    "createdBy",
    "lastUpdatedBy",
    "metadata",
]);

function extras<T>(property: DbProperty, key: string): T | undefined {
    const bag = property.typeExtras as Record<string, unknown> | null | undefined;
    return (bag?.[key] as T | undefined) ?? undefined;
}

/**
 * ⭐ THE ONE PLACE THAT DECIDES WHAT A FIELD IS. Never switch on `propertyType`
 * anywhere else — the `multiple` flags and the `long-string` spelling are exactly
 * the details that get missed.
 */
export function fieldKindOf(property: DbProperty): FieldKind {
    switch (property.propertyType) {
        case "number":
            return "number";

        case "boolean":
            return "boolean";

        case "date": {
            const date = extras<{ includeHour?: boolean }>(property, "date");
            return date?.includeHour ? "datetime" : "date";
        }

        case "long-string":
            return "longString";

        case "file": {
            const file = extras<{ multiple?: boolean }>(property, "file");
            return file?.multiple ? "multipleFile" : "file";
        }

        case "options": {
            const config = extras<{ multiple?: boolean }>(property, "optionsConfig");
            return config?.multiple ? "multipleOptions" : "options";
        }

        case "objectReference":
            return "tableLink";

        case "array":
        case "object":
            return "json";

        default:
            return "string";
    }
}

export function isFileKind(kind: FieldKind): kind is "file" | "multipleFile" {
    return kind === "file" || kind === "multipleFile";
}

export function isOptionsKind(kind: FieldKind): kind is "options" | "multipleOptions" {
    return kind === "options" || kind === "multipleOptions";
}

/** The declared choices of an `options` / `multipleOptions` field. */
export interface FieldOption {
    id: string;
    value: string;
    color?: string;
}

export function optionsOf(property: DbProperty): FieldOption[] {
    const list = extras<FieldOption[]>(property, "options");
    return Array.isArray(list) ? list : [];
}

/** The sub-type of a string / longString field (`email`, `link`, `rich-text`, …). */
export function stringSubtypeOf(property: DbProperty): string | undefined {
    if (property.propertyType === "string") {
        return extras<{ type?: string }>(property, "string")?.type;
    }
    if (property.propertyType === "long-string") {
        return extras<{ type?: string }>(property, "long-string")?.type;
    }
    return undefined;
}

export function relationOf(property: DbProperty): RelationKind | null {
    return property.objectReference?.objectReferenceRelation ?? null;
}

/**
 * Does this relation store its id ON the record that declares it?
 *
 * ⚠️ THE ANSWER DECIDES HOW A LINK IS WRITTEN, and getting it backwards writes
 * to a field that does not exist:
 *
 *  · `manyToOne` / `oneToOne` → **yes**. The id lives in this field, so linking is
 *    an ordinary record update.
 *  · `oneToMany` → **no**. The CHILD holds the id; this side is a view of them.
 *    You link by updating the child, not the parent.
 *  · `manyToMany` → **no**. Totalum owns a junction table; you link through the
 *    dedicated add/drop-reference endpoints and never touch a field.
 */
export function storesIdOnRecord(relation: RelationKind | null): boolean {
    return relation === "manyToOne" || relation === "oneToOne";
}

export function isManyToMany(relation: RelationKind | null): boolean {
    return relation === "manyToMany";
}

/**
 * The table a `tableLink` points at.
 *
 * ⚠️ `objectReferenceTypeId` IS THE TARGET TABLE'S `_id`, NOT ITS `type` NAME —
 * confirmed against a live schema. The `type` fallback exists only because a
 * hand-written or older schema could carry a name, and matching one extra field
 * is cheaper than a mysterious empty picker.
 */
export function resolveLinkedTable(
    tables: DbTable[],
    property: DbProperty
): DbTable | undefined {
    const target = property.objectReference?.objectReferenceTypeId;
    if (!target) return undefined;
    return tables.find(table => table._id === target) || tables.find(table => table.type === target);
}

/** Every `tableLink` field on a table, in declaration order. */
export function linkFieldsOf(table: DbTable | undefined): DbProperty[] {
    if (!table?.properties) return [];
    return Object.values(table.properties).filter(p => p.propertyType === "objectReference");
}

/** Every non-system, non-link field — the ones a plain form edits. */
export function scalarFieldsOf(table: DbTable | undefined): DbProperty[] {
    if (!table?.properties) return [];
    return Object.values(table.properties).filter(
        p => !SYSTEM_FIELDS.has(p.name) && p.propertyType !== "objectReference"
    );
}

export function editableFieldsOf(table: DbTable | undefined): DbProperty[] {
    if (!table?.properties) return [];
    return Object.values(table.properties).filter(p => !SYSTEM_FIELDS.has(p.name));
}

/**
 * ⭐ THE INVERSE SIDE OF A RELATION.
 *
 * Totalum gives BOTH sides of one relation the same property `id` — `user.session`
 * and `session.user_id` are both `neMm6_d9px0o`. Verified on a live schema. That
 * shared id is the only reliable join between the two halves: names differ, and
 * two tables can be related more than once, so matching on the target table alone
 * would pair the wrong fields.
 */
export function pairedPropertyId(property: DbProperty): string {
    return property.id;
}

/**
 * ⭐ THE FIELD ON THE CHILD THAT POINTS BACK AT US — the thing that makes a
 * `oneToMany` editable from the parent instead of read-only.
 *
 * A `oneToMany` stores nothing on the parent: the id lives in ONE field on the
 * child. Find that field and the relation becomes writable from either end —
 * linking a child is `update(child, { <inverse>: parentId })` and unlinking is
 * the same write with `null`. Without it, all the parent side can do is explain
 * itself, which is what it used to do.
 *
 * ── HOW IT IS FOUND, IN ORDER ───────────────────────────────────────────────
 *
 *  1. **The shared property id.** Totalum gives both halves of one relation the
 *     same `id` (`user.session` and `session.user_id` are both `neMm6_d9px0o` —
 *     verified live, see `pairedPropertyId`). This is the only match that stays
 *     correct when two tables are related more than once.
 *  2. **The unique link back.** A relation the parent declares may have no
 *     declared half on the child; then the child's single `manyToOne`/`oneToOne`
 *     field pointing at the parent table is unambiguous and is used.
 *
 * ⚠️ AMBIGUITY RETURNS `null`, AND THE CALLER MUST TREAT THAT AS "NOT EDITABLE".
 * If the child points at the parent table through two fields and neither shares
 * our id, guessing means writing the parent's id into the wrong column — a
 * corrupted relation that looks like a successful save. The UI falls back to
 * explaining where the link lives, which is what it did for every relation
 * before this existed.
 *
 * ⚠️ IT MUST STORE ITS ID ON THE CHILD. A `manyToMany` half is rejected even
 * when it shares the id: Totalum owns a junction table there, and `updateRecord`
 * on such a field writes nothing at all.
 */
export function inverseLinkPropertyOf(
    property: DbProperty,
    childTable: DbTable | undefined,
    parentTable: DbTable | undefined
): DbProperty | null {
    if (!childTable?.properties) return null;

    const candidates = linkFieldsOf(childTable).filter(candidate =>
        storesIdOnRecord(relationOf(candidate))
    );

    // 1) The shared id — exact, and survives two relations between the same pair.
    const paired = candidates.find(candidate => candidate.id === property.id);
    if (paired) return paired;

    // 2) The only field pointing back at us.
    if (!parentTable) return null;
    const pointingBack = candidates.filter(candidate => {
        const target = candidate.objectReference?.objectReferenceTypeId;
        return target === parentTable._id || target === parentTable.type;
    });
    return pointingBack.length === 1 ? pointingBack[0] : null;
}

export interface RelatedView {
    /** The table on the other side. */
    table: DbTable;
    /** The property on THIS table that declares the relation, when it does. */
    ownProperty?: DbProperty;
    /** The property on the OTHER table that declares it, when it does. */
    foreignProperty?: DbProperty;
    relation: RelationKind;
    /**
     * The key to use when expanding this relation inside `queryOptions`.
     * For a link declared here it is our own property name; for one declared on
     * the other side it is that table's type.
     */
    expandKey: string;
}

/**
 * ⭐ EVERY RELATED TABLE, FROM EVERY DIRECTION — what turns a table viewer into a
 * CMS.
 *
 * A record's relations are not only the ones its own table declares. A `client`
 * with no link fields at all can still be the parent of a hundred `order` rows,
 * because `order` declares `client_id` as `manyToOne`. Showing only our own
 * fields would hide exactly the relationships people care about.
 *
 * Deduplicated on the shared property `id`, so a relation declared on both sides
 * (which is the normal case) appears once, with both halves attached.
 */
export function relatedViewsFor(tables: DbTable[], table: DbTable | undefined): RelatedView[] {
    if (!table) return [];

    const views = new Map<string, RelatedView>();

    // 1) Relations this table declares.
    for (const property of linkFieldsOf(table)) {
        const other = resolveLinkedTable(tables, property);
        const relation = relationOf(property);
        if (!other || !relation) continue;

        views.set(property.id, {
            table: other,
            ownProperty: property,
            relation,
            expandKey: property.name,
        });
    }

    // 2) Relations OTHER tables declare that point back at us.
    for (const other of tables) {
        if (other._id === table._id) continue;

        for (const property of linkFieldsOf(other)) {
            const target = resolveLinkedTable(tables, property);
            if (!target || target._id !== table._id) continue;

            const relation = relationOf(property);
            if (!relation) continue;

            const existing = views.get(property.id);
            if (existing) {
                // The same relation seen from the other end — enrich, don't duplicate.
                existing.foreignProperty = property;
                continue;
            }

            views.set(property.id, {
                table: other,
                foreignProperty: property,
                // Seen from here, a `manyToOne` on the child means we are its "one".
                relation: relation === "manyToOne" ? "oneToMany" : relation,
                expandKey: other.type,
            });
        }
    }

    return [...views.values()];
}

/**
 * ⭐ A HUMAN LABEL FOR A RECORD, never a raw id.
 *
 * "Pick an existing record" is unusable if the options read
 * `6a6ce62157721914df2d2955`. Preference order, first non-empty wins:
 *
 *  1. a field the schema marked `showInTree` — the closest thing Totalum has to
 *     "this is the display field";
 *  2. a conventionally-named field (`name`, `title`, `label`, `email`, …);
 *  3. the first plain string field that is not an id-looking value;
 *  4. the `_id`, clearly the last resort.
 */
const LABEL_FIELD_NAMES = ["name", "title", "label", "email", "handle", "slug", "description", "type"];

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function labelForRecord(
    table: DbTable | undefined,
    record: Record<string, unknown> | null | undefined
): string {
    if (!record) return "";

    const id = String(record._id ?? "");
    if (!table?.properties) return id;

    const asText = (value: unknown): string => {
        if (typeof value === "string") return value.trim();
        if (typeof value === "number") return String(value);
        return "";
    };

    const properties = Object.values(table.properties);

    // 1) The schema's own display hint.
    for (const property of properties) {
        if (!property.showInTree) continue;
        const text = asText(record[property.name]);
        if (text && !OBJECT_ID_RE.test(text)) return text;
    }

    // 2) Conventional names, in preference order.
    for (const candidate of LABEL_FIELD_NAMES) {
        const property = properties.find(p => p.name === candidate);
        if (!property) continue;
        const text = asText(record[property.name]);
        if (text && !OBJECT_ID_RE.test(text)) return text;
    }

    // 3) Any plain string field that does not look like an id.
    for (const property of properties) {
        if (property.propertyType !== "string" || SYSTEM_FIELDS.has(property.name)) continue;
        const text = asText(record[property.name]);
        if (text && !OBJECT_ID_RE.test(text)) return text;
    }

    // 4) Honest fallback.
    return id;
}

/** A short, stable label for a table. */
export function labelForTable(table: DbTable | undefined): string {
    if (!table) return "";
    return table.label || table.type;
}

/**
 * The id held by a `tableLink` value, whatever shape it arrived in.
 *
 * ⚠️ A relation field can come back as a bare id string OR as an EXPANDED record
 * object, depending on whether the query asked for it. Reading `.name` off a
 * string, or rendering an object as a value, are both real failure modes.
 */
export function linkedIdOf(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object" && !Array.isArray(value)) {
        const id = (value as Record<string, unknown>)._id;
        return id ? String(id) : null;
    }
    return null;
}

/** The ids held by a many-sided `tableLink` value. */
export function linkedIdsOf(value: unknown): string[] {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map(linkedIdOf).filter((id): id is string => Boolean(id));
}

/** One entry of a `tableLink` value: always an id, plus the record when expanded. */
export interface LinkedEntry {
    id: string;
    /** The expanded record, when the query asked for it. `null` for a bare id. */
    record: Record<string, unknown> | null;
}

/**
 * ⭐ THE LINKED RECORDS, NOT JUST THEIR IDS.
 *
 * ⚠️ `linkedIdsOf` THROWS THE RECORD AWAY, which is exactly what made a relation
 * column render `6a6ce62157721914df2d2955`. When the query expands the field the
 * whole record is sitting right there and `labelForRecord` can turn it into a
 * name — but only if something keeps hold of it. This is that something; the id
 * is kept alongside so an unexpanded value still works, just without a label.
 */
export function linkedEntriesOf(value: unknown): LinkedEntry[] {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];

    return list
        .map((entry): LinkedEntry | null => {
            const id = linkedIdOf(entry);
            if (!id) return null;
            const expanded =
                entry && typeof entry === "object" && !Array.isArray(entry)
                    ? (entry as Record<string, unknown>)
                    : null;
            return { id, record: expanded };
        })
        .filter((entry): entry is LinkedEntry => entry !== null);
}

/** A stored file value, in either of the two shapes Totalum uses. */
export interface StoredFile {
    name: string;
    url?: string;
    type?: string;
}

/**
 * Normalise a `file` / `multipleFile` value to a list.
 *
 * ⚠️ ON WRITE a file is `{ name }`; ON READ Totalum returns `{ name, url }`. A
 * single-file field is an object, a multiple-file field an array — but a
 * single-file value can arrive wrapped in an array too, so both are accepted.
 */
export function filesOf(value: unknown): StoredFile[] {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];

    return list
        .map((entry): StoredFile | null => {
            if (typeof entry === "string") return { name: entry };
            if (entry && typeof entry === "object") {
                const file = entry as Record<string, unknown>;
                if (!file.name) return null;
                return {
                    name: String(file.name),
                    url: file.url ? String(file.url) : undefined,
                    type: file.type ? String(file.type) : undefined,
                };
            }
            return null;
        })
        .filter((file): file is StoredFile => file !== null);
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "ico"];

export function isImageFile(file: StoredFile): boolean {
    if (file.type === "image") return true;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_EXTENSIONS.includes(extension);
}

/** A human file size. Base 1024, because that is what a file manager shows. */
export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
