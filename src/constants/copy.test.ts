import { afterEach, describe, expect, it } from "vitest";

import { applyLanguage, copy, en, type Translation } from "./copy";
import { languages } from "@/localization/languages";
import hi from "@/localization/hi";

/**
 * Deep structural parity between English and a translation table.
 *
 * The `Translation` type enforces this at compile time; this walk is the
 * runtime backstop (e.g. against a table leaking through `any`). It asserts,
 * at every level: identical key sets, consistent string/number/function kinds,
 * matching function arity, and equal array lengths so indexed lists (onboarding
 * slides, FAQ items) stay structurally parallel across languages.
 */
function assertParity(enValue: unknown, otherValue: unknown, path: string, failures: string[]) {
    const both = (kind: string) =>
        `${path}: expected ${kind} on both sides`;
    if (typeof enValue === "string") {
        if (typeof otherValue !== "string") failures.push(both("a string"));
        return;
    }
    if (typeof enValue === "number") {
        if (typeof otherValue !== "number") failures.push(both("a number"));
        return;
    }
    if (typeof enValue === "function") {
        if (typeof otherValue !== "function" || enValue.length !== otherValue.length) {
            failures.push(`${path}: function signature mismatch`);
        }
        return;
    }
    if (Array.isArray(enValue)) {
        if (!Array.isArray(otherValue) || enValue.length !== otherValue.length) {
            failures.push(`${path}: array length mismatch`);
            return;
        }
        enValue.forEach((item, index) => assertParity(item, otherValue[index], `${path}[${index}]`, failures));
        return;
    }
    if (enValue && typeof enValue === "object") {
        if (!otherValue || typeof otherValue !== "object" || Array.isArray(otherValue)) {
            failures.push(both("an object"));
            return;
        }
        const enKeys = Object.keys(enValue).sort();
        const otherKeys = Object.keys(otherValue).sort();
        if (enKeys.length !== otherKeys.length || enKeys.some((key, index) => key !== otherKeys[index])) {
            failures.push(`${path}: key sets differ (en: [${enKeys.join(", ")}] other: [${otherKeys.join(", ")}])`);
            return;
        }
        for (const key of enKeys) assertParity((enValue as Record<string, unknown>)[key], (otherValue as Record<string, unknown>)[key], `${path}.${key}`, failures);
        return;
    }
    failures.push(`${path}: unsupported kind ${typeof enValue}`);
}

describe("translation tables", () => {
    // Driven from the registry, so every shipped table — and every table added
    // later — is covered without touching this file.
    const shipped = (
        Object.entries(languages) as [string, { code: string; table?: Translation }][]
    ).filter(([, definition]) => definition.table !== undefined) as [
        string,
        { code: string; table: Translation },
    ][];

    it("finds the shipped tables and leaves English out of the walk", () => {
        expect(shipped.length).toBeGreaterThan(0);
        expect(shipped.map(([code]) => code)).not.toContain("en");
    });

    it("every shipped table has full structural parity with English", () => {
        const failures: string[] = [];
        for (const [code, definition] of shipped) {
            assertParity(en, definition.table, `copy(${code})`, failures);
        }
        expect(failures).toEqual([]);
    });

    it("every shipped table resolves to the canonical English shape", () => {
        // The compile-time contract: a Translation is assignable from each.
        for (const [, definition] of shipped) {
            const asTranslation: Translation = definition.table;
            expect(asTranslation.common.back).toBeTruthy();
        }
    });

    it("every shipped table's interpolated strings pass their arguments through", () => {
        // The parity walk above proves matching arity, not working bodies. A
        // function could accept the right number of arguments and still drop
        // them, so render each one and assert the argument survives.
        const failures: string[] = [];
        for (const [code, { table }] of shipped) {
            const cases: [string, string, string[]][] = [
                ["common.version", table.common.version("1.2.3"), ["1.2.3"]],
                ["mirror.greeting", table.mirror.greeting("Aarav"), ["Aarav"]],
                ["aiConversation.greeting", table.aiConversation.greeting("Aarav"), ["Aarav"]],
                ["you.memoriesCount", table.you.memoriesCount(2), ["2"]],
                ["memories.observationsCount", table.memories.observationsCount(3), ["3"]],
                ["patternDetail.confidenceValue", table.patternDetail.confidenceValue(72), ["72"]],
                ["patternDetail.evidenceLine", table.patternDetail.evidenceLine(4, 2), ["4", "2"]],
                ["learningDetail.evidenceLine", table.learningDetail.evidenceLine(3, 7), ["3", "7"]],
                ["experimentDetail.observationsMeta", table.experimentDetail.observationsMeta(5), ["5"]],
                ["connectedSources.syncedAgo", table.connectedSources.syncedAgo("2h"), ["2h"]],
            ];
            for (const [label, rendered, expected] of cases) {
                if (typeof rendered !== "string" || rendered.length === 0) {
                    failures.push(`${code}.${label}: rendered ${JSON.stringify(rendered)}`);
                    continue;
                }
                for (const fragment of expected) {
                    if (!rendered.includes(fragment)) {
                        failures.push(`${code}.${label}: ${JSON.stringify(rendered)} lost ${JSON.stringify(fragment)}`);
                    }
                }
            }
        }
        expect(failures).toEqual([]);
    });

    it("translates rather than passing English through", () => {
        const failures: string[] = [];
        for (const [code, { table }] of shipped) {
            for (const [label, english, translated] of [
                ["mirror.greeting", en.mirror.greeting("Aarav"), table.mirror.greeting("Aarav")],
                ["you.memoriesCount", en.you.memoriesCount(2), table.you.memoriesCount(2)],
                ["common.back", en.common.back, table.common.back],
                ["timeline.header", en.timeline.header, table.timeline.header],
            ] as [string, string, string][]) {
                if (translated === english) {
                    failures.push(`${code}.${label} still reads ${JSON.stringify(english)}`);
                }
            }
        }
        expect(failures).toEqual([]);
    });
});

describe("applyLanguage", () => {
    afterEach(() => {
        applyLanguage(en);
    });

    it("swaps static strings at runtime", () => {
        applyLanguage(hi);
        expect(copy.language.header).toBe("भाषा");
        expect(copy.settings.languageTitle).toBe("भाषा");
    });

    it("swaps interpolated functions at runtime", () => {
        applyLanguage(hi);
        expect(copy.common.version("1.2.3")).toBe("वर्शन 1.2.3");
        expect(copy.you.memoriesCount(2)).toBe("2 स्मृतियाँ");
    });

    it("restores English when re-applied", () => {
        applyLanguage(hi);
        applyLanguage(en);
        expect(copy.language.header).toBe("Language");
        expect(copy.common.version("1.2.3")).toBe("Version 1.2.3");
    });
});
