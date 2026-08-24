/**
 * English dictionary — the SOURCE OF TRUTH for the shape of every dictionary.
 *
 * Rules for every phase:
 *  · Every user-visible string lives here. No hardcoded copy in components.
 *  · Add the key here first, then add it to `es.ts` — `es.ts` is typed as
 *    `Dictionary`, so a missing or misspelled key fails `check-types-errors`.
 *  · Interpolation uses `{name}` placeholders: t("x", { name: "Ada" }).
 *  · Keep the nesting shallow and grouped by surface (nav, auth, projects, …).
 */

export const en = {
  brand: {
    name: "Totalum",
    product: "Totalum Platform",
    tagline: "Describe your app. Watch it get built.",
  },

  common: {
    loading: "Loading…",
    retry: "Try again",
    /* The way off a page that will not load. See `ErrorState.secondaryHref`. */
    goBack: "Go back",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    delete: "Delete",
    deleting: "Deleting…",
    close: "Close",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Could not copy to clipboard",
    copyToClipboard: "Copy to clipboard",
    search: "Search",
    /**
     * ⚠️ `SearchableSelect` caps how many rows it renders (see `option-search.ts`),
     * so a search that matched thousands and shows fifty must SAY so. Without this
     * line it looks identical to one that matched exactly fifty.
     */
    noResults: "Nothing matches",
    moreResults: "…and {count} more — keep typing to narrow it down",
    back: "Back",
    next: "Next",
    previous: "Previous",
    optional: "Optional",
    required: "Required",
    yes: "Yes",
    no: "No",
    dismiss: "Dismiss",
    learnMore: "Learn more",
    refresh: "Refresh",
    openInNewTab: "Open in a new tab",
    somethingWentWrong: "Something went wrong",
    unexpectedError: "An unexpected error occurred. Please try again.",
    loadFailed: "We couldn't load this",
    loadFailedDescription: "The request didn't go through. Check your connection and try again.",
    typeToConfirm: "Type {value} to confirm",
    comingSoon: "Coming soon",
    inProgressTitle: "We're building this",
    inProgressDescription: "This section isn't ready yet. It will light up shortly.",
    credits: "credits",
    goToProjects: "Go to projects",
  },

  nav: {
    projects: "Projects",
    projectsHint: "Your apps",
    api: "API",
    apiHint: "Keys and reference",
    mcp: "MCP",
    mcpHint: "Connect your editor",
    whitelabel: "Whitelabel",
    whitelabelHint: "Embed it in your product",
    support: "Support chat",
    supportHint: "Talk to us",
    usage: "Usage",
    usageHint: "Credit analytics",
    billing: "Billing",
    billingHint: "Plan and credits",
    settings: "Settings",
    settingsHint: "Profile and preferences",
    designSystem: "Design system",
    mainNavigation: "Main navigation",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    skipToContent: "Skip to content",
    /* The aside's recent-projects list. Deliberately the same wording as
       `workspace.menu.recentProjects` — it is the same list in a second place. */
    recentProjects: "Recent projects",
    /* Shown under the four rows, and ONLY when a fifth project exists. "All" is a
       promise, so it points at `/projects` rather than at any filtered view. */
    recentProjectsSeeAll: "See all",
  },

  userMenu: {
    trigger: "Open account menu",
    account: "Account",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    language: "Language",
    signOut: "Sign out",
    signingOut: "Signing out…",
    signOutError: "We couldn't sign you out. Please try again.",
    guest: "Not signed in",
  },

  credits: {
    widgetTitle: "Credits",
    balance: "Balance",
    recurrent: "Plan credits",
    oneTime: "Purchased credits",
    getMore: "Get more",
    renewsOn: "Renews on {date}",
    unavailable: "Balance unavailable",
    renewalIncoming: "{credits} credits on {date}",
    planEndsOn: "Your plan ends {date}",
    tooltipRecurrent: "come with your plan, are spent first, and reset every month.",
    tooltipOneTime: "are the ones you buy. They never expire and are spent once your plan credits run out.",
    barLabel: "{recurrent} plan credits and {oneTime} purchased credits left",
    outOfCredits: "You're out of credits",
    runningLow: "Running low on credits",

    /**
     * ⭐ THE COMPOSER IS SHUT BECAUSE THE BALANCE IS EMPTY (`OutOfCreditsBanner`).
     *
     * ⚠️ "OUT OF CREDITS" MEANS "CANNOT START ANYTHING", NOT "EXACTLY ZERO" — the
     * VCaaS gate refuses below 1 credit, so 0.4 is just as stuck. That is why the
     * body states the requirement AND the balance instead of claiming zero.
     */
    /** Neutral filler for the card's status line when there is nothing to warn about. */
    renewsWhenPlanDoes: "Renews with your plan",

    /**
     * ⭐ THE FREE ROUTES, IN A DIALOG (`FreeCreditsModal`).
     * ⚠️ IT IS THE `/settings/referrals` PAGE'S OWN PANELS — the copy for the offers
     * themselves lives under `socialShare.*` and `referrals.*` and is NOT duplicated
     * here. These three strings are the dialog's frame and nothing else.
     */
    freeCredits: {
      title: "Get free credits",
      description: "Post about Totalum, or invite someone. Both pay in credits.",
      openPage: "Open the full page",
    },

    blocked: {
      title: "You're out of credits.",
      body: "A prompt needs at least 1 credit to start — you have {credits}.",
      upgrade: "Upgrade plan",
      buy: "Buy credits",
      /** Inside the box itself, where the caret would have gone. */
      composerLocked: "Out of credits — add some to keep building",
    },

    actions: {
      prompt: "this prompt",
      createProject: "creating a project",
      deploy: "publishing",
      restartServer: "restarting the server",
      sourceCode: "downloading the source code",
      restoreVersion: "restoring a version",
      customDomain: "adding a domain",
      upload: "uploading a file",
      generic: "that action",
    },
    lowToast: "{credits} credits left",
    lowToastBody: "Top up or upgrade before you run out mid-build.",
    emptyToast: "You're out of credits",
    emptyToastBody: "Add credits to keep building.",
    modal: {
      titlePreflight: "You need more credits",
      titleReactive: "You've run out of credits",
      bodyPreflight:
        "We stopped before sending anything, so nothing was charged. You don't have enough credits for {action}.",
      bodyReactive: "We couldn't complete {action} because your balance ran out.",
      yourBalance: "Your balance",
      thisCosts: "This costs",
      metered: "By usage",
      upgradeHeading: "Upgrade your plan",
      recommended: "Recommended",
      planCredits: "{credits} credits every month · {price}/month",
      upgradeTo: "Upgrade to {plan}",
      upgraded: "Your plan has been upgraded",
      alreadyTopPlan: "You're on our largest plan — top up with credits below.",
      buyHeading: "Or buy credits",
      autoRechargeTitle: "Never run out again",
      autoRechargeBody: "Turn on auto-recharge and we'll top you up automatically.",
      seeAllOptions: "See all options",
      working: "Just a moment…",
      loadFailed: "We couldn't load the plans and packs.",
    },
  },

  help: {
    needHelp: "Need help?",
    title: "We're here to help",
    description: "Book a 30-minute call or email us — we usually reply the same day.",
    supportChat: "Open the support chat",
    unread: "{count} unread",
    bookCall: "Book a call",
    email: "Email us",
    emailSubject: "I need help with the Totalum API",
    copyEmail: "Copy the address",
  },

  prompt: {
    /**
     * ── THE ENTER KEY, IN THE WORKSPACE CHAT ────────────────────────────────
     *
     * ⚠️ TWO STRINGS FOR ONE FACT, AND THE SHORT ONE IS NOT AN ABBREVIATION OF THE
     * LONG ONE BY ACCIDENT. `enterHint` sits inline in a composer that is 320 px
     * wide on a laptop, beside six buttons — the full sentence would push the send
     * button off the row — and `enterHintFull` is its `title`, for the person who
     * wonders how to get a line break. The hero keeps `pages.projects.heroHint`:
     * there, Enter still writes a newline and ⌘/Ctrl+Enter is what sends.
     */
    enterHint: "Enter to send",
    enterHintFull: "Enter to send · Shift + Enter for a new line",
    voice: {
      start: "Dictate your prompt",
      hint: "Speak instead of typing — we'll add the text to your prompt",
      requesting: "Waiting for microphone access…",
      recording: "Recording",
      stop: "Use this recording",
      cancel: "Discard this recording",
      transcribing: "Transcribing…",
      nothingHeard: "We didn't hear anything. Try again a little closer to the mic.",
      transcribeFailed: "We couldn't transcribe that recording",
      /** ⚠️ Shown on the tooltip BEFORE the first recording — nobody is charged
       *  for something they were not told the price of. */
      cost: "{cost} credits per recording",
      remaining: "{count} left",
      lastOne: "That was your last dictation for now.",
      /** `period` is "today" / "this month"; `when` is "in 2 hours". */
      periodDay: "today",
      periodMonth: "this month",
      limitReached: "You've used all {max} dictations {period}.",
      limitReachedWhen: "You've used all {max} dictations {period}. You can dictate again {when}.",
      limitReachedShort: "No dictations left {period} (limit {max})",
      noCredits: "You need credits to use voice input",
      errorUnsupported: "Your browser doesn't support voice recording",
      errorPermission: "Your browser blocked microphone access. Allow it in your site settings and try again.",
      errorNoDevice: "We couldn't find a microphone",
      errorFailed: "We couldn't start recording",
    },

    /**
     * ── ATTACHMENTS ─────────────────────────────────────────────────────────
     * Shared by BOTH composers (`/projects` hero and the workspace chat), which
     * is why these are here and not under `pages.projects` where the hero's used
     * to live. The two surfaces must say the same thing about the same rules.
     */
    attachments: {
      attach: "Attach files",
      /** `size` is the per-file ceiling in MB — see `MAX_ATTACHMENT_BYTES`. */
      attachHint: "Attach any file — up to {max}, {size} MB each",
      full: "That's the limit of {max} files",
      dropTitle: "Drop your files here",
      dropHint: "Images, PDFs, spreadsheets, video, 3D — up to {max}",
      count: "{count} of {max} attached",
      removeAll: "Remove all",
      remove: "Remove {name}",
      retry: "Try this upload again",
      uploading: "Uploading…",
      uploadingShort: "Uploading…",
      failed: "Upload failed",
      tooLarge: "{name} is over {size} MB",
      tooLargeMany: "{count} files are over {size} MB",
      noRoom: "Limit of {max} files — {count} left out",
      empty: "Empty files can't be attached ({count})",
      duplicate: "Already attached ({count})",
      someFailed: "1 attachment didn't upload, so it wasn't sent",
      someFailedPlural: "{count} attachments didn't upload, so they weren't sent",
      /**
       * The rolling 24-hour cap in `upload-limits.ts`. `max` is the number itself —
       * a refusal that does not say what the limit is reads as a bug.
       */
      dailyLimit: "You've reached your limit of {max} file uploads a day. Try again later.",

      /** The word under a file's name, beside its size. */
      kind: {
        image: "Image",
        video: "Video",
        audio: "Audio",
        pdf: "PDF",
        sheet: "Spreadsheet",
        doc: "Document",
        slides: "Slides",
        text: "Text",
        code: "Code",
        data: "Data",
        archive: "Archive",
        model3d: "3D model",
        font: "Font",
        design: "Design",
        file: "File",
      },
    },
  },

  plan: {
    upgrade: "Upgrade",
    /** The aside's plan row: "Free plan", "Starter plan". The name itself comes
     *  from `PLAN_LABELS`, which is not translated — the plans are named the same
     *  in both languages, and "Basic" is already a rename of the id `shared`. */
    onPlan: "{plan} plan",
    upgradeTo: "Upgrade to {plan} · {price}/month",
    currentPlanFree: "You're on the Free plan.",
    unknownShort: "Check plan",
    unknownTitle: "We couldn't check your plan",
    unknownDescription:
      "Your account service didn't answer, so we can't tell which features you have. Try again in a moment.",

    /**
     * The workspace's Upgrade button, beside Publish. Short copy on purpose — the
     * comparison table, the invoices and the downgrades all live on
     * `/settings/billing`, which this modal links to rather than reimplements.
     */
    upgradeModal: {
      title: "Do more with your project",
      description: "More credits every month, your own domain, GitHub and the source code.",
      /** The same dialog, reached from a composer that has stopped working. */
      blockedTitle: "You're out of credits",
      blockedDescription:
        "Every prompt needs at least 1 credit. A plan gives you a fresh allowance every month.",
      currentPlan: "You're on {plan} right now.",
      currentPlanBlocked: "You're on {plan} · {credits} credits left.",
      recommended: "Recommended",
      /**
       * ⭐ THE CARDS SHOW DELTAS, NOT LISTS — see the note in `UpgradeModal`. These
       * three lines are the whole comparison: how many more credits, how many
       * projects keep the paid capabilities, and what the tier adds that you do not
       * already have (those come from `billing.plans.features.*`).
       */
      extraCredits: "{credits} more credits every month",
      quota: "GitHub, custom domains and source code on {count} projects",
      quotaUnlimited: "GitHub, custom domains and source code on every project",
      /**
       * ⭐ THE PROJECT CEILING, AS AN UPGRADE ADVANTAGE. It replaced the capability
       * quota as this card's headline number — see the note in `UpgradeModal`.
       */
      projects: "Build up to {count} projects",
      projectsUnlimited: "Build unlimited projects",
      /**
       * ⭐ THE THREE WAYS OUT ARE ALTERNATIVES, AND THE PAGE SAYS SO OUT LOUD.
       * One word between the blocks does what a border-top never did: it tells the
       * reader they are choosing, not scrolling past a footnote.
       */
      orDivider: "or",
      packsHeading: "Buy one-time credits",
      packsHint: "They never expire, and your plan stays exactly as it is.",
      /**
       * ⚠️ "ASK FOR", NEVER "GET" — a post is reviewed by a person before any
       * credit moves. See the wording rules at the top of `lib/social-share.ts`.
       * ⚠️ Shown only to someone who has NOT claimed yet: no pending state, no
       * cooldown. Anything else advertises an offer they cannot take.
       */
      shareHeading: "Earn up to {credits} free credits",
      shareBody:
        "Post about your experience with Totalum on X, LinkedIn or Reddit, send us the link and we'll review it.",
      shareAction: "Share a post",
      seeAllPlans: "Compare every plan",
      footnote: "Change or cancel whenever you like.",
      /**
       * ── ⭐ THE TOP OF THE LADDER, AND THE THING THAT IS NOT ON IT ───────────
       *
       * Enterprise is a real tier with a real price, so it gets a real card — but
       * it never fits the three-column delta grid above, which is why it was
       * silently missing from this dialog (`MAX_OPTIONS = 3`, four tiers above
       * Free). Custom is not a tier at all: it is a conversation, so its button
       * opens a call/email dialog and never a Checkout session.
       */
      biggerHeading: "Bigger needs",
      enterpriseBlurb:
        "Unlimited GitHub, domains and source downloads, priority builds and direct support.",
      customTitle: "Custom plan",
      customBlurb:
        "More credits, invoicing, an SLA, or something we don't sell yet — tell us what you need and we'll price it.",
      customAction: "Talk to us",
      customDialogTitle: "Let's build your plan",
      customDialogDescription:
        "Book a 30-minute call or email us — we usually reply the same day.",
      customBookCall: "Book a 30-minute call",
    },
    features: {
      sourceDownload: {
        title: "Download your source code",
        description:
          "Get the whole project as a file you own — every component, route and migration the agent wrote. Yours to host anywhere.",
      },
      github: {
        title: "Sync with GitHub",
        description:
          "Connect a repository and keep it in step with your project in both directions. Review changes as pull requests, and keep your own history.",
      },
      customDomain: {
        title: "Use your own domain",
        description:
          "Serve your app at your own web address instead of a totalum-project.com subdomain, with HTTPS set up automatically.",
      },
      visualEdit: {
        title: "Edit your app visually",
        description:
          "Click anything in your preview and change its text, size, colours or images — then apply it straight to your code. Available on every paid plan.",
      },
      sourceEdit: {
        title: "Edit your code by hand",
        description:
          "Open any file in the editor, change it and save. Every save is committed and kept in Versions, so you can always go back. Available on every paid plan.",
      },
    },

    // ── Feature H1: per-plan capability quotas ───────────────────────────
    quota: {
      /**
       * ⚠️ TWO FORMS OF EVERY NAME, AND THEY ARE NOT INTERCHANGEABLE.
       * `names.*` is a standalone heading; `inSentence.*` is the same thing
       * embedded in prose. English barely notices the difference, Spanish very
       * much does — "la sincronización con GitHub" is right mid-sentence and
       * wrong as a card title. Keep the two sets in step.
       */
      names: {
        github: "GitHub sync",
        customDomain: "Custom domains",
        sourceDownload: "Source download",
      },
      inSentence: {
        github: "GitHub sync",
        customDomain: "custom domains",
        sourceDownload: "source download",
      },
      usage: "{used} of {quota} projects using {feature}.",
      usageUnlimited: "{used} projects using {feature} — unlimited on your plan.",
      includesThisProject: "This project is one of them.",
      shortBlocked: "{used}/{quota} used",
      blockedTitle: "You've used all your {feature} slots",
      // Phrased so `{feature}` is never sentence-initial — see the note on the ES
      // string, where that shape was grammatically wrong for two of the three.
      blockedDescription:
        "You're using {feature} on {used} of your projects, which is everything your plan includes ({quota}). Upgrade for more slots, or free one up by turning it off on a project that no longer needs it.",
      upgradeTo: "Upgrade to {plan} — {quota}",
      nProjects: "{count} projects",
      unlimitedProjects: "unlimited projects",
      manage: "Choose which projects use it",
      overQuotaInline: "{count} over your plan",
    },
  },

  // ── Feature H1: the management card on /settings/billing ──────────────
  featureUsage: {
    title: "Feature usage",
    /**
     * ⚠️ IT NO LONGER SAYS "on a number of projects". Every paid plan includes all
     * three on EVERY project; the card is now a map of where they are in use, not
     * a budget. Free is the one plan with none, and its `<PaidFeature>` upsell says
     * something more useful than a zero.
     */
    subtitle:
      "GitHub, custom domains and source download are included on every project on a paid plan. Here's where yours are being used.",
    ofQuota: "{used} of {quota} projects",
    unlimited: "{used} projects · unlimited",
    remaining: "{count} left",
    remainingOne: "1 left",
    full: "All slots in use",
    overQuota: "{count} over your plan",
    overQuotaHelp:
      "Your plan changed and more projects are using this than it includes. Nothing has been switched off — choose which projects keep it, or upgrade.",
    /**
     * ⚠️ THE SAME SITUATION, WITHOUT THE CHOICE. A source download cannot be taken
     * back, so there is no "choose which projects keep it" for it — offering one
     * would be offering an action that changes nothing the user can see.
     */
    overQuotaHelpPermanent:
      "Your plan changed and more projects have downloaded their source than it includes. Nothing is lost, and no new project can download until your plan covers it.",
    empty: "No projects are using this yet.",
    /** Why these rows have no "Turn off" button. */
    permanentNote: "A download can't be taken back, so these slots stay used.",
    release: "Turn off",
    releasing: "Turning off…",
    releaseFailed: "We couldn't turn it off. Please try again.",
    confirmTitle: "Turn {feature} off for {project}?",
    confirmGithub:
      "This disconnects the repository from this project. Your code stays on GitHub and in Totalum; they simply stop syncing. The slot becomes available for another project.",
    confirmCustomDomain:
      "This removes the custom domain from this project. It will go back to being served on its totalum-project.com address, and the slot becomes available for another project.",
    confirmAction: "Turn it off",
    error: "We couldn't load your feature usage.",
    upgradeCta: "See plans",
  },

  billing: {
    title: "Billing",
    subtitle: "Your plan, your credits and everything you've paid for.",

    // ── Current plan card ────────────────────────────────────────────────
    current: {
      heading: "Your plan",
      onPlan: "You're on {plan}",
      perMonth: "{price}/month",
      free: "Free",
      manage: "Manage billing",
      manageHint: "Invoices, receipts, card and billing address — on Stripe.",
      opening: "Opening…",
      statusActive: "Active",
      statusTrialing: "Trial",
      statusPastDue: "Payment failed",
      statusUnpaid: "Unpaid",
      statusCanceled: "Cancelled",
      statusIncomplete: "Awaiting confirmation",
      statusUnknown: "Unknown",
      paymentProblemTitle: "We couldn't take your last payment",
      paymentProblemBody:
        "Your plan is still active, but we need a working card to renew it. Update it in the billing portal.",
      fixPayment: "Update payment method",
      startedOn: "Started {date}",
    },

    // ── Renewal ──────────────────────────────────────────────────────────
    renewal: {
      heading: "Next renewal",
      renewsOn: "Renews {date}",
      endsOn: "Ends {date}",
      on: "{date}",
      credits: "{credits} credits arrive",
      inDays: "in {days} days",
      tomorrow: "tomorrow",
      today: "today",
      ending: "Your plan ends {date}",
      endingBody:
        "You keep everything until then. After that you move to Free — no more monthly credits, and GitHub and custom domains are removed.",
      resubscribe: "Keep my plan",
      none: "No renewal — the Free plan doesn't renew.",
      unknownCredits: "We couldn't work out your next credit grant.",
    },

    // ── Credit balances ──────────────────────────────────────────────────
    balance: {
      heading: "Credits",
      planCredits: "Plan credits",
      planCreditsHint: "Reset every month. Spent first.",
      purchased: "Purchased credits",
      purchasedHint: "Never expire. Spent after your plan credits.",
      total: "{credits} total",
      remainingOfGranted: "{remaining} of {granted} left",
      ringLabel: "{percent}% of your monthly credits left",

      // ── The two-balance visual (Improvement I4) ────────────────────────
      barLabel: "{plan} plan credits and {purchased} purchased credits",
      planResets: "Resets {date}",
      planResetsMonthly: "Resets every month",
      planEnding: "Won't be renewed",
      planNone: "Your plan includes none",
      purchasedNever: "Never expire",
      spendOrder: "Plan credits are spent first, then purchased ones.",
      unknownGrant: "Balance",
      low: "Running low",
      empty: "You're out of plan credits",
      emptyBody: "Buy a pack below, or upgrade for a bigger monthly allowance.",
      unavailable: "We couldn't load your balance.",
    },

    // ── Plan comparison ──────────────────────────────────────────────────
    plans: {
      heading: "Plans",
      subheading: "Change or cancel whenever you like.",
      creditsPerMonth: "{credits} credits / month",
      perMonthSuffix: "mo",
      creditsToStart: "{credits} credits to get started",
      currentBadge: "Your plan",
      bestValue: "Most popular",
      choose: "Choose {plan}",
      upgradeTo: "Upgrade to {plan}",
      downgradeTo: "Switch to {plan}",
      showLowerPlans: "See all plans, including cheaper ones",
      hideLowerPlans: "Show fewer plans",
      cancelPlan: "Cancel my plan",
      currentAction: "Your current plan",
      working: "Just a moment…",
      offlinePrices:
        "We couldn't reach the billing service, so these are our published prices. Refresh before you buy.",
      featuresHeading: "What's included",
      includedEverywhere: "In every plan",
      includedEverywhereHint: "Free included. These are the same on every tier.",
      paidOnlyHeading: "What a paid plan adds",
      paidOnlyHint: "Everything that changes as you move up a tier.",
      paidOnly: "Paid plans",
      /**
       * ⭐ THE FIRST ROW OF THE MATRIX, AND THE ONLY ONE THAT ISN'T A TICK.
       * Credits are the biggest thing a tier buys, so the table states the number
       * per plan instead of leaving the reader to find it back up in the cards.
       * ⚠️ Free's grant is a ONE-OFF — see the note in `PlanComparison`, and never
       * render it under a "every month" label.
       */
      creditsRow: "Credits every month",
      creditsOnce: "{credits} once",

      /**
       * ⭐ THE TWO ENFORCED LIMITS. `projectsRow` is the ceiling on projects an
       * account may OWN; `rateRow` is the ceiling on how fast it may create them.
       * Both are rendered as figures, never as a tick — see `NUMERIC_FEATURE_SLUGS`.
       */
      projectsRow: "Projects",
      rateRow: "New projects",
      /**
       * ⚠️ THE OWNER OCCUPIES A SEAT. "1" on Free means the owner ALONE, so the
       * value string says "including you" — "1 team member" reads as "you plus
       * one", which is a different product. A pending invitation holds a seat too.
       */
      seatsRow: "People",
      seatsValue: "{count}, including you",
      /** ⚠️ One seat gets its own sentence — see `seatsPhrase` on the website. */
      seatsValueOne: "Just you",
      unlimited: "Unlimited",
      ratePerMinute: "{count} per minute",
      /** Free's shape: below one a minute, the window stretches instead. */
      rateEveryMinutes: "{count} every {minutes} min",
      rateNone: "Paused",

      /** The ladder sentence. `{plan}` is the tier BELOW this card. */
      everythingInPlus: "Everything in {plan}, plus:",
      /** When a tier adds no new FEATURE — only more credits, projects or rate. */
      everythingIn: "Everything in {plan}.",

      /**
       * ⚠️ THE SUBSCRIPTION IS NOT THE INFRASTRUCTURE BILL, and this is the one
       * place the page says so. Stated under the table rather than on each card:
       * it is a footnote to the whole comparison, not a property of any tier.
       */
      creditsFootnote:
        "Infrastructure, database and built-in integrations are billed with credits — your plan's monthly credits cover them, and you can top up any time.",

      /**
       * ⭐ METERED INFRASTRUCTURE — the block under the plan table.
       *
       * ⚠️ NUMBERS ARE NOT IN THESE STRINGS. Prices come from `infra-pricing.ts`
       * and are interpolated, so a repricing never needs a translation pass —
       * and the English and Spanish pages can never quote different figures.
       */
      infra: {
        heading: "Backend and database scale without limits, billed on demand",
        lead: "Your projects' backend and database grow with your traffic — there is no ceiling and nothing to provision in advance. You pay only for what you actually use, in credits, and your plan's monthly credits cover it.",
        unlimitedRecords: "Unlimited database records",
        requestsPerSecond: "No limit on requests per second",
        queriesPerSecond: "~1,000 database queries per second (at ~1 ms per query)",
        metrics: {
          requests: "Requests",
          compute: "Compute time",
          rowsRead: "Rows read",
          rowsWritten: "Rows written",
          storage: "Storage",
        },
        units: {
          requests: "per million requests",
          compute: "per million CPU-milliseconds",
          rowsRead: "per million rows read",
          rowsWritten: "per million rows written",
          storage: "per GB stored, per month",
        },
        creditsSuffix: "credits",
        creditSuffix: "credit",
        /**
         * ⭐ WHAT IT RUNS ON.
         *
         * ⚠️⚠️ `network` AND `database` MAKE DIFFERENT CLAIMS ON PURPOSE. A
         * published project's frontend and backend ARE a Cloudflare Worker and are
         * deployed network-wide by design. The project DATABASE is not on
         * Cloudflare and is not replicated — it is a standalone MongoDB managed by
         * Totalum in the EU. Merging these two sentences would publish a
         * multi-region claim that is not true and would contradict the EU-data
         * promise on the marketing site.
         */
        networkHeading: "Built on Cloudflare",
        network:
          "Your project's frontend and backend are deployed across Cloudflare's global network — 300+ cities in 100+ countries at once. No regions to choose, no servers to size, nothing to scale by hand: each request is served near whoever made it, under 50 ms for 95% of Internet users.",
        database:
          "Your project's database is fully managed by Totalum: automatic hourly backups, data stored in the European Union, and no row limit or capacity to provision — it grows with your app.",
      },

      features: {
        projects: "Projects included",
        preview: "Live preview",
        database: "Built-in database",
        deploy: "One-click deploy",
        /* On EVERY plan, Free included — the user brings their own token, so there
           is nothing to meter. Phrased as a connection to match the paid rows'
           verbs, and worded identically to the marketing site. */
        figma: "Connect Figma and build from your designs",
        /* ⚠️ "Edit", never "see" — VIEWING source is free on every plan (F2);
           only writing is gated. One row covers the code editor and the visual
           editor: same entitlement, two ways in. */
        /* ⚠️ ON EVERY PLAN, FREE INCLUDED — the only gate on the API is a credit
           balance, never a tier. See the note in account-backend's plan catalog. */
        api: "Build through the REST API",
        mcp: "MCP server for Claude Code, Cursor and Codex",
        whitelabel: "White-label it as your own builder",
        sourceEdit: "Edit your code — in the editor or visually",
        sourceDownload: "Download your source code",
        github: "Sync with GitHub",
        customDomain: "Use your own domain",
        noBadge: "No \"Made with Totalum\" badge",
        priority: "Priority builds",
        support: "Direct support",
      },
    },

    // ── Downgrade / cancel confirmation ──────────────────────────────────
    invoices: {
      loadFailed: "We couldn't load your invoices.",
      emptyTitle: "No invoices yet",
      emptyBody: "Invoices appear here as soon as your first payment goes through. Buying credits or starting a plan both create one.",
      untitled: "Invoice",
      download: "Download the PDF",
      view: "View on Stripe",
      loadMore: "Load older invoices",
      status: {
        paid: "Paid",
        open: "Due",
        uncollectible: "Unpaid",
        void: "Voided",
        draft: "Draft",
      },
      detailsTitle: "Want to change some business data or tax information for your next invoices?",
      detailsBody: "Edit it here:",
      detailsAction: "Edit billing details",
      detailsNotice: "This changes what appears on invoices issued from now on. Invoices already issued cannot be modified — they are final documents.",
      detailsFailed: "We couldn't open the billing details page. Try again in a moment.",
    },

    // ── Cancelling a plan ─────────────────────────────────────────────────
    cancel: {
      title: "Cancel your {plan} plan?",
      intro: "Your plan stays active until {date}. After that your account moves to Free and the changes below take effect automatically.",
      introNoDate: "Your {plan} plan will end and your account will move to Free. The changes below take effect automatically.",
      losesHeading: "What you lose when the plan ends",
      losesHeadingDated: "What you lose on {date}",
      lossGithub: "GitHub is disconnected from every project",
      lossGithubDetail: "Your repositories are untouched, but the connection is removed and pushing from Totalum stops.",
      lossDomain: "Every custom domain is removed",
      lossDomainDetail: "Your projects fall back to their totalum-project.com address. Visitors to the custom domain stop reaching them.",
      lossVisualEditor: "The visual editor is switched off",
      lossVisualEditorDetail: "Editing a page by clicking on it needs a paid plan. You can still change anything by asking the agent.",
      lossCredits: "Your {credits} monthly credits stop",
      lossCreditsDetail: "No further monthly credits are granted, and any unused plan credits are cleared when the period ends.",
      keeps: "You keep your projects, your code and your data — nothing is deleted. You can come back to a paid plan whenever you want.",
      keepsWithCredits: "You keep your projects, your code, your data and your {credits} purchased credits — those never expire. Nothing is deleted, and you can come back to a paid plan whenever you want.",
      reasonLabel: "Why are you cancelling?",
      reasonHelp: "This is the only thing we ask for, and it genuinely decides what we build next.",
      reasonRequired: "Choose a reason to continue",
      detailLabel: "Anything else? (optional)",
      detailPlaceholder: "What would have made you stay?",
      keep: "Keep my plan",
      confirm: "Cancel my plan",
      working: "Cancelling…",
    },

    cancelReasons: {
      too_expensive: "It is too expensive",
      not_using_it: "I am not using it enough",
      missing_features: "It is missing features I need",
      too_many_bugs: "Too many bugs or it is hard to use",
      switching_provider: "I am moving to another tool",
      temporary_pause: "Just pausing for now",
      other: "Something else",
    },

    downgrade: {
      title: "Switching to Free removes two things",
      titleCancel: "Cancelling removes two things",
      confirmPlan: "Switch to {plan}",
      titlePlan: "Switch to {plan}?",
      introPlan:
        "You'll move from {from} to {to} straight away. Stripe works out the difference for the rest of this period and adjusts your next invoice.",
      keepsFeatures: "You keep everything that isn't credits.",
      keepsFeaturesDetail:
        "GitHub stays connected, your custom domains stay live, and you can still download your source code — those come with every paid plan.",
      fewerCredits: "Your monthly credits change from {from} to {to}.",
      fewerCreditsDetail:
        "The new amount arrives on your next renewal. Credits already in your account are not touched.",
      intro:
        "You keep {plan} until {date}, and you keep every project, every file and everything you've built. But when it ends:",
      introNoDate:
        "You keep every project, every file and everything you've built. But when your plan ends:",
      consequenceGithub: "GitHub is disconnected from all of your projects.",
      consequenceGithubDetail:
        "Your repositories stay exactly as they are on GitHub. They just stop syncing, and you'd need to reconnect them to resume.",
      consequenceDomain: "Every custom domain is removed.",
      consequenceDomainDetail:
        "Your projects go back to their totalum-project.com address. Your domain name stays yours — you'd just have to point it again.",
      consequenceCredits: "Your monthly plan credits stop.",
      consequenceCreditsDetail:
        "Credits you've bought separately stay in your account and never expire.",
      confirmLabel: "Type {word} to confirm",
      confirmWord: "DOWNGRADE",
      confirm: "Yes, switch to Free",
      confirmCancel: "Yes, cancel my plan",
      keep: "Keep my plan",
      working: "Cancelling…",
      doneTitle: "Your plan has been cancelled",
      doneBody: "You'll keep {plan} until {date}.",
      doneBodyNow: "You've been moved to the Free plan.",
    },

    // ── Credit packs ─────────────────────────────────────────────────────
    packs: {
      heading: "Buy credits",
      subheading: "One-time top-ups. They never expire and are spent after your plan credits.",
      credits: "{credits} credits",
      perCredit: "{price} per credit",
      save: "Save {percent}%",
      bestValue: "Best value",
      buy: "Buy",
      buying: "Opening checkout…",
      unavailable: "We couldn't load the credit packs.",
      empty: "No credit packs are available right now.",
      taxNote: "Prices exclude VAT, which is calculated at checkout.",
    },

    // ── Auto-recharge ────────────────────────────────────────────────────
    autoRecharge: {
      heading: "Auto-recharge",
      description:
        "Never stop mid-build. When your balance falls below the threshold we top it up automatically with the saved card.",
      enable: "Turn on auto-recharge",
      enabled: "Auto-recharge is on",
      disabled: "Auto-recharge is off",
      thresholdLabel: "When my balance drops below",
      amountLabel: "Top up by",
      creditsUnit: "credits",
      summary: "Below {threshold} credits, add {amount} credits.",
      save: "Save",
      saving: "Saving…",
      turnOff: "Turn off",
      turningOff: "Turning off…",
      needsCardTitle: "A saved card is needed",
      needsCardBody:
        "Add a payment method in the billing portal first — auto-recharge charges it without asking, so it can't be set up without one.",
      addCard: "Add a payment method",
      inProgress: "A top-up is being charged right now.",
      lastCharge: "Last top-up {date}",
      thresholdRange: "Between {min} and {max} credits.",
      amountRange: "Between {min} and {max} credits.",
      invalidThreshold: "Choose a threshold between {min} and {max} credits.",
      invalidAmount: "Choose an amount between {min} and {max} credits.",
      unavailable: "We couldn't load your auto-recharge settings.",
      savedOn: "Saved",
      savedOff: "Auto-recharge turned off",
    },

    // ── History ──────────────────────────────────────────────────────────
    history: {
      heading: "History",
      subheading: "Every credit that's arrived in your account.",
      empty: "Nothing yet",
      emptyBody: "Your purchases and monthly plan credits will show up here.",
      unavailable: "We couldn't load your history.",
      credits: "+{credits} credits",
      loadMore: "Show more",
      loading: "Loading…",
      showingCount: "Showing {shown} of {total}",
      origin: {
        purchase: "Credit pack",
        auto_recharge: "Auto-recharge",
        plan_grant: "Plan credits",
        plan_renewal: "Monthly renewal",
        manual: "Added by Totalum",
        referral: "Referral bonus",
        signup: "Welcome credits",
        unknown: "Credits added",
      },
    },

    // ── Return from Stripe ───────────────────────────────────────────────
    success: {
      titlePlan: "You're all set",
      titleCredits: "Payment received",
      bodyPlan: "Your {plan} plan is active and your credits are ready.",
      bodyPlanGeneric: "Your plan is active and your credits are ready.",
      bodyCredits: "Your credits have been added to your account.",
      confirming: "Confirming your payment…",
      confirmingBody: "This usually takes a couple of seconds.",
      slowTitle: "This is taking a moment",
      slowBody:
        "Your payment went through — we're just waiting for it to show up here. Refresh in a minute and it'll be there.",
      newBalance: "Your balance",
      creditsNow: "{credits} credits",
      backToBilling: "Back to billing",
      startBuilding: "Start building",
      receiptNote: "Your receipt is on its way by email.",
    },

    cancelled: {
      title: "No payment was taken",
      body: "You closed the checkout before paying, so nothing was charged and nothing has changed.",
      tryAgain: "Try again",
      backToBilling: "Back to billing",
    },

    /*
      ── Paid without leaving the app ──────────────────────────────────────
      Shown when the saved card was charged directly instead of redirecting to
      Stripe Checkout. Deliberately says the OUTCOME ("added", "active"), not
      "payment successful": the customer clicked to get credits, not to admire a
      receipt, and the balance beside the toast has already updated.
    */
    direct: {
      creditsAdded: "Credits added to your account",
      planActivated: "Your plan is active",
    },

    /*
      ── Bought from inside a project ──────────────────────────────────────
      The same news as `success`, but said in a box you close instead of on a
      page you have to navigate away from: the user was mid-build when they
      bought, so "keep building" is the primary action and billing is the
      option. See `ProjectPurchaseModal`.
    */
    projectReturn: {
      confirming: "Confirming your payment…",
      confirmingBody: "This takes a moment. You can keep working while we finish up.",
      titlePlan: "Your plan is active",
      titleCredits: "Credits added",
      bodyPlan: "You're on {plan}. Your credits are in your balance and renew every month.",
      bodyPlanGeneric: "Your new plan is active and your credits are in your balance.",
      bodyCredits: "Your credits are in your balance and never expire.",
      keepBuilding: "Keep building",
      backToBilling: "Back to billing",
    },

    /*
      ── The confirmation Stripe's checkout page used to be ────────────────
      A customer with a saved card is now charged by the first click, so this
      dialog is the deliberate second one. The amount appears twice — in the
      sentence and on the button — because a button reading only "Confirm"
      sends people back up the dialog to check what they agreed to.
    */
    confirmPurchase: {
      creditsTitle: "Buy {credits} credits?",
      planTitle: "Subscribe to {plan}?",
      upgradeTitle: "Upgrade to {plan}?",
      creditsSavedCard: "{price} will be charged to your saved card now. The credits are added straight away and never expire.",
      planSavedCard: "{price} will be charged to your saved card now, then monthly. You can cancel any time.",
      upgradeNow:
        "{price} will be charged to your saved card now — the rest of this month on the new plan, minus credit for what you've already paid. Your renewal date doesn't change.",
      upgradeNowWithCredits:
        "{price} will be charged to your saved card now — the rest of this month on the new plan, minus credit for what you've already paid. {credits} extra credits are added straight away, and your renewal date doesn't change.",
      upgradeUnpriced:
        "Your saved card will be charged for the rest of this month on the new plan, minus credit for what you've already paid. Your renewal date doesn't change.",
      viaStripe: "You'll continue to Stripe to enter your card and finish the payment.",
      payNow: "Pay {price}",
      continue: "Continue",
    },

    // ── Errors ───────────────────────────────────────────────────────────
    errors: {
      UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
      STRIPE_NOT_CONFIGURED:
        "Payments aren't set up yet. Please get in touch and we'll sort it out.",
      PLAN_UNKNOWN: "That plan doesn't exist.",
      PLAN_UNCHANGED: "You're already on that plan.",
      PLAN_REQUIRED: "Choose a plan first.",
      ALREADY_SUBSCRIBED:
        "You already have an active plan. Use 'change plan' instead of starting a new one.",
      NO_SUBSCRIPTION: "You don't have a paid plan to change.",
      NO_PAYMENT_METHOD: "Add a payment method first, in the billing portal.",
      CARD_DECLINED: "Your card was declined. Try another card, or check with your bank.",
      REQUIRES_ACTION: "Your bank needs to confirm this payment. Open the billing portal to finish.",
      INSUFFICIENT_CREDITS: "You don't have enough credits for that.",
      CREDITS_PACK_NOT_FOUND: "That credit pack is no longer available.",
      AUTO_RECHARGE_INVALID: "Those auto-recharge settings are outside the allowed range.",
      VALIDATION_ERROR: "Something in that request wasn't right. Try again.",
      RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
      BRIDGE_UNAVAILABLE: "We couldn't reach the billing service. Try again in a moment.",
      UNKNOWN: "Something went wrong. Try again.",
    },

    retrySection: "Retry",
    sectionUnavailable: "We couldn't load this section.",
  },

  docs: {
    onThisPage: "On this page",
  },

  api: {
    visualEditor: {
      heading: "The visual editor",
      description:
        "Click anything in your project's preview and change its text, size, colours or images — the edit is written into your source code and rebuilt.",
      canHeading: "What it does well",
      can1: "Text, font size, text and background colours, and image or video sources",
      can2: "Several edits at once — resolved, written and rebuilt as one batch",
      can3: "Asking the agent about the exact block you selected, with its route and classes attached",
      can4: "Per-change undo before you apply, and nothing written until you do",
      cantHeading: "What it can't do yet",
      cant1: "Moving, adding, duplicating or deleting elements",
      cant2: "Text or image URLs that come from data or a variable rather than the markup",
      /**
       * ⚠️ G4 NARROWED THIS. A template literal alone is now editable — the static
       * tokens are rewritten and the `${…}` parts are left exactly as they are, which
       * is what a next/font class needs. What is still out of reach is a class list a
       * FUNCTION assembles at render time: there is no static text in the source to
       * rewrite. Do not widen this back without checking `findTemplateClassCandidates`.
       */
      cant3: "Classes assembled by a helper such as cn() or clsx()",
      cant4: "Layout, spacing and anything that needs more than one attribute changed",
      costHeading: "What it costs",
      costBody:
        "Applying costs 0.3 credits per batch, however many changes are in it, plus the usual cost of the rebuild it triggers. Nothing is charged when nothing could be applied, and nothing is charged if you have no balance — the edit still goes through.",
      refusalNote:
        "When a change can't be matched to a place in your code with confidence, the editor says so and leaves your files alone rather than guessing. Ask the agent in the chat instead — it can make changes the visual editor can't.",
    },
    keys: {
      heading: "Your API keys",
      description: "Each key is a password to your account. Treat it like one.",
      create: "New key",
      creating: "Creating…",
      createTitle: "Create an API key",
      createBody: "Give it a name you'll recognise later, and optionally limit it to specific projects.",
      nameLabel: "Name",
      namePlaceholder: "e.g. Production server",
      createdTitle: "Here's your key",
      createdWarnTitle: "Copy it now — we can't show it again this way",
      createdWarnBody:
        "We only store an encrypted copy. You can reveal it later from this page, but you'll never see it again automatically.",
      savedIt: "I've saved it",
      loadFailed: "We couldn't load your API keys.",
      emptyTitle: "No API keys yet",
      emptyBody: "Create one to build with the API or connect an AI editor over MCP.",
      created: "Created {date}",
      lastUsed: "Last used {when}",
      neverUsed: "Never used",
      allProjects: "All projects",
      scopedTo: "{count} project(s)",
      reveal: "Reveal",
      revealing: "Revealing…",
      revealed: "Shown",
      copyKey: "Copy this key",
      useThis: "Use in snippets",
      usedInSnippets: "In snippets",
      managed: "Managed",
      managedHint: "This key is managed by Totalum and can't be deleted.",
      scope: "Projects",
      scopeTitle: "Projects for {name}",
      scopeBody: "Choose which projects this key may touch.",
      scopeLabel: "Allowed projects",
      scopeAllHint: "Nothing selected — this key can access all of your projects.",
      scopeSelected: "{count} project(s) selected.",
      scopeNoProjects: "You don't have any projects yet, so this key works everywhere.",
      scopeSaved: "Project access updated",
      deleteTitle: "Delete {name}?",
      deleteBody:
        "Anything using this key stops working immediately. This can't be undone.",
      deleted: "API key deleted",
    },
    quickstart: {
      heading: "Quickstart",
      description: "Create a project and start the agent. Copy any tab — the key is filled in for you.",
      noKey: "Create a key above and the snippets will use it automatically.",
    },
    costs: {
      heading: "What things cost",
      devHeading: "Development credits",
      description: "Live from the API, so these are always the prices you'll be charged.",
      action: "Action",
      credits: "Credits",
      createProject: "Create a project",
      deploy: "Deploy to production",
      startServer: "Start or restart the server",
      sourceCode: "Download the source code",
      recoverVersion: "Restore a version",
      uploadFile: "Upload a file",
      customDomain: "Add a custom domain",
      exportProject: "Export a project",
      importProject: "Import a project",
      agentLabel: "Agent runs",
      agentNote:
        "Agent runs are charged by usage, not at a fixed price — typically 10 to 40 credits for one prompt.",

      infraHeading: "Infrastructure credits",
      infraDescription:
        "Charged only when a project goes past the allowance its plan already includes for that service.",
      dynamic: "Per use",
      dynamicNote: "Priced per call from the model and the number of tokens.",
      infraNote:
        "You can cap monthly spending per project, separately for development and infrastructure credits, with the credit-limits endpoint.",
      chatgpt: "ChatGPT request",
      imageGeneration: "Image generation or edit",
      videoAnalysis: "Video analysis",
      audioTranscription: "Audio transcription",
      documentScan: "Document scan",
      webScraper: "Web scraper request",
      email: "Email sent",
      pdf: "PDF generated",
      fileUpload: "File upload",
    },
    reference: {
      heading: "API reference",
      description: "Every endpoint, with a request you can copy and run.",
      searchPlaceholder: "Search endpoints…",
      results: "{count} endpoint(s)",
      noResults: "No endpoints match",
      noResultsBody: "Try a different word, or clear the search to see all of them.",
      exampleRequest: "Example request",
      exampleResponse: "Example response",
      requestFields: "Request body",
      queryFields: "Query parameters",
      errorResponses: "Error responses",
      fields: "Response fields",
      async: "Async",
      allGroups: "All areas",
      groupLabel: "Area",
      endpointsIn: "{count} in this area",
      expandAll: "Expand all",
      collapseAll: "Collapse all",
      copyPath: "Copy the path",
      clearSearch: "Clear",
    },
    snippet: {
      maskedNote: "Your key is hidden here — copying fills in the real one.",
    },
    overview: {
      eyebrow: "REST API + MCP",
      heading: "Build apps from your own code",
      body:
        "Send a prompt, get a working full-stack app: the agent writes it, we host it, and you get a live URL. Everything below is the same API our own platform runs on.",
      step1Title: "Describe it",
      step1Body: "POST a prompt describing the app or the change you want.",
      step2Title: "The agent builds",
      step2Body: "Frontend, backend, database and migrations — poll for status while it works.",
      step3Title: "Ship it",
      step3Body: "Deploy to production, attach your own domain, and you're live.",
      badgeRest: "REST API",
      badgeMcp: "MCP server",
      badgeInfra: "Hosting, database and storage included",
      docsLink: "Full documentation",
    },
    security: {
      heading: "Never call this API from a browser",
      body:
        "An API key is a password to your whole account. It must only ever exist on your own server.",
      right: "Your users → your frontend → your backend → Totalum",
      wrong: "Your users → your frontend → Totalum",
      rightLabel: "Do this",
      wrongLabel: "Never this",
    },
    basics: {
      heading: "Base URL, auth and responses",
      description: "Three things to know before the first call.",
      baseUrl: "Base URL",
      auth: "Authentication",
      authBody: "Send your key on every request as the {header} header.",
      envelope: "Response format",
      envelopeBody:
        "Every response — success or failure — uses the same envelope. Check {field} before reading {data}.",
    },
    rateLimits: {
      heading: "Rate limits",
      description: "Only one operation is rate-limited. Everything else is bounded by your credit balance.",
      operation: "Operation",
      limit: "Limit",
      createProject: "Create a project",
      perWindow: "{max} per {seconds}s",
      note:
        "Over the limit you get 429 RATE_LIMIT_EXCEEDED. Wait for the window to pass and retry — the request was not charged.",
    },
    integrations: {
      heading: "Built in, no setup",
      description:
        "Every project ships with these. Mention one in your prompt and the agent wires it up — no accounts to create, no keys to paste.",
      needsKeyBadge: "Your key",
      needsKeyNote:
        "These two need your own API key, added as a project secret. Everything else works out of the box.",
      anythingElseTitle: "Anything else you name",
      anythingElseBody:
        "Any public API or npm package works too — just mention it. If it needs a key you haven't given us, the agent reports it in the secretKeysNeeded field and you add it as a project secret.",
      email: "Email delivery",
      emailBody: "Transactional and notification email from a shared domain.",
      pdf: "PDF generation",
      pdfBody: "Turn any HTML into a PDF.",
      aiImages: "AI images",
      aiImagesBody: "Generate and edit images with AI.",
      chatgpt: "ChatGPT",
      chatgptBody: "Use ChatGPT from inside your app.",
      auth: "Authentication",
      authBody: "Login, registration and sessions, complete.",
      docScan: "Document scanning",
      docScanBody: "Extract structured data from PDFs and images.",
      speech: "Speech to text",
      speechBody: "Whisper transcription — mp3, m4a, wav, webm, ogg, flac, up to 5 MB.",
      video: "Video analysis",
      videoBody: "Describe or extract data from video with Gemini, up to 100 MB.",
      scraping: "Web scraping",
      scrapingBody: "Raw HTML, markdown, text, AI extraction and screenshots.",
      database: "Database",
      databaseBody: "A managed database with tables, relations and queries.",
      hosting: "Hosting and deploys",
      hostingBody: "One call to production, served from a global CDN.",
      domains: "Custom domains",
      domainsBody: "Your own hostname with an automatic SSL certificate.",
      storage: "File storage",
      storageBody: "Upload and serve files behind signed URLs.",
      backendLogs: "Backend logs",
      backendLogsBody: "The agent reads your logs to debug its own errors.",
      stripe: "Stripe",
      stripeBody: "Payments, subscriptions and billing.",
      customEmail: "Email from your domain",
      customEmailBody: "Send from your own domain — we suggest Resend.",
    },
    webhooks: {
      heading: "Webhooks",
      description: "Get a POST on your server when a long-running job finishes.",
      manageHeading: "Your webhooks",
      urlLabel: "Destination URL",
      urlPlaceholder: "https://your-server.com/totalum-webhook",
      urlHint: "HTTPS only.",
      eventLabel: "Event",
      headersLabel: "Custom headers",
      headersHint: "Sent with every delivery — use one for a shared secret.",
      headerName: "Header",
      headerValue: "Value",
      addHeader: "Add a header",
      removeHeader: "Remove this header",
      register: "Register webhook",
      registering: "Registering…",
      registered: "Webhook registered",
      deleted: "Webhook deleted",
      deleteTitle: "Delete this webhook?",
      deleteBody: "You'll stop receiving {event} deliveries at that URL.",
      emptyTitle: "No webhooks yet",
      emptyBody: "Register one and we'll POST to it the moment a run finishes.",
      loadFailed: "We couldn't load your webhooks.",
      onePerEvent:
        "One webhook per event. To change a URL, delete the existing webhook and register the new one.",
      created: "Added {date}",
      headerCount: "{count} custom header(s)",
      payloadHeading: "What we send",
      payloadBody: "A POST with this JSON body. Reply 2xx — we don't retry today.",
      eventAgentFinished: "A prompt finished",
      eventAgentFinishedBody: "Fires when an agent run completes, for any of your projects.",
      eventLimitReached: "A credit limit was hit",
      eventLimitReachedBody: "Fires when a project reaches the monthly limit you set for it.",
      errorUrlRequired: "Add the URL we should POST to.",
      errorUrlHttps: "The URL has to start with https://",
      errorEventRequired: "Pick an event.",
      errorHeaderName: "Every custom header needs a name.",
      errorAlreadyExists: "You already have a webhook for that event. Delete it first.",
      errorFailed: "We couldn't register that webhook.",
    },
    errorsRef: {
      heading: "Error codes",
      description:
        "Every error uses the same envelope. Switch on errorCode, never on the message.",
      code: "Code",
      status: "HTTP",
      meaning: "Meaning",
      searchPlaceholder: "Search error codes…",
      noResults: "No error code matches",
      count: "{count} code(s)",
    },
    concurrency: {
      heading: "Concurrency",
      description: "One heavy operation per project at a time.",
      oneHeavy:
        "A project runs one of these at a time: the agent, a deployment, a version recovery, or a server start.",
      autoStart:
        "If you deploy, recover a version, connect or pull GitHub, write a file or rebuild while the server is down, it auto-starts (charged as a server start) and the call returns SERVER_NOT_READY. Poll the project until agentServerStatus is Active, then retry.",
      agentAllowed:
        "Starting the agent is the exception — it is allowed during server operations, and the backend waits internally.",
    },
    flow: {
      heading: "End-to-end flow",
      description: "Prompt to production, in the order the calls have to happen.",
      ensureProjectTitle: "Make sure the project exists",
      ensureProjectBody:
        "One project per app. Create it once; reuse the projectId for every later call.",
      sendPromptTitle: "Send the prompt",
      sendPromptBody:
        "Returns immediately. A first build usually takes 6–15 minutes.",
      pollAgentTitle: "Poll the agent",
      pollAgentBody:
        "Every 10–15 seconds. While status is init, show realtimeConversation to your user; when it is done, creditsSpent holds the cost.",
      refreshPreviewTitle: "Refresh the preview URL",
      refreshPreviewBody:
        "On page load, on refresh, and after every run. Read developmentUrlFieldToUse to pick between cachedDevelopmentUrl and temporalDevelopmentProjectUrl — default to the latter when it is null.",
      deployTitle: "Publish",
      deployBody: "Builds and deploys to a public URL. Usually 1–3 minutes.",
      pollDeployTitle: "Poll the deployment",
      pollDeployBody:
        "Every 10–15 seconds until status is success. The public URL is productionProjectUrl on the project.",
      customDomainTitle: "Attach a domain (optional)",
      customDomainBody:
        "Returns the DNS records to configure. Watch customDomain.status on the project until it is active.",
    },
    principles: {
      heading: "Things that will bite you",
      asyncTitle: "The agent and deploys are asynchronous",
      asyncBody: "They return before the work is done. Always poll.",
      showConversationTitle: "Show the conversation while it builds",
      showConversationBody:
        "A 10-minute silence reads as a hang. Stream realtimeConversation to your user.",
      backendOnlyTitle: "Never call Totalum from the browser",
      backendOnlyBody: "The key lives on your server. Your frontend talks to your backend.",
      refreshPreviewTitle: "Re-read the preview URL, always",
      refreshPreviewBody:
        "It changes when the sandbox archives or wakes. A cached URL shows a dead page.",
      previewNotProductionTitle: "Show the preview, not production",
      previewNotProductionBody:
        "Production only changes when the user publishes. Link to it separately.",
      keySecretTitle: "Treat the key as a password",
      keySecretBody: "Rotate it if it ever leaves your server. Scope it to projects if you can.",
    },
    requirements: {
      heading: "Credits and limits",
      balance: "Every operation needs enough balance before it starts.",
      perOperation: "Credits are charged per operation, at the prices above.",
      twoCategories:
        "Two categories: development (agent, deploys, server) and infrastructure (ChatGPT, images, email, PDFs, scans, scraping, uploads past the plan allowance).",
      monthlyLimits: "You can cap monthly spending per project, per category.",
      analytics: "The spending-analytics endpoint breaks usage down by day, project and type.",
      lowCreditAlerts:
        "We email you when the balance drops below 100 and again at 1. Alerts fire once and reset after a purchase.",
    },
    download: {
      heading: "Take the docs with you",
      description: "The complete reference as one file — for your notes or for your coding agent.",
      markdown: "Download as Markdown",
      markdownBody: "One .md file, the whole reference.",
      forAi: "Copy for an AI agent",
      forAiBody: "Paste into Claude, Cursor or ChatGPT so it knows the API.",
      copied: "Copied",
      working: "Preparing…",
      failed: "We couldn't build the file. Try again.",
    },
    errors: {
      UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
      VALIDATION_ERROR: "Check the details and try again.",
      API_KEY_NOT_FOUND: "That API key no longer exists.",
      KEY_NOT_DELETABLE: "This key is managed by Totalum and can't be deleted.",
      KEY_IS_SYSTEM: "This key is managed by Totalum.",
      RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
      BRIDGE_UNAVAILABLE: "We couldn't reach the account service. Try again in a moment.",
      UNKNOWN: "Something went wrong. Try again.",
    },
  },


  /**
   * ═══ THE "EMBED IT IN 4 STEPS" BLOCKS ════════════════════════════════════════
   *
   * The same three sections the marketing site runs on totalum.app/whitelabel,
   * /api and /mcp — "Create it in only 4 steps", "It is just an HTTP API" and the
   * integration-help card — brought inside the product where the user already has
   * a key. The only deliberate difference: step 1 says COPY your API key, not
   * create one. In here they already have one, and the card underneath is it.
   *
   * ⚠️ THREE VARIANTS, ONE SHAPE. `whitelabel` / `api` / `mcp` all carry the same
   * sub-keys because `EmbedSteps` resolves them as `embed.<variant>.<key>` — a
   * missing key in one variant is a runtime blank, not a type error.
   */
  embed: {
    copyKey: "Copy API key",
    copyKeyDone: "Copied",
    copyKeyFailed: "Could not copy",
    copyDocs: "Copy the full API docs",
    copyDocsDone: "Copied",
    copyDocsFailed: "Could not copy the docs",
    downloadDocs: "Download docs file",
    promptHead: "Your prompt (example)",
    live: "LIVE",
    agentAny: "Any other",
    httpDocsCta: "Explore all Totalum API docs",
    helpTitle: "Want a hand with the integration?",
    helpLead:
      "Tell us what you are building and we will tell you the shortest path to it — including the parts you should not build yourself.",
    helpEmail: "Email us",
    helpCall: "Schedule a call",
    templateTitle: "Do not build the builder — start from ours",
    templateLead:
      "An entire AI app builder, open source on GitHub: chat, live preview, hosting and deploys, already wired to the Totalum API. Clone it, paste your API key, put your brand on it — and it is your product.",
    templateRepo: "totalumlabs/ai-app-builder-open",
    templateCta: "Use this prebuilt AI app builder",
    stacksMore: "…and anything else",

    whitelabel: {
      eyebrow: "Whitelabel",
      title: "Put an AI app builder inside your product in 5 minutes",
      lead: "Your users describe what they need. Your product builds it, hosts it and ships it — under your brand, on your domain. All it takes is the Totalum API.",
      stepsTitle: "Create it in only 4 steps",
      stepsLead:
        "You do not have to understand how the builder works. You only have to point your coding agent at the docs.",
      s1Title: "Copy your API key",
      s1Body: "It is the only credential your product will ever need. Your key is in the card below.",
      s2Title: "Send these docs to your AI agent",
      s2Body:
        "Add the key to your project, then give the whole Totalum API reference to the coding agent you already use.",
      s3Title: "Tell your coding agent what to build",
      s3Body:
        "Ask for an AI web app builder powered by the Totalum API, and say how it should fit your product.",
      s3Prompt:
        "Using the attached Totalum API docs, add an AI app builder to our dashboard. Each project belongs to the logged-in workspace, and users can deploy from the chat.",
      s4Title: "Ship it",
      s4Body:
        "Your agent wires it up and you are done — hosting, database, deploys and domains already handled.",
      httpTitle: "It is just an HTTP API",
      httpLead:
        "No SDK to adopt, no runtime to install, no framework to migrate to. If your language can make an HTTP request, it can run an AI app builder.",
      keysTitle: "Your API key",
      keysLead: "The one credential your product authenticates with. Manage, scope and rotate it here.",
    },

    api: {
      stepsTitle: "Start calling the API in 4 steps",
      stepsLead:
        "You do not have to read the whole reference. Hand it to the coding agent you already use and describe what you want.",
      s1Title: "Copy your API key",
      s1Body: "Every request authenticates with it. Your key is in the card above.",
      s2Title: "Send these docs to your AI agent",
      s2Body:
        "Give the whole Totalum API reference to Claude Code, Codex, Cursor or whichever agent you work in.",
      s3Title: "Tell it what to automate",
      s3Body: "Describe the projects you want created, changed or deployed, and let it write the calls.",
      s3Prompt:
        "Using the attached Totalum API docs, write a script that creates a project from a prompt, waits for the agent to finish and returns the deployed URL.",
      s4Title: "Run it",
      s4Body:
        "The first call returns a project; the second returns a live URL. Hosting, database and deploys are already handled.",
      httpTitle: "It is just an HTTP API",
      httpLead:
        "No SDK to adopt, no runtime to install, no framework to migrate to. If your language can make an HTTP request, it can create and deploy applications.",
    },

    mcp: {
      stepsTitle: "Build from your agent in 4 steps",
      stepsLead:
        "MCP puts Totalum inside the assistant you already talk to. Four steps and it can create, edit and deploy real applications.",
      s1Title: "Copy your API key",
      s1Body: "The MCP server authenticates with it. Your key is in the card above.",
      s2Title: "Add the MCP server",
      s2Body:
        "One command in Claude Code, Codex, Cursor or any other MCP client — the exact snippet for yours is above.",
      s3Title: "Ask for what you need",
      s3Body:
        "Talk to your agent the way you always do. It calls Totalum for the parts that need building, hosting or deploying.",
      s3Prompt:
        "Using the Totalum MCP, create 10 CRMs for my customers with a real database, and publish each one online.",
      s4Title: "Watch it ship",
      s4Body:
        "Projects appear in your dashboard as the agent works, already hosted, with a database and a live URL.",
      httpTitle: "It works in any MCP client",
      httpLead:
        "MCP is an open protocol, so Totalum is not tied to one editor. Any client that speaks it gets the same tools — and the same HTTP API underneath if you would rather call it directly.",
    },
  },

  /**
   * "Just one last question" — the post-signup modal that asks where the user
   * discovered Totalum, shown only when the measured acquisition said nothing.
   * See `DiscoverySourceModal`.
   */
  discovery: {
    title: "Just one last question",
    description: "Where did you discover Totalum? It helps us a lot — and it is optional.",
    // Shown instead of `description` when the answer is required: a brand-new
    // account whose signup measured as plain `direct`. Say WHY it is being asked.
    requiredDescription:
      "Where did you discover Totalum? We could not tell how you found us, so please pick the option that fits best — it takes a second and it really helps us.",
    saveError: "We could not save your answer. Please try again.",
    placeholder: "Choose an option",
    aiPlaceholder: "Which AI assistant?",
    aiQuestion: "What did you search on the AI assistant to find Totalum?",
    aiQueryPlaceholder: "e.g. best no-code app builder",
    googleQuestion: "What did you search on Google to find Totalum?",
    googlePlaceholder: "e.g. no-code app builder",
    skip: "Skip",
    submit: "Send",
    options: {
      instagram: "Instagram",
      facebook: "Facebook",
      x: "X (Twitter)",
      reddit: "Reddit",
      linkedin: "LinkedIn",
      friend: "A friend",
      blog_article: "A blog article",
      ai_assistant: "AI assistant",
      chatgpt: "ChatGPT",
      claude: "Claude",
      gemini: "Gemini",
      other_ai: "Other AI",
      google: "Google",
    },
  },

  mcp: {
    connectTitle: "Connect it in only 2 steps",
    connectLead: "The server is hosted by us. There is nothing to install and nothing to run.",
    connectStep1Title: "Pick your API key",
    connectStep1Body:
      "The MCP server uses the same tlm_sk_ key as the REST API — there is no separate MCP key.",
    connectStep2Title: "Add Totalum to your agent",
    connectStep2Body: "Pick your agent and paste the config. That is the whole setup.",
    connectPickAgent: "Pick your agent",
    connectDocsLead: "Full client-by-client instructions live in the",
    connectDocsLink: "MCP documentation",
    copy: "Copy",
    copied: "Copied",
    needKey: {
      heading: "You'll need an API key first",
      body: "MCP connects your editor to Totalum with a key. Create one and come back.",
      action: "Create an API key",
    },
    what: {
      heading: "What is MCP?",
      body:
        "MCP lets your AI editor talk to Totalum directly. Instead of switching to a browser, you ask Claude or Cursor to build, deploy and query your projects — and it does it through the same API you'd call yourself.",
      buildTitle: "Build from your editor",
      buildBody: "Create projects and run the agent without leaving your terminal.",
      inspectTitle: "Query your data",
      inspectBody: "Read tables and records, check logs, and inspect versions.",
      shipTitle: "Ship it",
      shipBody: "Deploy to production and manage domains and secrets.",
      oneKeyTitle: "One key, all your projects",
      oneKeyBody:
        "MCP uses the same API key as everything else. Scope it to specific projects on the API page if you'd rather it couldn't touch all of them.",
    },
    value: {
      eyebrow: "One key, every project",
      headline: "Turn your editor into a build fleet",
      lead:
        "Your agent gets {count} tools over MCP: create projects, run builds, query the database, deploy, attach domains. It does the work while you keep typing.",
      parallelTitle: "One agent, a thousand apps",
      parallelBody:
        "Builds run on our infrastructure, not your laptop, so your agent can start as many as you like at once.",
      noDepsTitle: "Nothing to install",
      noDepsBody:
        "No Docker, no database, no deploy pipeline. Point your editor at one URL and it works.",
      includesTitle: "Every project comes with",
      incFrontend: "Frontend",
      incBackend: "Backend",
      incDatabase: "Database",
      incStorage: "File storage",
      incEmail: "Email",
      incHosting: "Hosting + CDN",
      docsLink: "MCP documentation",
    },
    keyBar: {
      heading: "The key these snippets use",
      keyLabel: "API key",
      selectLabel: "Which key",
      show: "Show the key",
      hide: "Hide the key",
      revealing: "Revealing…",
      note: "Snippets show a placeholder. Copying fills in the real key.",
      manage: "Manage keys",
    },
    tools: {
      heading: "What your agent can do",
      description:
        "{count} tools, live on the server. Ask in plain language — your editor picks the tool.",
      account: "Account",
      projects: "Projects",
      agent: "The build agent",
      serverAndDeploy: "Server and deploys",
      code: "Code and versions",
      database: "Database",
      config: "Secrets and domains",
      github: "GitHub",
      observability: "Usage and webhooks",
      startHere: "Not sure where to start? Ask your agent to call whatCanTotalumDo.",
    },
    video: {
      heading: "See it in action",
      description: "Three minutes, start to deployed app.",
      note: "Hosted on Tella. Nothing loads from them until you press play.",
      play: "Play the walkthrough",
    },
    setup: {
      heading: "Connect your editor",
      description: "Pick your tool and copy the config — your key is filled in on copy.",
      noKey: "Create a key on the API page and these snippets will use it automatically.",
    },
    agents: {
      claudeCode: {
        location: "Run this in your terminal",
        hint: "Or put it in .mcp.json at your project root to share it with your team. Use ${TOTALUM_API_KEY} instead of the key to read it from the environment.",
      },
      cursor: {
        location: "~/.cursor/mcp.json (or .cursor/mcp.json for one project)",
        hint: "Already have MCP servers? Add just the \"totalum-vcaas\" entry inside your existing mcpServers object, then restart Cursor.",
      },
      windsurf: {
        location: "~/.codeium/windsurf/mcp_config.json",
        hint: "Add the \"totalum-vcaas\" entry to your existing mcpServers object if you have one. Restart Windsurf completely — a reload isn't enough.",
      },
      vscode: {
        location: ".vscode/mcp.json",
        hint: "VS Code uses \"servers\", not \"mcpServers\" — the other key is silently ignored. Put this in .vscode/mcp.json specifically: headers are dropped from a workspace .mcp.json.",
      },
      codex: {
        location: "Run this in your terminal, then add the header below",
        hint: "The Codex CLI can't set custom headers, so add http_headers to ~/.codex/config.toml yourself. For an env var instead, use env_http_headers = { \"api-key\" = \"TOTALUM_API_KEY\" }.",
        location2: "~/.codex/config.toml — under [mcp_servers.totalum-vcaas]",
      },
      openclaw: {
        location: "Run this in any OpenClaw chat — it keeps your existing MCP servers",
        hint: "Needs commands.mcp: true in your config. /mcp show verifies it, /mcp unset totalum-vcaas removes it. OpenClaw only speaks stdio, so mcp-remote bridges our HTTP server — which means Node has to be installed.",
        location2: "Or add it to ~/.openclaw/openclaw.json under mcp.servers",
      },
      generic: {
        location: "Any MCP-compatible agent",
        hint: "Streamable HTTP transport, not stdio. The api-key header goes on every request. Some agents call the field serverUrl instead of url — check yours.",
        location2: "The JSON most agents accept",
      },
      claudeDesktop: {
        location: "claude_desktop_config.json",
        hint: "Claude Desktop can't speak HTTP to MCP servers, so this bridges it through mcp-remote — which needs Node installed. macOS: ~/Library/Application Support/Claude/. Windows: %APPDATA%\\Claude\\. Restart the app after saving.",
      },
    },
    trouble: {
      heading: "If it doesn't connect",
      notListedTitle: "The server doesn't appear",
      notListedBody:
        "Almost always a restart. Most editors only read MCP config at startup — quit completely rather than reloading the window.",
      unauthorizedTitle: "401 or 'unauthorized'",
      unauthorizedBody:
        "The key didn't come through. Copy the snippet again with the copy button — typing it by hand usually means the tlm_sk_**** placeholder was left in.",
      nodeMissingTitle: "'npx: command not found'",
      nodeMissingBody:
        "Claude Desktop's bridge needs Node.js. Install it, then restart the app.",
      wrongProjectTitle: "It says the project doesn't exist",
      wrongProjectBody:
        "The key may be scoped to a subset of your projects. Check its project list on the API page — a key can only see what it's allowed to.",
      noCreditsTitle: "Every build stops immediately",
      noCreditsBody:
        "Out of credits. The MCP server returns INSUFFICIENT_CREDITS the same way the REST API does — top up on the billing page.",
      headersDroppedTitle: "Connected, but every call fails",
      headersDroppedBody:
        "Your editor probably dropped the api-key header. In VS Code, use .vscode/mcp.json — headers in a workspace .mcp.json are silently discarded.",
    },

    /**
     * ═══ THE LEGACY `/mcp` PAGE, WORD FOR WORD ═══════════════════════════════
     *
     * ⚠️ EVERY STRING BELOW IS COPIED FROM `totalum-account-frontend`'s
     * `assets/i18n/en.json` → `mcp.*`, AND THE KEY NAMES ARE THE LEGACY ONES.
     * The page is a content clone of the Angular one, so keeping the key names
     * identical is what makes "did the wording drift?" a one-line diff against
     * the legacy dictionary instead of a reading exercise.
     *
     * ⚠️ DO NOT "IMPROVE" THIS COPY. The nested groups above (`what`, `value`,
     * `tools`, `trouble`, …) are the rewritten copy that the clone replaced;
     * they are kept only because `McpGuide.tsx` still compiles against them.
     *
     * The `*Location` / `*Hint` keys had no legacy dictionary entry — they were
     * hardcoded English inside `mcp.page.html`. The English here is that text
     * verbatim; the Spanish is a translation, because the legacy page showed
     * English to Spanish users and that was a bug, not a decision.
     */
    title: "Connect to AI Agents",
    subtitle: "Plug Totalum into any MCP-compatible AI coding agent",
    lockedTitle: "Buy credits to start",
    lockedDesc:
      "MCP access is enabled once you have an active credit balance. Purchase credits to unlock it.",
    lockedCta: "Buy credits to start",
    capabilitiesTitle: "What can your agent do with this?",
    /**
     * ⚠️ SPLIT ON PURPOSE. The legacy template rendered this through
     * `[innerHTML]` so the second half could be `<strong>`. `t()` returns a
     * plain string, so the emphasis is interpolated as a node instead — same
     * words, no `dangerouslySetInnerHTML` anywhere near a dictionary.
     */
    valueHeadline: "Your AI agent, shipping {strong}",
    valueHeadlineStrong: "full web apps",
    valueLead:
      "Connect Claude Code — or any AI agent — to Totalum MCP and it builds and edits complete projects on its own. No servers, databases or external services to set up.",
    valueParallel: "Build many in parallel",
    valueParallelDesc: "From one app to hundreds — worked on at the same time.",
    valueNoDeps: "Zero external dependencies",
    valueNoDepsDesc:
      "Everything is built in and managed by Totalum — nothing else to set up.",
    includesTitle: "Every project includes, out of the box",
    incFrontend: "Frontend",
    incBackend: "Backend",
    incDatabase: "Database",
    incStorage: "Storage",
    incEmail: "Email",
    incHosting: "Hosting",
    seeMcpDocs: "See the full MCP docs",
    videoTitle: "See it in action",
    videoSubtitle:
      "An example of what you can do with your favourite AI agent (like Claude Code) + Totalum MCP",
    videoDesc:
      "In this example we use Claude Code + Totalum MCP to build and publish online 10 full-stack websites in parallel, one per description in an Excel file. It's just an example — you can build whatever you want.",
    setupTitle: "Set up your agent",
    setupSubtitle: "OpenClaw, Claude Code, Codex, Cursor, Windsurf, Claude Desktop & more",
    copyConfig: "Copy config",
    apiKey: "API key",
    showKey: "Show key in snippet",
    hideKey: "Hide key in snippet",
    keyHiddenNote:
      "Your key is hidden by default and inserted automatically when you copy the config. Use “Show key” to reveal it.",

    // ── Per-agent snippet captions and caveats ────────────────────────────
    openclawLocation: "Using the /mcp slash command (safe — preserves existing MCPs)",
    openclawHint:
      "Run this in any OpenClaw chat. Requires commands.mcp: true in your config. Use /mcp show to verify and /mcp unset totalum-vcaas to remove.",
    openclawLocation2: "Or add to ~/.openclaw/openclaw.json under mcp.servers",
    openclawHint2:
      "OpenClaw only supports stdio transport. The mcp-remote package bridges the Totalum HTTP server as a local process. Restart the gateway after editing the config file. Requires Node.js.",
    claudeCodeLocation: "Run in your terminal",
    claudeCodeHint:
      "Or add it to .mcp.json in your project root for team sharing. Use ${TOTALUM_API_KEY} instead of the key for env variable support.",
    codexLocation: "Run in your terminal (safe — preserves existing MCPs)",
    codexHint:
      "Then add the api-key header to ~/.codex/config.toml (the CLI does not support custom headers):",
    codexLocation2: "~/.codex/config.toml — add under [mcp_servers.totalum-vcaas]",
    codexHint2:
      "For env variable support, replace http_headers with env_http_headers = { \"api-key\" = \"TOTALUM_API_KEY\" } and set export TOTALUM_API_KEY=\"your_key\".",
    cursorLocation: "Add to ~/.cursor/mcp.json (or .cursor/mcp.json for project-level)",
    cursorHint:
      "If you already have other MCP servers, just add the \"totalum-vcaas\" entry inside your existing mcpServers object. Restart Cursor after saving.",
    windsurfLocation: "Add to ~/.codeium/windsurf/mcp_config.json",
    windsurfHint:
      "If you already have other MCP servers, just add the \"totalum-vcaas\" entry inside your existing mcpServers object. Restart Windsurf completely after saving.",
    claudeDesktopLocation: "Add to claude_desktop_config.json",
    claudeDesktopHint:
      "If you already have other MCP servers, just add the \"totalum-vcaas\" entry inside your existing mcpServers object. Claude Desktop requires mcp-remote for HTTP servers. File location: macOS ~/Library/Application Support/Claude/claude_desktop_config.json, Linux ~/.config/Claude/claude_desktop_config.json, Windows %APPDATA%\\Claude\\claude_desktop_config.json. Restart Claude Desktop after saving.",
    genericLocation: "Any MCP-compatible agent",
    genericHint:
      "Use these values to configure any MCP-compatible agent. The server uses Streamable HTTP transport (not stdio). The api-key header must be sent with every request. Some agents use serverUrl instead of url — check your agent's documentation.",
    genericTabLabel: "Other",
  },

  /**
   * ═══ THE LEGACY `/vcaas` PAGE, WORD FOR WORD ═════════════════════════════
   *
   * ⚠️ THIS BLOCK BACKS `/api`, NOT `api.*`. The strings are copied from
   * `totalum-account-frontend`'s `assets/i18n/en.json` → `vcaas.*`, with the
   * legacy key names kept so the two dictionaries diff line for line.
   *
   * `api.*` above is the rewritten reference-manual copy the clone replaced. It
   * stays because `ApiConcepts.tsx`, `EndpointReference.tsx`, `Quickstart.tsx`
   * and `WebhooksPanel.tsx` still type-check against it — none of them is
   * rendered any more. Delete the components and the block together, or not at
   * all.
   *
   * Keys marked "not in the legacy dictionary" replace copy that was hardcoded
   * English in `vcaas.page.html` / `vcaas.page.ts`. English is that text
   * verbatim; Spanish is a real translation.
   */
  vcaas: {
    loading: "Loading...",

    // ── Hero ──────────────────────────────────────────────────────────────
    heroEyebrow: "Vibe coding, programmatically",
    heroTitle: "Build multiple full-stack apps by calling a simple API",
    heroBadgeInfra: "Managed infra",
    step1Title: "Call the API with a prompt",
    step1Desc:
      "Send a POST request describing the app or change you want in plain language.",
    step2Title: "The API builds it",
    step2Desc:
      "The API runs an AI agent that generates a complete app — frontend, backend & database.",
    step3Title: "Call deploy to ship it",
    step3Desc:
      "Hit the deploy endpoint and your app goes live with hosting, CDN, SSL & custom domains.",

    // ── API key card ──────────────────────────────────────────────────────
    yourApiKey: "Your API Key",
    apiKeySubtitle: "Use it on your backend to authenticate every request",
    manageKeys: "Manage API Keys",
    copyKey: "Copy key",
    copied: "Copied!",
    keyNeverShown:
      "For your security, the full key is never displayed — copy it to use it",
    keyNameHint: "Give your API key a descriptive name to identify where it's used",
    keyNamePlaceholder: "e.g. Production, My Backend, Testing...",
    creating: "Creating...",
    createKey: "Create Key",
    restrictToProjects: "Restrict to specific projects",

    /** Not in the legacy dictionary — hardcoded in `vcaas.page.html`. */
    lockedTitle: "Buy credits to start",
    lockedDesc:
      "Your API key will be enabled once you have an active credit balance. Purchase credits to unlock API & MCP access.",
    lockedCta: "Buy credits to start",
    addProject: "Add project...",
    /**
     * ⚠️ The dropdown is capped and the fetch behind it is capped, so a full list
     * is never a promise this control can keep. Point at the search instead.
     */
    searchForMore: "Showing {count}. Type to search all your projects.",
    noProjects: "No projects",
    scopeAll: "All",
    scopeRestrictHint: "Click to restrict",
    noRestrictions: "No restrictions — key has access to all projects",
    duplicateKeyName: "An API key with this name already exists",
    deleteKeyConfirm: "Are you sure you want to delete this API key?",
    keysLoadFailed: "We couldn't load your API keys.",

    // ── Built-in integrations ─────────────────────────────────────────────
    integrationsTitle: "Built-in integrations",
    integrationsSub: "Just mention them in your prompt — no setup",
    integrationsNote:
      "…or mention any API or npm package in your prompt and the agent integrates it.",

    /** Tile labels and their `title` tooltips — hardcoded in the legacy HTML. */
    integEmail: "Email",
    integEmailTitle: "Email delivery",
    integPdf: "PDF",
    integPdfTitle: "PDF generation",
    integAiImages: "AI images",
    integAiImagesTitle: "AI image generation & editing",
    integChatgpt: "ChatGPT",
    integChatgptTitle: "ChatGPT usage",
    integAuth: "Auth",
    integAuthTitle: "Complete authentication",
    integDocScan: "Doc scan",
    integDocScanTitle: "Document scanning",
    integSpeech: "Speech",
    integSpeechTitle: "Speech to text (Whisper)",
    integVideo: "Video",
    integVideoTitle: "Video analysis (Gemini)",
    integScraping: "Scraping",
    integScrapingTitle: "Web scraping",
    integDatabase: "Database",
    integDatabaseTitle: "Managed database",
    integHosting: "Hosting",
    integHostingTitle: "Deployment & hosting with CDN",
    integDomains: "Domains",
    integDomainsTitle: "Custom domain with SSL",
    integStorage: "Storage",
    integStorageTitle: "File storage with signed URLs",
    integStripe: "Stripe",
    integStripeTitle: "Stripe — add your API key as a project secret",
    integCustomEmail: "Custom email",
    integCustomEmailTitle:
      "Email from your own domain (Resend) — add your API key",

    // ── API documentation ─────────────────────────────────────────────────
    apiDocs: "API Documentation",
    apiDocsDesc: "Download the full reference or hand it to your AI agent",

    /* The open-source reference implementation, shown under the API reference.
       ⚠️ "Only dependency" is the claim worth making — it is what proves the
       public API is sufficient on its own. Keep it in any rewording. */
    openSourceBuilder: "Start from a Next.js template",
    openSourceBuilderDesc: "A complete, open-source one you can read, fork and run",
    openSourceBuilderCta: "Browse the repository on GitHub",
    openSourceBuilderNote:
      "It is built on the Totalum API as its only dependency — everything it does, you can do with the endpoints above.",
    downloadMarkdown: "Download .md",
    downloadDocsSub: "Complete API reference as a .md file",
    copyForAi: "Copy docs for AI agent",
    copyDocsSub: "Paste the whole reference into your AI agent",
    seeDetailedDocs: "See all detailed docs",
    /** Not in the legacy dictionary — the legacy page failed silently. */
    docsFailed: "We couldn't build the file. Try again.",

    // ── Webhooks ──────────────────────────────────────────────────────────
    manageWebhooks: "Manage Webhooks",
    webhookHint:
      "Receive HTTP notifications when events happen in your projects — you can also manage webhooks via the API",
    createWebhook: "Create Webhook",
    webhookUrlLabel: "Endpoint URL (HTTPS)",
    webhookUrlPlaceholder: "https://yourserver.com/webhook",
    webhookEventLabel: "Event to subscribe to",
    eventPromptFinished: "Prompt finished",
    eventLimitReached: "Credit limit reached",
    webhookHeaders: "Custom Headers",
    addHeader: "Add Header",
    activeWebhooks: "Active webhooks",
    noWebhooks: "No webhooks registered yet",

    /** Not in the legacy dictionary — hardcoded in `vcaas.page.ts`/`.html`. */
    headerNamePlaceholder: "Header name",
    headerValuePlaceholder: "Header value",
    webhookErrorRequired: "URL and event are required",
    webhookErrorHttps: "URL must use HTTPS",
    webhookErrorGeneric: "Error creating webhook",
    deleteWebhookConfirm: "Are you sure you want to delete this webhook?",
  },

  usage: {
    exportCsv: "Export CSV",
    range: {
      today: "Today",
      week: "7 days",
      month: "30 days",
      custom: "Custom",
      from: "From",
      to: "To",
      invalid: "Pick a valid start and end date.",
      tooLong: "Ranges are limited to {days} days.",
    },
    filter: {
      project: "Project",
      allProjects: "All projects",
      searchProjects: "Search projects…",
      /**
       * ⚠️ The server caps how many project ids it sends (see
       * `USAGE_PROJECT_LIST_LIMIT`). Saying so is what makes "paste an exact id"
       * discoverable instead of a trick only we know about.
       */
      truncated:
        "Showing your {count} most recent projects. Paste an exact project id to filter by any other.",
    },
    stats: {
      total: "Credits spent",
      overDays: "over {days} days",
      averagePerDay: "Average per day",
      averageHint: "Across the whole range, including quiet days",
      split: "Building / running",
      splitHint: "Development vs infrastructure",
      funding: "Plan / purchased",
      fundingHint: "Which balance paid for it",
      uncategorised:
        "{credits} credits aren't categorised as building or running, but are included in the total.",
    },
    projection: {
      title: "About {credits} more credits by {date}",
      assumption: "If you keep spending at the current rate.",
      willRunOut: "That's more than your current balance — you'd run out before the renewal.",
    },
    chart: {
      heading: "Over time",
      description: "Each bar is one day, split by what you spent it on.",
      total: "Total",
      date: "Date",
      noSpend: "Nothing spent",
      tableCaption: "Credits spent per day",
    },
    projects: {
      heading: "By project",
      description: "Sort any column, or open a project to filter everything above.",
      project: "Project",
      development: "Building",
      infrastructure: "Running",
      total: "Total",
      search: "Filter projects…",
      noMatch: "No projects match that search.",
      drillDown: "Focus",
      clear: "Clear",
      filtered: "Focused",
      capped: "Showing the top {shown} of {total} projects. Export the CSV for all of them.",
    },
    types: {
      prompt: "Agent prompts",
      deploy: "Deploys",
      start_server: "Server restarts",
      get_source_code: "Source downloads",
      recover_version: "Version restores",
      upload_file: "File uploads",
      add_custom_domain: "Custom domains",
      create_project: "Projects created",
      chatgpt: "AI text",
      image_generation: "Image generation",
      email: "Emails",
      pdf: "PDF generation",
      document_scan: "Document scans",
      web_scraper: "Web scraping",
    },
    empty: {
      title: "Nothing spent in this range",
      body: "Pick a wider range, or start building — usage shows up here as soon as you do.",
    },
    errors: {
      UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
      RANGE_TOO_LARGE: "That range is too long. Choose 90 days or fewer.",
      VALIDATION_ERROR: "Check the dates and try again.",
      BRIDGE_UNAVAILABLE: "We couldn't reach the account service. Try again in a moment.",
      UNKNOWN: "We couldn't load your usage. Try again.",
    },
  },

  /**
   * FEATURE G1 — the referral programme.
   *
   * ⚠️ NO CREDIT AMOUNT IS EVER HARD-CODED IN THIS COPY. Every number arrives as
   * `{credits}` / `{registration}` / `{payment}` from the account-backend settings
   * document, so the panel can never promise a figure the webhook does not pay.
   * That is the same rule Phase 16 arrived at for the cost hints, for the same
   * reason.
   */
  referrals: {
    hero: {
      title: "Earn up to {credits} credits for every person you invite",
      subtitle:
        "Share your link. When someone joins Totalum through it and verifies their email, you each get {registration} credits — and {payment} more each when they make their first payment.",
    },

    how: {
      title: "How it works",
      description: "Two moments, and both of you are paid at each one.",
      step1Title: "They join and verify",
      step1Body:
        "Someone opens your link, creates a Totalum account and confirms their email address.",
      step2Title: "They make their first payment",
      step2Body:
        "Their first plan subscription or credit purchase — whichever comes first.",
      eachAmount: "{credits} credits each",
    },

    rules: {
      newAccounts: "It has to be a new Totalum account — an email that already has one doesn't count.",
      verified: "Credits arrive once their email is verified, not when they first sign up.",
      noSelf: "You can't refer yourself.",
      oneTime: "Each reward is paid once per person, and lands in your purchased credits, which never expire.",
    },

    stats: {
      title: "Your referrals",
      invited: "Signed up",
      invitedHint: "People who created an account with your link.",
      verified: "Verified",
      verifiedHint: "Of those, the ones who confirmed their email.",
      paid: "Paid",
      paidHint: "Of those, the ones who have paid for something.",
      earned: "Credits earned",
      earnedHint: "Everything this programme has paid you so far.",
    },

    share: {
      linkLabel: "Your referral link",
      message: "I'm building apps with Totalum — describe what you want and it gets built. Sign up with my link and we both get free credits:",
      emailSubject: "Try Totalum with me",
      x: "X",
      whatsapp: "WhatsApp",
      linkedin: "LinkedIn",
      email: "Email",
      more: "More",
    },

    history: {
      title: "Rewards",
      emptyTitle: "No rewards yet",
      emptyDescription:
        "Share your link and the credits will show up here as soon as someone joins through it.",
      loadFailed: "We couldn't load your rewards.",
      rowRegistrationReferrer: "Someone joined with your link",
      rowRegistrationReferred: "Welcome bonus for joining with an invitation",
      rowPaymentReferrer: "Someone you invited made their first payment",
      rowPaymentReferred: "Bonus on your first payment",
    },

    cta: {
      menu: "Get free credits",
      widget: "Get free credits — invite a friend",
      modalHeading: "Or earn them for free",
      modalBody: "Invite someone to Totalum and you both earn up to {credits} credits.",
      modalAction: "Get my link",
      projectsTitle: "Give {credits} credits, get {credits} credits",
      projectsBody:
        "Invite someone to Totalum. When they join and verify, you each get {registration} credits — and more when they first pay.",
      projectsAction: "Get my link",
    },

    disabled: {
      title: "The referral programme is paused",
      description:
        "It isn't accepting new referrals right now. Any credits you've already earned are safe in your balance.",
    },

    errors: {
      loadTitle: "We couldn't load your referral link",
      loadDescription:
        "The request didn't go through. Your link and your rewards are safe — try again.",
    },
  },

  /**
   * ═══ SHARE-TO-EARN ═══════════════════════════════════════════════════════
   *
   * ⚠️⚠️ **NOTHING HERE MAY PROMISE THE CREDITS.** Submitting a post files a
   * REQUEST; a human looks at the post and decides. So every string is "ask for",
   * "request", "we'll review" — never "get 200 credits" or "and you'll receive".
   *
   * The person reading this copy is about to recommend us, by name, to their own
   * professional network. Copy that reads as a guarantee and is then followed by
   * a refusal does not cost us a support ticket; it costs us the one user who was
   * willing to put their reputation behind the product.
   *
   * ⚠️ NO CREDIT AMOUNT IS HARD-CODED. Every number arrives as `{credits}` from
   * `affiliate_settings.socialShare` — the same rule, for the same reason, as the
   * referral copy above: the panel must not be able to name a figure the reviewer
   * does not pay.
   */
  socialShare: {
    // ── The offer, wherever it appears ────────────────────────────────────
    /**
     * ⚠️ "UP TO", BECAUSE THE OFFER IS NOT ONE NUMBER ANY MORE. Each network pays
     * its own rate (`creditsByNetwork`), and the headline quotes the best of them —
     * so "{credits} credits" without the qualifier would be a promise that only
     * holds on two of the three networks. The per-network figures are shown beside
     * the network names, where the choice is actually made.
     */
    title: "Post about Totalum, ask for up to {credits} credits",
    shortTitle: "Share Totalum for up to {credits} credits",
    subtitle:
      "Tell people what you're building on LinkedIn, X or Reddit and send us the link. We read every one and reply in your support chat.",
    /** Beside a network's name, wherever one is offered. */
    rate: "{credits} credits",

    // ── How it works ──────────────────────────────────────────────────────
    how: {
      title: "How it works",
      description: "Three steps. The last one is us, not you.",
      step1Title: "Post about Totalum",
      /**
       * ⚠️ THE SPLIT IS NAMED HERE, IN WORDS, and not left to the badges alone.
       * Someone deciding where to post should not have to infer the rate from a
       * row of small numbers — it is the one fact that changes what they do next.
       */
      step1Body:
        "On LinkedIn or Reddit for {creditsLinkedin} credits, or on X for {creditsX}. Say something true — what you built, what it saved you. Your words work far better than ours.",
      step2Title: "Send us the link",
      step2Body:
        "Paste the link to the post itself. It goes straight to our support team with your request.",
      step3Title: "We review it and reply",
      step3Body:
        "A real person checks the post and answers in your support chat, usually within a working day. Approved requests are credited on the spot.",
    },

    // ── The rules, stated up front ────────────────────────────────────────
    rules: {
      title: "Before you post",
      newAccounts:
        "It has to be a real account of yours. Posts from brand-new or throwaway profiles don't qualify.",
      engagement:
        "The post needs genuine engagement — something nobody sees or reacts to doesn't count.",
      networks: "LinkedIn, X and Reddit only, and it must be the link to the post itself.",
      ownWords:
        "Write it in your own words, about your own project. Copying an example verbatim is allowed, but a post that sounds like you will always do better.",
      image:
        "Add a screenshot or a clip of your project if you can. It is not required, but it is the single biggest difference between a post people read and one they scroll past.",
      onePerPost: "One request per post, and one open request at a time.",
      review:
        "Every request is reviewed by a person. Sending one isn't a guarantee — but a genuine post is almost always approved.",
      public: "Keep the post public for at least a few days so we can actually open it.",
    },

    // ── Composing ─────────────────────────────────────────────────────────
    /**
     * ⚠️⚠️ THERE ARE FOUR DRAFTS AND ONE IS PICKED AT RANDOM — ON PURPOSE.
     *
     * There used to be one. Which means the day this feature works is the day
     * LinkedIn's feed carries the same paragraph, word for word, under a hundred
     * different faces. That does not read as a hundred recommendations; it reads
     * as astroturf, and it burns the person who posted it more than it burns us.
     *
     * ⚠️ EACH ONE IS WRITTEN AS A PERSON TALKING, NOT AS MARKETING. First person,
     * one concrete detail, a bit of doubt or surprise, no adjectives we would use
     * about ourselves ("powerful", "seamless"). The point is that someone can post
     * it unedited without sounding like they were paid to — and edit it without
     * having to start from scratch.
     *
     * ⚠️ EVERY DRAFT ENDS ON A COLON. `www.totalum.app` is appended after it by
     * `SocialShareDialog`, so the last character has to hand off to a link.
     *
     * ⚠️ KEEP THEM UNDER ~250 CHARACTERS. X counts the link as 23 and cuts at 280,
     * and a draft that arrives in the composer already over the limit is a draft
     * nobody posts. `social-share.test.ts` enforces this in both languages.
     */
    compose: {
      title: "Need something to say?",
      description:
        "These are examples, not a script. The best post is the one only you could write: what you actually built, what it replaced, what surprised you, how long you expected it to take. A real experience is worth far more than a polished template, and readers can tell the difference in one line.",
      /**
       * ⭐ ASKING FOR A SCREENSHOT IS THE HIGHEST-LEVERAGE LINE ON THIS SCREEN.
       * A post with the thing in it gets read; a paragraph of text scrolls past. It
       * also makes the review trivial for whoever opens the link, which is the
       * reason approvals come back the same day.
       */
      imageHint:
        "If you can, attach a screenshot or a short screen recording of what you built. A post that shows the actual app gets far more attention than one that only describes it, and it makes your request obvious to approve.",
      drafts: {
        d1:
          "Kept putting off an internal tool because it needed a dev, a database and a week I did not have. Described it in one paragraph instead and it was running before lunch. Still slightly suspicious of how that went: https://www.totalum.app",
        d2:
          "I have tried a lot of AI builds your app tools and most stop at a nice looking screen. This one gave me a real database, real users and a URL I could send to a client the same afternoon. That is a different product: https://www.totalum.app",
        d3:
          "Typed what I wanted in plain English and got back a working app. Database, screens, deployed, all of it. The part that normally eats a week of setup took me an afternoon. If your idea is stuck in a spreadsheet, try https://www.totalum.app",
        d4:
          "Small thing that made my week. I described an app, it got built with the database and all, live on a URL. No boilerplate, no picking a stack, no half finished side project sitting in a folder. https://www.totalum.app",
        d5:
          "The bit nobody warns you about with side projects is the two days of setup before you write anything interesting. I skipped every minute of that this weekend and actually shipped the thing. https://www.totalum.app",
        d6:
          "A client asked for a small booking system on Thursday. I sent them a working link on Friday morning. I am not going to pretend that was me being fast, it was https://www.totalum.app",
        d7:
          "I have been quietly replacing three spreadsheets with a proper app. Wrote a description, got a database and an admin panel back, moved the data across in an evening. Genuinely did not expect that: https://www.totalum.app",
        d8:
          "Honest review after two weeks of using it: I expected a demo and got something I put in front of real users. Auth, database, hosting, custom domain, all handled without me touching config. https://www.totalum.app",
        d9:
          "Told it what the app should do, went to make coffee, came back to a deployed URL that worked. I keep opening the code to check it is real code. It is, and it is readable. https://www.totalum.app",
        d10:
          "For anyone who keeps starting projects and never finishing the boring twenty percent: the boring twenty percent is already done for you here. That was the whole reason I never shipped anything. https://www.totalum.app",
        d11:
          "I am not a developer and I now have an internal tool my team opens every single day. I described it, adjusted it in the chat until it felt right, then published it. That is the whole story: https://www.totalum.app",
        d12:
          "Shipped more this month than in the previous six, and the only thing that changed is that I stopped hand rolling CRUD screens at eleven at night. Worth a look if that sounds familiar: https://www.totalum.app",
        d13:
          "The demo that sold me: I asked for a change in plain language, it edited the code, redeployed itself, and the live site updated while I watched. No pipeline, no config file, no waiting. https://www.totalum.app",
        d14:
          "If your idea has been sitting in a notes app for a year because the setup felt like too much, this is the shortcut. Took me one sitting and I now have something real to show people. https://www.totalum.app",
        d15:
          "Built and published a full CRM for a client while on a train with bad wifi. Real database, their own domain, their branding on it. I am still processing how normal that felt. https://www.totalum.app",
        d16:
          "Every AI builder I tried gave me a prototype I would have had to rewrite from scratch. This one gave me code I was happy to keep and a URL that already worked in front of a customer. https://www.totalum.app",
        d17:
          "Spent years telling people their idea needed a developer, a designer and three months. Described one of my own in a paragraph this week and had it live the same day. Slightly humbling: https://www.totalum.app",
        d18:
          "My favourite part is not that it builds the app, it is that I can ask for a change in one sentence and the live site updates. Feedback on Monday, fixed by Monday afternoon, no ceremony. https://www.totalum.app",
        d19:
          "We needed an internal dashboard and the quote we got back was four weeks. I described what we actually wanted and had a working version the same evening, database included. https://www.totalum.app",
        d20:
          "Two months in and the thing I still cannot get over is the database. Not a mock, not local storage, a real one I can query, back up and hand to whoever takes this over from me. https://www.totalum.app",
        d21:
          "I run a small agency and this quietly changed how we quote. Small internal tools that were never worth a project plan now take an afternoon, so we actually say yes to them. https://www.totalum.app",
        d22:
          "Was about to pay for another no code subscription and ended up describing the app instead. It came back with the screens, the data model and a URL. I cancelled the other one. https://www.totalum.app",
        d23:
          "Nobody tells you that the hardest part of a side project is the first evening. Auth, database, deploy, all before a single interesting line. That evening is gone now: https://www.totalum.app",
        d24:
          "I gave it a messy paragraph full of half formed requirements and it asked nothing, it just built something reasonable that I then corrected in chat. Faster than writing a spec. https://www.totalum.app",
        d25:
          "Replaced a shared spreadsheet that four people were fighting over with a real app that has proper records and permissions. Took an evening and nobody has emailed me about it since. https://www.totalum.app",
        d26:
          "The part I did not expect: the code is mine. I can read it, download it, push it to GitHub and keep going in my own editor if I ever want to. That is what made me stay: https://www.totalum.app",
        d27:
          "Showed a client a working prototype in the first meeting instead of a slide deck. We spent the rest of the hour on what it should actually do. Best meeting I have had in months. https://www.totalum.app",
        d28:
          "I have a folder of abandoned projects that all died at the setup stage. Started one on Sunday and it is already live with users. Same idea, different starting point: https://www.totalum.app",
        d29:
          "Genuinely useful for the unglamorous stuff. Order tracking, a booking form, an admin panel nobody will ever tweet about but three people rely on daily. All built in one sitting: https://www.totalum.app",
        d30:
          "Tried it expecting to write a snarky post about AI builders. Instead I have a deployed app with a real database that my team started using this week, so here we are: https://www.totalum.app",
      },
      exampleBadge: "Example",
      copyDraft: "Copy the draft",
      copied: "Copied",
      shuffle: "Try another",
      openOn: "Post on {network}",
      prefilled: "Opens with the draft ready",
      manual: "Opens the composer — paste the draft in",
    },

    // ── The claim form ────────────────────────────────────────────────────
    claim: {
      title: "Send us your post",
      description: "Paste the link to the post and we'll take it from there.",
      urlLabel: "Link to your post",
      urlPlaceholder: "https://www.linkedin.com/posts/…",
      urlHint: "The post itself, not your profile or a feed.",
      detected: "{network} post",
      submit: "Request {credits} credits",
      submitting: "Sending…",
      cancel: "Cancel",
      disclaimer:
        "This sends a request to our support team — it doesn't add the credits yet. We'll reply in your chat.",
      successTitle: "Request sent",
      successBody:
        "It's with our support team now. We'll reply in your support chat with the decision.",
      openChat: "Open the chat",
    },

    // ── State ─────────────────────────────────────────────────────────────
    cta: {
      start: "Share and request credits",
      menu: "Earn credits by sharing",
      widget: "Post about us — ask for up to {credits} credits",
      modalHeading: "Or post about us",
      modalBody:
        "Share Totalum on LinkedIn or Reddit and ask for {creditsLinkedin} credits, or on X for {creditsX}.",
      modalAction: "Share and ask",
      modalPendingBody:
        "Your post is with our support team. We'll reply in your chat as soon as it's reviewed.",
      modalPendingAction: "Open the chat",
    },

    pending: {
      title: "We're reviewing your post",
      body: "You asked for {credits} credits on {date}. Our reply lands in your support chat.",
      // ⚠️ SAYS WHAT HAPPENS IF NOBODY ANSWERS, because that is the question
      // someone stares at this box wondering, and silence reads as "ignored".
      expiry: "If we haven't got back to you within {days} days, you can send another.",
      viewPost: "See the post",
      openChat: "Open the support chat",
    },

    cooldown: {
      title: "Come back in {days} days",
      body:
        "You've already been credited for a post recently. The offer opens up again on {date}.",
    },

    disabled: {
      title: "This offer isn't running right now",
      description:
        "It's paused at the moment. Any credits you've already been given are safe in your balance.",
    },

    earned: {
      label: "Earned from sharing",
      hint: "Everything this offer has paid you so far.",
    },

    history: {
      title: "Your requests",
      emptyTitle: "No requests yet",
      emptyDescription: "Post about Totalum and your request will show up here.",
    },

    status: {
      pending: "Under review",
      approved: "Approved",
      rejected: "Not approved",
      // ⚠️ NOT "refused". An expired claim was never looked at, and telling
      // someone they were turned down when nobody read it is a lie that costs
      // us the next post too.
      expired: "No answer — send another",
    },

    errors: {
      SOCIAL_URL_INVALID: "That doesn't look like a LinkedIn, X or Reddit link.",
      SOCIAL_URL_NOT_A_POST:
        "That's a profile or a feed. We need the link to the post itself.",
      SOCIAL_URL_ALREADY_CLAIMED: "That post has already been sent to us.",
      SOCIAL_CLAIM_PENDING: "You already have a request being reviewed.",
      SOCIAL_CLAIM_COOLDOWN: "You've been credited recently — this opens up again soon.",
      SOCIAL_SHARE_DISABLED: "This offer isn't running right now.",
      RATE_LIMITED: "Too many tries. Give it a minute.",
      UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
      BRIDGE_UNAVAILABLE: "We couldn't reach our servers. Nothing was sent — try again.",
      UNKNOWN: "Something went wrong. Nothing was sent — try again.",
      loadTitle: "We couldn't load this offer",
      loadDescription: "The request didn't go through. Try again in a moment.",
    },
  },

  settings: {
    nav: {
      label: "Settings sections",
    },
    groups: {
      plan: "Plan & usage",
      account: "Account",
    },
    sections: {
      usage: {
        title: "Usage",
      },
      billing: {
        title: "Billing",
      },
      invoices: {
        title: "Invoices",
        description: "Every invoice we have issued you, ready to download.",
      },
      referrals: {
        title: "Free credits",
        // ⚠️ TWO PROGRAMMES LIVE ON THIS PAGE NOW — sharing and referrals — so the
        // description names both. "Invite people" alone hid the faster one behind
        // a label nobody would click for it.
        description: "Post about Totalum, or invite someone. Both earn you credits.",
      },
      profile: {
        title: "Profile",
        description: "Your name and the company details that appear on every invoice.",
      },
      preferences: {
        title: "Preferences",
        description: "Language, theme and the sound we play when a build finishes.",
      },
      security: {
        title: "Security",
        description: "How you sign in, your password, your sessions and closing the account.",
      },
      team: {
        title: "Team",
        description: "Invite people to your account and decide what each of them can do.",
      },
      notifications: {
        title: "Notifications",
        description: "The emails we're allowed to send you, and how we reach you here.",
      },
    },
    team: {
      heading: "Members",
      description: "Everyone with access to this account.",
      invite: "Invite someone",
      you: "You",
      emptyTitle: "It's just you here",
      emptyDescription:
        "Invite the people you work with. You decide what each of them can reach — every project or only some, view or edit, with or without billing.",
      loadErrorTitle: "We couldn't load your team",
      loadErrorDescription:
        "The member list didn't come through. Nothing has changed — try again.",
      noAccessTitle: "You can't see this account's members",
      noAccessDescription:
        "Ask the account owner if you need to see who else works here.",
      roles: {
        owner: "Owner",
        admin: "Admin",
        manager: "Manager",
      },
      roleHelp: {
        owner: "Owns the account, the plan and the credits. Can do everything.",
        admin:
          "Everything the owner can do inside the account — every project, billing, API keys and people — except closing or transferring the account.",
        manager: "Only what you tick below. Nothing else is visible to them.",
      },
      joined: "Joined {date}",
      joinedUnknown: "Member",
      scope: {
        allProjects: "All projects",
        allProjectsFuture: "All projects, now and later",
        projectCount: "{count} projects",
        oneProject: "1 project",
        noProjects: "No projects yet",
        canEdit: "can edit",
        viewOnly: "view only",
        canCreate: "can create projects",
        billingManaged: "manages billing",
        billingHidden: "billing hidden",
        usageVisible: "usage visible",
        usageHidden: "usage hidden",
        apiKeysManaged: "manages API keys",
        apiKeysHidden: "API keys hidden",
        adminEverything: "Full access to everything in this account",
        ownerEverything: "Owns this account",
      },
      /**
       * ⭐ THE SEAT WALL. Two situations share this block — see `SeatLimitModal`:
       * a Free plan (no seat exists and none can be freed) and a full paid plan
       * (upgrading works, but so does revoking). The copy has to fit both.
       */
      seatLimit: {
        upgradeTitle: "Invite your team",
        fullTitle: "Your plan is full",
        describedPlan: "The {plan} plan includes {total} users.",
        describedNoPlan: "Your plan includes {total} users.",
        usage: "{used} of {total} seats used",
        usageHelp: "Counts you, everyone on the account, and invitations you've sent.",
        upgradeBody:
          "The Free plan is just you. Upgrade to bring people in and share your projects with them — they work in your account, on your plan, and never need one of their own.",
        fullBody:
          "Every seat on your plan is taken. Upgrade to add more people to this account.",
        freeUpHint:
          "You can also free up a seat by removing someone or revoking an invitation you no longer need.",
        upgradeCta: "See the plans",
      },
      inviteModal: {
        title: "Invite someone to this account",
        description:
          "They'll get an email with a link to join. They work inside your account — your projects, your plan, your credits.",
        emailLabel: "Their email",
        emailPlaceholder: "name@company.com",
        roleLabel: "What can they do?",
        submit: "Send the invitation",
        sending: "Sending…",
        success: "Invitation sent to {email}",
      },
      scopeBuilder: {
        heading: "What this manager can reach",
        projectsHeading: "Projects",
        allProjectsLabel: "All current and future projects",
        allProjectsHelp:
          "They'll also get any project you create later, without you having to come back here.",
        accessLabel: "Access",
        /** Sits beside the toggle now that it lives inside the all-projects card. */
        allProjectsAccessLabel: "What they can do in them",
        accessView: "View",
        accessEdit: "Edit",
        searchPlaceholder: "Search projects",
        noProjects: "You don't have any projects yet. You can still invite them and pick projects later.",
        noMatches: "No project matches “{query}”.",
        loadingProjects: "Loading your projects…",
        projectsFailed: "We couldn't load your projects. You can still invite them and pick projects later.",
        selectedCount: "{count} selected",
        selectedNone: "No project selected — they'll see an empty workspace until you pick one.",
        /**
         * ⚠️ The list is a window (VCaaS returns at most 100 per call), so say so.
         * Otherwise someone scrolls to the bottom, does not find their project and
         * concludes it cannot be shared — instead of typing its name, which works.
         */
        capped: "Showing {count} projects. Search to find any of the others.",
        permissionsHeading: "Everything else",
        canCreateProjects: "Can create projects",
        canCreateProjectsHelp: "New projects land in your account and spend your credits.",
        canCreateGroups: "Can create groups",
        canCreateGroupsHelp: "Make, rename and delete project groups. This gives access to no project.",
        groupsHeading: "Whole groups",
        groupsHelp: "Grant everything filed under a group, including projects added to it later.",
        groupsEmpty: "You have no project groups yet.",
        canManageBilling: "Can manage billing",
        canManageBillingHelp:
          "Add and change payment methods, buy credits and download invoices. Only you can change or cancel the plan.",
        canSeeUsage: "Can see usage",
        canSeeUsageHelp: "How many credits the account is spending.",
        canManageApiKeys: "Can manage API keys",
        canManageApiKeysHelp:
          "Create, rename, scope and revoke keys — and see the ones you already have. Only tick this if they need to integrate.",
      },
      /**
       * ⭐ THE PLAIN-LANGUAGE SUMMARY under the invite/edit form.
       *
       * ⚠️ THE PIECES ARE ASSEMBLED BY THE CALLER, NOT INTERPOLATED HERE. A single
       * "{name} can {list}" template forces English word order onto Spanish; giving
       * each clause its own key lets both languages read like themselves.
       */
      accessSummary: {
        heading: "What they'll be able to do",
        admin:
          "Everything in this account except closing it or changing who owns it — every project, billing, usage, API keys, and inviting or removing other people.",
        manager: "As a manager, they'll be able to:",
        /** Shown when a manager scope grants literally nothing. */
        nothing:
          "Nothing yet. They'll be able to sign in and see who else is on the account, but no projects and no settings.",
        allProjectsView: "See every project you have now, and every one you create later",
        allProjectsEdit: "Open and edit every project you have now, and every one you create later",
        someProjectsView: "See {count} project you pick",
        someProjectsView_plural: "See the {count} projects you pick",
        someProjectsEdit: "Open and edit {count} project you pick",
        someProjectsEdit_plural: "Open and edit the {count} projects you pick",
        someProjectsMixed: "Open {count} projects you pick — some to view, some to edit",
        createProjects: "Create new projects, which belong to you and spend your credits",
        manageBilling: "Manage payment methods, buy credits and download invoices",
        seeUsage: "See how many credits the account is spending",
        manageApiKeys: "Create, scope and revoke API keys",
        /** Always shown, so the limits are as visible as the grants. */
        neverHeading: "They will never be able to:",
        neverPlan: "Change or cancel your plan",
        neverInvite: "Invite anyone or change what other people can do",
        neverDelete: "Delete a project",
        neverClose: "Close the account",
      },
      pending: {
        heading: "Pending invitations",
        description: "Sent, not accepted yet.",
        sentOn: "Sent {date}",
        expires: "Expires {date}",
        expired: "Expired",
        editAccess: "Edit access",
        resend: "Resend",
        revoke: "Revoke",
        resentOnce: "Resent once",
        resentTimes: "Resent {count} times",
      },
      manage: {
        menuLabel: "Manage {name}",
        changeRoleAndScope: "Change role and access",
        signOutEverywhere: "Sign out of all devices",
        remove: "Remove from the account",
      },
      editModal: {
        title: "Change what {name} can do",
        description: "Takes effect the next time they load a page.",
        save: "Save changes",
        success: "Updated {name}",
        /* The same modal saving through the invitation path — see `TeamPanel`. */
        invitationSuccess: "Updated what {email} will be able to do",
      },
      /**
       * ⚠️ REVERSIBLE, AND THE COPY HAS TO SAY SO. Signing someone out is not
       * removing them — they can sign back in and are still on the account. Without
       * that sentence an owner reads this as a softer "remove" and hesitates.
       */
      confirmSignOut: {
        title: "Sign {name} out everywhere?",
        description:
          "Ends every session they have, on every device, right away. They stay on this account and can sign back in.",
        confirm: "Sign them out",
        success: "Signed {name} out of all devices",
      },
      confirmRemove: {
        title: "Remove {name} from this account?",
        description:
          "They lose access immediately. Your projects, your credits and everything they built here stay exactly where they are. You can invite them again later.",
        confirm: "Remove them",
        success: "{name} no longer has access",
      },
      confirmRevoke: {
        title: "Revoke the invitation to {email}?",
        description: "The link in their email stops working. You can invite them again at any time.",
        confirm: "Revoke it",
        success: "Invitation revoked",
      },
      confirmResend: {
        title: "Send the invitation to {email} again?",
        description: "They get a fresh email with a fresh link. The old link stops working.",
        confirm: "Send it again",
        success: "Invitation sent again",
      },
      leave: {
        cta: "Leave this account",
        title: "Leave {owner}'s account?",
        description:
          "You lose access to their projects right away. Only the account owner can let you back in.",
        confirm: "Leave the account",
        success: "You've left the account",
      },
      errors: {
        /*
          ⚠️ BOTH CODES SAY THE SAME THING, DELIBERATELY. The backend still
          distinguishes a platform account from a legacy one, but the person
          inviting cannot act on that difference — either way the answer is "pick
          somebody else". Naming which platform the account is on only invites the
          follow-up question "so how do I move it?", which has no good answer here.
        */
        EMAIL_ALREADY_PLATFORM_USER:
          "This person already has a Totalum account, so you can't invite them. Ask them to sign up with a different email address.",
        EMAIL_ALREADY_LEGACY_USER:
          "This person already has a Totalum account, so you can't invite them. Ask them to sign up with a different email address.",
        /*
          ⚠️ IT NAMES THE `+`, because unlike the codes above this one is fixable by
          the inviter in five seconds — and only if they know what to change. "That
          address can't be invited" would send them to support for a typo.
        */
        EMAIL_PLUS_ALIAS:
          "Email addresses with a \"+\" can't be invited. Use the person's plain address, without the +tag.",
        EMAIL_DOMAIN_BLOCKED:
          "That temporary-email provider isn't allowed. Use the person's regular email address.",
        EMAIL_IS_SELF: "That's your own email — you already own this account.",
        ALREADY_A_MEMBER: "They're already part of this account.",
        INVITATION_ALREADY_PENDING: "You've already invited that email. Resend or revoke it below.",
        INVITATION_LIMIT_REACHED:
          "You've reached the limit of pending invitations. Revoke one you no longer need and try again.",
        /*
          ⚠️ NONE OF THESE THREE SUGGEST REVOKING ANYTHING. The quota counts mail
          that has already been sent, so freeing a pending invitation does not give
          any of it back — offering that as the fix would send people round a loop
          that cannot work. The only remedy is time, and each says so.
        */
        INVITATION_RATE_LIMIT_DAY:
          "You've sent as many invitations as this account can send in a day. You'll be able to send more within 24 hours.",
        INVITATION_RATE_LIMIT_MONTH:
          "You've sent as many invitations as this account can send in a month. Contact us if you need a higher limit.",
        RESEND_RATE_LIMIT:
          "You've resent this invitation too many times today. Try again later, or revoke it and check the address is right.",
        /*
          ⚠️ THESE TWO ARE THE SERVER'S LAST WORD, not the modal's. The UI opens the
          upgrade modal before the form when it knows the seats are gone; these are
          what shows if a seat was taken between loading the page and submitting.
        */
        SEAT_LIMIT_REACHED:
          "Every seat on your plan is taken. Upgrade, or free one up by removing someone or revoking an invitation.",
        SEATS_REQUIRE_UPGRADE:
          "Your plan is just you. Upgrade to invite people to this account.",
        INVITATION_NOT_FOUND: "We couldn't find that invitation. Reload the page.",
        INVITATION_NOT_PENDING: "That invitation has already been used or revoked.",
        INVITATION_EXPIRED: "That invitation has expired. Send a new one.",
        MEMBER_NOT_FOUND: "We couldn't find that person. Reload the page.",
        OWNER_IMMUTABLE: "The account owner can't be changed from here.",
        INVALID_ROLE: "Pick a role first.",
        EMAIL_REQUIRED: "Enter their email address.",
        VALIDATION_ERROR: "Check the form and try again.",
        FORBIDDEN: "You don't have permission to do that.",
        UNAUTHENTICATED: "Your session expired. Sign in again.",
        generic: "That didn't go through. Try again.",
      },
    },
    profile: {
      heading: "Your details",
      description: "Used on your invoices and for anything we need to send you.",
      name: "Name",
      phone: "Phone",
      companyName: "Company",
      nif: "Tax ID",
      address: "Address",
      city: "City",
      country: "Country",
      cp: "Postcode",
      save: "Save changes",
      saved: "Your details have been saved",
      loadFailed: "We couldn't load your details.",
      /**
       * Shown when the account service is unreachable and the page is painted from
       * the platform's own copy. Deliberately says what is true — these are the last
       * values we saw, and a save may not go through — rather than pretending the
       * page is live.
       */
      offline: "Showing your last saved details — we couldn't reach the account service just now.",
    },
    language: {
      heading: "Language",
      description: "Changes the interface straight away, and the emails we send you.",
      english: "English",
      spanish: "Español",
      saved: "Language updated",
    },
    appearance: {
      heading: "Appearance",
      description: "Theme and the sound we play when a build finishes.",
      theme: "Theme",
    },
    notifications: {
      heading: "Emails",
      description: "What we're allowed to send you.",
      marketing: "Product news and tips",
      marketingHint: "Occasional updates about what's new. Never more than monthly.",
      firstPrompt: "When my first build finishes",
      firstPromptHint: "A one-off email the first time an agent run completes.",
      limitReached: "When I run low on credits",
      limitReachedHint: "So a long build doesn't stop without warning.",
      saved: "Email preferences saved",

      /**
       * ⚠️ "IN THIS BROWSER" IS IN THE COPY, NOT ONLY IN THE CODE. This preference
       * genuinely cannot follow the user to another device — the OS permission
       * belongs to this browser — and a setting that quietly behaves differently
       * per device is a setting people stop trusting. Saying so is the fix.
       */
      browser: {
        heading: "In this browser",
        description:
          "Notifications are granted per browser, so this setting only applies here.",
        supportLabel: "Tell me when support replies",
        supportHint:
          "A desktop notification the moment we answer, even if you're in another tab.",
        blocked:
          "Your browser is blocking notifications from Totalum. Turn them back on in the site settings next to the address bar, then try again.",
        blockedToast: "Your browser wouldn't allow notifications.",
        unsupported: "This browser doesn't support notifications.",
        testTitle: "Notifications are on",
        testBody: "This is what a reply from support will look like.",
      },
    },
    security: {
      heading: "Security",
      // The section page is already titled "Security"; the card inside it names
      // what it actually contains, so the word is not printed twice.
      passwordHeading: "Password and sessions",
      changePassword: "Change password",
      currentPassword: "Current password",
      newPassword: "New password",
      confirmPassword: "Confirm new password",
      passwordChanged: "Password changed",
      passwordChangedHint:
        "We signed you out on every other device, so any session you didn't recognise is closed.",
      forgotCurrent: "Don't remember your current password?",
      passwordMismatch: "The two passwords don't match.",
      passwordTooShort: "Use at least 8 characters.",
      signOutEverywhere: "Sign out everywhere",
      signOutEverywhereHint:
        "Ends every session on every device, including this one. Use it if you've lost a device.",
      signedOutEverywhere: "Signed out on every device",
    },
    danger: {
      heading: "Close your account",
      description: "This can't be undone from here.",
      whatHappensTitle: "What happens when you close your account",
      keepsBilling: "Your invoices and payment history are kept.",
      keepsBillingHint: "We're required to keep them, and you may need them.",
      revokesKeys: "Every API key stops working immediately.",
      revokesKeysHint: "Anything built on the API — including MCP in your editor — stops.",
      projectsStay: "Your projects are not deleted.",
      projectsStayHint:
        "They stop being reachable from here. Contact us if you need them back or exported.",
      noRefund: "Any credits left on the account are not refunded.",
      noRefundHint: "Spend them or cancel your plan first if that matters to you.",
      confirmLabel: "Type {word} to confirm",
      confirmWord: "CLOSE",
      action: "Close my account",
      working: "Closing…",
      done: "Your account has been closed",
    },
    errors: {
      UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
      VALIDATION_ERROR: "Check the details and try again.",
      USER_NOT_FOUND: "We couldn't find your account.",
      BRIDGE_UNAVAILABLE: "We couldn't reach the account service. Try again in a moment.",
      UNKNOWN: "Something went wrong. Try again.",
    },
  },

  support: {
    placeholder: "Tell us what's going on…",
    send: "Send",
    attach: "Attach a file",
    attachHint: "Images, PDFs and spreadsheets, up to 10 MB",
    attachment: "Attachment",
    uploading: "Uploading…",
    hint: "Enter to send · Shift + Enter for a new line. We reply by email too.",
    fromTotalum: "Totalum",
    fromAgent: "{name} · Totalum",
    agentTitle: "{name} from Totalum",
    agentAvatar: "{name}, Totalum support",
    supportRoleSuccess: "Customer success",
    supportRoleEngineer: "Support engineer",
    teamLine: "{names} answer these — real people, not a bot.",
    sending: "Sending…",
    download: "Download",
    jumpToLatest: "Jump to latest",
    newMessages: "New message",
    today: "Today",
    yesterday: "Yesterday",
    loadFailed: "We couldn't load your conversation.",

    // ── The panel header ──────────────────────────────────────────────────
    title: "Totalum Support",
    copy: "Copy message",
    unreadDivider: "New",

    // ── Attachments ───────────────────────────────────────────────────────
    removeAttachment: "Remove {name}",
    tooManyFiles: "You can attach up to {max} files at a time.",
    duplicateFile: "{name} is already attached.",
    imageFailed: "This preview has expired — download it instead",
    dropTitle: "Drop your files here",
    dropBody: "Images, PDFs and spreadsheets · up to {max} at a time, 10 MB each",
    kind: {
      image: "Image",
      pdf: "PDF",
      sheet: "Spreadsheet",
      file: "File",
    },
    gallery: {
      counter: "{index} of {total}",
    },

    empty: {
      title: "Ask us anything",
      responseTime: "We usually reply within a few hours on working days",
      body: "Real people, not a bot. We usually reply within a few hours on working days — and we'll email you when we do, so you don't have to keep this open.",
    },
    file: {
      TOO_LARGE: "That file is larger than 10 MB.",
      TYPE_NOT_ALLOWED: "You can attach images, PDFs and spreadsheets.",
    },
    /**
     * The BROWSER notification raised when support replies.
     *
     * ⚠️ THE TITLE NAMES THE PRODUCT. It appears in the OS notification centre next
     * to everything else the machine is shouting about; "New message" from an
     * unnamed source is the one people dismiss without reading.
     */
    notification: {
      title: "Totalum Support replied",
      fallbackBody: "You have a new message from our support team.",
      /* The in-app panel's link. The OS notification has no link — clicking it focuses the tab. */
      open: "Open the conversation",
    },

    errors: {
      UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
      VALIDATION_ERROR: "Write a message first.",
      MESSAGE_TOO_LONG: "That message is too long.",
      FILE_TOO_LARGE: "That file is larger than 10 MB.",
      FILE_TYPE_NOT_ALLOWED: "You can attach images, PDFs and spreadsheets.",
      UPLOAD_FAILED: "We couldn't upload that file. Try again.",
      USER_NOT_FOUND: "We couldn't find your account.",
      BRIDGE_UNAVAILABLE: "We couldn't reach support. Try again in a moment.",
      UNKNOWN: "Something went wrong. Try again.",
    },
  },

  pages: {
    projects: {
      title: "Projects",
      description: "Describe what you want to build and Totalum builds it for you.",
      placeholderTitle: "No projects yet",
      placeholderDescription: "Your project dashboard is being built. You'll create apps from here.",

      // ── Hero prompt ───────────────────────────────────────────────────────
      // ⚠️ `heroTitle` IS A TEMPLATE, not a plain string. `{accent}` is the one
      // word the headline colours cobalt, and it is a placeholder rather than a
      // second sentence because languages put the verb in different places
      // ("What do you want to build?" / "¿Qué quieres construir?"). Rendered with
      // `interpolateNodes` in `ProjectsHero`.
      heroTitle: "What do you want to {accent}?",
      heroTitleAccent: "build",
      heroSubtitle: "Describe your app in a sentence. We'll write the code, host it and give you a live URL.",
      heroPlaceholder: "A booking app for my barbershop, with a calendar, SMS reminders and Stripe payments…",
      heroSubmit: "Start building",
      heroSubmitShort: "Build",
      heroHint: "Press {shortcut} to start",
      heroMic: "Dictate your idea",
      heroMicSoon: "Voice input is coming soon",
      /**
       * ⚠️ THE ONLY ATTACHMENT STRING LEFT HERE, and it is not the composer's: it
       * is the toast for uploads that failed AFTER the project was created, which
       * only the hero flow can produce. Everything the composer says about
       * attachments moved to `prompt.attachments` when the chat started saying it
       * too — see the note there.
       */
      heroAttachmentsLabel: "{count} attached",

      /*
        ⚠️ THE STARTER IDEAS ARE GONE, AND SO ARE THEIR KEYS (`example1Label` …
        `example3Prompt`, `emptyStarters`, `emptyStep1`–`3`). The first-run screen is
        now the composer and one quiet line; three example cards under the one box
        the page is for were the clutter, not the guidance.
      */

      // ── Connect GitHub, from the hero composer ────────────────────────────
      githubConnect: "Connect GitHub",
      githubPickDescription: "GitHub sync is set up per project. Choose the one to connect.",
      githubNoProjectsTitle: "No projects to connect yet",
      githubNoProjectsDescription: "Describe what you want to build first. Once a project exists, you can sync it to a repository.",
      // ── Create dialog ─────────────────────────────────────────────────────
      createTitle: "Name your project",
      createDescription: "This becomes your app's address, so it can't be changed later.",
      createNameLabel: "Project name",
      createNamePlaceholder: "my-app",

      // Editing a project's display name / description (the id is immutable).
      editDetails: "Edit name and description",
      editTitle: "Edit project",
      editDescription: "Change how this project appears in your list. Its address stays the same.",
      editLabelLabel: "Display name",
      editLabelHint: "Shown on the card instead of the project id. Leave it empty to show the id.",
      editIdLabel: "Project id",
      editIdHint: "This is your app's address and can't be changed.",
      editDescriptionLabel: "Description",
      editDescriptionHint: "Shown under the name. Starts as your first instruction.",
      editSaved: "Project updated",

      // Project groups — optional folders. Deliberately quiet in the UI.
      groupsAll: "All projects",
      groupsUngrouped: "Ungrouped",
      groupsCreate: "New group",
      groupsCreateTitle: "New group",
      groupsEditTitle: "Edit group",
      groupsFormDescription: "Groups are a way to file projects. Your projects stay in the main list either way.",
      groupsNameLabel: "Name",
      groupsNamePlaceholder: "Client work",
      groupsDescriptionLabel: "Description (optional)",
      groupsCreated: "Group created",
      groupsSaved: "Group updated",
      groupsDeleted: "Group deleted",
      groupsEdit: "Edit {name}",
      groupsDelete: "Delete {name}",
      groupsDeleteTitle: "Delete {name}?",
      groupsDeleteDescription: "The group goes; its {count} projects stay and simply become ungrouped. Nothing is deleted.",
      groupsMove: "Move to group",
      groupsMoveTitle: "Move to group",
      groupsMoveDescription: "Choose where {name} is filed.",
      groupsNoGroup: "No group",
      groupsMoved: "Project moved",
      createSubmit: "Create and build",
      createSubmitPending: "Creating…",
      /*
        ⚠️ "OPTIONAL" IS IN THE LABEL, not only implied by the default. The field
        only ever appears for accounts that already have groups, where a select
        sitting under a required name field reads as another thing to answer.
      */
      createGroupLabel: "Group (optional)",
      createPromptLabel: "First instruction",

      // Live name-availability feedback.
      nameChecking: "Checking availability…",
      nameAvailable: "{name} is available",
      nameTaken: "{name} is already taken",
      nameSuggestion: "Try {name} instead",
      nameUseSuggestion: "Use this name",
      nameErrorEmpty: "Choose a name for your project",
      nameErrorTooShort: "Use at least 4 characters",
      nameErrorTooLong: "Use at most 35 characters",
      nameErrorFormat: "Use lowercase letters, numbers and single hyphens. Start with a letter.",
      nameErrorReserved: "Names can't contain “-dev-”",

      // ── Creation errors (mapped from VCaaS codes) ─────────────────────────
      errorAlreadyExists: "That name is taken. We picked {name} instead — or choose your own.",
      errorInvalidName: "Use lowercase letters, numbers and single hyphens. Start with a letter.",
      errorInvalidNameLength: "Project names must be between 4 and 35 characters.",
      errorReservedName: "Project names can't contain “-dev-”. Please pick another.",
      errorRateLimited: "You're creating projects very quickly. Wait a moment and try again.",
      /**
       * ⚠️ NO LONGER A FIXED NUMBER. The creation rate is per plan (Free is one
       * every five minutes, Enterprise 100 a minute), so quoting "10 per minute" to
       * everybody was wrong for four of the five tiers. The exact figures live on
       * the billing page, which is one link away.
       */
      errorRateLimitedDetail: "Your plan limits how many new projects you can create per minute. Wait a moment and try again.",

      /** ⭐ THE CEILING — a wall, not a wait. See `mapCreateError`. */
      errorProjectLimit: "You've used all {count} projects included in your {plan} plan.",
      errorProjectLimitGeneric: "You've used every project your plan includes.",
      errorProjectLimitDetail:
        "Delete a project you no longer need, or move up a plan for more.",
      errorSeePlans: "See plans",
      errorInsufficientCredits: "You don't have enough credits to create a project.",
      errorInsufficientCreditsDetail: "Top up to keep building.",
      errorCreateFailed: "We couldn't create your project.",
      errorTopUp: "Top up credits",

      // ── List, toolbar, pagination ─────────────────────────────────────────
      listTitle: "Your projects",
      listCount: "{count} project",
      listCountPlural: "{count} projects",
      searchPlaceholder: "Search projects…",
      searchClear: "Clear search",
      reload: "Reload projects",
      sortLabel: "Sort",
      sortRecent: "Newest first",
      sortOldest: "Oldest first",
      sortModified: "Recently modified",
      sortOldestModified: "Least recently modified",
      sortNameAsc: "Name A–Z",
      sortNameDesc: "Name Z–A",
      sortLimitNotice: "Sorting by name covers your {limit} most recent projects of {total}. Switch to “Newest first” to see them all.",
      viewLabel: "Layout",
      viewGrid: "Grid view",
      viewList: "List view",
      newProject: "New project",
      // On the tile that closes the grid. It points back at the composer rather
      // than promising a second way to create — there is only one.
      newProjectHint: "Describe it in the box at the top",
      pageOf: "Page {page} of {total}",
      showingRange: "Showing {from}–{to} of {total}",
      goToPage: "Go to page {page}",

      // ── Creation-date filter ──────────────────────────────────────────────
      dateFilterLabel: "Filter by creation date",
      dateAny: "Any date",
      dateLast7: "Last 7 days",
      dateLast30: "Last 30 days",
      dateLast90: "Last 3 months",
      dateThisYear: "This year",
      dateCustom: "Custom range",
      dateClear: "Clear date filter",
      dateFrom: "From {date}",
      dateUntil: "Until {date}",
      dateRangeHintStart: "Pick the first day of the range",
      // A single chosen day is already a live filter ("since then"), so the hint
      // says what the second click would add rather than demanding it.
      dateRangeHintEnd: "Pick the last day, or leave it open-ended",
      emptyFilteredTitle: "No projects match these filters",
      emptyFilteredDescription: "Try a wider date range, or clear the filters to see everything.",
      filtersClear: "Clear filters",

      // ── Cards & rows ──────────────────────────────────────────────────────
      created: "Created {date}",
      openProject: "Open",
      openPreview: "Open preview",
      openProduction: "Open live app",
      /** The badge where the live address would be, on a project never deployed. */
      noProduction: "Not published yet",
      copyName: "Copy project name",
      projectActions: "Actions for {name}",
      untitled: "Untitled project",
      // The card footer. It says "Edited" rather than just showing a date, because
      // the same slot used to show the CREATION date and nothing would have told
      // anyone it changed meaning.
      modified: "Edited {date}",
      modifiedTitle: "Last modified {modified} · Created {created}",
      // The card's second, quieter date line. Short on purpose: it sits under a
      // relative date and must not compete with it.
      createdOn: "Created {date}",
      createdBy: "Created by {name}",
      createdByUnknown: "Creator unknown",
      lastEditedBy: "Last edited by {name}",
      columnName: "Project",
      columnStatus: "Status",
      columnCreated: "Created",
      columnModified: "Last modified",
      columnActions: "Actions",

      // ── Delete ────────────────────────────────────────────────────────────
      deleteTitle: "Delete {name}?",
      deleteDescription: "This permanently deletes the project, its code, its database and its live URL. This cannot be undone.",
      deleteConfirmLabel: "Delete project",
      deleteSuccess: "{name} was deleted",
      deleteFailed: "We couldn't delete {name}",

      // ── Empty & error states ──────────────────────────────────────────────
      /*
        THE FIRST-RUN LINE. It states the fact ("nothing here yet") and points at
        the one thing on screen that changes it — the composer above. Nothing more:
        the box is the guidance.
      */
      emptyTitle: "No projects yet",
      emptyDescription: "The apps you build will appear here. Describe your idea in the box above to create the first one.",
      /*
        ⭐ THE OTHER TWO WAYS IN. Rendered with `interpolateNodes`, so the two words
        are links to `/api` and `/mcp` and the translator keeps the whole sentence.
      */
      emptyOtherWays: "You can also create projects with the {api} or over {mcp}.",
      emptyOtherWaysApi: "API",
      emptyOtherWaysMcp: "MCP",
      emptySearchTitle: "No projects match “{query}”",
      emptySearchDescription: "Try a different search, or clear it to see everything.",
      loadFailedTitle: "We couldn't load your projects",
      loadFailedDescription: "The project service didn't answer. Check your connection and try again.",

      // ── Live-region announcements ─────────────────────────────────────────
      announceCreating: "Creating {name}",
      announceCreated: "{name} created. Opening the workspace.",
      announceLoaded: "{count} projects loaded",
      announceLoading: "Loading projects",
    },
    project: {
      title: "Workspace",
      description: "Chat with the agent, preview your app, browse code and data.",
      placeholderTitle: "Workspace",
      placeholderDescription: "The project workspace is being built.",
      backToProjects: "All projects",
    },
    api: {
      title: "API",
      description: "Create API keys and build on the Totalum API from your own code.",
      placeholderTitle: "API keys and reference",
      placeholderDescription: "Key management and the full endpoint reference land here.",
    },
    mcp: {
      title: "MCP",
      description: "Connect Claude Code, Cursor, Windsurf and more straight to your projects.",
      placeholderTitle: "MCP setup",
      placeholderDescription: "Per-editor configuration snippets land here.",
    },
    whitelabel: {
      title: "Whitelabel",
      description: "Put an AI app builder inside your own product, under your brand.",
    },
    support: {
      title: "Support",
      description: "Ask us anything about your account, your projects or your bill.",
      placeholderTitle: "Support chat",
      placeholderDescription: "Your conversation with our team will live here.",
    },
    usage: {
      title: "Usage",
      description: "See exactly where your credits go, by day, project and action.",
      placeholderTitle: "Credit analytics",
      placeholderDescription: "Charts and per-project breakdowns land here.",
    },
    billing: {
      title: "Billing",
      description: "Your plan, your credits and everything you've paid for.",
      placeholderTitle: "Plan and credits",
      placeholderDescription: "Plan comparison, credit packs and invoices land here.",
    },
    settings: {
      soundTitle: "Sounds and notifications",
      soundToggle: "Play a chime when a run finishes",
      soundDescription: "A short sound when your app finishes building, and a softer one if something went wrong.",
      notificationsToggle: "Show a desktop notification",
      notificationsDescription: "Only when this tab is in the background. Your browser will ask for permission.",
      notificationsBlocked: "Your browser has blocked notifications for this site.",
      notificationsGranted: "Notifications are on.",
      title: "Settings",
      description: "Profile, language, notifications and security.",
      placeholderTitle: "Preferences",
      placeholderDescription: "Profile and notification settings land here.",
    },
    designSystem: {
      title: "Design system",
      description:
        "Every token and primitive in this product. Check your screens against this page.",
      devOnly: "Development only",
      colorRoles: "Colour roles",
      colorRamps: "Colour ramps",
      dataPalette: "Data palette",
      typography: "Typography",
      radii: "Radii",
      shadows: "Elevation",
      spacing: "Spacing rhythm",
      motion: "Motion",
      primitives: "Primitives",
      buttons: "Buttons",
      statusPills: "Status pills",
      skeletons: "Skeletons",
      emptyStates: "Empty and error states",
      modals: "Modals",
      toasts: "Toasts",
      openModal: "Open modal",
      openConfirm: "Open confirm dialog",
      demoModalTitle: "A modal, at any width",
      demoModalDescription:
        "Centred dialog on desktop, bottom sheet on mobile. Focus is trapped, ESC closes.",
      demoConfirmTitle: "Delete this thing?",
      demoConfirmDescription: "Nothing is actually deleted — this is the design system page.",
      toastSuccess: "Show success toast",
      toastError: "Show error toast",
      toastInfo: "Show info toast",
      toastLoading: "Show loading toast",
      sampleToastSuccess: "Deployment finished",
      sampleToastError: "Deployment failed",
      sampleToastInfo: "Your preview is warming up",
      sampleToastLoading: "Working on it…",
    },
  },

  /**
   * ═══ FEATURE G5 — THE ONE POST-REGISTRATION QUESTION ═══════════════════════
   *
   * Copy rules for this screen: it is the last step of a signup, so it promises a
   * destination rather than describing a setting. Both options are phrased as
   * things the user will DO, and neither is presented as the default — the visual
   * order is builder-first only because it is the larger audience.
   */
  /**
   * ⭐ SHAREABLE TEMPLATE LINKS — `/register?template=<alias>` → `/import-template`.
   *
   * ⚠️ THE COPY NEVER PROMISES THE PROJECT IS READY. What this screen waits for is
   * the import STARTING; the build itself carries on in the workspace behind the
   * import overlay, which is the thing that says when it is finished.
   */
  templates: {
    title: "Setting up your project",
    resolving: "Getting your template ready…",
    preparing: "Setting up {template}",
    preparingGeneric: "Setting up your project",
    body: "We're creating your project and copying the template into it. This takes a moment — you'll land inside it automatically.",
    cost: "This uses {credits} credits from your balance.",
    opening: "Opening your project…",
    alreadyTitle: "You already have this one",
    alreadyBody: "This template has already been imported into your account. We're opening the copy you have.",
    unavailableTitle: "That link is no longer available",
    unavailableBody:
      "The template behind it has been retired or turned off. Nothing was created and nothing was charged.",
    failedTitle: "We couldn't set that up",
    goToProjects: "Go to my projects",

    /* ⚠️ EVERY ONE OF THESE IS ACTIONABLE, and each is mapped from a CODE rather
       than shown as the server's own sentence — same rule and same reason as
       `transfer.error.*`: a failure that only says "failed" leaves the user with a
       half-spent flow and no idea whether to retry, wait, or top up. The server's
       words are still the fallback for anything unmapped. */
    error: {
      nothingPending: "There's no template waiting to be set up. Your projects are all here.",
      inProgress:
        "This template is already being set up on your account — that's another tab or a moment ago. Give it a minute and check your projects.",
      nameUnavailable:
        "You already have projects with every name we'd give this one. Import it from your projects page instead and pick a name.",
      insufficientCredits:
        "You don't have enough credits to set this up. Top up from Billing and open the link again — nothing was charged.",
      unavailable: "Our account service didn't answer. Nothing was charged — try again in a moment.",
    },
    partialCreated:
      "The project {project} was created and charged for, but the template didn't copy into it. You can open it and start from there, or delete it.",
  },

  onboarding: {
    title: "Welcome",
    heading: "What brings you to Totalum?",
    headingNamed: "Welcome, {name}. What brings you to Totalum?",
    subheading: "Pick one so we can start you in the right place. You can do both later.",
    choose: "Start here",
    reassurance: "This only decides where you land — nothing is locked in.",
    error: "We couldn't save that. Please try again.",
    builder: {
      title: "Build apps myself",
      body: "Describe what you want and watch it get built, deployed and hosted.",
      point1: "Prompt, preview and edit in the browser",
      point2: "Database, auth, domains and hosting included",
    },
    api: {
      title: "Use Totalum from my code",
      body: "Drive the whole builder from the API, or from an agent over MCP.",
      point1: "Create and deploy projects with one call",
      point2: "Works with Claude Code, Cursor and Windsurf",
    },
  },

  auth: {
    social: {
      continueWithGoogle: "Continue with Google",
      connecting: "Opening Google…",
      dividerEmail: "or continue with email",
      dividerSocial: "or",
      notLinked:
        "That email already has a Totalum account with a password. Sign in with your password first, then link Google from settings.",
      noEmail: "Google didn't share an email address, so we can't match it to an account.",
      signupDisabled: "New accounts through Google are turned off right now.",
      restart: "That took too long and the sign-in expired. Give it another go.",
      genericError: "We couldn't finish signing you in with Google. Try again.",
      /*
        ⚠️ IT MUST SAY NOTHING WAS CREATED. The refusal happens before the account
        exists, so the only correct next step is "press the button again and pick the
        other Google account" — copy that sounded like a broken account would send
        people to support for something they can fix in one click.
      */
      invitationMismatch:
        "That invitation was sent to a different email address. Continue with the Google account that uses the invited address — nothing was created for the one you picked.",
      invitationUnavailable:
        "We couldn't check that invitation, so we didn't start the Google sign-in. Reload the page and try again.",
      linkedProviders: "Sign-in methods",
      googleLinked: "Google is connected",
      passwordSet: "Password sign-in is on",
      passwordNotSet: "No password yet",
    },
    setPassword: {
      heading: "Password",
      descriptionNone:
        "You signed in with Google, so there's no password on this account yet. Add one and you'll be able to sign in either way.",
      descriptionSet: "Change the password you use to sign in with your email.",
      action: "Set a password",
      actionChange: "Change password",
      sending: "Sending…",
      sent: "Check your inbox — we sent you a link to {email}.",
      // F5 — the flow is a code now, not a link.
      codeSent: "We sent an 8-digit code to {email}. Enter it to choose your password.",
      doneWithCode: "Your password is set. You can now sign in with Google or with your email.",
      failed: "We couldn't send that email. Try again in a moment.",
      loadFailed: "We couldn't check your sign-in methods.",
    },
    errors: {
      generic: "Something didn't work. Please try again.",
      network: "We couldn't reach our servers. Check your connection and try again.",
      rateLimited: "Too many attempts. Please wait a minute and try again.",
      captchaFailed: "We couldn't verify that you're human. Please try again.",
      /**
       * ⚠️ THE OTHER HALF OF `CAPTCHA_FAILED`, and it needs the opposite advice —
       * see the note at the call site in `RegisterForm`. Shown only when the check
       * never RAN: a blocked script, or a site key not registered for this domain.
       */
      captchaUnavailable:
        "The human check couldn't run on this page. An ad blocker or privacy extension is the usual cause \u2014 turn it off here, or try another browser. If it keeps failing, tell support: this site's domain may not be registered with our captcha provider.",
      emailNotAllowed: "That email address can't be used to create an account.",
      emailInvalid: "That doesn't look like a valid email address.",
      serviceUnavailable: "Our account service is briefly unavailable. Please try again in a moment.",
    },
    shared: {
      email: "Email",
      emailPlaceholder: "you@company.com",
      password: "Password",
      passwordPlaceholder: "At least 8 characters",
      confirmPassword: "Confirm password",
      name: "Full name",
      namePlaceholder: "Your name",
      showPassword: "Show password",
      hidePassword: "Hide password",
      emailLabelHint: "We'll send a confirmation code here.",
      protectedByRecaptcha: "Protected by reCAPTCHA.",
      socialProof: "Join the builders shipping real apps on Totalum.",
      noCreditCard: "No credit card required · 50 free credits",
      or: "or",
      backToLogin: "Back to sign in",
      termsNotice: "By continuing you agree to our {terms} and {privacy}.",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      legalHeading: "Legal",
    },
    login: {
      title: "Welcome back",
      subtitle: "Sign in to keep building.",
      submit: "Sign in",
    /* The single button a legacy address gets — no password field, no Google.
       ⚠️ It must NOT say "continue to the old panel" or name a platform. */
    continueToAccount: "Continue",
      submitting: "Signing in…",
      forgotPassword: "Forgot your password?",
      noAccount: "New to Totalum?",
      createAccount: "Create an account",
      emailRequired: "Enter your email address.",
      passwordRequired: "Enter your password.",
      resendVerification: "Resend the verification email",
      resendSent: "Sent. Check your inbox.",
      unknownAccountHint: "No account yet?",
      invalidCredentials: "That email and password don't match an account.",
      unverified: "Your email isn't verified yet. Check your inbox for the link.",
      genericError: "We couldn't sign you in. Please try again.",
    },
    register: {
      title: "Start building",
      subtitle: "Create your account and ship your first app in minutes.",
      submit: "Create account",
      submitting: "Creating your account…",
      haveAccount: "Already have an account?",
      signIn: "Sign in",
      emailTaken: "That email is already registered. Try signing in instead.",
      emailRequired: "Enter your email address.",
      invitedEmailLocked: "This is the address your invitation was sent to, so it can\u2019t be changed.",
      nameRequired: "Tell us your name.",
      openMailApp: "Open my inbox",
      wrongEmail: "Wrong address?",
      startOver: "Start over",
      checkInboxHint: "The code expires in 1 hour. Check your spam folder if it hasn't arrived.",
      verifying: "Checking that email…",
      passwordMismatch: "The two passwords don't match.",
      passwordTooShort: "Use at least 8 characters.",
      passwordStrengthWeak: "Weak",
      passwordStrengthFair: "Fair",
      passwordStrengthStrong: "Strong",
      genericError: "We couldn't create your account. Please try again.",
      /* ⚠️ SAYS NOTHING ABOUT WHY. The non-production environment only accepts
         internal addresses (`@/lib/dev-signup-guard`), and naming that rule would
         tell a prober exactly what to type before the `@`. It reads as an ordinary
         transient failure, which is the intent. */
      signupUnavailable: "We couldn't complete your registration. Try a different account.",
      checkInboxTitle: "Check your inbox",
      checkInboxDescription: "We sent an 8-digit code to {email}. Enter it to activate your account.",
      resend: "Resend the email",
      resent: "Sent. Give it a minute to arrive.",
    },
    verifyEmail: {
      title: "Verifying your email",
      subtitle: "One moment while we confirm your address.",
      provisioningTitle: "Finishing your setup",
      provisioningDescription: "We're getting your account ready. This usually takes a second — press retry if it doesn't.",
      resend: "Send a new code",
      resendIn: "Send a new code in {seconds}s",
      resent: "Sent. Check your inbox.",
      goToLogin: "Go to sign in",
      successTitle: "You're all set",
      successDescription: "Your email is verified. Let's build something.",
      errorTitle: "That link didn't work",
      errorDescription: "It may have expired or already been used. Request a new one.",
      continue: "Continue",

      // ── The 8-digit code (Improvement I3) ──────────────────────────────
      codeTitle: "Enter your code",
      codeSubtitle: "We sent an 8-digit code to {email}. It's in the subject line too.",
      codeSubtitleNoEmail: "Type the 8-digit code we emailed you.",
      codeLabel: "Verification code",
      codeDigitLabel: "Digit {position} of {total}",
      codeSubmit: "Verify my email",
      codeSubmitting: "Verifying…",
      codeHint: "The code expires in an hour. You can paste it straight in.",
      codeEmailLabel: "Which address did you sign up with?",
      codeInvalid: "That code isn't right. Check the digits and try again.",
      codeExpired: "That code has expired. Send yourself a new one.",
      codeTooManyAttempts: "Too many wrong tries. Request a new code to continue.",
      codeUnknownEmail: "We don't have a sign-up for that address.",
      codeVerified: "Email verified",
      openInbox: "Open your inbox",
      wrongEmail: "Wrong address?",
      startOver: "Start over",
    },
    recovery: {
      /**
       * ⚠️ `/forgot-password` OFFERS ONE PATH NOW — the sign-in code. The
       * "set a new password instead" branch and its copy (`sendResetCode`, `or`,
       * `switchToReset`, `switchToSignIn`, `codeTitleReset`, `newPasswordTitle`,
       * `newPasswordSubtitle`, `doneTitle/Subtitle/Hint`) are DELETED, not
       * commented out. The keys that remain from that flow — `continue`,
       * `newPasswordLabel`, `savePassword`, `saving`, `backToCode`,
       * `passwordTooShort`, `resend` — are still live: `settings/SetPasswordWithCode`
       * uses them for a signed-in user setting their FIRST password.
       */

      // ── Step 1: the address ────────────────────────────────────────────────
      sendSignInCode: "Email me a sign-in code",
      sendSignInCodeHint: "Fastest way back in. Your password stays exactly as it is.",
      sending: "Sending…",

      // ── Step 2: the code ───────────────────────────────────────────────────
      codeBadge: "8-digit code",
      codeTitleSignIn: "Enter your sign-in code",
      codeSubtitle:
        "If {email} has a Totalum account, an 8-digit code is on its way. It's valid for 15 minutes.",
      // {time} is mm:ss — the code's real, server-enforced life ticking down.
      expiresIn: "This code expires in {time}",
      signInWithCode: "Sign in",
      continue: "Continue",
      checking: "Checking…",
      resend: "Send me another code",
      wrongEmail: "Use a different email address",

      // ── Setting a password (settings → security, not this screen) ──────────
      newPasswordLabel: "New password",
      savePassword: "Save and continue",
      saving: "Saving…",
      backToCode: "Back to the code",
      passwordTooShort: "Use at least 8 characters.",
    },
    forgotPassword: {
      // ⚠️ NOTHING HERE PROMISES A LINK OR A PASSWORD. The screen sends one
      // 8-digit sign-in code and nothing else — the "Send reset link" /
      // "a reset link is on its way" strings were left behind by the pre-F5 flow,
      // were reachable by nobody, and are gone so they cannot be re-wired.
      title: "Can't get in?",
      subtitle: "Tell us your email and we'll send you an 8-digit code.",
      emailRequired: "Enter your email address.",
      rememberedIt: "Remembered it?",
    },
    resetPassword: {
      title: "Choose a new password",
      subtitle: "Make it something only you would guess.",
      confirmPassword: "Confirm the new password",
      missingToken: "This page needs the link from your email to work.",
      requestNewLink: "Request a new link",
      goToLogin: "Sign in",
      newPassword: "New password",
      submit: "Update password",
      submitting: "Updating…",
      successTitle: "Password updated",
      successDescription: "You can sign in with your new password now.",
      invalidToken: "This reset link is invalid or has expired.",
    },
    legacyAccount: {
      /*
        ⚠️⚠️ THIS COPY MUST NOT ANNOUNCE THE MIGRATION. It used to open with "Your
        account lives on our previous platform" and name accounts.totalum.app
        twice — which told a customer who was simply signing in, as they have for
        years, that something had changed under them and they were on the wrong
        side of it. Nothing here is untrue now; it is just no longer THEIR problem.
        Say what is happening ("we've sent you a code") and nothing about where
        their account is hosted or which platform is which.
      */
      title: "Check your email",
      description: "We've sent a sign-in code to {email}.",
      descriptionNoEmail: "Enter your email and we'll send you a sign-in code.",
      cta: "Continue in the browser",
      secondary: "Use a different email",
      // Feature F4 — the handoff. The page signs them in from here now.
      signInHere: "Send me a code",
      signInHereHint: "We'll email you an 8-digit code and take you straight in.",
      sending: "Sending your code…",
      codeSent: "We sent an 8-digit code to {email}. Enter it to continue to your account.",
      continue: "Continue to my account",
      verifying: "Signing you in…",
      redirecting: "Taking you to your account…",
      resend: "Send me another code",
      codeInvalid: "That code isn't right. Check your inbox and try again.",
      codeExpired: "That code has expired. Send yourself a new one.",
      /* ── The Google screen. ⚠️ NAMES NO PLATFORM — see the component. ── */
      googleTitle:
        "Your account signs in with your email address rather than through Google.",
      googleContinue: "Continue with my email",
      googleHint: "No password needed — we'll take you straight in.",
      notLegacy: "We couldn't find an account for that email.",
      rateLimited: "Too many attempts. Wait a few minutes and try again.",
      unavailable: "We couldn't sign you in automatically. Use the link below instead.",
    },

    // Feature F7 — joining someone else's account.
    acceptInvitation: {
      loading: "Checking your invitation…",
      title: "Join {owner} on Totalum",
      titleFallback: "You've been invited to Totalum",
      roleLine: "You've been invited as {role}.",
      sentTo: "The invitation was sent to {email}.",
      /** ⚠️ The one thing this page must never leave ambiguous. */
      whoseAccount:
        "You'll be working inside {owner}'s account: their projects, their plan, their credits. You won't have an account of your own to pay for.",
      whoseAccountFallback:
        "You'll be working inside the account that invited you: their projects, their plan, their credits. You won't have an account of your own to pay for.",
      expiresOn: "This invitation expires {date}.",
      signedInAs: "You're signed in as {email}.",
      accept: "Join this account",
      accepting: "Joining…",
      registerCta: "Create your account to join",
      registerHint:
        "Sign up with {email} — the address the invitation was sent to — and we'll bring you straight back here.",
      newAccountOnly:
          "This invitation can only be accepted with a new account. If you already use Totalum with another address, ask for the invitation to be sent there instead.",
      loginCta: "I already have an account",
      wrongEmailTitle: "This invitation is for a different email",
      wrongEmailDescription:
        "It was sent to {invited} but you're signed in as {current}. Sign out and come back with the right address.",
      signOut: "Sign out",
      successTitle: "You're in",
      successDescription: "You now have access to {owner}'s account.",
      successDescriptionFallback: "You now have access to the account that invited you.",
      goToProjects: "Go to projects",
      invalidTitle: "This invitation link doesn't work",
      invalidDescription:
        "It may have been used already, revoked, or copied incompletely. Ask whoever invited you to send a new one.",
      expiredTitle: "This invitation has expired",
      expiredDescription: "Ask whoever invited you to send a new one — it only takes them a click.",
      alreadyMemberTitle: "You're already part of this account",
      alreadyMemberDescription: "Nothing to do here — head to your projects.",
      unavailableTitle: "We couldn't check your invitation",
      unavailableDescription:
        "That's on us, not on the link. Try again in a moment.",
      errors: {
        INVITATION_NOT_FOUND:
          "This invitation link doesn't work. Ask whoever invited you to send a new one.",
        INVITATION_NOT_PENDING: "This invitation has already been used or was revoked.",
        INVITATION_EXPIRED: "This invitation has expired. Ask for a new one.",
        ALREADY_A_MEMBER: "You already belong to another Totalum account, so you can't join this one.",
        ACCOUNT_ALREADY_EXISTS:
            "This email already had a Totalum account before the invitation was sent, so it can't be used to join. Ask for a new invitation for an address that doesn't have an account yet.",
        EMAIL_IS_SELF: "That's your own account — there's nothing to join.",
        USER_NOT_FOUND: "We couldn't find your account. Sign in again and reopen this link.",
        FORBIDDEN: "This invitation was sent to a different email address.",
        UNAUTHENTICATED: "Sign in to accept this invitation.",
        generic: "We couldn't complete this. Try again in a moment.",
      },
    },
  },

  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has moved.",
    cta: "Back to projects",
  },

  /**
   * The route-level crash screen (`src/app/error.tsx`). Three lines, on purpose:
   * the reader cannot act on a React error code, and the only action we can
   * honestly offer is starting over from the top.
   */
  errorBoundary: {
    title: "Something went wrong",
    description: "There was an error on this page.",
    /* ⚠️ THE BUTTON LEAVES FOR `/` — it does not re-render what just crashed. */
    retry: "Retry",
  },

  // ── Phase 08: the project workspace ──────────────────────────────────────
  workspace: {
    tabsLabel: "Workspace panels",

    /**
     * ⭐ THE MENU BEHIND THE TOTALUM MARK (`WorkspaceMenu`).
     *
     * ⚠️ MOST OF ITS ROWS ARE **NOT** IN HERE, and that is deliberate: Version
     * history, Secrets, Restart the server, Get free credits and the three theme
     * options all reuse the strings their old triggers used
     * (`workspace.actions.*`, `workspace.preview.restart*`, `referrals.cta.menu`,
     * `userMenu.theme*`). A second copy of "Secrets" that could drift from the
     * modal's own title is worse than a slightly scattered dictionary.
     */
    menu: {
      trigger: "Project menu",
      /**
       * The trigger's accessible name now that it carries the project name too.
       * ⚠️ IT MUST NAME THE PROJECT: with the label visible, a screen reader that
       * announced only "Project menu" would drop the one piece of information the
       * sighted user gets for free from the same control.
       */
      triggerNamed: "{project} — project menu",
      /* "Dashboard", not "Back" or "All projects": it is a place, and naming the
         place is what tells someone they will not lose their project by going. */
      dashboard: "Dashboard",
      recentProjects: "Recent projects",
      /* Shown when this is the only project the account has. */
      recentEmpty: "This is your only project so far",
      recentRetry: "Couldn't load them — try again",
      allProjects: "All projects",
      /* "Duplicate" alone reads as "duplicate what?" inside a list of rows that
         are mostly about this project's settings. */
      duplicate: "Duplicate this project",
      /** ⚠️ The ACCOUNT's settings, not the project's — the two rows sit together
       *  in the menu and each names its noun. Goes to `/settings/usage`. */
      accountSettings: "Account settings",
      appearance: "Appearance",
      /* The balance, in the shape people read it: "45 left". */
      /**
       * ⭐ THE CARD'S ONE ACTION. "Get more" alone (the sidebar widget's wording)
       * is ambiguous next to a balance; naming the noun makes the button readable
       * without its context.
       */
      getMoreCredits: "Get more credits",
      creditsLeft: "{credits} left",
    },
    mobileSwitchLabel: "Switch between chat and panel",
    showChat: "Show chat",
    hideChat: "Hide chat",
    resizeChat: "Resize the chat panel",
    loadFailedTitle: "We couldn't open this project",
    loadFailedDescription: "The project service didn't answer. Check your connection and try again.",

    tabs: {
      preview: "Preview",
      code: "Code",
      database: "Database",
      chat: "Chat",
    },

    // Feature F8 — who else is in this project, right now.
    presence: {
      label: "{count} other people in this project",
      labelOne: "1 other person in this project",
      peerOnTab: "{name} · {tab}",
      onThisTab: "Here now: {names}",
      idle: "idle",
    },

    actions: {
      versions: "Version history",
      secrets: "Secrets",
      domain: "Custom domain",
      github: "GitHub",
      figma: "Figma",
      support: "Need help?",
      logs: "Logs",
      comingSoon: "{name} opens here shortly — it's being built.",
    },

    runFinishedTitle: "Your app is ready",
    runFinishedBody: "{project} finished building.",
    runFailedTitle: "That run didn't finish",
    runFailedBody: "{project} hit a problem.",

    chat: {
      promptLabel: "Message the agent",
      placeholder: "Describe what to change…",
      placeholderRunning: "The agent is working…",
      send: "Send",
      stop: "Stop the run",
      /*
        ⚠️ STOPPING IS CONFIRMED, BECAUSE IT IS NOT A PAUSE. The button sits where
        Send sits — a millimetre from the key people press by reflex — and the run it
        kills has already been paid for and cannot be resumed, only started again.
      */
      stopConfirmTitle: "Stop the agent?",
      stopConfirmBody: "The agent stops where it is. Whatever it has already written stays, but the rest of this run is lost — you'd have to ask again to continue.",
      stopConfirmAction: "Stop the run",
      stopConfirmKeep: "Keep working",
      emptyTitle: "Tell the agent what to build",
      emptyDescription: "Describe a change and it writes the code, then updates the preview.",
      running: "The agent is working…",
      idle: "The agent is idle",
      completed: "Completed",
      runFailed: "That run couldn't be started",
      buildSteps: "{count} build steps",
      buildingSteps: "Building… ({count})",

      /* ── The run progress bar ─────────────────────────────────────────────
         ⚠️ "~" AND "usually" ARE LOAD-BEARING. There is no real percentage to
         report (the agent says `init` or `done`), so the estimate must read as an
         estimate everywhere it appears. */
      /* ⚠️ "4 to 10 minutes" — the RANGE is what makes it read as an estimate, so
         the old "~" is gone: it was there when this quoted a single generous number
         ("~25 min") that every real run then contradicted. Both numbers come from
         `RUN_ESTIMATE_MIN_MS` / `RUN_ESTIMATE_MS`; never hard-code them here. */
      progressEstimate: "{from} to {minutes} minutes",
      progressLabel: "How long this run has been going",
      progressOverrun: "Longer than usual",

      /* ── The stalled-run notice ───────────────────────────────────────── */
      stuckTitle: "The agent looks stuck",
      stuckBody:
        "It has been working for a while with almost nothing to show. Stopping the run and restarting the agent server usually clears it — that takes about {minutes} minutes.",
      stuckAction: "Stop and restart server",
      stuckWorking: "Restarting…",
      loadEarlier: "Load earlier messages",
      showAll: "Show everything",
      showLess: "Show less",
      viewChanges: "View changes",
      diffComingSoon: "The diff viewer arrives in the next update.",
      code: "Code",
    },

    /* The inline form the agent's secret request turns into — see SecretsRequest.tsx. */
    secretsRequest: {
      title: "The agent needs a key",
      description: "Add it here and the run picks up where it stopped. Values are encrypted and never shown again.",
      missingCountOne: "1 missing",
      missingCountMany: "{count} missing",
      valuePlaceholder: "Paste the value…",
      valueFor: "Value for {name}",
      entryLabel: "Environment {index}",
      removeEntry: "Remove this environment",
      addEnvironment: "Use a different value per environment",
      saveOne: "Save key",
      saveMany: "Save {count} keys",
      saving: "Saving…",
      savedTitleOne: "Key saved",
      savedTitleMany: "{count} keys saved",
      notifyAgent: "Tell the agent it can continue",
      notified: "The agent has been told. It'll carry on from here.",
      /* Sent to the agent verbatim as the next prompt — write it as the user would. */
      followUpPrompt:
        "I've saved the keys you asked for ({names}). They're in the project's environment now — please carry on.",
    },

    preview: {
      pathLabel: "Preview path",
      /* ── The page list beside the address box ── */
      pagesLabel: "Pages in this project",
      pagesLoad: "Find my pages",
      pagesRetry: "Try again",
      pagesFailed: "We couldn't read your project's pages.",
      pagesNoMatch: "No page matches that.",
      pagesDynamic: "dynamic",
      pagesNeedsSource:
        "Reading your project's pages uses the same source-code read as the Code tab, which costs 1 credit. It's free after that for the rest of your session.",
      loading: "Loading your app…",
      emptyTitle: "No preview yet",
      emptyDescription: "Send your first instruction and your app appears here.",
      buildingTitle: "Building your app…",
      buildingDescription: "The preview appears as soon as the server is up.",
      errorTitle: "The preview didn't load",
      errorDescription:
        "The dev server may still be starting, or it may have gone to sleep. Try again, or open it in a new tab.",
      /**
       * ⚠️ DIFFERENT FROM `errorTitle` ON PURPOSE. That one means "we could not tell
       * whether it loaded" (a timeout on a cross-origin frame). This one means we
       * FETCHED the page and read wreckage — so it may state it plainly.
       */
      brokenTitle: "This preview is broken",
      brokenDescription:
        "Your app isn't being served properly — the page is empty, unstyled, or showing the sandbox's error screen. The agent can usually fix it.",
      brokenFix: "Ask the AI to fix it",
      brokenPrompt:
        "The preview of my app is broken — it isn't rendering properly (the page is blank, unstyled, or shows the sandbox error screen instead of my app). Please investigate the build, find what's failing, fix it and rebuild the app.",
      /**
       * ⭐ THE "IT LOOKS ALMOST RIGHT" FAILURE. The markup renders and every one of
       * the app's script chunks is refused, so the page is a photograph of itself:
       * nothing hydrates, no button works, no client component ever mounts.
       *
       * ⚠️ SAY WHAT THEY CAN SEE, THEN WHAT WE MEASURED. "Nothing on the page works"
       * is the symptom they already have; "its JavaScript isn't being served" is the
       * part they cannot know and the reason it is not their design's fault.
       */
      brokenScriptsTitle: "This preview isn't running",
      brokenScriptsDescription:
        "The page is rendering, but none of its JavaScript is loading — so nothing on it is interactive. That's usually a build that isn't being served properly, not a problem with your design.",
      brokenScriptsPrompt:
        "The preview of my app renders its HTML, but none of its JavaScript loads — every script chunk under /_next/static fails, so the page is completely inert (nothing is interactive and no client component mounts). Please investigate the build and the dev server, find why the JavaScript assets aren't being served, fix it and rebuild the app.",
      cachedSnapshot: "Cached snapshot · the server is asleep",
      useLive: "Show the live app",
      /**
       * ⚠️ THE ANSWER WHEN THE ASK IS TOO EARLY. `useLive` re-reads the project rather
       * than forcing the live url, so a press before the app is serving has to say
       * something — silence would read as a broken button.
       */
      liveNotReady: "Your app isn't serving yet. This is the last saved copy — we'll switch to the live one as soon as it's ready.",
      viewportMobile: "Mobile view",
      viewportDesktop: "Desktop view",
      restartServer: "Restart the server",
      restartTitle: "Restart the development server?",
      /* ⚠️ "About a minute" was wrong: upstream runs the whole sandbox setup and
         documents 2-4 minutes. Under-promising here is what made the button look
         broken — people waited out the minute and concluded nothing had happened. */
      restartDescription:
        "The preview goes offline for 2 to 4 minutes while the server comes back up. Your code and data are untouched.",
      restartConfirm: "Restart the server",
      restartStarted: "The server is restarting…",
      restartDurationNotice: "This takes 2 to 4 minutes. You can keep working in the chat.",
      restarting: "Restarting the server…",
      /* ⚠️ THESE TWO DO NOT REPEAT THE BANNER ABOVE THEM. `workspace.operation.restartServer`
         already says what is happening, how long it takes and how far along it is — this
         panel answers a different question: why the page you were looking at is gone. Saying
         "Restarting your development server / this takes 2 to 4 minutes" here (which it used
         to, before the banner existed) put the same two sentences on screen twice, forty
         pixels apart. */
      restartingTitle: "Nothing to preview for a moment",
      restartingDescription:
        "We've taken the last page down rather than leave you looking at something that is no longer being served. It comes back by itself.",
      restartReady: "Your development server is back up",
      restartSlow:
        "The server is taking longer than usual. It may still be starting — refresh the preview in a moment.",
    },

    deploy: {
      publish: "Publish",
      deploying: "Publishing…",
      live: "Live",
      liveNow: "Live now",
      notPublished: "Not published yet. Publishing puts your app online at a public URL.",
      deployNow: "Publish now",
      deployAgain: "Publish the latest changes",
      openLive: "Open the live app",
      durationNotice: "Building and publishing takes about 3 minutes. You can keep working meanwhile.",
      started: "Publishing started",
      succeeded: "Your app is live",
      failed: "The deployment failed",
      customDomain: "Custom domain",
      customDomainManage: "Custom domain",
      customDomainHint: "Use your own web address",

      // ── The publish dialog ────────────────────────────────────────────────
      titleFirst: "Publish your app",
      titlePublished: "Publish the latest changes",
      subtitleFirst: "Put your app online at a public address anyone can open.",
      subtitlePublished: "Your app is already online. Publishing again replaces it with what you have built since.",
      willBeLiveAt: "It will be live at",
      whatHappens: "What happens when you publish",
      whatHappensAgain: "What happens when you publish again",
      factPublic: "Your app becomes public — anyone with the address can open it.",
      factReplace: "The live version is replaced. Visitors see the new one as soon as it finishes.",
      costNotice: "Publishing costs 1 credit.",
      domainSection: "Address",
      domainActive: "Active",
      domainPendingDns: "Pending DNS",
      domainDeploying: "Setting up HTTPS",
      domainBlocked: "Blocked",
      domainRemoving: "Removing",
      domainSslFailed: "HTTPS failed",
      domainOpenSetup: "Open domain setup",
      dnsNotice:
        "DNS changes can take up to 5 hours to propagate. Your domain goes live automatically once the records verify.",

      /* ── The badge beside Publish ──────────────────────────────────────────
         Short on purpose: it sits in a header that already holds the project
         name, three tabs and the button it is warning you about. */
      domainBadgePending: "DNS pending",
      domainBadgeFailed: "Domain problem",
      domainBadgeAria: "Custom domain {hostname} — {status}. Open domain setup.",
    },

    /* ═══ WHILE THE PROJECT IS BUSY ══════════════════════════════════════════
       Four long operations — publish, rebuild, pull from GitHub, restart the
       server — that take minutes on the sandbox and pause the chat. One shape of
       copy for all four, so the banner, the locked composer and the refusals never
       describe the same state in three different voices. See
       `src/lib/project-operation.ts`.

       ⚠️ `{min}`/`{max}` COME FROM `OPERATION_PROFILES`, NOT FROM THE SENTENCE.
       Writing "2 to 4 minutes" by hand here is how the copy and the progress bar
       drift apart — the bar fills against `max`, so the words have to be the same
       number.

       ⚠️ EVERY `description` PROMISES THE CHAT COMES BACK BY ITSELF. That is the
       one question a locked box raises, and answering it is the difference between
       waiting and reloading. */
    operation: {
      progressLabel: "How far along this is",
      estimate: "of ~{minutes} min",
      overrun: "Longer than usual",

      publish: {
        title: "Publishing your project",
        description:
          "This takes {min} to {max} minutes. You can keep looking around — the chat comes back on its own when it finishes.",
        chatLock: "Paused while your project is publishing",
        chatLockToast:
          "You can't send prompts while your project is publishing. It takes {min} to {max} minutes and the chat unlocks by itself.",
        blocked: "Your project is publishing. Wait until it finishes — {min} to {max} minutes.",
        stalled:
          "Publishing is taking longer than usual, so we've stopped watching it. Reload in a moment to see where it got to.",
      },

      rebuild: {
        title: "Rebuilding your project",
        description:
          "Your saved changes are being built. This takes {min} to {max} minutes and the chat comes back on its own.",
        chatLock: "Paused while your project is rebuilding",
        chatLockToast:
          "You can't send prompts while your project is rebuilding. It takes {min} to {max} minutes and the chat unlocks by itself.",
        blocked: "Your project is rebuilding. Wait until it finishes — {min} to {max} minutes.",
        stalled:
          "The rebuild is taking longer than usual, so we've stopped watching it. Check your preview in a moment.",
      },

      githubPull: {
        title: "Pulling from GitHub",
        description:
          "Your repository is replacing the code on this project. This takes {min} to {max} minutes and the chat comes back on its own.",
        chatLock: "Paused while we pull from GitHub",
        chatLockToast:
          "You can't send prompts while we're pulling from GitHub — your files are being replaced. It takes {min} to {max} minutes.",
        blocked: "We're pulling from GitHub. Wait until it finishes — {min} to {max} minutes.",
        stalled:
          "The pull is taking longer than usual, so we've stopped watching it. Open GitHub sync in a moment to check.",
      },

      /* ⚠️ THIS ONE NAMES WHAT IT OVERWRITES. The other four leave the project's code
         where it is (or replace it with the same code); a restore replaces what you
         have built since that snapshot, and someone watching a three-minute bar is
         entitled to be reminded which way round it goes. */
      restoreVersion: {
        title: "Restoring a version",
        description:
          "Your project is going back to the version you picked. This takes {min} to {max} minutes and the chat comes back on its own.",
        chatLock: "Paused while a version is restored",
        chatLockToast:
          "You can't send prompts while a version is being restored — your files are being replaced. It takes {min} to {max} minutes and the chat unlocks by itself.",
        blocked: "A version is being restored. Wait until it finishes — {min} to {max} minutes.",
        stalled:
          "The restore is taking longer than usual, so we've stopped watching it. Check your preview in a moment.",
      },

      /* ⭐ THE ONLY ONE THAT BLOCKS THE WHOLE SCREEN — see `ImportOverlay`. The
         `succeeded` / `failed` keys are its own rather than borrowed from the
         transfer dialogs, because an import is now finished HERE, in the workspace,
         and not in the dialog that started it. */
      import: {
        title: "Setting up your project",
        description:
          "We're copying everything in and building it. This takes {min} to {max} minutes — you can leave and come back.",
        chatLock: "Paused while your project is set up",
        chatLockToast:
          "You can't send prompts while a project is being imported — its files and database are being replaced. It takes {min} to {max} minutes and the chat unlocks by itself.",
        blocked: "Your project is still being imported. Wait until it finishes — {min} to {max} minutes.",
        succeeded: "Your project is ready.",
        failed: "The import didn't finish. Your project is here, but it may be empty or incomplete.",
        stalled:
          "This is taking longer than usual, so we've stopped watching it. The import is still running on our side — check back in a few minutes.",
      },

      restartServer: {
        title: "Restarting your development server",
        description:
          "Your app is offline while it comes back up. This takes {min} to {max} minutes and the chat comes back on its own.",
        chatLock: "Paused while your server restarts",
        chatLockToast:
          "You can't send prompts while the development server is restarting — there is nothing running to build against yet. It takes {min} to {max} minutes.",
        blocked:
          "Your development server is restarting. Wait until it finishes — {min} to {max} minutes.",
        stalled:
          "The server is taking longer than usual to come back. We've stopped watching it — try refreshing the preview in a moment.",
      },
    },

    /* ═══ THE MOMENT IT GOES LIVE ════════════════════════════════════════════
       ⚠️ THE ADDRESS IS THE CONTENT. This dialog exists so the URL can be read,
       copied and opened — everything else in it is one line. */
    published: {
      title: "Your project is live",
      description: "Anyone with the address below can open it right now.",
      urlLabel: "Public address",
      open: "Open my app",
      note: "Publishing again replaces this version with whatever you've built since. Your address stays the same.",
    },

    code: {
      loadTitle: "Browse your code",
      loadDescription: "Read every file the agent has written, right here. Included on every plan.",
      loadAction: "Load the code",
      loading: "Downloading your code…",
      loadFailed: "We couldn't load your code",
      refresh: "Fetch the latest code",
      searchPlaceholder: "Find a file…",
      noMatches: "No file matches “{query}”",
      fileCount: "{count} files",
      files: "Files",
      breadcrumb: "File path",
      askAi: "Ask AI to edit",
      askAiPrompt: "In {path}, ",
      download: "Download this file",
      githubConnect: "Sync with GitHub",
      githubConnected: "GitHub connected",
      downloadProject: "Download project",
      downloadProjectDone: "Your project is downloading",
      downloadProjectFailed: "We couldn't download your project",

      // ── The editor (files API) ────────────────────────────────────────────
      save: "Save",
      saved: "{name} saved",
      saveFailed: "We couldn't save that file",
      unsaved: "Unsaved changes",
      fileFailed: "We couldn't open that file",
      tooLargeToOpen: "This file is over 1 MB, which is too large to open in the editor. Download the project to read it.",
      rebuildNeeded: "Saved. Your app keeps serving the previous build until you rebuild it.",
      rebuildInProgress: "Rebuilding. Your changes go live when it finishes.",
      rebuildNow: "Rebuild now",
      rebuildStarted: "Rebuild started",
      rebuildDuration: "This usually takes 1 to 4 minutes.",
      rebuildDone: "Rebuild finished — your changes are live",
      rebuildFailed: "The rebuild didn't finish",
      noSelectionTitle: "No file selected",
      noSelectionDescription: "Pick a file from the tree to read it.",
      binaryTitle: "Can't preview this file",
      binaryDescription: "It isn't text, so there's nothing to show in the editor. You can still download it.",
      largeTitle: "This file is large",
      largeDescription: "It's {size}. Opening very large files can make the editor slow to respond.",
      largeShowAnyway: "Open it anyway",
    },

    database: {
      // ── Feature H3: the CMS ───────────────────────────────────────────
      edit: "Edit",
      linkFailed: "The record saved, but we couldn't create one of its links",
      unlinkFailed: "The record saved, but we couldn't remove one of its links",
      relation: {
        manyToOne: "belongs to one",
        oneToMany: "has many",
        manyToMany: "linked to many",
        oneToOne: "one to one",
      },
      files: {
        choose: "Choose a file",
        fromUrl: "or attach from a URL",
        urlPlaceholder: "https://example.com/photo.jpg",
        attach: "Attach",
        urlFailed: "We couldn't attach that URL",
        orDrop: "or drop it here",
        limit: "Up to 12 MB per file",
        none: "No file attached.",
        uploading: "Uploading {file}",
        uploaded: "File attached",
        uploadedMany: "{count} files attached",
        uploadFailed: "We couldn't upload {file}",
        tooLarge: "{file} is over the 12 MB limit",
        singleOnly: "This field holds one file, so we kept the first one.",
        download: "Download",
        preview: "Open {file}",
        /* ⭐ The `+X` badge on a file cell / field. It is a button, so it needs a
           name a screen reader can read — "+7" on its own says nothing. */
        showAll: "Show all {count} files",
        galleryTitle: "Attached files",
        galleryCount: "{count} attached",
        /* Shown ONLY when the field holds more than the gallery draws. Saying
           which ones are missing is the honest version of a silent slice. */
        galleryTruncated: "Showing the first {shown} of {total} files.",
        remove: "Remove",
        removed: "File removed",
        removeTitle: "Remove this file?",
        removeBody:
          "It comes off this record when you save. The file itself stays in your project's storage.",
      },
      link: {
        chooseExisting: "Choose one",
        addExisting: "Link one",
        createNew: "New {table}",
        clear: "Clear",
        nothingLinked: "No {table} linked yet.",
        unlinkOne: "Unlink {record}",
        searchPlaceholder: "Search {table}…",
        searchFailed: "We couldn't search that table.",
        noMatches: "Nothing matches that search.",
        tableEmpty: "This table has no records yet.",
        /*
          ⚠️ THIS IS NOW A LAST RESORT, NOT THE `oneToMany` DEFAULT. It shows only
          when the field on the {table} side cannot be identified with certainty —
          two links back to this table and no shared property id — because then
          the link really is not writable from here. Everywhere else the relation
          is edited in place.
        */
        oneToManyHint:
          "These live on the {table} side, and this relation is declared in a way we can't write from here — open the {table} record and set its link field there.",
        oneToManySaveFirst:
          "Save this record first — a {table} is attached by pointing it at this record, so it needs an id to point at.",
        /*
          ⚠️ NAMES THE FIELD IT WRITES. "Saved immediately" alone tells you the
          timing but not the blast radius; people are entitled to know that
          pressing this edits a row in another table.
        */
        childWritesImmediately:
          "Linking and unlinking writes {field} on the {table} record straight away — it doesn't wait for Save.",
        childrenTruncated: "Showing the first {count}. Filter the {table} table to see the rest.",
        childLinked: "Linked",
        childUnlinked: "Link removed",
        /*
          ⚠️ NOT `workspace.database.linkFailed`, WHICH READS "the record saved,
          but…". Nothing was saved here — the failure is the whole action, and
          borrowing that string would tell the user their record was written when
          it was not.
        */
        childLinkFailed: "We couldn't link that record",
        childUnlinkFailed: "We couldn't remove that link",
        alreadyLinked: "linked elsewhere",
        moveTitle: "Move it to this record?",
        moveBody:
          "{record} is linked to another record. A {table} can only be linked to one, so this moves it here — the other record loses it. Nothing is deleted.",
        moveConfirm: "Move it here",
      },
      filter: {
        title: "Filters",
        subtitle: "Narrow the list — including by what's in a linked table.",
        empty: "No filters yet. Add a condition to narrow this table.",
        addCondition: "Add a condition",
        addGroup: "Add a group",
        groupLabel: "Any of these",
        removeGroup: "Remove this group",
        removeCondition: "Remove this condition",
        combinator: "How to combine",
        and: "and",
        or: "or",
        apply: "Apply",
        clear: "Clear all",
        counting: "Counting…",
        matches: "{count} match",
        showQuery: "Show the query",
        hideQuery: "Hide the query",
        queryHint: "This is what the filters above send to your database.",
        whereLabel: "Which table",
        fieldLabel: "Which field",
        operatorLabel: "Condition",
        valueLabel: "Value",
        thisTable: "{table}",
        relatedTable: "linked {table}",
        pickField: "Pick a field",
        pickValue: "Pick a value",
        valuePlaceholder: "Value",
        listPlaceholder: "a, b, c",
        op: {
          eq: "is",
          ne: "is not",
          contains: "contains",
          startsWith: "starts with",
          endsWith: "ends with",
          gt: "is after",
          gte: "is at least",
          lt: "is before",
          lte: "is at most",
          in: "is one of",
          nin: "is none of",
          isEmpty: "is empty",
          isNotEmpty: "is not empty",
        },
      },
      detail: {
        fields: "Fields",
        noFields: "This table has no editable fields.",
        related: "Related records",
        noRelated: "No {table} linked to this record yet.",
        addRelated: "Add {table}",
        open: "Open",
        /* ⭐ The accessible name of a linked-record link in the grid. The visible
           text is the record's own label, which on its own gives a screen-reader
           user no hint that it opens anything. */
        openRecord: "Open {record}",
        loading: "Opening…",
        openFailed: "We couldn't open that record",
        /* The `_id`, kept visible in the editor. Quiet, but never hidden. */
        recordId: "Record ID",
        unlink: "Unlink",
        unlinked: "Link removed",
        unlinkFailed: "We couldn't remove that link",
        unlinkTitle: "Remove this link?",
        unlinkBody:
          "This only removes the connection. The {table} record itself is not deleted and you can link it again later.",
        loadFailed: "We couldn't load these records.",
      },

      tableLabel: "Table",
      viewData: "Data",
      viewSchema: "Schema",
      searchPlaceholder: "Search records…",
      jsonView: "JSON",
      newRecord: "New record",
      editRecord: "Edit this record",
      deleteRecord: "Delete this record",
      systemField: "System",
      nullValue: "empty",
      referencePlaceholder: "The _id of the referenced record",

      // Typed table cells — a linked-record column and a file column say what they
      // hold rather than printing `{…}`.
      // ── The tables aside and the pager ────────────────────────────────────
      searchTables: "Find a table…",
      sortByName: "Name",
      sortByRecords: "Records",
      noTableMatches: "No tables match that search.",
      rowsPerPage: "Rows per page",
      rowsPerPageOption: "{count} rows",
      deleteRecordConfirmTitle: "Delete this record?",
      linkedCount: "{count} linked",
      fileCount: "{count} files",
      rowCount: "{count} row",
      rowCountPlural: "{count} rows",

      tablesFailed: "We couldn't load your tables",
      tablesFailedDescription: "The database didn't answer. Your server may still be starting.",
      recordsFailed: "We couldn't load these records",
      recordsFailedDescription: "The query didn't go through. Try again in a moment.",
      noTablesTitle: "No tables yet",
      noTablesDescription: "Ask the agent to build a feature that stores data, and its tables appear here.",
      emptyTitle: "No records yet",
      emptyDescription: "This table is empty. Add the first record, or let your app create one.",
      noMatchesTitle: "Nothing matches “{query}”",
      noMatchesDescription: "Try a different search, or clear it to see every record.",

      createTitle: "New record",
      editTitle: "Edit record",
      formDescription: "In the {table} table.",
      noEditableFields: "This table has no editable fields.",
      invalidJson: "That isn't valid JSON.",
      created: "Record created",
      updated: "Record updated",
      deleted: "Record deleted",
      deleteFailed: "We couldn't delete that record",
      deleteTitle: "Delete this record?",
      deleteDescription: "This permanently removes the record from your app's database. It cannot be undone.",

      showingCount: "{from}–{to} of {total}",
      showingPage: "Page {page}",
    },

    // Feature F12 — the visual editor.
    visualEditor: {
    // ── G4: naming a change in words ────────────────────────────────────────
    changeLabel: "{role} {aspect}",
    changeOn: "on {element}",
    undoOneNamed: "Undo: {change}",
    roleHeading: "Heading",
    roleParagraph: "Paragraph",
    roleButton: "Button",
    roleLink: "Link",
    roleImage: "Image",
    roleVideo: "Video",
    roleListItem: "List item",
    roleLabel: "Label",
    roleQuote: "Quote",
    roleElement: "Element",
    aspectText: "text",
    aspectSize: "size",
    aspectTextColor: "colour",
    aspectBgColor: "background",
    aspectStyle: "style",
    aspectMedia: "source",
    /** Joins the aspects of one collapsed change: "Heading size and colour". */
    aspectJoin: " and ",

    // ── G4: colour picker ───────────────────────────────────────────────────
    colorFromProject: "Your project's colours",
    colorCustom: "Custom…",
    colorHideCustom: "Hide",
    colorApply: "Use",

    // ── G4: apply progress ──────────────────────────────────────────────────
    stepWrite: "Writing the changes into your code",
    stepBuild: "Rebuilding your app",
    stepReload: "Reloading the preview",
    rebuildLeaveHint: "You can keep using the rest of the workspace — we'll reload the preview when it's ready.",
    appliedTitle: "Your changes are live",

    // ── G4: discard confirmation ────────────────────────────────────────────
    discardConfirmTitle: "Discard your visual changes?",
    discardConfirmBody: "{changes} will be thrown away and the preview goes back to how it was. This can't be undone.",

    // ── G4: unsupported project ─────────────────────────────────────────────
    unsupportedTitle: "This page can't be edited visually",
    unsupportedBody: "We couldn't find editable markup here — the page may be built from a component library or generated at runtime. Describe the change in the chat instead and the agent will make it.",
    unsupportedAction: "Ask the agent instead",

    // ── G4: the help popover ────────────────────────────────────────────────
    helpTitle: "Editing visually",
    helpIntro: "Click anything in your preview, then change its text, size, colours or image. Nothing touches your code until you press Apply.",
    helpCanTitle: "What works well",
    helpCan1: "Text, size, colours and image sources on most elements",
    helpCan2: "Several edits at once — they're written and rebuilt together",
    helpCan3: "Asking the agent about the block you've selected",
    helpCantTitle: "What it can't do yet",
    helpCant1: "Moving, adding or deleting elements",
    helpCant2: "Text built from data, or classes assembled by a helper like cn()",
    helpCant3: "Anything it can't place in your code with confidence — it will say so rather than guess",
    helpCost: "Applying costs 0.3 credits, plus the usual cost of the rebuild. Nothing is charged if nothing is applied.",
    helpOpen: "How this works",
    errorUnsafeWrite: "We couldn't apply these changes safely, so nothing was written. Your files are untouched — try selecting the element again.",
    /**
     * ⚠️ DELIBERATELY NAMES NO CAUSE THE USER CAN ACT ON, because there is none: the
     * write endpoint is not returning what it is sent, and no amount of retrying or
     * re-selecting changes that. It promises the one thing that matters — their files
     * were not touched — and points at the chat, which writes by a different route.
     */
    errorWriteNotFaithful: "We couldn't write to your project safely just now, so nothing was changed. Your files are untouched. Ask the assistant in the chat to make this change instead, and try the visual editor again later.",
    oneChange: "1 change",
    nChanges: "{count} changes",
    oneFile: "1 file",
    nFiles: "{count} files",
    unsavedLabel: "{changes} not saved yet",
    appliedNone: "Nothing could be applied — every change is listed below with the reason.",
    appliedCount: "{changes} written to {files}.",
    errorPlanRequired: "Editing your code needs a paid plan. Your changes are still here — upgrade and press Apply again.",
    errorRebuildRunning: "Your app is already rebuilding. Wait for that to finish, then apply these changes.",
    errorTreeUnavailable: "We couldn't read your project's files. Nothing was written — try again in a moment.",
    errorNoSourceFiles: "We couldn't find any editable source files in this project.",
    errorAgentRunning: "The agent is working on this project. Wait for it to finish, then apply these changes.",
    errorNetwork: "The connection dropped before we heard back. Your files may or may not have been written — check the Code tab before applying again.",
    errorRebuildFailed: "Your files were written, but the rebuild failed. Open the Logs to see why, then rebuild from the preview toolbar.",
    errorRebuildTimeout: "The rebuild is taking longer than expected. Your files were written — check the preview in a few minutes.",
    errorRebuildNotFound: "We couldn't find the rebuild we started. Your files were written; rebuild from the preview toolbar to see them.",
    errorAppDown: "The rebuild finished but your app isn't responding yet. Your changes were saved — give it a moment and refresh the preview.",
      title: "Visual editor",
      panelLabel: "Visual editor inspector",
      barLabel: "Unsaved visual changes",
      open: "Edit visually",
      blockedPrompt: "You can't edit visually while the agent is building. Wait for this prompt to finish.",
      blockedPublish: "You can't edit visually while your project is publishing.",
      blockedRebuild: "You can't edit visually while your project is rebuilding.",
      blockedPull: "You can't edit visually while changes are being pulled from GitHub.",
      blockedRestart: "You can't edit visually while the development server is restarting.",
      /**
       * ⚠️ THE ONE THAT IS NOT ABOUT SOMETHING THE USER STARTED. The other four name an
       * operation in flight; this one is "your app is not being served yet", which is the
       * state a project sits in while it comes back from sleep — and the state in which
       * the editor used to open over the archived copy and let people edit nothing.
       */
      blockedStarting:
        "Your live app isn't ready yet. Visual editing needs it running — give it a moment and try again.",
      close: "Close the visual editor",
      connecting: "Connecting to your preview…",
      unavailableTitle: "The visual editor can't open this preview",
      unavailableDescription:
        "Your project needs a running preview before you can edit it visually. Start the server from the preview toolbar and try again.",
      pickTitle: "Click anything in your app",
      pickDescription: "Pick a heading, a paragraph, an image — then change its text, size, colours or source here. Nothing is saved until you apply.",
      selection: "Selected",
      text: "Text",
      textHint: "Press ⌘/Ctrl + Enter to apply, Escape to cancel.",
      noTextHint: "This element wraps other elements, so it has no text of its own. Pick the heading or paragraph inside it.",
      size: "Text size",
      smaller: "Make the text smaller",
      bigger: "Make the text bigger",
      colors: "Colours",
      textColor: "Text",
      bgColor: "Background",
      media: "Image or video",
      mediaPlaceholder: "https://… or /images/photo.jpg",
      mediaHint:
        "Paste a URL, or a path to a file in your project's public folder. Uploading costs 0.5 credits.",
      noClassHint:
        "This element has no classes in your code, so size and colour can't be mapped back to a file. Ask the AI below and it can still make the change.",
      mediaDrop: "Drop an image here",
      mediaBrowse: "Choose a file",
      mediaUploading: "Uploading…",
      mediaUploadFailed: "We couldn't upload that file. Try again.",
      mediaNotAnImage: "That file isn't an image or a video.",
      mediaTooLarge: "That file is larger than {size} MB.",
      askTitle: "Ask about this block",
      askPlaceholder: "e.g. make this section stack on mobile",
      askSend: "Ask the agent",
      askPrompt: "About the {element} on {route} (text: “{text}”, classes: {classes}): {question}",
      kindText: "Text",
      kindStyle: "Style",
      kindMedia: "Media",
      showList: "Show them",
      hideList: "Hide them",
      discardAll: "Discard all",
      apply: "Apply changes",
      undoOne: "Undo this change",
      applying: "Applying your changes…",
      applyingHint: "Finding each change in your code and writing it.",
      rebuilding: "Rebuilding your app…",
      rebuildingHint: "This takes 1-4 minutes. The editor is locked until it finishes.",
      applyFailed: "We couldn't apply these changes. Nothing was written — try again.",
      /**
       * ⚠️ G4 — TWO KEYS, BECAUSE SPANISH CONJUGATES. The single key read
       * "1 no se han podido ubicar" — plural verb, singular subject. Same trap the
       * credit copy hit in Phase 16 and the bar's own `oneChange`/`nChanges` solved:
       * pick the sentence by count rather than interpolating into a fixed one.
       */
      unmappedSummary: "{change} couldn't be placed in your code:",
      unmappedSummaryMany: "{change} couldn't be placed in your code:",
      unmappedNotFound: "we couldn't find that exact text in the source.",
      unmappedAmbiguous: "it appears in several places and we can't tell which one you meant.",
      unmappedLowConfidence: "we weren't confident enough about the match to change it.",
      unmappedOverlapping: "another change in this batch already rewrote that part of the file. Apply again to make this one.",
      /**
       * ⭐ G6 — the only refusal that is NOT about our confidence. We know which
       * element it is; the source computes that value instead of writing it, so
       * there is nothing to edit. Retrying cannot help, and the copy must not
       * suggest it — the chat can do this, and that is where it points.
       */
      unmappedUnsupported: "we found the element, but this value is built by your code rather than written in it. Ask in the chat and the agent will change it.",
      rebuildNotStarted: "The files were written, but the rebuild didn't start. Rebuild from the preview toolbar to see the change.",
      lockedTitle: "The editor is locked while your app rebuilds",
    },

    logs: {
      title: "Server logs",
      // ⚠️ CORRECTED IN F9: development and production are two different machines.
      modalDescription: "Your development server and your published site, side by side.",
      sourceLabel: "Which logs to show",
      sourceDev: "Development",
      sourceProd: "Production",
      devHint: "Output from the dev server that powers your preview.",
      /**
       * ⚠️ "A FEW MINUTES" WAS WRONG BY TWO ORDERS OF MAGNITUDE, and it is half the
       * reason production logs read as broken. Cloudflare Logpush delivers to the
       * `startum-logs` worker in batches that were measured lagging 2–3.5 hours on
       * 2026-08-06 (the newest record across 100 live projects moved from 08:11Z to
       * 09:48Z between two scans taken 37 minutes apart). Someone who visits their
       * own site and immediately opens this tab will correctly see nothing, and the
       * old copy told them to expect otherwise.
       */
      prodHint: "Requests to your published site over the last {range}. Delivered in batches — the last couple of hours may be missing.",
      // ⚠️ USED IN TWO PLACES — the range select's own options AND inline inside
      // sentences ("over the last {range}"). Keep them as bare durations so both
      // read correctly; the select's aria-label supplies the "how far back" framing.
      rangeLabel: "How far back to look",
      rangeHours: "{count} h",
      rangeDays: "{count} days",
      updated: "Updated {when}",
      introDescription:
        "Live output from the server behind your preview — everything your app prints while you build.",
      introProdDescription:
        "Requests handled by your published site, with anything your code logged while serving them.",
      load: "Load the logs",
      refresh: "Refresh the logs",
      autoRefresh: "Auto",
      autoRefreshHint: "Refresh the logs every 10 seconds. Pauses while this tab is in the background.",
      autoRefreshHintProd:
        "Refresh the production logs every 30 seconds. Pauses while this tab is in the background. Each refresh counts towards your plan's log-request limit.",
      download: "Download the logs",
      searchPlaceholder: "Filter lines…",
      searchProdPlaceholder: "Search production (regex)…",
      prodSearchHint:
        "Searches the whole {range} window on the server, not just what's on screen. Regular expressions work: error|timeout",
      noMatches: "No line matches “{query}”",
      matchCount: "{count} of {total} lines",
      jumpToBottom: "Jump to the latest",
      newEntries: "New entries",
      emptyTitle: "No logs yet",
      emptyDescription:
        "Nothing has been logged. Use your app — submit a form, load a page — then refresh.",
      emptyProdTitle: "Nothing from production yet",
      emptyProdDescription:
        /**
         * ⚠️ THE THIRD SENTENCE IS NOT PADDING — IT IS A MEASURED FACT. A request
         * answered straight from the static-asset layer never invokes the Worker, so
         * Cloudflare emits no trace event and it can NEVER appear here. Measured
         * 2026-08-06: 6 asset-served 200s produced 0 records, while all 31
         * middleware/SSR 307s produced one record each. Without this line, the owner
         * of a purely static landing page is told their site has no traffic when it
         * has plenty.
         */
        "No requests have reached your published site in the last {range} — or they have, and Cloudflare hasn't delivered them here yet. Batches can lag a couple of hours, so try a longer window before assuming it's quiet. Pages served straight from static files never appear here at all: only pages your app renders, plus API routes, are logged.",
      emptyProdSearchDescription:
        "Nothing in the last {range} matches that search. Try a shorter pattern, a longer window, or clear it to see the most recent requests.",
      notDeployedTitle: "You haven't published this project yet",
      notDeployedDescription:
        "Production logs start the moment your site goes live. Publish it, and the requests real visitors make will show up here.",
      fetchFailed: "We couldn't fetch the logs",
      fetchFailedDescription: "Your server may not be running. Try restarting it from the preview toolbar.",
      fetchFailedProdDescription:
        "We couldn't reach the production log service. Nothing is wrong with your site — try again in a moment.",
      rateLimitedTitle: "You've hit your plan's log limit",
      rateLimitedDescription:
        "Production logs are limited per plan. Wait for the limit to reset, or upgrade for more.",
    },

    unsavedTitle: "Discard your changes?",
    unsavedDescription: "You've typed something that hasn't been saved. Closing now loses it.",
    unsavedDiscard: "Discard",
    unsavedKeepEditing: "Keep editing",

    /**
     * The pencil beside the project name — what a project IS, as opposed to what is
     * in it: its name, its folder, and who can reach it.
     *
     * ⚠️ NEVER CALL `label` A "RENAME" IN COPY. `projectId` is the hostname and
     * cannot change; promising a rename and then leaving every URL untouched is how
     * someone concludes the save failed. Every string here says "name" and shows the
     * id alongside it.
     */
    projectSettings: {
      open: "Project settings",
      title: "Project settings",
      description: "Its name, the group it belongs to, and who can reach it.",
      labelLabel: "Project name",
      labelHint: "Just a name for you — the project's address stays",
      descriptionLabel: "Description",
      descriptionPlaceholder: "What this project is for…",
      descriptionHint: "Only you and your team see this.",
      save: "Save changes",
      saved: "Project updated",
      saveFailed: "We couldn't save those changes",

      groupHeading: "Group",
      groupDescription: "Optional. Groups are folders for your projects — a project can be in one.",
      groupNone: "No group",
      groupsLoading: "Loading your groups…",
      groupsFailed: "We couldn't load your groups. Your project is unaffected — try again in a moment.",
      groupProjectCount: "{count} projects",
      groupOneProject: "1 project",
      groupCreate: "New group",
      groupNameLabel: "Group name",
      groupNamePlaceholder: "Client work",
      groupDescriptionPlaceholder: "What goes in here (optional)",
      groupCreateAndLink: "Create and add this project",
      groupCreateFailed: "We couldn't create that group",
      groupLinked: "Moved to {name}",
      groupRemoved: "Removed from its group",
      groupUnlink: "Remove from group",
      groupFailed: "We couldn't change this project's group",

      accessHeading: "Who can reach this project",
      accessDescription:
        "Everyone here can open this project. Access is set per person for the whole account.",
      accessLoading: "Loading…",
      accessEmpty: "It's just you — nobody else has access to this project.",
      accessDenied: "You can't see this account's members. Ask the account owner who else works here.",
      accessEdit: "Can edit",
      accessView: "View only",
      accessEditButton: "Edit users project access",
    },

    versions: {
      title: "Version history",
      description: "Every completed run leaves a snapshot you can go back to.",
      restore: "Restore",
      /* ⚠️ TWO MESSAGES, BECAUSE THERE ARE TWO MOMENTS. `restoreStarted` fires when the
         request is accepted — which is 1-4 minutes before the work is done — and
         `restored` only when `versionRecovery` clears. They used to be one string said
         at the first moment, which told people their code was back while it was still
         being written. */
      restoreStarted: "Restoring {name}…",
      restored: "Version restored",
      restoreFailed: "We couldn't restore that version",
      restoreTitle: "Restore {name}?",
      restoreDescription:
        "This replaces your current code with this snapshot. Anything built since then is lost, and it can't be undone.",
      loadFailed: "We couldn't load your history",
      loadFailedDescription: "The version list didn't come through. Try again in a moment.",
      emptyTitle: "No versions yet",
      emptyDescription: "Once the agent completes a run, its snapshot appears here.",
    },

    secrets: {
      title: "Secrets",
      description: "API keys and other values your app needs. They're encrypted and never shown again once saved.",
      existing: "{count} saved",
      emptyTitle: "No secrets yet",
      emptyDescription: "Add the keys your app needs — a Stripe key, a database URL, anything private.",
      addOne: "Add one",
      pasteEnv: "Paste a .env",
      nameLabel: "Name",
      nameInvalid: "Use letters, numbers and underscores. Start with a letter or underscore.",
      nameDuplicate: "A secret with this name already exists. Saving will add a second one.",
      valueLabel: "Value",
      envLabel: "Environment",
      envBoth: "Development + Production",
      envDevelopment: "Development only",
      envProduction: "Production only",
      show: "Show the value",
      hide: "Hide the value",
      add: "Save secret",
      addAll: "Save {count} secrets",
      created: "{name} saved",
      createFailed: "We couldn't save that secret",
      delete: "Delete {name}",
      deleted: "{name} deleted",
      deleteFailed: "We couldn't delete that secret",
      deleteTitle: "Delete {name}?",
      deleteDescription: "Your app will no longer be able to read this value. This can't be undone.",
      bulkLabel: "Paste the contents of your .env",
      bulkHint: "Comments and blank lines are ignored. Values may contain = and #.",
      bulkPreview: "{count} secrets ready · {skipped} lines skipped",
      bulkCreated: "{count} secrets saved",
      bulkFailed: "These couldn't be saved: {names}",
    },

    domain: {
      title: "Custom domain",
      description: "Serve your published app at your own web address.",
      currentUrl: "Currently published at",
      hostnameLabel: "Your domain",
      hostnameHint: "Use a subdomain you control, like app.example.com.",
      hostnameInvalid: "Enter a domain like app.example.com — no https:// and no path.",
      save: "Add this domain",
      saved: "Domain added — now add the DNS records below",
      saveFailed: "We couldn't add that domain",
      remove: "Remove domain",
      removed: "Domain removed",
      removeFailed: "We couldn't remove that domain",
      removeTitle: "Remove {name}?",
      removeDescription: "Your app goes back to its totalum-project.com address. You can add the domain again later.",
      deployFirstTitle: "Publish your app first",
      deployFirstDescription:
        "A custom domain points at your published app, so there needs to be something to point at. Publish, then come back.",
      dnsTitle: "DNS records",
      /* ⭐ THE HEADING BECOMES THE INSTRUCTION while the records are outstanding.
         "DNS records" names a table; this one tells you what to do with it. */
      dnsTitleRequired: "Add these {count} records at your domain provider",
      dnsActionRequired: "Action needed",
      dnsDescription: "Add these at your domain provider. We check automatically every few minutes.",
      dnsDescriptionRequired:
        "Your domain won't work until these exist. Copy each one into your domain provider's DNS settings — we detect them automatically, so there is nothing to confirm here.",
      dnsType: "Type",
      dnsName: "Name",
      dnsValue: "Value",
      helpActive: "Your domain is live and serving over HTTPS.",
      helpPendingValidation:
        "Waiting for your DNS records. Add the records below at your domain provider — this usually takes a few minutes, but can take several hours.",
      helpPendingDeployment: "Your records checked out. We're setting up HTTPS — this takes a few minutes.",
      helpBlocked:
        "This domain can't be used. It may already be attached to another project, or be reserved. Try a different subdomain.",
      helpRemoving: "This domain is being detached. It'll disappear from here in a moment.",
      helpSslFailed:
        "We couldn't issue an HTTPS certificate for this domain. That almost always means a DNS record is missing or has a typo. Check the records below, then remove the domain and add it again.",

      /* ── Propagation status ────────────────────────────────────────────────
         DNS is the longest wait in the product and the only one with nothing
         visible happening. These strings are the difference between "still
         working on it" and "this is broken". */
      progressLabel: "Setup progress",
      stepOf: "Step {current} of {total} ·",

      /* ⚠️ ONE OR TWO WORDS. These are an inline rail sharing a row with a
         countdown and a button, not headings. */
      stepDnsShort: "DNS",
      stepSslShort: "HTTPS",
      stepLiveShort: "Live",

      /** ⭐ THE ONLY LINE HERE THAT ASKS FOR SOMETHING. Everything else is status. */
      actionAddRecords: "Add the DNS records below at your domain provider",
      /** The same fact where the records are NOT on screen — the publish dialog. */
      actionAddRecordsElsewhere: "your DNS records haven't been added yet.",

      stepDnsWaiting: "Waiting to check your records.",
      stepDnsActive: "Waiting for your DNS records.",
      stepDnsDone: "Your records are visible to us.",
      stepDnsFailed: "We can't use this hostname.",

      stepSslWaiting: "Starts once your records are found.",
      stepSslActive: "Records found — issuing your HTTPS certificate.",
      stepSslDone: "Certificate issued.",
      stepSslFailed: "The certificate couldn't be issued.",

      stepLiveWaiting: "The last step — nothing for you to do.",
      stepLiveActive: "Pointing your domain at your published app.",
      stepLiveDone: "Visitors reach your app at this address.",
      stepLiveFailed: "Your domain isn't serving your app.",

      checksAutomatically: "checking automatically",
      nextCheckIn: "next check {seconds}s",
      checking: "checking…",
      checkNow: "Check now",
      waitingFor: "Waiting {duration}",
      /* One line, both of them — the strip is four lines tall and stays that way. */
      expectationShort: "usually 5–30 min, up to 5 h.",
      slowShort: "longer than usual — check each record below matches exactly.",
    },

    // ── Feature H2: Figma connect ─────────────────────────────────────────
    figma: {
      title: "Figma",
      description: "Let the agent read your designs and build from them.",
      statusConnected: "Connected",
      statusNeedsAttention: "Needs attention",

      connect: "Connect Figma",
      reconnect: "Reconnect with this token",
      connecting: "Connecting…",
      connected: "Figma connected",
      connectFailed: "We couldn't connect Figma",
      disconnect: "Disconnect",
      disconnected: "Figma disconnected",
      disconnecting: "Disconnecting…",
      disconnectConfirm: "Disconnect Figma? The agent will not be able to read your designs until you connect it again.",
      disconnectPendingConfirm: "Forget this token? Nothing was connected yet — the project you're about to create will not have Figma.",
      pendingForgotten: "Figma token removed",
      disconnectFailed: "We couldn't disconnect Figma",
      replaceToken: "Replace token",
      loadFailed: "We couldn't check your Figma connection.",
      unknownAccount: "Figma account",

      /* ── The composer button (the Figma icon in the tool tray) ── */
      addToPrompt: "Add a Figma design",
      linkLabel: "Figma design link",
      linkHint: "In Figma, right-click a frame → Copy link to selection.",
      linkInvalid: "That doesn't look like a Figma link.",
      addAction: "Add to prompt",
      /** Used only when the box is EMPTY — otherwise just the link is appended. */
      promptTemplate: "Build this Figma design: {url}",
      gateTitle: "Connect Figma first",
      gateBody: "The agent reads your design through Figma's API, so it needs your access token. Connect once, then paste a link to any frame.",
      connectUnavailable: "Connect Figma from the project workspace to use designs in a prompt.",
      pendingTitle: "Figma is ready",
      pendingBody: "It will be connected to this project the moment you create it.",
      pendingConnectFailed: "The project was created, but Figma couldn't be connected",
      validating: "Checking the token…",
      validated: "Token accepted",
      notConnectedHint: "The agent needs your Figma account to read the design.",

      tokenLabel: "Figma access token",
      tokenBroken:
        "Figma is no longer accepting this token — it was probably revoked or it expired. Paste a new one to reconnect.",

      howToTitle: "Where to get a token",
      howToStep1: "In Figma, open Settings and go to the Security tab.",
      howToStep2: "Under Personal access tokens, click \"Generate new token\".",
      howToStep3: "Set an expiry you're comfortable with, tick the scopes below, then copy the token.",
      scopesLabel: "Scopes needed:",
      openFigmaSettings: "Open Figma settings",
      securityNote:
        "Your token is encrypted and only ever used by your own project's agent. We check it with Figma once when you connect it, and we never show it again.",

      enablesTitle: "What this enables",
      enables1: "Paste a Figma link in the chat and the agent reads that frame.",
      enables2: "It builds real components from your layout, spacing, colours and text.",
      enables3: "It reuses your styles and variables instead of inventing new ones.",
      enablesTip: "Tip: copy a link to a frame in Figma (right-click → Copy link) and paste it into a prompt.",

      confirmDisconnectTitle: "Disconnect Figma?",
      confirmDisconnectBody:
        "The agent will stop being able to read your designs. Nothing in Figma changes, and you can reconnect at any time.",
    },

    /**
     * ⭐⭐ THE SERVER IS ASLEEP AND WE ARE WAKING IT — see `use-server-wake.ts`.
     *
     * ⚠️ "STARTING", NOT "FAILED". Every one of these endpoints starts the server
     * itself and answers `SERVER_NOT_READY`; the work is already under way. Copy that
     * reads as an error is what makes someone press the button again and spend a
     * second server start.
     */
    serverWake: {
      /**
       * ⚠️ WRITTEN FOR SOMEONE WHO HAS NEVER HEARD OF A SANDBOX. This copy replaced the
       * raw API sentence — "Server is already starting (status: Unarchiving) … Poll GET
       * /projects/… and check agentServerStatus" — which is a correct instruction to a
       * program and four unknown words to the person who pressed Publish.
       */
      title: "Starting your project's server",
      body: "Your project went to sleep after a while without use. We're starting it back up — this usually takes 2 to 4 minutes. You can keep working in the meantime.",
      /**
       * ⚠️ IT NO LONGER PROMISES TO DO IT FOR THEM — see `notifyServerReady`. The wait
       * ends in a toast naming the action, and the click stays the user's. Copy that
       * promised an automatic publish while the code notified instead would be the worst
       * of both.
       */
      bodyWithAction: "Your project went to sleep after a while without use. We're starting it back up — usually 2 to 4 minutes — and we'll tell you the moment you can {action}.",
      /**
       * ⚠️ FOR THE THREE ACTIONS WE CANNOT REPLAY FOR THE USER — connect (the token is
       * gone), restore (destructive, confirmed in a closed dialog) and import (its own
       * dialog owns the retry). Saying "we'll do it when it's ready" there would be a
       * promise we do not keep, so this one asks plainly.
       */
      bodyRetry: "Your project went to sleep after a while without use. We're starting it back up — usually 2 to 4 minutes. Try again once it's ready.",
      failed: "Your project is taking longer than expected to start. Try again in a moment, or use Restart server in the preview toolbar.",
      /** Beside the bar once the typical duration has passed. */
      overrun: "Taking longer than usual",
      /**
       * ⭐ THE DIALOG THAT ANSWERS A REFUSED BUTTON (`SERVER_WAKE_BLOCKED_EVENT`).
       *
       * ⚠️ IT NAMES NO SINGLE ACTION, because one dialog answers all of them — publish,
       * rebuild, connect, pull, restore, save, apply. The strip inside it says what will
       * happen next for the action actually pressed; this says WHY nothing happened.
       */
      blockedTitle: "Your project's server is starting",
      blockedBody:
        "Your project went to sleep after a while without use, so this can't run just yet. We're starting it back up — it usually takes 2 to 4 minutes.",
      blockedCta: "Got it",
      /** The toast that ends the wait. `{action}` is one of the `action*` strings below. */
      readyFor: "Your project is ready — you can {action} now.",
      /**
       * ⭐ THE TWO HALVES OF `SANDBOX_NOT_REACHABLE`, WHICH NEED OPPOSITE ADVICE.
       *
       * ⚠️ NEITHER SENTENCE MENTIONS A SANDBOX, A STATUS CODE OR A PREVIEW URL — the
       * upstream message did all three and left the reader with nothing to do. What a
       * user needs here is which of the two things is happening and whether waiting is
       * the answer.
       */
      /**
       * ⚠️⚠️ ACTION-NEUTRAL, AND IT WAS NOT. This body read "…there's nothing to publish.
       * Give it a couple of minutes and press Publish again" because publish was its
       * first caller — and then the visual editor started using the same dialog, so
       * clicking "Edit visually" answered with instructions about publishing. One dialog
       * serves every action that needs the live app; its copy has to describe the STATE,
       * and let the button the user pressed be the thing they press again.
       */
      startingTitle: "Your project is still starting",
      startingBody:
        "Your app isn't answering yet, so there's nothing to work with. Give it a couple of minutes and try again.",
      appErrorTitle: "Your app isn't running",
      appErrorBody:
        "Your project's server is up, but the app isn't serving a page — publishing now would put that same broken page online. Ask the AI in the chat to fix it, then publish. Waiting won't change this one.",
      /** Slotted into `bodyWithAction`, so each one completes "we will …". */
      actionPublish: "publish",
      actionApply: "apply your changes",
      actionSave: "save your file",
      actionRebuild: "rebuild",
      actionConnect: "connect GitHub",
      actionPull: "pull from GitHub",
      actionRestore: "restore that version",
    },

    github: {
      title: "GitHub",
      description: "Keep a repository and your project in step.",

      flowTitle: "How Totalum uses your repository",
      /** ⚠️ Each of these is completed by a branch name in <code>. Keep them as
       *  sentence starts, not whole sentences. */
      flowPrompt: "After every prompt, Totalum commits and pushes to",
      flowPublish: "When you publish, it opens a pull request and merges it:",
      flowPull: "Before every prompt, it pulls the latest from",
      flowLocalWork: "Working on your own machine? Work on",
      flowMainWarning: "Don't commit to",
      /** ⚠️ PRECISE ON PURPOSE. Publishing merges develop into main; it only
       *  force-overwrites main when that merge CONFLICTS. "Always overwrites"
       *  would be a scarier claim than the code makes. */
      flowMainWarningEnd: " yourself — publishing merges develop into it, and overwrites it if the two conflict.",
      statusConnected: "Connected",
      statusNeedsAttention: "Token needs attention",
      manage: "Manage connection",
      connect: "Connect",
      connected: "GitHub connected",
      connectFailed: "We couldn't connect that repository",
      repoLabel: "Repository",
      repoHint:
        "Paste the repository URL, or type my-org/my-repo. It must already exist — if it already has code, it also needs develop and main branches.",
      /** Shown when we rewrote what was pasted, followed by the resolved owner/name. */
      repoResolved: "We'll connect:",
      repoInvalid: "That doesn't look like a GitHub repository.",
      tokenLabel: "Fine-grained personal access token",

      /**
       * ⚠️ THE THREE PERMISSION NAMES ARE NOT HERE, AND MUST NOT BE ADDED. They
       * are rendered untranslated from `GithubModal` because they are labels the
       * user has to find on GitHub's own page. See the note at that call site.
       */
      setupTitle: "How to connect",
      setupStep1: "Create a fine-grained token —",
      setupLink: "open the form",
      setupStep2: "Repository access → Only select repositories → pick your repo.",
      setupStep3: "Repository permissions → set all three to Read and write:",
      setupStep4: "Generate it, then paste it below. It starts with github_pat_.",
      directionLabel: "Sync direction",
      dirToGithub: "Totalum → GitHub",
      dirFromGithub: "GitHub → Totalum",
      directionHint: "Which side wins the first time they're synced. You can pull from GitHub at any time afterwards.",
      securityBody:
        "We send it straight to your project and never store it in your browser. If it leaks, revoke it on GitHub.",
      tokenInvalid: "This token is no longer valid. Reconnect with a new one.",
      tokenExpired: "This token has expired. Reconnect with a new one.",
      pull: "Pull from GitHub",
      pulling: "Pulling…",
      pullSucceeded: "Pulled the latest changes",
      pullFailed: "We couldn't pull from GitHub",
      pullNoChanges: "Already up to date",
      viewEnv: "View .env secrets",
      hideEnv: "Hide .env secrets",
      envTitle: "Synced environment files",
      envDescription: "What your repository currently has for each environment.",
      envEmpty: "(empty)",
      envFailed: "We couldn't read the .env files",
      disconnect: "Disconnect",
      disconnected: "GitHub disconnected",
      disconnectFailed: "We couldn't disconnect",
      disconnectTitle: "Disconnect this repository?",
      disconnectDescription:
        "Your project stops syncing with GitHub. Your code stays in both places — nothing is deleted.",
    },

    /* ⭐ The import overlay's own stage rail. Everything else on that screen — the
       scene, the tips, the clock — is shared with `firstRun`; only the four steps
       differ, because an import restores a backup and writes no code. */
    importRun: {
      backToProjects: "Back to my projects",
      /* ⚠️ THE TEMPLATE'S OWN NAME, when the import came from a shared link. It is
         what the person clicked, so it is what the wait should be about — a generic
         "Setting up your project" throws away the only thing they recognise. */
      titleNamed: "Setting up {template}",
      subtitle:
        "You can close this tab — the import keeps going, and this screen will still be here when you come back.",
      stageRestoring: "Restoring the project data",
      stageSource: "Setting up its code",
      stageDependencies: "Installing dependencies",
      stageBuilding: "Building and starting it up",
    },

    firstRun: {
      title: "Building your app",
      subtitle: "You can leave this page — we'll keep going, and it'll be here when you come back.",
      stepOf: "Step {step} of {total}",
      elapsed: "{time} elapsed",
      stageSandbox: "Creating your sandbox",
      stageDependencies: "Installing dependencies",
      stageWriting: "Writing your code",
      stageServer: "Starting your server",
      tipLabel: "Did you know…",
      tipProgress: "Fact {current} of {total}",
      previousTip: "Previous fact",
      nextTip: "Next fact",
      showTip: "Show tip {number}",

      /* The label on a tip's link. One generic phrase for all of them: the
         headline already says what you would be opening. */
      tipLink: "Learn more",

      tipDomainTitle: "Use your own domain",
      tipDomainChip: "Free HTTPS",
      tipDomain: "Point your own domain at this project and we issue and renew its HTTPS certificate for you.",
      tipDatabaseTitle: "Every project has a database",
      tipDatabaseChip: "No SQL",
      tipDatabase: "It's a real database, and the Database tab lets you read and edit your rows by hand.",
      tipGithubTitle: "GitHub syncs both ways",
      tipGithubChip: "Both ways",
      tipGithub: "Prompts push to develop, publishing pushes to main, and the commits you write yourself come back in.",
      tipFigmaTitle: "Build from your Figma designs",
      tipFigmaChip: "Figma",
      tipFigma: "Connect your Figma account once, then paste a frame link into a prompt and the agent builds that screen.",
      tipApiTitle: "Build your own app builder",
      tipApiChip: "One key",
      tipApi: "With one API key your own product can create projects, run prompts and publish them.",
      tipVisualEditTitle: "Edit text and images by hand",
      tipVisualEditChip: "Click to edit",
      tipVisualEdit: "Click anything in the preview to change its words, image, colour or size — the edit is written into your code.",
      tipSecretsTitle: "Keep API keys out of your code",
      tipSecretsChip: "Encrypted",
      tipSecrets: "Store them in Secrets: encrypted, with separate values for development and production.",
      tipLogsTitle: "Logs for dev and production",
      tipLogsChip: "Dev + prod",
      tipLogs: "Each one has its own stream, so you see an error the moment it happens and can paste it back to the agent.",
      tipMcpTitle: "Use Totalum from your AI agent",
      tipMcpChip: "MCP",
      tipMcp: "Connect the MCP server and Claude Code, Cursor or Windsurf can build, query and publish this project for you.",
      tipFullStackTitle: "A real full-stack app",
      tipFullStackChip: "SEO + GEO",
      tipFullStack: "Pages are rendered on the server and fast by default, so search engines and AI answer engines can read them.",
      tipCreditsTitle: "Earn 200 credits per friend",
      tipCreditsChip: "+200 credits",
      tipCredits: "Invite a friend for 50 credits when they join and 150 more when they first pay — or post about Totalum and ask us for credits.",
      tipTeamTitle: "Invite your teammates",
      tipTeamChip: "Whole account",
      tipTeam: "Anyone you invite works alongside you on every project in this account, not one at a time.",
      tipScaleTitle: "Room for a million projects",
      tipScaleChip: "1,000,000",
      tipScale: "One account holds up to a million of them, so there is no reason to be careful with an idea.",
      tipDeployTitle: "Publishing takes about 3 minutes",
      tipDeployChip: "≈3 min",
      tipDeploy: "Your app goes out to Cloudflare's edge, and you can keep prompting while it does.",
      tipVersionsTitle: "Every run is a save point",
      tipVersionsChip: "2 credits",
      tipVersions: "Going back to an earlier version takes seconds and costs 2 credits.",
    },

    diff: {
      title: "Changes",
      summary: "{files} files · +{additions} −{deletions}",
      loading: "Loading the changes…",
      /* The generic case. The two below name a cause we actually recognise —
         see FAILURE_COPY in DiffViewer.tsx for why one message can't cover all. */
      loadFailed: "We couldn't load these changes",
      loadFailedDescription:
        "We tried the saved patch and rebuilding it from the commit, and neither came through. Try again in a moment.",
      failedSleepingTitle: "Your project is asleep",
      failedSleepingDescription:
        "These changes have to be rebuilt from your project's server, and it isn't running. Open the preview to wake it up, then try again.",
      failedGoneTitle: "These changes are no longer stored",
      failedGoneDescription:
        "We only keep the most recent patches, and this run's has been cleared. There's no commit recorded for it either, so it can't be rebuilt.",
      emptyTitle: "No changes to show",
      emptyDescription: "This run didn't modify any files.",
      expandAll: "Expand all",
      collapseAll: "Collapse all",
      copyPatch: "Copy patch",
      binaryFile: "Binary file — no textual diff",
      noTextualChanges: "No changes to display",
      statusAdded: "Added",
      statusDeleted: "Deleted",
      statusRenamed: "Renamed",
      statusModified: "Modified",
    },
  },

  // ── Feature H8: export · import · clone ──────────────────────────────────
  transfer: {
    cost: "Costs {credits} credits.",
    nameLabel: "Name for the new project",
    nameTaken: "You already have a project with that name.",
    createdDescription: "Imported project",
    partialCreated:
      "The project {project} WAS created and has been charged for, but the import did not finish.",
    openIt: "Open it",
    nothingCreated: "No project was created, so nothing is left behind.",

    step: {
      exporting: "Packaging the source project",
      creating: "Creating the new project",
      importing: "Starting the import",
      waiting: "Building and starting it up",
    },

    /* ⚠️ THE `done` AND `timeout` BLOCKS ARE GONE, AND THEY WERE NOT LOST.
       Both described a wait that no longer happens in these dialogs: they hand off
       to the workspace the moment the import STARTS, and the workspace's import
       overlay owns the finish, the timeout and the copy for both — see
       `workspace.operation.import.*`. Two sets of words for one event is how they
       drift apart. */

    error: {
      exportRateLimited:
        "You can export once a minute and five times an hour. Wait a moment and try again.",
      importRateLimited:
        "You can import once a minute and five times an hour. Wait a moment and try again.",
      insufficientCredits:
        "You don't have enough credits for this. Top up from Billing and try again — nothing was charged.",
      projectNotFound: "We couldn't find that project. It may have been deleted.",
      missingCode: "Paste the import code from the export you want to bring in.",
      notImportable:
        "That project already has content. An import only works into a fresh, empty project.",
      importInProgress: "An import is already running for this project. Wait for it to finish.",
      serverNotReady:
        "This project's server is starting up — that usually takes 2 to 4 minutes. Wait a moment and try again.",
      agentRunning: "The agent is working on this project. Wait for the run to finish, then try again.",
      nameTaken: "That name is already taken. Pick another one.",
      createRateLimited: "You've created a lot of projects very quickly. Wait a minute and try again.",
      /* ⚠️ Retrying never clears this one — say what actually does. */
      projectLimitReached:
        "Your plan's projects are all in use, so there's no room for a new one. Delete a project you no longer need, or move up a plan.",
    },

    export: {
      title: "Export this project",
      description: "Package it up so you — or someone you trust — can recreate it elsewhere.",
      includesTitle: "What the export includes",
      includes1: "Your database structure, pages and configuration",
      includes2: "A reference to the project's source code",
      excludesTitle: "What it does NOT include",
      excludes1: "Secrets, API keys and access tokens",
      excludes2: "Signed-up users, auth records and the sandbox itself",
      includeRecords: "Include the data in your tables",
      includeRecordsHint: "Off by default: only the structure travels, not the rows.",
      rateLimit: "You can export once a minute.",
      action: "Export",
      running: "Packaging your project…",
      ready: "Export ready",
      codeLabel: "Import code",
      reveal: "Reveal",
      hide: "Hide",
      secretWarning:
        "Treat this like a password. Anyone who has it can import your database and source into a project of their own.",
    },

    import: {
      title: "Import a project",
      description: "Bring in a project from an import code as a brand-new project of your own.",
      codeLabel: "Import code",
      codeInvalid: "That doesn't look like an import code. Paste the whole thing, including the .zip.",
      costDetail: "One for the new project, six for the import.",
      action: "Import",
    },

    clone: {
      title: "Duplicate this project",
      description: "Make a working copy of {project} that you can change without touching the original.",
      includeRecords: "Copy the data in your tables too",
      includeRecordsHint: "On by default, so the copy behaves like the original.",
      costBreakdown: "Two to export, one for the new project, six to import.",
      duration: "It takes a few minutes. You can keep working while it runs.",
      action: "Duplicate",
    },
  },

  status: {
    building: "Building",
    running: "Running",
    promptRunning: "Prompt running",
    deployed: "Deployed",
    stopped: "Stopped",
    failed: "Failed",
    pending: "Pending",
    active: "Active",
    inactive: "Inactive",
    draft: "Draft",
  },
} as const;

export default en;
