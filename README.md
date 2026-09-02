<div align="center">

# 🪄 Open-Source AI App Builder

### Type a prompt, get a working full-stack **Next.js** app — hosted, with a database, auth, a visual editor, GitHub sync, Figma and custom domains already built in.

**A free, self-hosted, white-label alternative to [v0](https://v0.dev), [Lovable](https://lovable.dev), [Bolt](https://bolt.new) and [Replit](https://replit.com).**
Run it for yourself, or put an AI app builder inside your own product.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#-license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)

[**🚀 Quick Start**](#-quick-start) · [**🧩 Put it in your product**](#-put-it-inside-your-own-product) · [**☁️ Deploy**](#️-deploy-it) · [**📚 Docs**](https://www.totalum.app/docs) · [**⭐ Star this repo**](https://github.com/totalumlabs/ai-app-builder-open)

<br/>

<img src=".github/assets/ai_app_builder_open_demo.gif" alt="Demo: typing a prompt and watching the AI build, preview and deploy a full-stack Next.js app" width="90%" />

*From prompt to deployed app — live preview, code editor, database and deploy, all in one place.*

</div>

---

## What is this?

A ready-to-run AI app builder, open source under MIT.

A user types what they want, for example *"a CRM with kanban boards and Stripe billing"*. The AI builds a real full-stack **Next.js** app, shows it live in the browser, and publishes it to a public URL when the user is happy.

Everything a builder like this normally needs is already handled:

- **The hard part is done by the [Totalum API](https://www.totalum.app/docs/api/overview).** Totalum runs the AI agent that writes the code, and hosts every generated app with its database, file storage, SSL, CDN, deploys and custom domains. One API key gives you all of it.
- **This repo is the product on top.** It is the user interface: the prompt box, the live preview, the code editor, the visual editor, the database browser, the logs, the version history and everything else you see in the demo.

> **In one sentence:** clone this repo, paste one API key, and you have your own AI app builder running in minutes, for yourself or for your customers.

---

## 🌟 Who is it for?

| You are… | What you get |
| --- | --- |
| 🧑‍💻 **A builder or indie hacker** | Your own free, self-hosted v0 / Lovable / Bolt alternative. Prompt → deployed app. |
| 🏢 **A SaaS or software company** | Let *your* users build full-stack apps inside *your* product, without building the infrastructure. |
| 🎨 **An agency or no-code team** | Ship client apps faster, under your own brand. |
| 🧪 **Curious, not technical** | No servers to manage. One key, and everything works. |

---

## ✨ What it does

All of this works with **one API key**. No other cloud accounts, no glue code:

- 🤖 **Prompt → full-stack app.** Describe an app in plain English and the AI agent builds a complete Next.js project.
- 👀 **Live preview.** Watch the running app update while the agent works.
- 🖱️ **Visual editor.** Click any element in the preview and change its text, size, colours or image. The change is written back to the exact file and line, and the app rebuilds.
- 🧑‍💻 **Code editor.** A Monaco (VS Code) editor to read and edit every generated file. Save, rebuild, done.
- 🗄️ **Database.** Every app gets a real database. Browse, query and edit its records from the UI.
- 🔐 **Secrets and environment variables.** Managed per project and per environment.
- 🚀 **Hosting and one-click deploy.** Every project has a live URL. Publish to production in one click.
- 🌐 **Custom domains.** Attach your own domain with guided DNS setup and watch it go live.
- 🔗 **GitHub sync.** Connect a repo and push or pull changes in both directions.
- 🎨 **Figma.** Paste a Figma frame link in the chat and the agent builds from the design.
- 📦 **Export, import and duplicate projects.** Package a whole project into an import code, restore it, or clone it in one action.
- 🕓 **Version history.** Every AI build is a restorable checkpoint, with a diff viewer showing exactly what changed.
- 📜 **Logs.** Read runtime logs from the preview server and from production.
- 🧱 **Isolated sandboxes.** Each project runs in its own environment. A sleeping one wakes on demand, and the UI tells the user instead of failing silently.
- 🏢 **Multi-tenant.** Create isolated projects per user or per customer with no extra work.
- 🌍 **Deploy anywhere.** Vercel, Docker, or any Node.js host.

---

## 🚀 Quick Start

You can have it running locally in about three minutes.

### 1. Clone and install

```bash
git clone https://github.com/totalumlabs/ai-app-builder-open.git
cd ai-app-builder-open
npm install
```

### 2. Add your API key

Create a `.env` file (or `.env.local`) in the project root:

```bash
TOTALUM_VCAAS_API_KEY=your_key_here
```

> 👉 No key yet? It is free to start. See [Getting your API key](#-getting-your-api-key) just below.

### 3. Run it

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**, type what you want to build, and watch it happen. 🎉

**Requirements:** [Node.js](https://nodejs.org) 20+ and npm. Nothing else.

---

## 🔑 Getting your API key

The only thing this app needs is a Totalum API key. **The first 50 AI credits are free.**

1. **Create an account** at **[totalum.app/api](https://www.totalum.app/api)**.
2. During onboarding, choose **"Use the Totalum API"**.
3. **Copy your API key** into your `.env` file as `TOTALUM_VCAAS_API_KEY`.

That single key covers hosting, databases, AI, custom domains, GitHub sync and sandboxes. No other providers are required.

---

## ⚙️ Environment variables

| Variable | Required | What it is |
| --- | :---: | --- |
| `TOTALUM_VCAAS_API_KEY` | ✅ **Yes** | Your Totalum API key. The only variable the app needs. It is read on the server only and never reaches the browser. |
| `NEXT_PUBLIC_APP_URL` | ⬜ Optional | The public URL of your deployment, e.g. `https://your-domain.com`. Used to allow-list your origin for CSP and CORS in production. Defaults to the same host. |

To start from the example file:

```bash
cp .env.example .env.local
```

> 🔒 **Security:** the API key is only read in `src/lib/vcaas-server.ts`, which never ships to the browser. It is deliberately **not** a `NEXT_PUBLIC_` variable.

---

## ☁️ Deploy it

This is a standard Next.js app with no platform lock-in. It runs wherever Next.js runs.

### Vercel, one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/totalumlabs/ai-app-builder-open&env=TOTALUM_VCAAS_API_KEY)

Import the repo, set `TOTALUM_VCAAS_API_KEY` under **Environment Variables**, and deploy.

### Any Node.js host (VM, Docker, Railway, Render, Fly.io…)

```bash
npm run build
npm start          # serves on $PORT (default 3000)
```

Set `TOTALUM_VCAAS_API_KEY` in the host's environment and point your process manager or container at `npm start`.

---

## 🧩 Put it inside your own product

This is not only a standalone tool. It is a drop-in AI app-builder layer for a SaaS you are launching or already run.

- 🏢 **Multi-tenant by design.** Every generated app is an isolated Totalum project. Create one per user, team or customer.
- 🎨 **White-label.** It is your codebase and your UI. Rebrand it, restyle it, embed it in your dashboard.
- 🔌 **One integration.** A single API key gives your users hosting, databases, AI, domains, GitHub and sandboxes. You do not stitch together five vendors.
- 📈 **A new revenue stream.** Resell app building, hosting or premium AI credits on top of your product.

> **The pitch to your customers:** *"Build and ship a full-stack app right here, inside our platform."*

> ⚠️ **Before you put real users behind it, read `src/app/api/vcaas/_shared.ts`.** This app runs on one API key, so "who is asking?" and "may they touch this project?" are answered with "yes" by default. That file is where you add your own auth and ownership checks. The API routes already delegate the decision to it.

---

## 🔐 Auth, database and third-party providers

Generated apps come with a managed database and everything they need to run. You can still add any provider you like:

- **Auth**: [Better Auth](https://better-auth.com) is already a dependency. Supabase Auth, Clerk, Auth0 or your own also work.
- **Database**: use the built-in one, or connect Supabase, Postgres, PlanetScale, MongoDB and so on.
- **Payments**: [Stripe](https://stripe.com) is included for billing and subscriptions.
- **AI**: the [Vercel AI SDK](https://sdk.vercel.ai) is included. Bring any model or provider.

Add a provider by installing its SDK and setting its key in the **Secrets** panel.

---

## 🏗️ How it works

```
┌──────────────────────────────────────────────────────────────┐
│  This repo (the Next.js front-end, or your own SaaS)         │
│                                                              │
│   UI components ──► API client (src/lib/vcaas.ts)            │
│                        │  same-origin fetch                  │
│                        ▼                                     │
│   /api/vcaas/*  (server proxy routes) ──► adds the api-key   │
└────────────────────────────┬─────────────────────────────────┘
                             │  HTTPS + your secret API key
                             ▼
        ╔═══════════════════════════════════════════╗
        ║   Totalum API                              ║
        ║   AI agent · hosting · sandboxes           ║
        ║   database · deploys · domains · GitHub    ║
        ╚═══════════════════════════════════════════╝
```

Three things worth knowing:

- **The browser never sees your API key.** Client code calls same-origin proxy routes under `/api/vcaas/*`. The server adds the key and forwards the request to Totalum.
- **Every Totalum call goes through one file.** The client side is `src/lib/vcaas.ts`, with its types in `src/lib/vcaas-types.ts`. The part that holds the key is `src/lib/vcaas-server.ts`. If you want to see how an endpoint is really called, polled and error-handled, read there.
- **Credits belong to the operator.** Every action runs on the one API key in your environment. When that account runs out of credits the app says so once and links to the billing page. ⚠️ That message is for **you**, not your users. Remove it before you sell this to customers.

---

## 📚 API reference

The Totalum API is documented in two places:

- **Online:** **[www.totalum.app/docs](https://www.totalum.app/docs)**, plus the [quickstart](https://www.totalum.app/docs/quickstart) and the [OpenAPI spec](https://www.totalum.app/openapi.json).
- **In this repo:** [`project-docs/totalum-api-docs.md`](project-docs/totalum-api-docs.md) is the core reference in one file: account and credits, projects, the AI agent, deployments, server and logs, versions, secrets, custom domains and analytics. It links to the optional areas (GitHub, Figma, database, webhooks, files, project transfer, project groups). Keep it next to the code so an AI coding assistant working in this repo has the API in context.

---

## 🗂️ Project structure

```
src/
├─ app/
│  ├─ page.tsx                 # Dashboard: prompt box, your projects, import/duplicate
│  ├─ project/[projectId]/     # The workspace (chat, preview, code, database, …)
│  └─ api/
│     ├─ vcaas/[...path]/      # Server proxy to the Totalum API
│     ├─ preview/[projectId]/  # Same-origin proxy of a project, needed by the visual editor
│     ├─ visual-edit/…/apply   # Turns visual changes into real source edits
│     └─ config/               # Reports whether the API key is configured
├─ components/
│  └─ workspace/               # Chat, Preview, Code, Database, GitHub, Figma, Logs…
│     └─ visual-editor/        # Inspector panel, changes bar, the editor's own hook
├─ i18n/                       # One English dictionary + `useT()`
├─ lib/
│  ├─ vcaas.ts                 # 🧠 The Totalum API client (browser side)
│  ├─ vcaas-server.ts          # The half that holds the API key, server only
│  ├─ vcaas-types.ts           # Shared API types
│  └─ visual-edit*.ts          # Matching a clicked element back to its source
├─ proxy.ts                    # CORS / CSP boundary
project-docs/
└─ totalum-api-docs.md         # The Totalum API core reference
```

---

## ❓ FAQ

<details>
<summary><b>Is it really free?</b></summary>

The code is free and open source. Running it needs a Totalum API key, which is free to start (the first 50 AI credits are included). You pay only as usage grows. See [pricing](https://www.totalum.app/api#pricing).
</details>

<details>
<summary><b>Do I need to set up a database, hosting or an AI provider?</b></summary>

No. The single Totalum API key provides hosting, databases, AI, domains, GitHub and sandboxes. You can still add your own providers such as Supabase or Stripe if you want them.
</details>

<details>
<summary><b>Can my users build apps inside my own product?</b></summary>

Yes. It is multi-tenant and white-label by design. See [Put it inside your own product](#-put-it-inside-your-own-product).
</details>

<details>
<summary><b>What can it build?</b></summary>

Full-stack Next.js web apps: dashboards, CRMs, internal tools, marketplaces, SaaS MVPs, landing pages with a backend, and more.
</details>

<details>
<summary><b>Where is the API key stored? Is it safe?</b></summary>

Server side only. It is read in `src/lib/vcaas-server.ts` and never shipped to the browser. Client requests go through same-origin proxy routes that add the key on the server.
</details>

<details>
<summary><b>Can I self-host without Vercel?</b></summary>

Yes. `npm run build && npm start` runs on any Node.js host: a VM, Docker, Railway, Render, Fly.io and so on.
</details>

---

## 🆚 How it compares

| | **AI App Builder Open** | v0 · Lovable · Bolt · Replit |
| --- | :---: | :---: |
| Open source | ✅ | ❌ |
| Self-hostable | ✅ | ❌ |
| White-label, embeddable in your SaaS | ✅ | ❌ |
| Multi-tenant out of the box | ✅ | Limited |
| Hosting + database + domains + GitHub included | ✅ (one key) | Varies |
| Bring your own providers (Supabase, Stripe…) | ✅ | Limited |
| Deploy anywhere | ✅ | ❌ |

---

## 🤝 Contributing

Contributions are welcome, whether a bug fix, a new panel, docs or a feature idea:

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes and run `npm run build` to check them.
3. Open a pull request describing what you changed and why.

Found a bug or have an idea? [Open an issue](https://github.com/totalumlabs/ai-app-builder-open/issues).

---

## 📄 License

Released under the **MIT License**. Free for personal and commercial use. See [`LICENSE`](LICENSE).

---

<div align="center">

### If this project helps you, please give it a ⭐. It helps others find it.

**Open-source AI app builder** · self-hosted **v0 / Lovable / Bolt / Replit alternative** · prompt-to-app · full-stack Next.js · multi-tenant · embeddable AI app builder for your SaaS.

Built with ❤️ on the [Totalum API](https://www.totalum.app/api) · [Docs](https://www.totalum.app/docs) · [Get your free API key](https://www.totalum.app/api)

</div>
