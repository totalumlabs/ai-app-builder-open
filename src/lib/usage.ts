/**
 * A stable CSS colour for a usage type (the copied usage chart's series). The platform maps known types to its
 * `--data-N` tokens; this app has no such tokens, so every type hashes its own name onto a fixed palette — the same
 * name keeps the same colour across date ranges.
 */
const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d", "#c026d3", "#0d9488"];

export function colorForType(type: string): string {
    if (type === "other" || type === "uncategorized") return "#9ca3af";
    let hash = 0;
    for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
}
