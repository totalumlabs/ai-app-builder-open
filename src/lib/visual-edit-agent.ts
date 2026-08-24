/**
 * ═══ THE IN-PAGE AGENT (Feature F12) ════════════════════════════════════════
 *
 * The script that runs INSIDE the previewed app and does the four things the
 * workspace cannot do from outside an iframe: hit-test a click, outline what is
 * under the cursor, describe the selected element, and apply a preview-only change.
 *
 * ⚠️ IT IS SERVED FROM OUR ORIGIN by the preview proxy, so it is same-origin with
 * the workspace and needs no privilege from the user's project. The project is not
 * modified in any way — see the proxy route for why that matters and for the
 * evidence that the template's own `ScriptExecutor` is dead code in production.
 *
 * ⚠️ EVERY MESSAGE IS ORIGIN-CHECKED IN BOTH DIRECTIONS. The agent only accepts
 * messages whose `event.origin` equals its own, and only posts to
 * `window.parent` with that same explicit origin — never `"*"`. An embedded page
 * cannot drive the editor, and the editor cannot leak into another frame.
 *
 * ⚠️ IT IS A STRING, NOT A MODULE, on purpose: it has to be delivered as a
 * standalone classic script into a document we do not own the build of. Keeping it
 * here (rather than in `public/`) means it ships with the bundle, versions with the
 * code that speaks to it, and cannot be fetched by anything that is not proxying a
 * preview.
 */

/** Message type names, shared by the agent and the React side. */
export const VISUAL_EDIT_MESSAGE = {
    /** agent → parent: the agent is loaded and listening. */
    ready: "totalum:ve:ready",
    /** parent → agent: turn selection mode on/off. */
    setActive: "totalum:ve:set-active",
    /** agent → parent: the user picked an element. */
    selected: "totalum:ve:selected",
    /** agent → parent: selection was cleared (Escape, or a click on nothing). */
    cleared: "totalum:ve:cleared",
    /** parent → agent: apply a preview-only change to the selected element. */
    apply: "totalum:ve:apply",
    /** parent → agent: undo one previously applied preview change. */
    revert: "totalum:ve:revert",
    /** agent → parent: the previewed app navigated; selection is stale. */
    navigated: "totalum:ve:navigated",
    /**
     * parent → agent: drop the current selection and its outline (G3/P2).
     * `setActive:true` never did this — the agent only clears on `setActive:false`,
     * which would also turn selection mode off.
     */
    deselect: "totalum:ve:deselect",
    /**
     * agent → parent: here is the project's palette again, nothing else has changed.
     *
     * ⚠️⚠️ G4 — THIS EXISTS TO BREAK AN INFINITE LOOP, not for tidiness. The palette
     * refresh on activation used to reuse `ready`, and `ready` is what increments the
     * parent's `readyTick` — whose effect posts `setActive`, which made the agent post
     * `ready`, which… Measured on a live preview: 120+ round trips in two seconds, each
     * one walking 400 elements to re-harvest the palette, for as long as the editor sat
     * armed. A message that means "new palette" must not also mean "I just loaded".
     */
    palette: "totalum:ve:palette",
    /**
     * agent → parent: the user typed **into the page itself**, not into the panel.
     *
     * ⭐ EDITING IN PLACE IS THE POINT OF A VISUAL EDITOR. The panel's textarea works,
     * but retyping a heading in a sidebar while looking at the heading two feet away
     * is the thing this feature exists to replace.
     *
     * ⚠️ IT CARRIES THE `before` FROM WHEN EDITING STARTED, not from the last
     * keystroke. The parent collapses consecutive edits to one property keeping the
     * FIRST `before`, and that value is what has to exist in the source file — a
     * per-keystroke `before` would describe text that was never in anyone's repo.
     */
    textEdited: "totalum:ve:text-edited",
} as const;

/**
 * The agent source.
 *
 * ⚠️ PLAIN ES5-ish, NO BUILD STEP. It is injected verbatim into someone else's
 * document, which may be running any React version and any polyfill set, so it uses
 * nothing that needs transpiling and touches no global the app might own.
 */
/**
 * ═══ THE RUNTIME URL SHIM (Feature G3 — audit finding B1) ═══════════════════
 *
 * ⚠️⚠️ WITHOUT THIS, THE PROXIED PREVIEW IS A BLANK PAGE. Measured in G2 against a
 * real generated project: `document.body` had **zero** text and 21 elements.
 *
 * `rewriteHtml()` fixes the URLs written into the HTML. It cannot fix the ones Next.js
 * computes at RUNTIME: webpack's `publicPath` is inlined as `/_next/` at build time and
 * the RSC flight payload carries *relative* chunk names, so the client runtime asks for
 *
 *     /_next/static/chunks/874-….js          → 404 (that is the PLATFORM's own app)
 *
 * instead of
 *
 *     /api/preview/<id>/_next/static/chunks/874-….js   → 200
 *
 * Every runtime chunk 404s, React never hydrates, and the page the user came to edit
 * never appears.
 *
 * ── HOW IT IS FIXED ─────────────────────────────────────────────────────────
 *
 * Rewriting at the *point of use*, which is the only place that sees the final URL:
 *
 *   · `document.createElement('script'|'link')` — webpack loads chunks and CSS by
 *     creating an element and assigning `.src`/`.href`. Both the property and
 *     `setAttribute` are patched, SYNCHRONOUSLY, because a `<script src>` starts
 *     fetching the instant it is assigned (a `MutationObserver` would be a microtask
 *     too late).
 *   · `fetch` and `XMLHttpRequest.open` — RSC navigations, server actions and the
 *     app's own API calls.
 *
 * ⚠️ IT MUST RUN BEFORE EVERY OTHER SCRIPT, which is why the proxy now injects it at
 * the TOP of `<head>` rather than at the end.
 *
 * ── THE SECURITY HALF, WHICH MATTERS AS MUCH AS THE FUNCTIONAL ONE ──────────
 *
 * ⚠️ The proxied document runs on the PLATFORM's origin with `allow-same-origin`, so
 * before this shim the previewed app's own JavaScript could `fetch('/api/credits/…')`
 * or any other platform route **with the user's session cookie attached**. The app is
 * generated from a prompt, so that is a prompt-injection exfiltration path to the
 * owner's own account data.
 *
 * Rewriting every root-absolute request to the proxy base closes the ordinary path:
 * the app's calls now reach the app. This is a strong mitigation, NOT a sandbox — code
 * running in the same realm can always undo a monkey-patch. The real containment is
 * that the proxy is only mounted while the editor is open, and it is documented in
 * PROGRESS as the reason a dedicated preview origin would be the better long-term
 * answer.
 */
export const PREVIEW_RUNTIME_SHIM = (base: string) => String.raw`
(function () {
  if (window.__totalumPreviewShim) return;
  window.__totalumPreviewShim = true;

  var BASE = ${JSON.stringify(base)};

  // Root-absolute, but not protocol-relative ("//cdn…") and not already proxied.
  function rewritePath(url) {
    if (url.charCodeAt(0) !== 47) return url;      // not "/"
    if (url.charCodeAt(1) === 47) return url;      // "//host" is another origin
    if (url.lastIndexOf(BASE + '/', 0) === 0) return url;
    if (url === BASE) return url;
    return BASE + url;
  }

  /**
   * ⭐⭐⭐ A FULLY-QUALIFIED SAME-ORIGIN URL IS THE SAME PROBLEM WEARING A HOSTNAME.
   *
   * ⚠️⚠️ THIS IS WHY THE PREVIEW STILL DID NOT HYDRATE. Measured with a stack trace from
   * inside 'Node.appendChild': webpack's own chunk loader ('__webpack_require__.l') was
   * creating '<script>' elements whose src was ALREADY absolute —
   * 'http://host/_next/static/chunks/app/page-*.js' — because that is what
   * '__webpack_require__.p' resolves to. The old test bailed on the first character not
   * being '/', so every one of those sailed through the setter untouched, 404ed at the
   * platform root, and React never hydrated. Six chunks per page load.
   *
   * ⚠️ ONLY OUR OWN ORIGIN, AND ONLY OUTSIDE THE BASE. Another host is somebody else's
   * asset and must not be touched; a url already under the base is already correct.
   */
  function rewrite(url) {
    /**
     * ⭐⭐⭐ A TrustedScriptURL IS NOT A STRING, AND THAT IS WHAT DEFEATED THIS.
     *
     * ⚠️⚠️ THE MEASURED ROOT CAUSE OF THE UN-HYDRATED PREVIEW. Next.js wraps every
     * chunk url in a Trusted Types policy before assigning it:
     *
     *     u.src = r.tu(o)          // r.tu -> trustedTypes.createPolicy(...).createScriptURL
     *
     * so the value arriving at our patched setter is a TrustedScriptURL OBJECT. The
     * first line here was 'typeof url !== string ? return url', which handed it straight
     * back untouched — every webpack chunk then loaded from the platform root, 404ed,
     * and React never hydrated. Six to eight chunks on every page load, and invisible to
     * a probe because a hand-written string was rewritten perfectly.
     *
     * ⚠️ IT IS RETURNED AS A PLAIN STRING, which drops the trusted wrapper. That is safe
     * HERE and nowhere else: the preview proxy strips 'content-security-policy' from
     * every response it serves, so nothing is enforcing 'require-trusted-types-for'. If
     * that ever changes this has to mint its own policy instead.
     */
    if (typeof url !== 'string') {
      try {
        if (url === null || url === undefined) return url;
        var coerced = String(url);
        var rewritten = rewrite(coerced);
        return rewritten === coerced ? url : rewritten;
      } catch (e) {
        return url;
      }
    }

    if (url.charCodeAt(0) === 47) return rewritePath(url);

    try {
      var origin = window.location.origin;
      if (origin && url.lastIndexOf(origin + '/', 0) === 0) {
        var rest = url.slice(origin.length);
        var next = rewritePath(rest);
        return next === rest ? url : origin + next;
      }
    } catch (e) {}

    return url;
  }

  // Also handle Request objects and URL instances passed to fetch().
  function rewriteInput(input) {
    try {
      if (typeof input === 'string') return rewrite(input);

      /**
       * ⭐ A 'URL' INSTANCE, WHICH THE COMMENT ABOVE ALWAYS CLAIMED AND THE CODE NEVER
       * DID. It has 'href', not 'url', so it fell past the Request branch below and was
       * returned untouched. Measured: Next's router prefetches the next route as
       * 'fetch(new URL("/register?_rsc=…"))', which escaped the proxy and 404ed on every
       * page that links anywhere.
       */
      if (input && typeof input === 'object' && typeof input.url !== 'string' && typeof input.href === 'string') {
        var next = rewrite(input.href);
        return next === input.href ? input : next;
      }

      if (input && typeof input === 'object' && typeof input.url === 'string') {
        var u = input.url;
        // Same-origin absolute URLs come back through as full hrefs.
        if (u.lastIndexOf(window.location.origin, 0) === 0) {
          var path = u.slice(window.location.origin.length);
          var next = rewrite(path);
          if (next !== path) return new Request(window.location.origin + next, input);
        }
        return input;
      }
    } catch (e) {}
    return input;
  }


  // ── 1 · elements that load subresources ─────────────────────────────────
  //
  // ⚠️⚠️ PATCHED ON THE PROTOTYPE, NOT ON INSTANCES FROM document.createElement.
  // Measured: patching the instances returned by a wrapped document.createElement
  // rewrote a hand-made probe perfectly and still let EIGHT of Next.js's own chunk
  // loads through. React 19's Float (ReactDOM.preinit) does not go through the
  // document.createElement we can see, so the only place that reliably observes
  // every URL is the property setter itself.
  function patchUrlProperty(ctor, prop) {
    try {
      if (!ctor || !ctor.prototype) return;
      var desc = Object.getOwnPropertyDescriptor(ctor.prototype, prop);
      if (!desc || !desc.set || !desc.get) return;
      Object.defineProperty(ctor.prototype, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: function () { return desc.get.call(this); },
        set: function (value) { desc.set.call(this, rewrite(value)); }
      });
    } catch (e) {}
  }

  patchUrlProperty(window.HTMLScriptElement, 'src');
  patchUrlProperty(window.HTMLLinkElement, 'href');
  patchUrlProperty(window.HTMLImageElement, 'src');
  patchUrlProperty(window.HTMLSourceElement, 'src');
  patchUrlProperty(window.HTMLMediaElement, 'src');
  patchUrlProperty(window.HTMLIFrameElement, 'src');
  /**
   * ⭐⭐⭐ THE TWO THAT NAVIGATE, AND THEY WERE THE TWO THAT WERE MISSING.
   *
   * ⚠️⚠️ THIS IS WHY THE PLATFORM'S OWN WEBSITE COULD APPEAR INSIDE THE PREVIEW.
   * rewriteHtml() fixes the anchors in the FIRST document; every anchor React creates
   * afterwards — which is all of them, after any client-side render — kept its raw
   * "/some-path". The proxied document is same-origin with the workspace, so following
   * one loaded platform.totalum.app/some-path INTO the preview frame: the user's app
   * replaced by ours, inside their own preview.
   *
   * Everything else in this list loads a subresource; these two replace the document,
   * which is why their absence was so much louder than a 404 for a chunk.
   */
  patchUrlProperty(window.HTMLAnchorElement, 'href');
  patchUrlProperty(window.HTMLAreaElement, 'href');
  patchUrlProperty(window.HTMLFormElement, 'action');

  // setAttribute bypasses the property setter entirely, so it needs the same
  // treatment — scoped to the tag/attribute pairs that actually fetch something.
  //
  // ⚠️ 'A' AND 'FORM' MATTER MOST HERE, not in the property list above: React sets
  // 'href' and 'action' as ATTRIBUTES, so this is the path a Next.js <Link> actually
  // takes on every render.
  var URL_ATTRS = { SCRIPT: 'src', LINK: 'href', IMG: 'src', SOURCE: 'src',
                    VIDEO: 'src', AUDIO: 'src', IFRAME: 'src',
                    A: 'href', AREA: 'href', FORM: 'action' };
  try {
    var setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      var want = URL_ATTRS[this.tagName];
      if (want && String(name).toLowerCase() === want) value = rewrite(value);
      return setAttribute.call(this, name, value);
    };

    var setAttributeNS = Element.prototype.setAttributeNS;
    Element.prototype.setAttributeNS = function (ns, name, value) {
      var want = URL_ATTRS[this.tagName];
      if (want && String(name).toLowerCase() === want) value = rewrite(value);
      return setAttributeNS.call(this, ns, name, value);
    };
  } catch (e) {}

  // ── 1b · ⭐⭐ WEBPACK'S publicPath, FIXED AT THE SOURCE ───────────────────
  //
  // ⚠️ THIS IS THE ONE THAT ACTUALLY FIXES THE BLANK PREVIEW, and the prototype
  // patches above are NOT a substitute for it. Measured against a real generated
  // project: the setters demonstrably rewrite a probe script, and webpack's chunk
  // loader still escaped them —
  //
  //     ChunkLoadError: Loading chunk 219 failed.
  //     (error: /_next/static/chunks/app/global-error-….js)   at r.f.j (webpack-….js)
  //
  // — and because that app has no server-rendered HTML (its whole tree arrives in
  // the RSC flight payload) a failed chunk is not cosmetic: React throws and NOTHING
  // renders.
  //
  // Rather than keep guessing which DOM API webpack reaches for, we correct the value
  // it builds every URL from. Next.js registers chunks on self.webpackChunk_N_E;
  // the third element of a pushed item is the runtime callback, and it receives
  // __webpack_require__. Wrapping it lets us prefix .p ONCE, before a single
  // chunk URL has been computed.
  try {
    var chunkKey = 'webpackChunk_N_E';
    var existing = window[chunkKey] || [];
    var patchedRuntime = false;

    var prefixPublicPath = function (req) {
      if (patchedRuntime || !req || typeof req.p !== 'string') return;
      if (req.p.lastIndexOf(BASE, 0) === 0) { patchedRuntime = true; return; }
      req.p = BASE + req.p;
      patchedRuntime = true;
    };

    var wrapItem = function (item) {
      if (item && typeof item[2] === 'function') {
        var runtime = item[2];
        item[2] = function (req) { prefixPublicPath(req); return runtime(req); };
      }
      return item;
    };

    // Anything already queued before we ran.
    for (var i = 0; i < existing.length; i++) wrapItem(existing[i]);

    var nativePush = existing.push;
    existing.push = function (item) { return nativePush.call(this, wrapItem(item)); };
    window[chunkKey] = existing;
  } catch (e) {}

  // ── 2 · RSC navigations, server actions, the app's own API calls ─────────
  if (typeof window.fetch === 'function') {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      return nativeFetch.call(this, rewriteInput(input), init);
    };
  }

  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype.open) {
    var open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = rewrite(url);
      return open.apply(this, args);
    };
  }

  // ── 3 · history: keep the app's URLs inside the proxy path ───────────────
  // Next's router pushes "/about"; without this the workspace's own router would
  // see a top-level path change and the agent's route reporting would be wrong.
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    if (typeof original !== 'function') return;
    history[name] = function (state, title, url) {
      if (typeof url === 'string') url = rewrite(url);
      return original.call(this, state, title, url);
    };
  });

  // ── 4 · ⭐⭐ programmatic navigation, which no attribute rewrite can reach ──
  //
  // ⚠️ 'location.href = "/x"' and 'location.assign("/x")' inside the app's own click
  // handler are document loads, and they land on the PLATFORM. 'location.href' is an
  // accessor on a host object some engines refuse to redefine, so only the two methods
  // are wrapped — a strict improvement, and neither is required for the page to work.
  try {
    ['assign', 'replace'].forEach(function (name) {
      var original = window.location[name];
      if (typeof original !== 'function') return;
      window.location[name] = function (url) {
        return original.call(window.location, typeof url === 'string' ? rewrite(url) : url);
      };
    });
  } catch (e) {}

  try {
    var nativeOpen = window.open;
    if (typeof nativeOpen === 'function') {
      window.open = function (url) {
        var args = Array.prototype.slice.call(arguments);
        if (typeof url === 'string') args[0] = rewrite(url);
        return nativeOpen.apply(window, args);
      };
    }
  } catch (e) {}

  /**
   * ── 5 · ⭐⭐⭐ THE LAST LINE OF DEFENCE, AND IT IS ALWAYS ARMED ────────────
   *
   * ⚠️⚠️ EVERYTHING ABOVE REWRITES A URL AT THE MOMENT IT IS WRITTEN. This catches the
   * one that got away, at the moment it would be FOLLOWED: any same-origin link whose
   * path is not under this preview's base is, by definition, a platform page about to
   * render inside the user's preview. There is no legitimate case — the app has nothing
   * on our origin outside its own base.
   *
   * ⚠️ IT IS ON THE BUBBLE PHASE AT 'window', DELIBERATELY. The editor's own handler
   * swallows clicks at document CAPTURE while selection mode is on, so this never
   * competes with it — it runs only for clicks nothing else claimed. That includes the
   * window the editor cannot cover: selection is disarmed for the length of an apply,
   * and since Apply now closes the panel, the user is looking at a live app with the
   * editor inactive for the whole rebuild.
   *
   * ⚠️ 'defaultPrevented' AND THE MODIFIER KEYS ARE BOTH RESPECTED — an app that
   * handled its own click, and a user opening a link in a new tab, are both none of our
   * business.
   */
  try {
    window.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var node = event.target;
      var depth = 0;
      while (node && node.nodeType === 1 && node.tagName !== 'A' && depth < 12) {
        node = node.parentElement;
        depth++;
      }
      if (!node || node.nodeType !== 1 || node.tagName !== 'A') return;

      var raw = node.getAttribute('href');
      if (!raw || raw.charAt(0) === '#') return;

      var url;
      try { url = new URL(node.href, window.location.href); } catch (e) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === BASE || url.pathname.lastIndexOf(BASE + '/', 0) === 0) return;

      event.preventDefault();
      window.location.href = BASE + url.pathname + url.search + url.hash;
    }, false);
  } catch (e) {}
})();
`;

export const AGENT_SOURCE = String.raw`
(function () {
  if (window.__totalumVisualEditor) return;

  var ORIGIN = window.location.origin;
  /**
   * The proxy base this document is served under, e.g. "/api/preview/my-app".
   * Derived from our own <script src>, so the agent never has to be told.
   * Used to undo the proxy's src rewrite before reporting a signature (G3/B3).
   */
  var BASE = (function () {
    try {
      var self = document.currentScript ||
        document.querySelector('script[data-totalum-visual-editor]');
      var src = self && self.getAttribute('src');
      if (!src) return '';
      var path = src.charAt(0) === '/' ? src : new URL(src, location.href).pathname;
      return path.replace(/\/[^/]*$/, '');
    } catch (e) { return ''; }
  })();
  /**
   * ⭐⭐ THE MESSAGE NAMES, INJECTED FROM THE ONE DEFINITION ABOVE.
   *
   * ⚠️⚠️ THIS USED TO BE A HAND-MAINTAINED SECOND COPY, AND IT HAD SILENTLY
   * DRIFTED. 'palette' was added to 'VISUAL_EDIT_MESSAGE' and never here, so
   * 'post(M.palette, …)' posted a message with 'type: undefined' — the parent
   * requires a name starting with 'totalum:ve:', so it dropped every one. The
   * palette refresh on activation had therefore never worked, and nobody could
   * see it because 'ready' also carries a palette and covered for it.
   *
   * A literal that must be edited in lockstep with a constant thirty lines away is
   * a bug waiting for its next author. Interpolating it means the agent cannot
   * disagree with the parent about what a message is called, ever again.
   */
  var M = ${JSON.stringify(VISUAL_EDIT_MESSAGE)};

  var active = false;
  var selected = null;
  /** id -> { el, prop, previous } so every preview change is individually undoable. */
  var applied = {};
  var seq = 0;
  /** Bumped on every select(); see signatureOf() for why the store needs it (G3/M4). */
  var selectionId = 'sel-0';
  var selectionSeq = 0;

  // ── Overlay (G4: refined, and it respects prefers-reduced-motion) ─────────
  //
  // ⚠️ EVERY RULE IS !important AND EVERY PROPERTY IS ONE WE CAN GIVE BACK.
  // This paints into someone else's stylesheet cascade, so it only ever touches
  // outline, box-shadow and cursor - properties that do not affect layout.
  // Using border or padding here would reflow the page under the user's cursor,
  // which is how a selection overlay ends up changing the thing it is measuring.
  var style = document.createElement('style');
  style.textContent =
    // Hover: a soft, thin ring. Deliberately quieter than the selection so the two
    // are never confused while sweeping the pointer across a dense layout.
    '.totalum-ve-hover{outline:1.5px dashed rgba(37,99,235,.6)!important;outline-offset:2px!important;' +
    'cursor:pointer!important;border-radius:2px}' +
    /**
     * ⭐⭐ THE SELECTION RING IS A FLOATING BOX, NOT AN OUTLINE ON THE ELEMENT.
     *
     * ⚠️⚠️ AN OUTLINE ON THE ELEMENT IS CLIPPED BY ANY ANCESTOR WITH
     * overflow:hidden, AND THAT IS WHY SOME IMAGES SHOWED NO BORDER. The ring sits
     * OUTSIDE the border box (offset 2px) and the halo further out again, so the
     * single most common way to present a picture on the web — an img filling a
     * rounded, cropped wrapper — cropped the selection indicator away entirely.
     * The element was selected and the panel described it; it just did not look
     * selected, which is indistinguishable from broken.
     *
     * A fixed-position box appended to documentElement cannot be clipped by
     * anything, because it is not inside anything. It is pointer-events:none so it
     * never intercepts the click meant for the element under it.
     */
    '.totalum-ve-ring{position:fixed!important;pointer-events:none!important;z-index:2147483646!important;' +
    'border:2px solid rgb(37,99,235)!important;border-radius:3px!important;' +
    'box-shadow:0 0 0 3px rgba(37,99,235,.16),0 0 0 1px rgba(255,255,255,.5)!important;' +
    'display:none;margin:0!important;padding:0!important;background:none!important}' +
    'html.totalum-ve-active *{cursor:crosshair!important}' +
    // The previewed app keeps its own text selection behaviour everywhere except
    // while we are picking, where a drag would select prose instead of an element.
    'html.totalum-ve-active{-webkit-user-select:none!important;user-select:none!important}' +
    /**
     * ⭐ EDITING IN PLACE. The two rules above are exactly wrong for an element the
     * user is typing into: a crosshair over text they are editing, and a document
     * that refuses to select text, would make the caret unusable. Both are undone
     * for the editing element and everything inside it.
     */
    '.totalum-ve-editing,html.totalum-ve-active .totalum-ve-editing,' +
    'html.totalum-ve-active .totalum-ve-editing *{cursor:text!important;' +
    '-webkit-user-select:text!important;user-select:text!important}' +
    '.totalum-ve-editing{caret-color:rgb(37,99,235)!important}';
  document.documentElement.appendChild(style);

  /**
   * The ring itself, and the code that keeps it on top of the selected element.
   *
   * ⚠️ IT FOLLOWS SCROLL AND RESIZE. A fixed box is positioned in viewport
   * coordinates, so it would otherwise drift off the element the moment the page
   * moved — worse than no ring, because it would point at the wrong thing.
   */
  var ring = document.createElement('div');
  ring.className = 'totalum-ve-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.documentElement.appendChild(ring);

  function positionRing() {
    if (!selected || !selected.getBoundingClientRect) { ring.style.display = 'none'; return; }
    var r = selected.getBoundingClientRect();
    // A zero-area box means the element is hidden or detached — do not draw a dot.
    if (r.width <= 0 && r.height <= 0) { ring.style.display = 'none'; return; }
    ring.style.display = 'block';
    ring.style.left = (r.left - 2) + 'px';
    ring.style.top = (r.top - 2) + 'px';
    ring.style.width = r.width + 'px';
    ring.style.height = r.height + 'px';
  }

  // Capture phase: a scroll inside any nested scroller moves the element too, and
  // those events do not bubble.
  window.addEventListener('scroll', positionRing, true);
  window.addEventListener('resize', positionRing);

  /**
   * ⭐ G4 — THE PROJECT'S OWN PALETTE, READ OFF THE RENDERED PAGE.
   *
   * The colour picker used to be a raw hex field, which asks the user to invent a
   * colour that has nothing to do with their design. The colours the project ALREADY
   * uses are right there in the computed styles, so we harvest them: walk the visible
   * elements, count every distinct text / background / border colour, and return the
   * most-used ones first.
   *
   * ⚠️ FREQUENCY-ORDERED, NOT DOCUMENT-ORDERED. The first colours in the DOM are
   * usually the page chrome; the ones used MOST are the palette the design actually
   * rests on. Fully transparent and near-transparent values are dropped — they are
   * not choices anyone made.
   *
   * Capped at 400 elements: this runs on selection-mode activation, and a huge page
   * should not cost a visible pause.
   */
  function harvestPalette() {
    var counts = {};
    var nodes = document.body ? document.body.querySelectorAll('*') : [];
    var limit = Math.min(nodes.length, 400);

    for (var i = 0; i < limit; i++) {
      var el = nodes[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      var cs = window.getComputedStyle(el);
      var values = [cs.color, cs.backgroundColor, cs.borderTopColor];
      for (var j = 0; j < values.length; j++) {
        var hex = toHexColor(values[j]);
        if (hex) counts[hex] = (counts[hex] || 0) + 1;
      }
    }

    var out = [];
    for (var key in counts) if (Object.prototype.hasOwnProperty.call(counts, key)) {
      out.push({ hex: key, count: counts[key] });
    }
    out.sort(function (a, b) { return b.count - a.count; });
    return out.slice(0, 12).map(function (entry) { return entry.hex; });
  }

  /**
   * Any CSS colour -> '#rrggbb'. null when transparent or unparseable.
   *
   * ⚠️⚠️ G4 — DO NOT REPLACE THIS WITH AN rgb() REGEX. It was one, and on every
   * project the platform generates it threw the palette away. Tailwind 4 writes its
   * whole colour system in oklch(), and getComputedStyle hands oklch() straight back
   * — it does NOT normalise to rgb() the way it does for hsl() or named colours. So
   * the regex matched only the few literal rgb() values and the picker offered black,
   * white and cream while the design's actual stones and amber went in the bin.
   *
   * Painting one pixel and reading it back delegates the colour-space maths to the
   * browser, so oklch / oklab / color() / lab / hwb / named all convert correctly,
   * and anything the browser cannot parse leaves fillStyle untouched — which we
   * detect with the two-sentinel trick below rather than trusting a silent no-op.
   */
  var probeCtx = null;
  var hexMemo = {};
  function toHexColor(value) {
    if (!value) return null;
    var text = String(value).trim();
    if (!text || text === 'transparent' || text === 'none') return null;

    // A page has a handful of distinct colour STRINGS across its thousand computed
    // values, and getImageData is the expensive part — so memoise on the raw string.
    if (Object.prototype.hasOwnProperty.call(hexMemo, text)) return hexMemo[text];
    var result = computeHexColor(text);
    hexMemo[text] = result;
    return result;
  }

  function computeHexColor(text) {
    try {
      if (!probeCtx) {
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        probeCtx = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!probeCtx) return null;

      // Two different sentinels: if the value is invalid CSS the assignment is
      // ignored, and fillStyle still reads back as whichever sentinel we set. Only
      // a value that survives BOTH rounds is a colour the browser actually parsed.
      probeCtx.fillStyle = '#000000';
      probeCtx.fillStyle = text;
      var first = probeCtx.fillStyle;
      probeCtx.fillStyle = '#ffffff';
      probeCtx.fillStyle = text;
      if (probeCtx.fillStyle !== first) return null;

      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.fillRect(0, 0, 1, 1);
      var px = probeCtx.getImageData(0, 0, 1, 1).data;

      // Anything mostly see-through is not a colour the user picked.
      if (px[3] < 89) return null;

      var hex = '#';
      for (var i = 0; i < 3; i++) {
        var part = px[i].toString(16);
        hex += part.length === 1 ? '0' + part : part;
      }
      return hex;
    } catch (e) {
      return null;
    }
  }

  function post(type, payload) {
    try { window.parent.postMessage({ type: type, payload: payload || null }, ORIGIN); } catch (e) {}
  }

  function clean(text) { return (text || '').replace(/\s+/g, ' ').trim(); }

  /**
   * ⭐⭐ G3/B2 — STRIP THE EDITOR'S OWN CLASSES BEFORE ANYONE SEES THEM.
   *
   * 'totalum-ve-selected' is added to draw the outline, and the old code read the class
   * attribute AFTER adding it. That single ordering made the class attribute reported to
   * the workspace differ from the source file by one token — which meant every size and
   * every colour edit resolved to "not-found". Two whole edit kinds, 100% failure, on
   * every element of every project.
   *
   * Returns null when nothing is left, so "no class attribute in the source" stays
   * distinguishable from "an empty one".
   */
  function sourceClass(el) {
    var raw = el.getAttribute('class');
    if (!raw) return null;
    var kept = [];
    var parts = raw.split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].indexOf('totalum-ve-') !== 0) kept.push(parts[i]);
    }
    return kept.length ? kept.join(' ') : null;
  }

  /**
   * ⭐ G3/B3 — UNDO THE PROXY'S URL REWRITE.
   *
   * rewriteHtml() turned src="/hero.png" into src="/api/preview/<id>/hero.png" before
   * this agent ever ran, so reporting the live attribute meant reporting a string that
   * appears in no source file — every image and video replacement was unmappable.
   */
  function unproxy(raw) {
    if (!raw || !BASE) return raw;
    if (raw === BASE) return '/';
    return raw.lastIndexOf(BASE + '/', 0) === 0 ? raw.slice(BASE.length) : raw;
  }

  /**
   * ⭐⭐ G6 — WHAT THE SOURCE FILE WOULD CALL THIS IMAGE, not what the browser fetched.
   *
   * Three things stood between those two, and each one broke image replacement in its
   * own way:
   *
   *  1 · ⚠️⚠️ 'next/image' RENDERS AN OPTIMISER URL. '<Image src="/hero.png">' becomes
   *      'src="/_next/image?url=%2Fhero.png&w=1920&q=75"'. Reporting that verbatim put a
   *      string in 'change.before' that exists in no file, so every tie-break that asks
   *      "which entry currently holds this url" failed, and the panel showed the user a
   *      query string instead of their filename. The real url is right there in the
   *      'url' parameter — unwrapping it costs nothing and makes before/after honest.
   *
   *  2 · ⚠️ '<source srcSet="…">' HAS NO 'src' ATTRIBUTE AT ALL. The agent reports
   *      '<source>' as replaceable media (it is), the panel then had an empty field and
   *      'commitSrc' refuses on a falsy 'signature.src' — so a '<picture>' could be
   *      selected and never edited. srcset is a candidate list; the FIRST url in it is
   *      the one the source most likely wrote.
   *
   *  3 · The proxy prefix, which 'unproxy' has always removed (G3/B3).
   */
  function unwrapNextImage(url) {
    if (!url || url.indexOf('/_next/image') === -1) return url;
    try {
      var query = url.slice(url.indexOf('?') + 1).split('&');
      for (var i = 0; i < query.length; i++) {
        if (query[i].lastIndexOf('url=', 0) === 0) return decodeURIComponent(query[i].slice(4));
      }
    } catch (e) {}
    return url;
  }

  function firstSrcSetUrl(value) {
    if (!value) return null;
    // "a.png 1x, b.png 2x" -> "a.png". Descriptors are whitespace-separated.
    var first = String(value).split(',')[0];
    return first ? first.trim().split(/\s+/)[0] || null : null;
  }

  function sourceSrc(el) {
    var raw = el.getAttribute('src');
    if (!raw) raw = firstSrcSetUrl(el.getAttribute('srcset') || el.getAttribute('srcSet'));
    return unwrapNextImage(unproxy(raw));
  }

  /** The nearest ancestor id — a weaker but still useful anchor. */
  function ancestorIdOf(el) {
    var node = el.parentElement;
    var depth = 0;
    while (node && depth < 6) {
      var id = node.getAttribute && node.getAttribute('id');
      if (id) return id;
      node = node.parentElement;
      depth++;
    }
    return null;
  }

  /** Direct text only — a wrapper's textContent would swallow its children. */
  function ownText(el) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) out += node.nodeValue;
    }
    return clean(out);
  }

  /**
   * ⭐⭐ G6 — A HEADING BROKEN OVER TWO LINES IS STILL A HEADING.
   *
   * ⚠️⚠️ '<h1>Bean<br/>There</h1>' COULD NOT BE EDITED AT ALL — no text field in the
   * panel, no caret in the page — because the old test refused ANY element with
   * children. A hero heading with a '<br/>' in it is one of the most common shapes on a
   * generated landing page and one of the most likely things a user wants to retype, so
   * "you cannot edit this" was landing on exactly the wrong element.
   *
   * '<br>' is the only child we admit, and it is admissible for a specific reason: it
   * carries no content of its own, so the element's text stays LINEAR. Reading it is
   * "text, newline, text" and writing it back is the same in reverse — nothing can be
   * lost. Any other child (a '<span>', a '<strong>', a link) holds words and styling
   * that a plain-text round trip would destroy, so those are still refused and the user
   * selects the child itself.
   */
  function onlyBrChildren(el) {
    if (!el.children) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].tagName !== 'BR') return false;
    }
    return true;
  }

  function isEditableText(el) {
    // No element children, or only <br> ⇒ the text is unambiguously this element's and
    // is linear, so replacing it cannot destroy a child.
    if (!el.children || !onlyBrChildren(el)) return false;
    return linearText(el).length > 0;
  }

  /**
   * ⭐⭐⭐ IS THIS ELEMENT, OR ANYTHING IT SITS INSIDE, SOMETHING THE APP ACTS ON?
   *
   * ⚠️⚠️ THIS IS THE FIX FOR "I CLICK A BUTTON AND THE PREVIEW NAVIGATES AWAY".
   *
   * A <button> or an <a> whose content is plain text passes 'isEditableText', so
   * 'select()' put a caret in it — and 'onClick' then has to let the NEXT click through,
   * because a click inside the element being edited is how anyone moves a cursor. That
   * click is a real click: React's handler fires, 'router.push()' runs, and the frame
   * loads another route. The user was editing a label; the app treated it as a press.
   *
   * ⚠️ IT DOES NOT MAKE THESE UNEDITABLE. 'isEditableText' is unchanged, so the panel
   * still offers its text field for a button's label and the change still resolves —
   * what changes is that the words are retyped in the panel rather than in a live app
   * that is listening for the click. In-place editing stays exactly as it was for
   * headings, paragraphs, list items and every other non-interactive element.
   *
   * ⚠️ IT WALKS UP, because '<a><span>Read more</span></a>' selects the span, and the
   * click that would place a caret in the span still activates the anchor around it.
   */
  var INTERACTIVE_TAGS = { A: 1, AREA: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1,
                           LABEL: 1, SUMMARY: 1, OPTION: 1 };
  var INTERACTIVE_ROLES = { button: 1, link: 1, tab: 1, menuitem: 1, checkbox: 1,
                            radio: 1, switch: 1, option: 1 };

  function isInteractive(el) {
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      if (INTERACTIVE_TAGS[node.tagName]) return true;
      var role = node.getAttribute && node.getAttribute('role');
      if (role && INTERACTIVE_ROLES[role]) return true;
      // A plain <div onClick={…}> is invisible from here, which is why 'onClick' below
      // swallows the click for EVERY element rather than relying on this list alone.
      node = node.parentElement;
      depth++;
    }
    return false;
  }

  /**
   * The element's own text with '<br>' read as a newline.
   *
   * ⚠️ IT IS NOT 'textContent'. A '<br>' contributes nothing to 'textContent', so
   * "Bean" and "There" would fuse into "BeanThere" — which is neither what the user
   * sees nor what the source says, and would match nothing.
   */
  function linearText(el) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) out += node.nodeValue;
      else if (node.nodeType === 1 && node.tagName === 'BR') out += '\n';
    }
    // ⚠️ Collapse runs of spaces and tabs, but NEVER the newlines we just introduced.
    return out.replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/^\s+|\s+$/g, '');
  }

  /** Write linear text back, rebuilding the '<br>' elements the newlines stand for. */
  function setLinearText(el, value) {
    var lines = String(value == null ? '' : value).split('\n');
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) el.appendChild(document.createElement('br'));
      if (lines[i]) el.appendChild(document.createTextNode(lines[i]));
    }
  }

  function breadcrumbOf(el) {
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 4 && node !== document.body) {
      var name = node.tagName.toLowerCase();
      // ⚠️ sourceClass, not getAttribute — otherwise the breadcrumb reads
      // "li.totalum-ve-selected" for an element with no classes of its own (G3/B2).
      var id = node.getAttribute('id');
      var cls = (sourceClass(node) || '').split(/\s+/)[0];
      parts.unshift(id ? name + '#' + id : cls ? name + '.' + cls : name);
      node = node.parentElement;
      depth++;
    }
    return parts.join(' › ');
  }

  function nthOfType(el) {
    var n = 1;
    var sib = el;
    while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) n++;
    return n;
  }

  /**
   * ⭐⭐⭐ G5 — WHERE THIS ELEMENT WAS WRITTEN, IF THE BUILD BOTHERED TO SAY.
   *
   * The template's webpack loader stamps every JSX element with
   * 'data-tlm-loc="src/app/page.tsx:42:7"'. When it is there the server does not have to
   * infer anything: no class comparison, no text comparison, no ambiguity between two
   * identical cards. Projects built before the loader shipped simply have no attribute
   * and fall through to structural matching, so this is additive in both directions.
   *
   * ⚠️ THE ATTRIBUTE ON THE NODE IS THE CALL SITE'S, NOT THE PRIMITIVE'S, because
   * '<Button {...props} />' spreads the caller's data-* after its own attributes. That is
   * exactly the file the user wants edited.
   */
  function locOf(el) {
    try { return el.getAttribute('data-tlm-loc') || null; } catch (e) { return null; }
  }

  /** The nearest tagged ancestors, innermost first — a region when the element has none. */
  function ancestorLocsOf(el) {
    var out = [];
    var node = el.parentElement;
    var depth = 0;
    while (node && depth < 8 && out.length < 3) {
      var loc = locOf(node);
      if (loc) out.push(loc);
      node = node.parentElement;
      depth++;
    }
    return out;
  }

  function tokensOf(el) {
    var value = sourceClass(el);
    return value ? value.split(/\s+/).filter(Boolean) : [];
  }

  /**
   * ⭐ THE ANCESTOR CHAIN, WHICH IS HOW TWO IDENTICAL CARDS STOP BEING THE SAME CARD.
   *
   * A landing page is full of elements that are indistinguishable on their own — every
   * feature title, every nav link, every pricing row. What separates them is where they
   * sit, and the server has the source tree to compare this against.
   */
  function pathOf(el) {
    var out = [];
    var node = el.parentElement;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 8 && node !== document.documentElement) {
      out.push({
        tag: node.tagName.toLowerCase(),
        id: node.getAttribute('id') || null,
        tokens: tokensOf(node),
        nthOfType: nthOfType(node)
      });
      node = node.parentElement;
      depth++;
    }
    return out;
  }

  /**
   * ⭐⭐ WHICH OF THE IDENTICAL ONES DID THEY CLICK?
   *
   * ⚠️⚠️ THIS IS THE ANSWER TO "IT APPEARS IN SEVERAL PLACES AND WE CANNOT TELL WHICH
   * YOU MEANT" — a message the user saw for a change they had made with a single
   * unambiguous click. The page knows perfectly well which one it was: it is the Nth of
   * the M elements on this page that look exactly like it. When the source contains the
   * same M indistinguishable candidates, the two sets are the same set in the same
   * order, and N picks the right one.
   *
   * The fingerprint is deliberately coarse (tag + class + own text): it has to group the
   * elements the SERVER cannot tell apart, not the ones a browser cannot.
   */
  function twinInfo(el) {
    try {
      var fingerprint = function (node) {
        return node.tagName + '|' + (sourceClass(node) || '') + '|' + ownText(node);
      };
      var mine = fingerprint(el);
      var all = document.body ? document.body.getElementsByTagName(el.tagName) : [];
      var ordinal = -1;
      var count = 0;
      for (var i = 0; i < all.length; i++) {
        if (fingerprint(all[i]) !== mine) continue;
        if (all[i] === el) ordinal = count;
        count++;
        if (count > 60) return { ordinal: null, twins: null };  // a huge list proves nothing
      }
      return ordinal === -1 ? { ordinal: null, twins: null } : { ordinal: ordinal, twins: count };
    } catch (e) {
      return { ordinal: null, twins: null };
    }
  }

  /**
   * The attributes that identify an element independently of its classes.
   *
   * ⚠️ 'href' GOES THROUGH unproxy FOR THE SAME REASON 'src' DOES (G3/B3): rewriteHtml
   * turned href="/about" into href="/api/preview/<id>/about" before this agent existed,
   * so reporting the live value would be reporting a string that is in no source file —
   * and the server would score a correct match DOWN for disagreeing with it.
   */
  var REPORTED_ATTRS = ['alt', 'href', 'placeholder', 'title', 'aria-label', 'type', 'name'];
  function attrsOf(el) {
    var out = {};
    for (var i = 0; i < REPORTED_ATTRS.length; i++) {
      var name = REPORTED_ATTRS[i];
      var value = el.getAttribute(name);
      if (name === 'href') value = unproxy(value);
      if (value) out[name] = value;
    }
    return out;
  }

  function signatureOf(el) {
    var parent = el.parentElement;
    var prev = el.previousElementSibling;
    var next = el.nextElementSibling;
    var twins = twinInfo(el);
    return {
      /**
       * ⚠️ THE ROUTE IS THE APP'S, NOT THE PROXY'S. Under the proxy the pathname is
       * "/api/preview/<id>/about"; the matcher scores it against "src/app/about/page.tsx",
       * so the base has to come off or every route signal is silently lost (G3).
       */
      route: (function () {
        var path = window.location.pathname || '/';
        if (BASE && path.lastIndexOf(BASE, 0) === 0) path = path.slice(BASE.length) || '/';
        return path || '/';
      })(),
      tag: el.tagName.toLowerCase(),
      text: isEditableText(el) ? linearText(el) : null,
      className: sourceClass(el),
      parentTag: parent ? parent.tagName.toLowerCase() : null,
      parentClassName: parent ? sourceClass(parent) : null,
      prevSiblingText: prev ? clean(prev.textContent).slice(0, 60) || null : null,
      nextSiblingText: next ? clean(next.textContent).slice(0, 60) || null : null,
      nthOfType: nthOfType(el),
      src: sourceSrc(el),
      breadcrumb: breadcrumbOf(el),
      id: el.getAttribute('id') || null,
      ancestorId: ancestorIdOf(el),
      // ⭐ G3/M4 — stable for as long as this element stays selected, so the store can
      // collapse consecutive edits to one property without keying on the class-derived
      // breadcrumb (which changes the moment a size or colour edit lands).
      selectionId: selectionId,

      /**
       * ── G5: everything the server needs to stop guessing ──────────────────
       *
       * ⚠️ ALL OF IT IS ADDITIVE. An older workspace ignores these fields and an older
       * agent simply does not send them; the matcher treats each one as evidence when it
       * is there. Nothing here changes the meaning of a field that already existed.
       */
      loc: locOf(el),
      ancestorLocs: ancestorLocsOf(el),
      classTokens: tokensOf(el),
      // The whole subtree's text, so an element with children (the hero <h1> with a
      // <br> in it) can still be IDENTIFIED even though its text cannot be edited.
      subtreeText: clean(el.textContent).slice(0, 300) || null,
      attrs: attrsOf(el),
      path: pathOf(el),
      domOrdinal: twins.ordinal,
      domTwins: twins.twins
    };
  }

  function describe(el) {
    var computed = window.getComputedStyle(el);
    return {
      signature: signatureOf(el),
      editable: {
        text: isEditableText(el),
        // Only a real media element can have its source replaced.
        media: el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'SOURCE'
      },
      computed: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize
      },
      rect: (function () {
        var r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      })()
    };
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  var hovered = null;

  function setHover(el) {
    if (hovered === el) return;
    if (hovered) hovered.classList.remove('totalum-ve-hover');
    hovered = el;
    if (hovered && hovered !== selected) hovered.classList.add('totalum-ve-hover');
  }

  /**
   * ═══ EDIT THE TEXT WHERE IT IS ═══════════════════════════════════════════
   *
   * The selected element becomes contenteditable, so the heading can be retyped in
   * the page instead of in a sidebar. The panel's textarea still works and the two
   * stay in step, because both end up in the same change through the same store.
   *
   * ⚠️ 'plaintext-only' WHERE IT EXISTS. Plain 'true' lets a paste carry markup —
   * spans, styles, whole subtrees — into an element whose text we are about to
   * write back into a source file as a string. Safari and Firefox have only
   * recently supported the value, so it falls back rather than assuming.
   */
  var editing = null;
  var editingBefore = '';
  var editTimer = null;

  function stopEditing() {
    if (editTimer) { clearTimeout(editTimer); editTimer = null; }
    if (!editing) return;
    editing.removeAttribute('contenteditable');
    editing.classList.remove('totalum-ve-editing');
    editing = null;
    editingBefore = '';
  }

  function startEditing(el) {
    editing = el;
    editingBefore = linearText(el);
    el.classList.add('totalum-ve-editing');
    try { el.setAttribute('contenteditable', 'plaintext-only'); } catch (e) {}
    if (el.getAttribute('contenteditable') !== 'plaintext-only') {
      el.setAttribute('contenteditable', 'true');
    }
  }

  /**
   * ⚠️ DEBOUNCED, AND THE REASON IS NOT PERFORMANCE. Every push round-trips to the
   * parent, which echoes an apply back; writing that echo into the DOM mid-word
   * would move the caret to the start. See the guard in applyChange.
   */
  function onEditInput() {
    if (!editing) return;
    if (editTimer) clearTimeout(editTimer);
    editTimer = setTimeout(function () {
      if (!editing) return;
      var now = linearText(editing);
      if (now === editingBefore) return;
      post(M.textEdited, { before: editingBefore, after: now });
    }, 260);
  }

  document.addEventListener('input', onEditInput, true);

  function select(el) {
    stopEditing();
    selected = el;
    if (!el) { positionRing(); post(M.cleared); return; }
    // A NEW selection gets a new stable id; a re-describe of the same element keeps it.
    selectionId = 'sel-' + (++selectionSeq);
    el.classList.remove('totalum-ve-hover');
    positionRing();
    // Only an element whose text is unambiguously its own — the same test the
    // panel's text field uses, so the two are never offered on different things.
    // ⚠️ NOT INSIDE A BUTTON OR A LINK — see 'isInteractive'. The panel's text field
    // still edits it; a caret here turns the user's next click into a press.
    if (isEditableText(el) && !isInteractive(el)) startEditing(el);
    post(M.selected, describe(el));
  }

  function isMedia(el) {
    return !!el && (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'SOURCE');
  }

  /**
   * ⭐⭐ WHAT THE USER MEANT TO CLICK, WHICH IS NOT ALWAYS WHAT THEY HIT.
   *
   * ⚠️⚠️ THIS IS WHY SOME IMAGES COULD NOT BE SELECTED AT ALL. event.target is the
   * TOPMOST element at the point, and pictures on the web are routinely buried:
   * a gradient scrim for legible caption text, a hover layer, a stretched anchor,
   * an aspect-ratio spacer. Every one of those is a div sitting exactly on top of
   * the img, so the click selected the div — an element with no text and no media,
   * i.e. one the panel can do almost nothing with — and the image underneath was
   * unreachable no matter how carefully you aimed.
   *
   * So when the top element is neither media nor text of its own, look DOWN the
   * stack at the same point and take the first media element instead. If there is
   * none, nothing changes and the original target is used.
   *
   * ⚠️ IT NEVER OVERRIDES A REAL TEXT ELEMENT. A caption sitting over a photo is a
   * legitimate thing to select, so anything with its own text wins on its own.
   */
  function pick(event) {
    var top = event.target;
    if (!top || top.nodeType !== 1) return null;
    if (isMedia(top) || isEditableText(top)) return top;
    if (!document.elementsFromPoint) return top;

    var stack = document.elementsFromPoint(event.clientX, event.clientY) || [];
    for (var i = 0; i < stack.length; i++) {
      var node = stack[i];
      if (node === document.body || node === document.documentElement) break;
      if (isMedia(node)) return node;
      // Stop at the first thing that is clearly its own content — going deeper
      // would reach past a real element into whatever happens to be behind it.
      if (isEditableText(node)) break;
    }
    return top;
  }

  function onMove(event) {
    if (!active) return;
    if (editing && (event.target === editing || editing.contains(event.target))) {
      setHover(null);
      return;
    }
    var el = pick(event);
    if (!el || el === document.body || el === document.documentElement) return;
    setHover(el);
  }

  function onClick(event) {
    if (!active) return;
    /**
     * ⚠️ A CLICK INSIDE THE ELEMENT BEING EDITED IS A CARET, NOT A SELECTION — so it
     * must not RE-SELECT. It must still be swallowed.
     *
     * ⚠️⚠️ IT USED TO RETURN HERE UNTOUCHED, AND THAT IS HOW A CLICK IN THE EDITOR
     * REACHED THE APP. The caret is placed by the browser on 'mousedown'; 'click' is
     * only what the application listens to. Returning early therefore bought nothing for
     * the cursor and handed the app a genuine press — which on anything interactive
     * navigated the frame out of the page being edited. Preventing the default and
     * stopping propagation leaves the caret exactly where the user put it.
     */
    if (editing && (event.target === editing || editing.contains(event.target))) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    var el = pick(event);
    if (el) select(el);
  }

  /**
   * ⭐⭐ THE EVENTS THAT ACT BEFORE A CLICK EVER HAPPENS.
   *
   * ⚠️ 'click' IS NOT THE ONLY WAY AN APP NAVIGATES. Radix, most menu primitives and a
   * good deal of hand-written React act on 'pointerdown'/'mousedown', which fire first —
   * so swallowing the click alone let the page move under a user who was only trying to
   * select something. 'submit' and 'auxclick' (middle-click) are the same story.
   *
   * ⚠️ PROPAGATION IS STOPPED, THE DEFAULT IS NOT — for pointerdown/mousedown. The
   * default is what places a caret and starts a text selection, and both are wanted
   * inside the element being edited; the app's own handlers are what must not run.
   */
  function swallowBefore(event) {
    if (!active) return;
    if (editing && (event.target === editing || editing.contains(event.target))) return;
    event.stopPropagation();
  }

  function swallowFully(event) {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onKey(event) {
    if (!active) return;
    /**
     * ⚠️ WHILE EDITING, ESCAPE ENDS THE EDIT — IT DOES NOT DESELECT. Dropping the
     * selection would also close the panel describing what was just typed. A
     * second Escape, with nothing being edited, clears as it always did.
     */
    if (event.key === 'Escape' && editing) {
      var node = editing;
      stopEditing();
      if (node.blur) node.blur();
      return;
    }
    if (event.key === 'Escape') { setHover(null); select(null); }
  }

  // ⚠️ CAPTURE PHASE, so the app's own handlers never see the click that was meant
  // for the editor — otherwise selecting a link would navigate away.
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', swallowBefore, true);
  document.addEventListener('mousedown', swallowBefore, true);
  document.addEventListener('auxclick', swallowFully, true);
  document.addEventListener('submit', swallowFully, true);

  // ── Preview-only changes ──────────────────────────────────────────────────
  function applyChange(change) {
    var el = selected;
    if (change.target === 'selected' && !el) return { ok: false, error: 'nothing-selected' };
    var id = change.id || 've-' + (++seq);

    if (change.prop === 'text') {
      /**
       * ⚠️ 'previous' IS THE PRE-EDIT TEXT WHEN THE USER IS TYPING IN THE PAGE.
       * By the time the parent echoes an inline edit back, the DOM already holds
       * the new text — recording that as 'previous' would make undo a no-op.
       */
      applied[id] = {
        el: el,
        prop: 'text',
        previous: editing === el ? editingBefore : linearText(el)
      };
      /**
       * ⚠️⚠️ DO NOT REWRITE TEXT THE USER IS TYPING. Assigning textContent destroys
       * and rebuilds the text node, which collapses the selection and drops the
       * caret to position 0 — so every debounced push mid-word would send the
       * cursor to the start of the heading. When the DOM already says what the
       * change says, there is nothing to write.
       */
      /**
       * ⚠️ 'setLinearText', NOT 'textContent'. Assigning textContent deletes the
       * '<br>' elements outright, so a two-line heading collapsed onto one the
       * instant any edit touched it — including an edit to its colour.
       */
      if (linearText(el) !== change.value) setLinearText(el, change.value);
    } else if (change.prop === 'class') {
      /**
       * ⚠️ G3 — THE VALUE THE WORKSPACE SENDS IS *SOURCE* CLASSES ONLY, because the
       * signature it derived it from is now stripped (B2). Writing it verbatim would
       * therefore delete the outline the user is looking at. The editor's own classes
       * are carried across explicitly, and 'previous' records the SOURCE value so a
       * revert restores exactly what the file has.
       */
      applied[id] = {
        el: el,
        prop: 'class',
        previous: sourceClass(el),
        previousStyle: inlineStyleSnapshot(el)
      };
      setSourceClass(el, change.value);
      mirrorClassAsInlineStyle(el, change.value);
    } else if (change.prop === 'src') {
      /**
       * ⚠️⚠️ G6 — 'srcset' WINS OVER 'src' IN THE BROWSER, so setting 'src' alone
       * showed the user the OLD picture and made a perfectly good edit look broken.
       * Every 'next/image' renders a srcset, and so does every '<picture><source>'.
       * It is recorded so a revert puts the responsive set back exactly as it was.
       */
      applied[id] = {
        el: el,
        prop: 'src',
        previous: el.getAttribute('src'),
        previousSrcSet: el.getAttribute('srcset') || el.getAttribute('srcSet'),
        hadSrc: el.hasAttribute('src')
      };
      // The live DOM needs the PROXIED url; the change carries the source one.
      el.setAttribute('src', proxied(change.value));
      if (applied[id].previousSrcSet !== null && applied[id].previousSrcSet !== undefined) {
        el.setAttribute('srcset', proxied(change.value));
      }
      // A <source> inside <video>/<picture> needs the parent reloaded to take effect.
      if (el.tagName === 'SOURCE' && el.parentElement && el.parentElement.load) el.parentElement.load();
    } else {
      return { ok: false, error: 'unknown-prop' };
    }

    // A text or class change can resize the element; the ring must follow it.
    positionRing();
    return { ok: true, id: id };
  }

  /**
   * ⭐⭐⭐ WHY A CLASS EDIT ALSO WRITES AN INLINE STYLE — PREVIEW ONLY.
   *
   * ⚠️⚠️ THE PREVIEW IS A PRODUCTION BUILD, SO A NEW TAILWIND CLASS HAS NO CSS.
   * This is the whole reason "change colour" appeared to do nothing. setColorClass
   * writes 'text-[#ff0000]' — an arbitrary value, correct for the SOURCE, and
   * guaranteed to compile the next time Tailwind runs. But Tailwind already ran: the
   * previewed app was built and served by 'next start', its stylesheet is a finished
   * artefact, and a class nobody had written when it was generated matches no rule.
   * So the attribute changed, the pixels did not, and the user reasonably concluded
   * the feature was broken. The same applies to a stepped 'text-[3.6rem]', and to any
   * scale step whose class the project does not already use somewhere.
   *
   * The class is still what gets written to the file — that is the mappable, reviewable,
   * responsive-friendly edit, and after the rebuild it is what renders. This is purely
   * the stand-in that makes the intervening minute honest.
   *
   * ⚠️ IT NEVER TOUCHES A PROPERTY THE CHANGE DID NOT MENTION, and 'previousStyle'
   * records the element's own inline values so a revert puts back exactly what the page
   * shipped with — including "nothing".
   *
   * ⚠️ PREFIXED TOKENS ARE IGNORED. 'hover:text-red-500' and 'md:text-2xl' describe
   * states and breakpoints this element is not necessarily in; mirroring them as a flat
   * inline style would show the user a hover colour they cannot see the trigger for.
   *
   * ⚠️ NO BACKTICKS ANYWHERE IN THIS FILE'S AGENT SOURCE — it is a template literal in
   * the module that ships it, so one backtick ends the script mid-function.
   */
  var TEXT_SCALE = {
    'text-xs': '0.75rem', 'text-sm': '0.875rem', 'text-base': '1rem',
    'text-lg': '1.125rem', 'text-xl': '1.25rem', 'text-2xl': '1.5rem',
    'text-3xl': '1.875rem', 'text-4xl': '2.25rem', 'text-5xl': '3rem',
    'text-6xl': '3.75rem', 'text-7xl': '4.5rem', 'text-8xl': '6rem', 'text-9xl': '8rem'
  };

  /** The three properties this mirror may touch, and nothing else. */
  var MIRRORED = ['color', 'backgroundColor', 'fontSize'];

  function inlineStyleSnapshot(el) {
    var out = {};
    for (var i = 0; i < MIRRORED.length; i++) out[MIRRORED[i]] = el.style[MIRRORED[i]] || '';
    return out;
  }

  function restoreInlineStyle(el, snapshot) {
    if (!snapshot) return;
    for (var i = 0; i < MIRRORED.length; i++) el.style[MIRRORED[i]] = snapshot[MIRRORED[i]] || '';
  }

  function mirrorClassAsInlineStyle(el, value) {
    var tokens = (value || '').split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!token || token.indexOf(':') !== -1) continue;

      // 'text-[…]' is a colour when it starts with '#', a size otherwise — the one
      // ambiguity in the syntax, and it is decided by the first character.
      var arbitrary = /^(text|bg)-\[([^\]]+)\]$/.exec(token);
      if (arbitrary) {
        var inner = arbitrary[2];
        if (inner.charAt(0) === '#') {
          if (arbitrary[1] === 'bg') el.style.backgroundColor = inner;
          else el.style.color = inner;
        } else if (arbitrary[1] === 'text' && /^[\d.]+(rem|px|em)$/.test(inner)) {
          el.style.fontSize = inner;
        }
        continue;
      }

      if (TEXT_SCALE[token]) el.style.fontSize = TEXT_SCALE[token];
    }
  }

  /** Write source classes while preserving whatever editor classes are on the element. */
  function setSourceClass(el, value) {
    var editorClasses = [];
    var current = (el.getAttribute('class') || '').split(/\s+/);
    for (var i = 0; i < current.length; i++) {
      if (current[i] && current[i].indexOf('totalum-ve-') === 0) editorClasses.push(current[i]);
    }
    var next = (value || '').split(/\s+/).filter(Boolean).concat(editorClasses);
    if (next.length) el.setAttribute('class', next.join(' '));
    else el.removeAttribute('class');
  }

  /** Source url -> the url this proxied document can actually load. */
  function proxied(url) {
    if (!url || !BASE) return url;
    if (url.charAt(0) !== '/') return url;                 // absolute or relative: as-is
    if (url.lastIndexOf(BASE + '/', 0) === 0) return url;  // already proxied
    return BASE + url;
  }

  function revertChange(id) {
    var record = applied[id];
    if (!record) return { ok: false };
    if (record.prop === 'text') setLinearText(record.el, record.previous);
    else if (record.prop === 'class') {
      setSourceClass(record.el, record.previous);
      // Undo the preview mirror too, or the colour survives the class that caused it.
      restoreInlineStyle(record.el, record.previousStyle);
    }
    else if (record.prop === 'src') {
      // ⚠️ Put back BOTH, and put back "absent" as absent — a <source> never had a src.
      if (record.hadSrc) record.el.setAttribute('src', record.previous);
      else record.el.removeAttribute('src');
      if (record.previousSrcSet === null || record.previousSrcSet === undefined) {
        record.el.removeAttribute('srcset');
      } else {
        record.el.setAttribute('srcset', record.previousSrcSet);
      }
      if (record.el.tagName === 'SOURCE' && record.el.parentElement && record.el.parentElement.load) {
        record.el.parentElement.load();
      }
    }
    else if (record.previous === null) record.el.removeAttribute(record.prop);
    else record.el.setAttribute(record.prop, proxied(record.previous));
    delete applied[id];
    positionRing();
    return { ok: true };
  }

  // ── Messages ──────────────────────────────────────────────────────────────
  window.addEventListener('message', function (event) {
    // ⚠️ THE ORIGIN CHECK. Same-origin only: the proxy serves this document from
    // the workspace's own origin, so anything else is not the editor.
    if (event.origin !== ORIGIN) return;
    var data = event.data || {};

    if (data.type === M.setActive) {
      active = !!data.payload;
      document.documentElement.classList.toggle('totalum-ve-active', active);
      if (!active) { setHover(null); select(null); }
      // G4 — refresh the palette on activation: a rebuild since load may have
      // changed the design, and a stale swatch row is worse than none.
      // ⚠️ M.palette, NOT M.ready — see the note on the message. Posting ready here
      // fed the parent's readyTick, whose effect posts this very message back.
      else post(M.palette, { route: window.location.pathname, palette: harvestPalette() });
    } else if (data.type === M.apply) {
      var result = applyChange(data.payload || {});
      if (result.ok && selected) post(M.selected, describe(selected));
    } else if (data.type === M.revert) {
      revertChange((data.payload || {}).id);
      if (selected) post(M.selected, describe(selected));
    } else if (data.type === M.deselect) {
      // G3/P2 — drop the outline WITHOUT turning selection mode off.
      setHover(null);
      select(null);
    }
  });

  // A client-side navigation invalidates the selection AND every preview change,
  // because the nodes they pointed at are gone.
  var lastPath = window.location.pathname;
  setInterval(function () {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      selected = null;
      applied = {};
      // A new route is a new palette — the old one described a page that is gone.
      post(M.navigated, { route: lastPath, palette: harvestPalette() });
    }
  }, 400);

  window.__totalumVisualEditor = true;

  /**
   * ⚠️ ANNOUNCED TWICE, DELIBERATELY (G3).
   *
   * This script runs at the TOP of <head>, so 'ready' is posted before the workspace's
   * React listener can possibly have missed it — but only if the listener was already
   * attached. G2 measured the other case: attach a listener after the document has
   * loaded and 'ready' is gone forever, leaving the panel on "Connecting…" with no
   * retry. Re-announcing on 'load' costs one message and removes the race entirely.
   * The parent is idempotent about it.
   */
  post(M.ready, { route: window.location.pathname, palette: harvestPalette() });
  window.addEventListener('load', function () {
    post(M.ready, { route: window.location.pathname, palette: harvestPalette() });
  });
})();
`;

/** The `<script>` tag the proxy injects. Points at the agent route below. */
export const AGENT_SCRIPT_TAG = (base: string) =>
    `<script src="${base}/__totalum-visual-editor.js" data-totalum-visual-editor></script>`;

/** The path the proxy serves the agent from, relative to a project's proxy base. */
export const AGENT_PATH = "__totalum-visual-editor.js";
