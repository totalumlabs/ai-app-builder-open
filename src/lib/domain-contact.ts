/**
 * The registrant (WHOIS) contact of a domain purchase, as the form edits it (Francesc 2026-10-07: "United States" and
 * "+34 644479777" were refused). The API (contracts `DomainContact`) takes the ISO 3166-1 alpha-2 country in any case
 * and an international phone it normalises the same way as `normalizePhone`; the form sends both already canonical.
 */

export const CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "address1", "city", "zip", "country"] as const;
export type Contact = Record<(typeof CONTACT_FIELDS)[number], string>;
export const EMPTY_CONTACT = Object.fromEntries(CONTACT_FIELDS.map(field => [field, ""])) as Contact;

/** Every ISO 3166-1 alpha-2 country with its international calling code (ITU-T E.164). */
const DIAL_CODES =
    "AD376 AE971 AF93 AG1 AI1 AL355 AM374 AO244 AR54 AS1 AT43 AU61 AW297 AX358 AZ994 BA387 BB1 BD880 BE32 BF226 BG359 " +
    "BH973 BI257 BJ229 BL590 BM1 BN673 BO591 BQ599 BR55 BS1 BT975 BW267 BY375 BZ501 CA1 CC61 CD243 CF236 CG242 CH41 " +
    "CI225 CK682 CL56 CM237 CN86 CO57 CR506 CU53 CV238 CW599 CX61 CY357 CZ420 DE49 DJ253 DK45 DM1 DO1 DZ213 EC593 EE372 " +
    "EG20 EH212 ER291 ES34 ET251 FI358 FJ679 FK500 FM691 FO298 FR33 GA241 GB44 GD1 GE995 GF594 GG44 GH233 GI350 GL299 " +
    "GM220 GN224 GP590 GQ240 GR30 GT502 GU1 GW245 GY592 HK852 HN504 HR385 HT509 HU36 ID62 IE353 IL972 IM44 IN91 IO246 " +
    "IQ964 IR98 IS354 IT39 JE44 JM1 JO962 JP81 KE254 KG996 KH855 KI686 KM269 KN1 KP850 KR82 KW965 KY1 KZ7 LA856 LB961 " +
    "LC1 LI423 LK94 LR231 LS266 LT370 LU352 LV371 LY218 MA212 MC377 MD373 ME382 MF590 MG261 MH692 MK389 ML223 MM95 " +
    "MN976 MO853 MP1 MQ596 MR222 MS1 MT356 MU230 MV960 MW265 MX52 MY60 MZ258 NA264 NC687 NE227 NF672 NG234 NI505 NL31 " +
    "NO47 NP977 NR674 NU683 NZ64 OM968 PA507 PE51 PF689 PG675 PH63 PK92 PL48 PM508 PR1 PS970 PT351 PW680 PY595 QA974 " +
    "RE262 RO40 RS381 RU7 RW250 SA966 SB677 SC248 SD249 SE46 SG65 SH290 SI386 SJ47 SK421 SL232 SM378 SN221 SO252 SR597 " +
    "SS211 ST239 SV503 SX1 SY963 SZ268 TC1 TD235 TG228 TH66 TJ992 TK690 TL670 TM993 TN216 TO676 TR90 TT1 TV688 TW886 " +
    "TZ255 UA380 UG256 US1 UY598 UZ998 VA39 VC1 VE58 VG1 VI1 VN84 VU678 WF681 WS685 YE967 YT262 ZA27 ZM260 ZW263";
export const DIAL_CODE: Readonly<Record<string, string>> = Object.fromEntries(
    DIAL_CODES.split(" ").map(entry => [entry.slice(0, 2), entry.slice(2)])
);
export const COUNTRY_CODES = Object.keys(DIAL_CODE);

/** The countries in the reader's language, sorted by name; `value` is the ISO code the API takes. */
/** Shown first, in this order, in every country picker; the rest follow alphabetically. */
export const COMMON_COUNTRIES = ["US", "GB", "CA", "ES", "FR", "DE", "IT", "MX", "AU", "NL", "PT", "BR"];

/** `codes` as searchable options in the reader's language: the common countries first, then A–Z. */
export function countryOptions(
    locale: string,
    codes: readonly string[] = COUNTRY_CODES
): { value: string; label: string; hint: string }[] {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const rank = (code: string) => {
        const i = COMMON_COUNTRIES.indexOf(code);
        return i < 0 ? COMMON_COUNTRIES.length : i;
    };
    return codes
        .map(code => ({ value: code, label: names.of(code) ?? code, hint: code }))
        .sort((a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label, locale));
}

/** A phone as people type it → E.164: spaces, dashes, dots and parentheses removed, a `00` prefix read as `+`. */
export function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-.()]/g, "").replace(/^00/, "+");
}
export const isE164 = (phone: string) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(phone));

/**
 * The phone split for the calling-code picker: the country whose code starts it (the chosen country first, so "+1" is
 * the US for a US contact and Canada for a Canadian one) and the rest as typed. An empty phone takes the country's code.
 */
export function splitPhone(phone: string, country: string): { dial: string; national: string } {
    const typed = phone.trimStart().replace(/^00/, "+");
    if (!typed) return { dial: DIAL_CODE[country] ? country : "", national: "" };
    const digits = normalizePhone(typed);
    const starts = (code: string) => digits.startsWith(`+${DIAL_CODE[code]}`);
    const dial = DIAL_CODE[country] && starts(country) ? country : COUNTRY_CODES.filter(starts).sort((a, b) => DIAL_CODE[b].length - DIAL_CODE[a].length)[0];
    if (!dial) return { dial: "", national: typed };
    // drop "+<code>" from what was typed, keeping the user's own spacing in the rest
    let seen = 0;
    let cut = 0;
    while (cut < typed.length && seen < DIAL_CODE[dial].length + 1) if (/[+\d]/.test(typed[cut++])) seen++;
    return { dial, national: typed.slice(cut).trimStart() };
}
export function joinPhone(dial: string, national: string): string {
    if (national.trim().startsWith("+") || national.trim().startsWith("00") || !DIAL_CODE[dial]) return national;
    return `+${DIAL_CODE[dial]} ${national}`;
}

/** The contact sent to the API: trimmed, the country uppercase, the phone E.164. */
export function canonicalContact(contact: Contact): Contact {
    const out = Object.fromEntries(CONTACT_FIELDS.map(field => [field, contact[field].trim()])) as Contact;
    return { ...out, country: out.country.toUpperCase(), phone: normalizePhone(out.phone) };
}
export const contactComplete = (contact: Contact) =>
    CONTACT_FIELDS.every(field => contact[field].trim()) && !!DIAL_CODE[contact.country.trim().toUpperCase()] && isE164(contact.phone);
export const sameContact = (a: Contact, b: Contact) => {
    const [x, y] = [canonicalContact(a), canonicalContact(b)];
    return CONTACT_FIELDS.every(field => x[field] === y[field]);
};

/**
 * The account's most recent saved registrant (`GET /domains/contacts` answers the owner's own, decrypted), to pre-fill
 * the form on the next purchase, e.g. after a failed payment. Never another account's: the API scopes the list.
 */
export function latestSavedContact(data: unknown): { id: string; contact: Contact } | null {
    const list = Array.isArray(data) ? data : (data as { contacts?: unknown[] } | null)?.contacts;
    const last = Array.isArray(list) ? (list[list.length - 1] as { id?: string; contact?: Partial<Contact> } | undefined) : undefined;
    if (!last?.id) return null;
    const contact = Object.fromEntries(CONTACT_FIELDS.map(field => [field, String(last.contact?.[field] ?? "")])) as Contact;
    return { id: last.id, contact };
}

/** A registry promo (cheap the first year, renewing far higher) must never surprise: the renewal is then spelled out. */
export const renewsAtAnotherPrice = (result: { price: number; renewalPrice: number }) =>
    Math.abs(result.price - result.renewalPrice) >= 0.005;
/** A search result's price line: "€3.59 first year, then €91.19/year", or "€12.99/year" when both prices are the same. */
export const priceLineKey = (result: { price: number; renewalPrice: number }) =>
    renewsAtAnotherPrice(result) ? ("engineV2.domains.priceFirstYear" as const) : ("engineV2.domains.pricePerYear" as const);
