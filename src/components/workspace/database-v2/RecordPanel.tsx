"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import {
    fieldKind,
    fromInput,
    inlineSql,
    insertStatement,
    isRequired,
    keyColumns,
    newRowInputs,
    toInput,
    updateStatement,
    type Column,
    type ParseError,
    type SqlValue,
    type Statement,
} from "@/lib/db-v2-form";
import { cn } from "@/lib/utils";
import { vcaasApi } from "@/lib/vcaas";
import type { DbEnv, SqlTable } from "@/lib/vcaas-types";
import { ENV_THEME, envLabel } from "./env-theme";
import type { useRowWriter } from "./TableDataView";

const DISPLAY_GUESS = ["name", "title", "email", "label", "username", "slug"];

/** A foreign key as a searchable pick-list of the parent table (first 200 rows; any id can still be pasted). */
function ForeignKeyPicker({ projectId, env, parent, toColumn, value, onChange, id }: { projectId: string; env: DbEnv; parent: SqlTable | undefined; toColumn: string; value: string; onChange: (v: string) => void; id: string }) {
    const t = useT();
    const [options, setOptions] = React.useState<{ value: string; label: string; hint?: string }[]>([]);
    React.useEffect(() => {
        if (!parent) return;
        const display = parent.ui?.displayColumn ?? DISPLAY_GUESS.find(name => parent.columns.some(c => c.name === name));
        void vcaasApi.v2.rows(projectId, { env, table: parent.name, page: { limit: 200 } }).then(response => {
            if (!response.ok) return;
            setOptions(
                response.data.rows.map(row => {
                    const key = String(row[toColumn] ?? "");
                    return { value: key, label: display && row[display] != null ? String(row[display]) : key, hint: display ? key : undefined };
                }),
            );
        });
    }, [projectId, env, parent, toColumn]);
    return (
        <SearchableSelect
            id={id}
            value={value}
            onValueChange={onChange}
            options={options}
            placeholder={t("engineV2.database.fkPlaceholder", { table: parent?.label || parent?.name || "" })}
            searchPlaceholder={t("engineV2.database.fkSearch")}
            allowRawValue
            className="w-full"
        />
    );
}

/**
 * The row editor (a side panel): one typed input per column — text, number, a toggle for booleans, date and time
 * pickers, JSON, a pick-list for foreign keys and CHECK options — validated before anything is sent, with the exact
 * SQL shown. A new row sends every filled column; an edit sends only the columns the user changed, matched on the
 * row's key (every column of a composite key).
 */
export function RecordPanel({
    projectId,
    env,
    table,
    tables,
    row,
    sample,
    writer,
    onClose,
    onSaved,
    onDelete,
}: {
    projectId: string;
    env: DbEnv;
    table: SqlTable;
    tables: SqlTable[];
    row: Record<string, unknown> | null;
    /** SP7: a row already in the table, so a new row's INTEGER timestamps take the table's unit. */
    sample?: Record<string, unknown>;
    writer: ReturnType<typeof useRowWriter>;
    onClose: () => void;
    onSaved: () => void;
    onDelete: (row: Record<string, unknown>) => void;
}) {
    const t = useT();
    const theme = ENV_THEME[env];
    const keys = keyColumns(table);
    const tableName = table.label || table.name;
    const [inputs, setInputs] = React.useState<Record<string, string | boolean>>(() =>
        row ? Object.fromEntries(table.columns.map(c => [c.name, toInput(c, row[c.name])])) : newRowInputs(table),
    );
    const [dirty, setDirty] = React.useState<Set<string>>(new Set());
    const [showErrors, setShowErrors] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const { setError } = writer;

    React.useEffect(() => setError(null), [setError]);

    const set = (name: string, value: string | boolean) => {
        setInputs(current => ({ ...current, [name]: value }));
        setDirty(current => new Set(current).add(name));
    };

    // Parse every column that will be sent; the errors show under their fields.
    const errors: Record<string, ParseError> = {};
    const values: Record<string, SqlValue> = {};
    for (const column of table.columns) {
        const input = inputs[column.name] ?? "";
        if (row ? !dirty.has(column.name) : input === "" && !isRequired(column)) continue;
        const parsed = fromInput(column, input, row ? row[column.name] : sample?.[column.name]);
        if (parsed.ok) values[column.name] = parsed.value;
        else if ("error" in parsed) errors[column.name] = parsed.error;
    }
    const valid = Object.keys(errors).length === 0;
    const statement: Statement | null = row
        ? Object.keys(values).length
            ? updateStatement(table.name, keys, row, values)
            : null
        : insertStatement(table.name, values);

    const save = async () => {
        setShowErrors(true);
        if (!valid || !statement) return;
        setSaving(true);
        await writer.write(
            {
                statements: [statement],
                title: t(row ? "engineV2.database.liveSaveEditTitle" : "engineV2.database.liveSaveNewTitle", { table: tableName }),
                confirmLabel: t("engineV2.database.saveLive"),
                onDone: () => {
                    toast.success(t("engineV2.database.saved"));
                    onSaved();
                    onClose();
                },
            },
            false,
        );
        setSaving(false);
    };

    const field = (column: Column) => {
        const kind = fieldKind(column);
        const id = `field-${column.name}`;
        const value = inputs[column.name] ?? "";
        const locked = !!row && keys.includes(column.name);
        const error = showErrors ? errors[column.name] : undefined;
        const fk = table.foreignKeys.find(f => f.column === column.name);
        // An empty field of a defaulted column is left out of an insert, so say what the database will put there.
        const placeholder = column.default !== null && !row ? t("engineV2.database.defaultValue", { value: column.default.replace(/^'(.*)'$/, "$1") }) : column.notNull ? undefined : t("engineV2.database.empty");
        const common = { id, disabled: locked, "aria-invalid": !!error || undefined };
        let control: React.ReactNode;
        if (kind === "boolean") {
            control = <Switch id={id} disabled={locked} checked={value === true} onCheckedChange={checked => set(column.name, checked)} />;
        } else if (kind === "relation" && fk && !locked) {
            control = <ForeignKeyPicker id={id} projectId={projectId} env={env} parent={tables.find(x => x.name === fk.table)} toColumn={fk.toColumn} value={String(value)} onChange={v => set(column.name, v)} />;
        } else if (kind === "options" && column.options) {
            control = (
                <select {...common} className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={String(value)} onChange={e => set(column.name, e.target.value)}>
                    <option value="">{column.notNull ? "—" : t("engineV2.database.empty")}</option>
                    {column.options.map(option => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            );
        } else if (kind === "long" || kind === "json") {
            control = (
                <Textarea
                    {...common}
                    rows={kind === "json" ? 5 : 3}
                    spellCheck={kind !== "json"}
                    className={cn(kind === "json" && "font-mono text-xs")}
                    value={String(value)}
                    placeholder={placeholder}
                    onChange={e => set(column.name, e.target.value)}
                />
            );
        } else {
            const type = kind === "integer" || kind === "number" ? "number" : kind === "date" ? "date" : kind === "datetime" ? "datetime-local" : "text";
            control = (
                <Input
                    {...common}
                    type={type}
                    step={kind === "integer" ? 1 : kind === "number" ? "any" : undefined}
                    value={String(value)}
                    placeholder={placeholder}
                    onChange={e => set(column.name, e.target.value)}
                />
            );
        }
        return (
            <div key={column.name} className="space-y-1">
                <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium">
                    {column.label || column.name}
                    {isRequired(column) && !locked ? <span className="text-destructive" aria-label={t("engineV2.database.required")}>*</span> : null}
                    <span className="text-muted-foreground ml-auto font-mono text-[11px] font-normal">
                        {column.name} · {fk ? `→ ${fk.table}` : column.sqlType.toLowerCase() || kind}
                    </span>
                </label>
                {control}
                {error ? <p className="text-destructive text-xs">{t(`engineV2.database.form.${error}`)}</p> : null}
            </div>
        );
    };

    return (
        <Sheet open onOpenChange={open => !open && onClose()}>
            <SheetContent side="right" className={cn("w-full gap-0 border-l-2 p-0 sm:max-w-lg", theme.frame)} data-testid="record-panel">
                <SheetHeader className="border-border border-b">
                    <div className="flex items-center gap-2 pr-6">
                        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", theme.selected)}>{envLabel(env)}</span>
                        <SheetTitle>{t(row ? "engineV2.database.editRowTitle" : "engineV2.database.newRowTitle", { table: tableName })}</SheetTitle>
                    </div>
                    <SheetDescription>{t("engineV2.database.formHint")}</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{table.columns.map(field)}</div>
                <SheetFooter className="border-border gap-3 border-t">
                    {statement ? (
                        <details className="text-xs" open>
                            <summary className="text-muted-foreground cursor-pointer">{t("engineV2.database.sqlToRun")}</summary>
                            <pre className="bg-muted mt-1 max-h-32 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap" data-testid="record-sql">
                                {inlineSql(statement)}
                            </pre>
                        </details>
                    ) : null}
                    {writer.error ? <pre className="text-destructive bg-destructive-subtle rounded p-2 font-mono text-xs whitespace-pre-wrap">{writer.error}</pre> : null}
                    <div className="flex items-center gap-2">
                        {row ? (
                            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(row)}>
                                <Trash2Icon className="size-4" aria-hidden />
                                {t("engineV2.database.deleteRow")}
                            </Button>
                        ) : null}
                        <Button variant="outline" className="ml-auto" onClick={onClose}>
                            {t("common.cancel")}
                        </Button>
                        <Button className={theme.button} disabled={saving || !statement || (showErrors && !valid)} onClick={() => void save()}>
                            {env === "live" ? t("engineV2.database.saveLive") : t("engineV2.database.save")}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
