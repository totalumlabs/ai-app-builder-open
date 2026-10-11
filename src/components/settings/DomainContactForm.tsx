"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLocale, useT } from "@/i18n";
import {
    DIAL_CODE,
    canonicalContact,
    countryOptions,
    joinPhone,
    normalizePhone,
    sameContact,
    splitPhone,
    type Contact,
} from "@/lib/domain-contact";
import { vcaasApi } from "@/lib/vcaas";

const TEXT_FIELDS = ["firstName", "lastName", "email", "address1", "city", "zip"] as const;

/**
 * The registrant contact of a domain purchase (Settings → Domains and the project's "Buy a new domain"): the country
 * from a searchable list of every country in the reader's language (the ISO code is what is sent), the phone as a
 * calling-code picker that follows the country plus the number, normalised on blur. Pre-filled with the account's
 * saved contact when there is one, and always editable.
 */
export function DomainContactForm({ value, onChange, saved }: { value: Contact; onChange: (next: Contact) => void; saved: boolean }) {
    const t = useT();
    const { locale } = useLocale();
    const countries = React.useMemo(() => countryOptions(locale), [locale]);
    const dialOptions = React.useMemo(
        () => countries.map(country => ({ value: country.value, label: `+${DIAL_CODE[country.value]}`, hint: country.label })),
        [countries]
    );
    const { dial, national } = splitPhone(value.phone, value.country);
    const set = (patch: Partial<Contact>) => onChange({ ...value, ...patch });

    return (
        <div className="grid gap-2 sm:grid-cols-2" data-testid="domain-contact-form">
            <p className="text-muted-foreground text-xs sm:col-span-2">{t(saved ? "engineV2.domains.contactSaved" : "engineV2.domains.contactHint")}</p>
            {TEXT_FIELDS.map(field => (
                <Input
                    key={field}
                    aria-label={t(`engineV2.domains.contact_${field}`)}
                    placeholder={t(`engineV2.domains.contact_${field}`)}
                    value={value[field]}
                    onChange={event => set({ [field]: event.target.value })}
                />
            ))}
            <SearchableSelect
                value={value.country}
                onValueChange={country =>
                    // the calling code follows the country while no number is typed
                    set(national.trim() ? { country } : { country, phone: DIAL_CODE[country] ? `+${DIAL_CODE[country]} ` : "" })
                }
                options={countries}
                placeholder={t("engineV2.domains.contact_country")}
                searchPlaceholder={t("engineV2.domains.countrySearch")}
                ariaLabel={t("engineV2.domains.contact_country")}
                className="w-full sm:col-span-2"
            />
            <div className="flex gap-2 sm:col-span-2">
                <SearchableSelect
                    value={dial}
                    onValueChange={next => set({ phone: joinPhone(next, national) })}
                    options={dialOptions}
                    placeholder="+"
                    searchPlaceholder={t("engineV2.domains.countrySearch")}
                    ariaLabel={t("engineV2.domains.phoneCode")}
                    className="w-24 shrink-0"
                    contentClassName="w-[min(18rem,calc(100vw-2rem))]"
                    renderOption={option => (
                        <span className="flex justify-between gap-2">
                            <span className="truncate">{option.hint}</span>
                            <span className="text-muted-foreground tabular-nums">{option.label}</span>
                        </span>
                    )}
                />
                <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-label={t("engineV2.domains.contact_phone")}
                    placeholder={t("engineV2.domains.contact_phone")}
                    value={national}
                    onChange={event => set({ phone: joinPhone(dial, event.target.value) })}
                    onBlur={() => value.phone && set({ phone: normalizePhone(value.phone) })}
                />
            </div>
            <p className="text-muted-foreground text-2xs sm:col-span-2">{t("engineV2.domains.phoneHint")}</p>
        </div>
    );
}

export type SavedContact = { id: string; contact: Contact };

/**
 * The registrant id for a purchase: the saved one when the form still holds it, else a new saved contact (an edit is
 * a new contact, so the WHOIS data and the transfer lock of the domains already registered with the old one stay).
 */
export async function registrantFor(saved: SavedContact | null, contact: Contact): Promise<{ saved: SavedContact } | { error: string | undefined }> {
    if (saved && sameContact(saved.contact, contact)) return { saved };
    const canonical = canonicalContact(contact);
    const created = await vcaasApi.v2.createDomainContact(canonical);
    if (!created.ok || !created.data?.id) return { error: created.error };
    return { saved: { id: created.data.id, contact: canonical } };
}
