/**
 * Parse a pasted `.env` blob into secret entries.
 *
 * The "paste your .env" helper exists because the alternative — typing twelve
 * secrets into a form one at a time — is where people give up. It has to handle
 * what real `.env` files actually contain, not the tidy subset:
 *
 *   · `#` comments and blank lines
 *   · a leading `export ` (people paste straight from a shell script)
 *   · single, double and unquoted values
 *   · `=` inside the VALUE (`DATABASE_URL=postgres://u:p=x@host/db`)
 *   · `\n` escapes inside double quotes (private keys are pasted this way)
 *   · trailing inline comments after an UNQUOTED value only
 *
 * ⚠️ THE LAST TWO ARE WHERE NAIVE PARSERS CORRUPT SECRETS. Splitting on every `=`
 * truncates connection strings; stripping `#` inside a quoted value mangles any
 * password containing one. Both are silent — the secret is stored, just wrong, and
 * the app fails at runtime with no clue why.
 *
 * Pure module. Unit-tested by `src/lib/__tests__/plan.test.ts`.
 */

export interface ParsedEnvEntry {
    name: string;
    value: string;
}

/** VCaaS/`process.env` naming: a letter or `_` first, then letters/digits/`_`. */
export const SECRET_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidSecretName(name: string): boolean {
    return SECRET_NAME_REGEX.test(name);
}

export function parseEnv(text: string): { entries: ParsedEnvEntry[]; skipped: number } {
    const entries: ParsedEnvEntry[] = [];
    let skipped = 0;

    for (const rawLine of (text || "").split("\n")) {
        const line = rawLine.trim();

        if (!line || line.startsWith("#")) continue;

        // Split on the FIRST `=` only — everything after it is the value.
        const separator = line.indexOf("=");
        if (separator === -1) {
            skipped += 1;
            continue;
        }

        let name = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();

        // `export FOO=bar`
        if (name.startsWith("export ")) name = name.slice("export ".length).trim();

        if (!isValidSecretName(name)) {
            skipped += 1;
            continue;
        }

        const quote = value[0];
        if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
            value = value.slice(1, -1);
            // Only double quotes interpret escapes — matching dotenv, and matching how
            // multi-line private keys are pasted.
            if (quote === '"') {
                value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
            }
        } else {
            // UNQUOTED ONLY: strip a trailing inline comment. Doing this to a quoted
            // value would corrupt any password containing `#`.
            const comment = value.search(/\s+#/);
            if (comment !== -1) value = value.slice(0, comment).trim();
        }

        // A name with no value is almost always a template placeholder (`API_KEY=`)
        // rather than an intentional empty secret.
        if (value === "") {
            skipped += 1;
            continue;
        }

        entries.push({ name, value });
    }

    return { entries, skipped };
}
