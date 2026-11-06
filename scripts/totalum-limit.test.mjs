// Unit test for src/lib/totalum-limit.ts — `npm test`. No test runner dependency:
// TypeScript (already a devDependency) strips the types, node:test runs it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/totalum-limit.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const lib = await import("data:text/javascript," + encodeURIComponent(outputText));

const URL_ = "https://www.totalum.app/whitelabel";

test("both limits link to the Totalum whitelabel page", () => {
    assert.equal(lib.TOTALUM_UPGRADE_URL, URL_);
});

test("INSUFFICIENT_CREDITS (402) and VCAAS_INSUFFICIENT_CREDITS (403) open the credits modal", () => {
    for (const upstreamCode of ["INSUFFICIENT_CREDITS", "VCAAS_INSUFFICIENT_CREDITS"]) {
        const limit = lib.totalumLimitOf({ ok: false, code: "INSUFFICIENT_CREDITS", upstreamCode });
        assert.deepEqual(limit, { kind: "credits" }, String(upstreamCode));
        const copy = lib.totalumLimitCopy(limit);
        assert.match(copy.description, /out of credits/);
        assert.match(copy.description, /Buy Totalum credits or upgrade the Totalum plan/);
    }
});

test("MAX_PROJECTS_REACHED opens the project-limit modal with the numbers", () => {
    const details = { maxProjects: 2, projectsUsed: 2, plan: "starter", upgradePlan: "pro" };
    const limit = lib.totalumLimitOf({ ok: false, code: "PROJECT_LIMIT_REACHED", upstreamCode: "MAX_PROJECTS_REACHED", details });
    assert.equal(limit.kind, "projects");
    const copy = lib.totalumLimitCopy(limit);
    assert.match(copy.description, /Upgrade the Totalum plan to have more projects/);
    assert.equal(copy.usage, "2 of 2 projects");
    assert.equal(lib.totalumLimitCopy({ kind: "projects" }).usage, null);
    assert.equal(lib.totalumLimitCopy({ kind: "projects", details: { maxProjects: "unlimited", projectsUsed: 3 } }).usage, null);
});

test("other refusals and successes open nothing", () => {
    assert.equal(lib.totalumLimitOf({ ok: true }), null);
    assert.equal(lib.totalumLimitOf(null), null);
    assert.equal(lib.totalumLimitOf({ ok: false, code: "INSUFFICIENT_CREDITS", upstreamCode: "PROJECT_CREDIT_LIMIT_REACHED" }), null);
    // An app's own credit gate (no upstream code) is not Totalum's: it keeps its own UI.
    assert.equal(lib.totalumLimitOf({ ok: false, code: "INSUFFICIENT_CREDITS" }), null);
    assert.equal(lib.totalumLimitOf({ ok: false, code: "PLAN_REQUIRED", upstreamCode: "PLAN_NOT_API" }), null);
    assert.equal(lib.totalumLimitOf({ ok: false, code: "RATE_LIMITED" }), null);
});

test("signalTotalumLimit dispatches the event the modal listens for", () => {
    const seen = [];
    globalThis.window = { dispatchEvent: (e) => seen.push(e) };
    globalThis.CustomEvent ??= class extends Event { constructor(t, i) { super(t); this.detail = i?.detail; } };
    lib.signalTotalumLimit({ ok: false, code: "PROJECT_LIMIT_REACHED", upstreamCode: "MAX_PROJECTS_REACHED", details: { maxProjects: 1, projectsUsed: 1 } });
    lib.signalTotalumLimit({ ok: true });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].type, lib.TOTALUM_LIMIT_EVENT);
    assert.equal(seen[0].detail.kind, "projects");
    delete globalThis.window;
});
