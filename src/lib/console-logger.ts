/**
 * Console Logger - Captures all console logs and HTTP calls
 * Sends them to parent window via postMessage for real-time monitoring
 */

class ConsoleLogger {
  private parentOrigin: string | null = null;
  private isInitialized = false;
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };
  private originalFetch: typeof window.fetch | null = null;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  // Mobile drag-to-scroll state
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;
  private dragListeners: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: () => void;
    mouseleave: () => void;
  } | null = null;

  /**
   * Initialize console interceptors and fetch interceptor
   */
  init() {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    // Store original fetch
    this.originalFetch = window.fetch;

    // Override console methods
    console.log = (...args: any[]) => {
      this.sendLog('log', args);
      this.originalConsole.log.apply(console, args);
    };

    console.error = (...args: any[]) => {
      this.sendLog('error', args);
      this.originalConsole.error.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      this.sendLog('warn', args);
      this.originalConsole.warn.apply(console, args);
    };

    console.info = (...args: any[]) => {
      this.sendLog('info', args);
      this.originalConsole.info.apply(console, args);
    };

    // In development, detect parent origin to send logs via postMessage
    // In production, postMessage log forwarding is disabled
    if (process.env.NODE_ENV !== 'production') {
      this.detectParentOrigin();
    }

    // Intercept fetch calls
    this.interceptFetch();

    // Intercept unhandled errors
    this.interceptErrors();

    // Listen for mobile mode toggle from parent
    this.setupMobileModeListener();

    this.isInitialized = true;
    //console.log('[ConsoleLogger] Initialized - logs will be sent to parent window');
  }

  /**
   * Send log message to parent window
   */
  private sendLog(level: string, args: any[]) {
    try {
      const message = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      const timestamp = new Date().toISOString();

      // Send to parent window (only if parent origin was validated)
      if (window.parent && window.parent !== window && this.parentOrigin) {
        window.parent.postMessage(
          {
            type: 'console-log',
            level,
            message,
            timestamp,
          },
          this.parentOrigin
        );
      }
    } catch (error) {
      // Silently fail if can't send to parent
    }
  }

  /**
   * Detect parent window origin from document.referrer and validate it
   */
  private detectParentOrigin() {
    try {
      if (window.parent === window) return; // Not in an iframe

      const referrer = document.referrer;
      if (!referrer) return;

      const referrerOrigin = new URL(referrer).origin;

      // In development, accept any parent origin
      this.parentOrigin = referrerOrigin;
    } catch {
      // Silently fail if can't determine parent origin
    }
  }

  /**
   * Intercept fetch calls to log HTTP requests
   */
  private interceptFetch() {
    if (!this.originalFetch) return;

    window.fetch = async (...args: any[]) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';
      const method = args[1]?.method || 'GET';

      const startTime = Date.now();

      try {
        const response = await this.originalFetch!.apply(window, args);
        const duration = Date.now() - startTime;

        // Only log if URL is valid (not 'unknown' or undefined)
        if (url && url !== 'unknown') {
          this.sendLog('info', [
            `🌐 HTTP ${method} ${url} → ${response.status} ${response.statusText} (${duration}ms)`,
          ]);
        }

        return response;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Only log if URL is valid (not 'unknown' or undefined)
        if (url && url !== 'unknown') {
          this.sendLog('error', [
            `🌐 HTTP ${method} ${url} → FAILED (${duration}ms): ${error.message}`,
          ]);
        }

        throw error;
      }
    };
  }

  /**
   * Intercept unhandled errors and promise rejections
   */
  private interceptErrors() {
    // Store handlers so we can remove them later
    this.errorHandler = (event: ErrorEvent) => {
      this.sendLog('error', [
        `Unhandled Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      ]);
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      this.sendLog('error', [`Unhandled Promise Rejection: ${event.reason}`]);
    };

    window.addEventListener('error', this.errorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  /**
   * Setup listener for mobile mode toggle from parent
   */
  private setupMobileModeListener() {
    // Disable mobile mode by default
    this.toggleMobileStyles(false);

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'toggle-mobile-mode') {
        this.toggleMobileStyles(event.data.isMobile);
      }
    });
  }

  /**
   * Toggle mobile mode styles (hide scrollbars for mobile view)
   */
  private toggleMobileStyles(isMobile: boolean) {
    const styleId = 'mobile-mode-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (isMobile) {
      // Add mobile styles if not already present
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
          /* Hide scrollbars in mobile preview */
          html, body {
            overflow: auto;
            -webkit-overflow-scrolling: touch;
          }

          /* Hide scrollbar for Chrome, Safari and Opera */
          html::-webkit-scrollbar,
          body::-webkit-scrollbar,
          *::-webkit-scrollbar {
            display: none !important;
          }

          /* Hide scrollbar for IE, Edge and Firefox */
          html, body, * {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }

          /* Mobile drag-to-scroll cursor - Gray circle like Chrome DevTools */
          html, body {
            cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="rgba(128, 128, 128, 0.5)" stroke="rgba(64, 64, 64, 0.8)" stroke-width="1.5"/></svg>') 10 10, auto !important;
            user-select: none !important;
            -webkit-user-select: none !important;
          }

          html.dragging, body.dragging {
            cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="rgba(128, 128, 128, 0.7)" stroke="rgba(64, 64, 64, 1)" stroke-width="2"/></svg>') 10 10, auto !important;
          }
        `;
        document.head.appendChild(styleElement);
      }

      // Enable drag-to-scroll
      this.enableDragToScroll();
    } else {
      // Remove mobile styles
      if (styleElement) {
        styleElement.remove();
      }

      // Disable drag-to-scroll
      this.disableDragToScroll();
    }
  }

  /**
   * Enable drag-to-scroll functionality for mobile view
   */
  private enableDragToScroll() {
    if (this.dragListeners) {
      return; // Already enabled
    }

    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    // Mouse down - start dragging
    const handleMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.startX = e.pageX - (htmlElement.scrollLeft || bodyElement.scrollLeft);
      this.startY = e.pageY - (htmlElement.scrollTop || bodyElement.scrollTop);
      this.scrollLeft = htmlElement.scrollLeft || bodyElement.scrollLeft;
      this.scrollTop = htmlElement.scrollTop || bodyElement.scrollTop;

      htmlElement.classList.add('dragging');
      bodyElement.classList.add('dragging');
    };

    // Mouse move - scroll if dragging
    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      e.preventDefault();

      const x = e.pageX - (htmlElement.scrollLeft || bodyElement.scrollLeft);
      const y = e.pageY - (htmlElement.scrollTop || bodyElement.scrollTop);
      const walkX = (x - this.startX) * 1.5; // Multiply for faster scroll
      const walkY = (y - this.startY) * 1.5;

      window.scrollTo({
        left: this.scrollLeft - walkX,
        top: this.scrollTop - walkY,
        behavior: 'auto',
      });
    };

    // Mouse up/leave - stop dragging
    const handleMouseUp = () => {
      this.isDragging = false;
      htmlElement.classList.remove('dragging');
      bodyElement.classList.remove('dragging');
    };

    // Store listeners for cleanup
    this.dragListeners = {
      mousedown: handleMouseDown,
      mousemove: handleMouseMove,
      mouseup: handleMouseUp,
      mouseleave: handleMouseUp,
    };

    // Add event listeners
    document.addEventListener('mousedown', this.dragListeners.mousedown);
    document.addEventListener('mousemove', this.dragListeners.mousemove);
    document.addEventListener('mouseup', this.dragListeners.mouseup);
    document.addEventListener('mouseleave', this.dragListeners.mouseleave);
  }

  /**
   * Disable drag-to-scroll functionality
   */
  private disableDragToScroll() {
    if (!this.dragListeners) {
      return; // Not enabled
    }

    // Remove event listeners
    document.removeEventListener('mousedown', this.dragListeners.mousedown);
    document.removeEventListener('mousemove', this.dragListeners.mousemove);
    document.removeEventListener('mouseup', this.dragListeners.mouseup);
    document.removeEventListener('mouseleave', this.dragListeners.mouseleave);

    // Clean up
    this.dragListeners = null;
    this.isDragging = false;

    // Remove dragging class if present
    document.documentElement.classList.remove('dragging');
    document.body.classList.remove('dragging');
  }

  /**
   * Cleanup and restore original console methods
   */
  cleanup() {
    if (!this.isInitialized) {
      return;
    }

    // Restore console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;

    // Restore original fetch
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    // Remove error listeners
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }

    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }

    // Disable drag-to-scroll
    this.disableDragToScroll();

    this.isInitialized = false;
  }
}

// Export singleton instance
export const consoleLogger = new ConsoleLogger();
