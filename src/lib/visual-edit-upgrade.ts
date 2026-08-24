/**
 * ═══ GIVING AN EXISTING PROJECT THE EXACT TIER (Feature G5) ═════════════════
 *
 * New projects are generated from a template whose webpack config stamps every JSX
 * element with `data-tlm-loc="file:line:col"`, and for those the visual editor never
 * has to infer anything. Projects created before that shipped carry their own copy of
 * `next.config.ts` and would stay on structural matching forever.
 *
 * This installs the loader into one of those projects: two files, written through the
 * same endpoint every visual edit already uses, picked up by the rebuild that the apply
 * was going to run anyway. From the next apply onwards, that project resolves exactly.
 *
 * ── THE RULES IT FOLLOWS, AND WHY EACH ONE IS THERE ─────────────────────────
 *
 * ⚠️⚠️ IT REFUSES ANY CONFIG IT DOES NOT RECOGNISE. Patching a build config is the one
 * change here that can take an app off the air, and a `next.config.ts` the user (or the
 * agent) has rewritten is not something to pattern-match hopefully. The shape has to be
 * the template's own `webpack: (config, { dev }) => {`; anything else is skipped and
 * reported, and the editor carries on inferring exactly as before.
 *
 * ⚠️⚠️ THE LOADER FILE IS WRITTEN FIRST, AND THE CONFIG ONLY IF THAT SUCCEEDED. The
 * failure to avoid is a config that points at a loader which is not there — that is not
 * a degraded editor, it is a build that cannot run at all.
 *
 * ⚠️ IT IS IDEMPOTENT. Both writes are skipped when the project already has them, so a
 * retry, a second apply or a concurrent session cannot double-patch a file.
 *
 * ⚠️ IT IS NEVER REQUIRED. Every failure path returns a status and nothing else; the
 * apply that triggered it does not fail, does not warn the user, and does not retry.
 */

/**
 * The loader, as it will be written into the project.
 *
 * ⚠️⚠️ THIS IS A SECOND COPY OF `nextjs-startum-template/scripts/totalum-source-tags.js`
 * AND THE TWO MUST AGREE. It cannot be imported: the template is a different repository
 * that is not present at runtime, and the file has to travel to the sandbox as text.
 * The contract it implements — anchor on the `<`, 1-based line and column, relative
 * POSIX path — is what `findByLoc` looks elements up by, so a divergence would silently
 * demote every project it touches back to the inference tier.
 */
export const SOURCE_TAG_LOADER = `/**
 * Stamps every JSX element in src/ with data-tlm-loc="file:line:col".
 *
 * Installed by the Totalum visual editor so it can edit the exact element you clicked
 * instead of inferring it from classes and text. It only ADDS a data-* attribute:
 * nothing is removed, reordered or rewritten, and a file that fails to parse is
 * returned untouched. Set TOTALUM_SOURCE_TAGS=0 to disable it (the Cloudflare deploy
 * build does, so a published app carries no file paths).
 *
 * Canonical copy: nextjs-startum-template/scripts/totalum-source-tags.js
 */
const path = require("path");

const NOT_DOM = new Set(["Fragment", "React.Fragment", "Suspense", "StrictMode", "Profiler", "ErrorBoundary"]);

function isTaggable(name) {
    if (!name) return false;
    if (NOT_DOM.has(name)) return false;
    if (/Provider$/.test(name) || /Context$/.test(name)) return false;
    return true;
}

module.exports = function totalumSourceTags(source) {
    if (process.env.TOTALUM_SOURCE_TAGS === "0") return source;

    let ts;
    try {
        ts = require("typescript");
    } catch (error) {
        return source;
    }

    const resourcePath = this.resourcePath || "";
    if (resourcePath.includes("node_modules")) return source;
    if (!/\\.(tsx|jsx)$/.test(resourcePath)) return source;
    if (source.indexOf("<") === -1) return source;

    const relative = path
        .relative(this.rootContext || process.cwd(), resourcePath)
        .split(path.sep)
        .join("/");

    let sourceFile;
    try {
        sourceFile = ts.createSourceFile(resourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    } catch (error) {
        return source;
    }

    const insertions = [];

    const visit = node => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const name = node.tagName.getText(sourceFile);
            const alreadyTagged = node.attributes.properties.some(
                property =>
                    ts.isJsxAttribute(property) &&
                    property.name &&
                    property.name.getText(sourceFile) === "data-tlm-loc"
            );
            if (isTaggable(name) && !alreadyTagged) {
                const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                insertions.push({
                    at: node.tagName.end,
                    text: ' data-tlm-loc="' + relative + ':' + (position.line + 1) + ':' + (position.character + 1) + '"',
                });
            }
        }
        ts.forEachChild(node, visit);
    };

    try {
        visit(sourceFile);
    } catch (error) {
        return source;
    }

    if (insertions.length === 0) return source;

    insertions.sort((a, b) => b.at - a.at);
    let output = source;
    for (const insertion of insertions) {
        output = output.slice(0, insertion.at) + insertion.text + output.slice(insertion.at);
    }
    return output;
};
`;

export const LOADER_PATH = "scripts/totalum-source-tags.js";

/** The marker that says a config has already been patched. Also the loader's filename. */
const CONFIG_MARKER = "totalum-source-tags";

/**
 * The rule, written to be independent of the config's import block.
 *
 * ⚠️ `require("path")` RATHER THAN AN `import`. Adding an import means editing the top
 * of someone's file as well as the middle, and two edits are two chances to corrupt it.
 * Next compiles `next.config.ts` in a CommonJS-capable context — the template's own file
 * already calls `require("@opennextjs/cloudflare")` at module level — so this works
 * as-is in `.ts` and `.js` configs alike.
 */
const CONFIG_RULE = `
    // ⭐ Totalum visual editor — stamps every JSX element with its source location so
    // edits made in the preview land on the exact element you clicked.
    // See scripts/totalum-source-tags.js. Disable with TOTALUM_SOURCE_TAGS=0.
    config.module.rules.push({
      test: /\\.(tsx|jsx)$/,
      include: require("path").join(process.cwd(), "src"),
      exclude: /node_modules/,
      enforce: "pre",
      use: [{ loader: require("path").join(process.cwd(), "scripts", "totalum-source-tags.js") }],
    });
`;

/**
 * The config shapes we are willing to touch.
 *
 * ⚠️ ANCHORED ON THE OPENING BRACE OF THE `webpack` HOOK, so the rule is inserted as its
 * first statement — before any early `return config` a project may have added.
 */
const WEBPACK_ANCHORS = [
    "webpack: (config, { dev }) => {",
    "webpack: (config, { dev, isServer }) => {",
    "webpack: (config) => {",
    "webpack: config => {",
];

export type UpgradeStatus =
    | "installed"
    | "already-installed"
    | "no-config"
    | "unknown-config"
    | "loader-write-failed"
    | "config-write-failed";

export interface UpgradeIo {
    /** Returns the file's contents, or `null` when it does not exist / cannot be read. */
    read(path: string): Promise<string | null>;
    /** Returns `true` only when the write is known to have stored exactly what was sent. */
    write(path: string, content: string): Promise<boolean>;
}

/**
 * Work out the patched config without writing anything — the half worth unit-testing.
 */
export type ConfigPatch = { ok: true; content: string } | { ok: false; reason: UpgradeStatus };

/**
 * ⚠️ A NARROWING HELPER, because this repo compiles with `strictNullChecks: false` —
 * under which TypeScript will not narrow a union on a boolean-literal discriminant.
 * `bridgeFailed` and `isUnsafe` exist elsewhere for exactly the same reason.
 */
function patchFailed(patch: ConfigPatch): patch is { ok: false; reason: UpgradeStatus } {
    return patch.ok === false;
}

export function patchNextConfig(content: string): ConfigPatch {
    if (content.includes(CONFIG_MARKER)) return { ok: false, reason: "already-installed" };

    const anchor = WEBPACK_ANCHORS.find(candidate => content.includes(candidate));
    if (!anchor) return { ok: false, reason: "unknown-config" };

    const at = content.indexOf(anchor) + anchor.length;
    return { ok: true, content: content.slice(0, at) + CONFIG_RULE + content.slice(at) };
}

const CONFIG_PATHS = ["next.config.ts", "next.config.js"];

export async function installSourceTags(io: UpgradeIo): Promise<{ status: UpgradeStatus; configPath?: string }> {
    for (const configPath of CONFIG_PATHS) {
        const config = await io.read(configPath);
        if (config === null) continue;

        const patched = patchNextConfig(config);

        if (patchFailed(patched) && patched.reason === "already-installed") {
            /**
             * The config points at the loader. Make sure the loader is actually there —
             * a config referencing a missing file is a build that cannot start, and this
             * is the one state worth repairing rather than reporting.
             */
            const loader = await io.read(LOADER_PATH);
            if (loader === null) {
                const wrote = await io.write(LOADER_PATH, SOURCE_TAG_LOADER);
                return { status: wrote ? "installed" : "loader-write-failed", configPath };
            }
            return { status: "already-installed", configPath };
        }

        if (patchFailed(patched)) return { status: patched.reason, configPath };

        // ⚠️ THE LOADER FIRST, ALWAYS. See the note at the top of this file.
        const existing = await io.read(LOADER_PATH);
        if (existing === null && !(await io.write(LOADER_PATH, SOURCE_TAG_LOADER))) {
            return { status: "loader-write-failed", configPath };
        }

        const wroteConfig = await io.write(configPath, patched.content);
        return { status: wroteConfig ? "installed" : "config-write-failed", configPath };
    }

    return { status: "no-config" };
}
