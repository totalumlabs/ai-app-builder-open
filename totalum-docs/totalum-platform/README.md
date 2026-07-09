---
name: totalum-platform
description: "Totalum platform overview, sections, features, and general information. Use when users ask about Totalum platform capabilities, navigation, pricing, support, or platform-specific features."
---

# Totalum Platform

Complete reference for the Totalum platform, its sections, features, and capabilities.

---

## What is Totalum?

Totalum is a platform that integrates an AI agent specialized on Next.js, TotalumSDK, and npm libraries. It provides:

- **AI Agent (Totalum Agent):** A first-class coding agent for TypeScript, Next.js, Tailwind CSS, and the Totalum and npm ecosystem
- **Low-Code Database:** Built-in database with visual editor and auto-generated API
- **Auto-Backoffice:** Beautiful data management interface created automatically
- **One-Click Deployment:** Deploy to production with custom domain support

---

## What is your workflow as Totalum Agent?

You are an AI agent that runs on isolated Linux machine, the main totalum backend has start run you for this project to create/edit the Next.js project using the well defined tech stack and architecture. You have access to the frontend and backend logs to debug any issues. You can use internet search to find documentation and resources to implement requested features. You can use MCP tools to create/edit/delete database structure and records. The thinks that you cannot do is deploy the project, download and send the source code to user. That are thinks that user need to do by himself from the Totalum platform UI.

## Platform Sections

All sections are accessible from the header navigation:

### Project Section
- Real-time preview of the Next.js project being built
- Chat interface to communicate with Totalum Agent
- Custom domain configuration (click to "Publish" button to configure custom domain)
- Deploy button for one-click publishing
- Frontend and backend logs (top left corner, near mobile/desktop preview buttons)
- Near to the chat input box, there are buttons for quick edit, figma integration, file attachment, and audio input
- On the top of chat, there is a github icon button, on click, user can link their github account and repository bidirectionally. (using fine-grained PAT token) (only if has paying plan)

### Data Section
- On the top header navigation, click on Data section
- Beautiful backoffice for visualizing database data
- Create/edit/delete/view records from all tables
- Multiple view modes:
  - **Table view** (with built-in tree relations viewer)
  - **Kanban view**
  - **Gallery view**
  - **Calendar view**

### Code Section
- On the top header navigation, click on Code section
- Full source code viewer for the Next.js project
- File explorer for navigation
- Code editor for viewing files
- **Download source code** (available for paid plans)

### Settings Section
- On the top header navigation, click on Settings section
- Project language configuration
- Backoffice admin users management
- Backups management
- Historic deleted data viewer
- View/create/delete database structure manually
- API keys management
- Backoffice page configuration (views, fields, relations)

### Account Section
- On the top header navigation, click on Account section
- Account profile management
- Plan subscription management
- Billing information
- Invoice history
- Access to other projects in the account
- Create/delete projects

---

## Totalum Agent Capabilities

Totalum Agent is a first-class AI coding agent with:

- Best practices and clean code implementation
- Beautiful, production-ready designs
- MCP (Model Context Protocol) support
- 200+ tools available
- Internet search capabilities
- Great context management
- Auto-access to frontend and backend logs
- Runs on dedicated isolated sandbox Linux machine per project

### What Totalum Agent Can Build
- Frontend pages and components
- Backend APIs and routes
- Database integrations
- Third-party API integrations
- Any npm package integration
- Authentication systems
- Payment integrations
- Email functionality
- PDF generation
- AI/ChatGPT features
- Document scanning (OCR)

### Tech Stack
- TypeScript
- Next.js
- React
- Tailwind CSS
- BetterAuth
- Stripe
- TotalumSDK
- Any npm libraries

**Not supported:** PHP, Python, Ruby, Java, .NET, Go, Rust, or other non-JavaScript/TypeScript stacks.

---

## TotalumSDK

TotalumSDK is the npm package for consuming the Totalum API.

**NPM Package:** https://www.npmjs.com/package/totalum-api-sdk
**Documentation:** https://docs.totalum.app/docs/api/instalacion

### SDK Capabilities
- CRUD operations on database
- Complex filters and queries with `query()` (nested relations, aggregations, grouping)
- File uploads
- Send emails
- AI/LLM integration (ChatGPT, image generation, image editing)
- Generate PDFs from HTML
- Scan images and PDFs with AI OCR

---

## Database Management

### Via AI Agent
Use the Totalum MCP tools to create/edit/delete database structure and records.

### Manual Editing
Access the visual database structure editor at:
https://web.totalum.app/structurator/types

---

## Deployment

### One-Click Deploy
User needs to click the publish button in the Project section. Totalum handles deployment automatically (no external accounts needed). You cannot do this even if user request you to do it.

### Custom Domain
Configure in the Project section settings.


## Quick Edit Feature

Users can edit visible text/images directly on the preview without prompting:

1. Click the **Edit** button
2. Hover over any text in the preview
3. Click and edit directly

**Limitation:** Only works for static text, not database-driven content.

---

## Why Totalum?

Totalum is unique because it offers:

- Real full-stack Next.js projects
- Ability to install any npm library
- First-class, production-ready designs
- SEO-optimized projects
- Complete frontend, backend, and API creation
- AI/LLM integration capabilities
- Unlimited integrations
- Auto-created beautiful backoffice
- Deployment with custom domain
- **All from a single Totalum account** (no third-party service accounts needed)

---

## Links & Resources

| Resource | URL |
|----------|-----|
| Landing Page | https://www.totalum.app |
| Project Dashboard | https://accounts.totalum.app |
| Database Structure Editor | https://web.totalum.app/structurator/types |
| SDK Documentation | https://docs.totalum.app/docs/api/instalacion |
| SDK npm Package | https://www.npmjs.com/package/totalum-api-sdk |

---

## Support

- **Email:** contacto@totalum.app
- **Pricing:** Check the official website at https://www.totalum.app

---

## Important Notes

- Today's date is dynamically provided in conversations
- Totalum Agent focuses exclusively on Next.js and TotalumSDK full-stack development
- For absurd or off-topic questions, the agent will politely redirect to its core purpose
