---
name: frontend-design
description: "Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics."
---

# Frontend Design Skill

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

Super important: if is necesary to create a header, remember to create a reusable component for it in `src/components/` and import it where needed. If the app requires authentication, remember to update `src/middleware.ts` to add public routes if the page is public. And if multiple header variants are needed, create multiple reusable header components.

---

## Design Thinking

Before coding, understand the context and commit to a **BOLD** aesthetic direction:

### Questions to Answer
- **Purpose:** What problem does this interface solve? Who uses it?
- **Tone:** Pick an extreme direction (see Aesthetic Directions below)
- **Constraints:** Technical requirements (framework, performance, accessibility)
- **Differentiation:** What makes this UNFORGETTABLE? What's the one thing someone will remember?

### Aesthetic Directions (Pick ONE and Commit)
- **Brutally Minimal** - Stark, essential, maximum whitespace
- **Maximalist Chaos** - Dense, layered, overwhelming intentionally
- **Retro-Futuristic** - Neon, chrome, CRT vibes, 80s sci-fi
- **Organic/Natural** - Soft curves, earth tones, flowing shapes
- **Luxury/Refined** - Gold accents, serifs, muted elegance
- **Playful/Toy-like** - Rounded, bouncy, bright primary colors
- **Editorial/Magazine** - Strong typography, dramatic layouts, print-inspired
- **Brutalist/Raw** - Exposed structure, harsh contrasts, anti-design
- **Art Deco/Geometric** - Bold patterns, gold lines, symmetry
- **Soft/Pastel** - Gentle gradients, light colors, cloud-like
- **Industrial/Utilitarian** - Functional, exposed, warehouse aesthetic

**CRITICAL:** Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work—the key is **intentionality**, not intensity.
Important: avoid input number common issues like when there is a default value of 0, the user cannot clear the input because it reverts to 0.

---

## Implementation Standards

Code must be:
- **Production-grade and functional**
- **Visually striking and memorable**
- **Cohesive with a clear aesthetic point-of-view**
- **Meticulously refined in every detail**

---

## Frontend Aesthetics Guidelines

### Typography
- **Choose fonts that are beautiful, unique, and interesting**
- **NEVER use generic fonts:** Arial, Inter, Roboto, system fonts
- Opt for distinctive choices that elevate the frontend's aesthetics
- Unexpected, characterful font choices
- Pair a distinctive display font with a refined body font
- **Vary fonts between projects**—NEVER converge on common choices (e.g., Space Grotesk)
- If you are creating the web on spanish, remember to not do gramaticall mistakes and add appropiate ñ and accents to correspondent words.

### Color & Theme
- Commit to a **cohesive aesthetic**
- Use CSS variables for consistency
- **Dominant colors with sharp accents** outperform timid, evenly-distributed palettes
- Vary between light and dark themes across generations

### Motion & Animation
- Use animations for effects and micro-interactions
- Prioritize CSS-only solutions for HTML
- Use Motion library for React when available
- **Focus on high-impact moments:** One well-orchestrated page load with staggered reveals (`animation-delay`) creates more delight than scattered micro-interactions
- Use scroll-triggering and hover states that surprise

### Spatial Composition
- **Unexpected layouts**
- Asymmetry
- Overlap
- Diagonal flow
- Grid-breaking elements
- Generous negative space OR controlled density

### Backgrounds & Visual Details
Create atmosphere and depth rather than defaulting to solid colors:
- Gradient meshes
- Noise textures
- Geometric patterns
- Layered transparencies
- Dramatic shadows
- Decorative borders
- Custom cursors
- Grain overlays

---

### Select Component (CRITICAL!)
**SelectItem value must NEVER be empty string, null, or undefined.**
```typescript
// WRONG - crashes page
<SelectItem value="">{item.name}</SelectItem>
```

## Anti-Patterns (NEVER Do These)

**Generic AI aesthetics to AVOID:**
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
- Same design choices across different projects

---

## Complexity Matching

**IMPORTANT:** Match implementation complexity to the aesthetic vision:

| Vision | Implementation |
|--------|---------------|
| **Maximalist** | Elaborate code with extensive animations, layered effects, dense interactions |
| **Minimalist/Refined** | Restraint, precision, careful attention to spacing, typography, subtle details |

Elegance comes from **executing the vision well**, not from adding more code.

---

## Project-Specific Rules

### Components
Use shadcn/ui from `src/components/ui/` as foundation:
```typescript
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
```

### Images
- **NEVER use Next.js `<Image />`** — use `<img>` tag
- Get images from Unsplash
- **ALWAYS validate URLs:** `mcp__totalum__checkIfImageExistsByUrl(imageUrl)`

### Server vs Client Components
```typescript
"use client"; // Required for:
// - onClick, onChange, onSubmit handlers
// - useState, useEffect, any React hooks
// - Browser APIs (window, document, localStorage)
```

### New Pages
**Update middleware immediately:**
```typescript
// src/middleware.ts
const publicRoutes = ["/", "/login", "/your-new-page"]; // ADD HERE
```

---

## CSS Variables Reference

```css
--background, --foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--accent, --accent-foreground
--muted, --muted-foreground
--destructive, --destructive-foreground
--card, --card-foreground
--border, --input, --ring
```

---

## Responsive Design

### Mobile-First Approach
```typescript
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
className="text-2xl md:text-4xl lg:text-6xl"
className="py-12 md:py-20 lg:py-32"
```

### Container Pattern
```typescript
className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
```

---

## Accessibility Requirements

- Color contrast 4.5:1 minimum
- Focus visible on all interactive elements
- Alt text on images
- Semantic HTML (nav, main, section, article)
- ARIA labels where needed
- Keyboard navigable

---

## Creative Mandate

**Remember:** Claude is capable of extraordinary creative work.

- **Don't hold back**
- Show what can truly be created when thinking outside the box
- Commit fully to a distinctive vision
- Interpret creatively and make unexpected choices
- **No design should be the same**
- Every interface should feel genuinely designed for its specific context

## Protected Routes

Super important: every time a new page is created, update `src/middleware.ts` to add public routes if the page is public.

### Middleware Configuration
`src/middleware.ts` protects routes:
```typescript
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/privacy-policy",
  "/terms-of-service",
  // SUPER IMPORTANT: add new public routes here when needed
];
```

## Client Components                                               
                                                                     
  Add `"use client"` at the top of any file using `onClick`,         
  `useState`, `useEffect`, or other interactivity.                   
                                                                     
  ```tsx                                                             
  "use client"; // ← Required for interactivity                      
                                                                     
  export function MyButton() {                                       
    return <button onClick={() => {}}>Click</button>;                
  }
  ```                                                       
                                                                     
  If is not added, this error can happen: Error: Event handlers cannot be passed to Client Component props → 
  Add "use client" to the file.
