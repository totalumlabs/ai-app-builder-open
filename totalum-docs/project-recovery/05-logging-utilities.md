---
name: logging-utilities
description: "Logging utility files for comprehensive error tracking: backend-logger.ts for server-side logging with timestamps, console-logger.ts for client-side log interception and remote monitoring."
---

# Logging Utilities Recovery

These files provide comprehensive logging for debugging and error tracking.

## src/lib/backend-logger.ts

Server-side logger that patches console globally with timestamps.

### Complete backend-logger.ts Template

```typescript
/**
 * Production Bulletproof Backend Logger
 *
 * Features:
 * - Catches ALL errors (uncaught exceptions, unhandled promises)
 * - Never crashes (bulletproof error handling)
 * - Automatic timestamps with millisecond precision
 * - No code changes needed - patches console globally
 * - Works in ALL environments (production, development, edge)
 *
 * This file auto-initializes when imported via instrumentation.ts
 */

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

/**
 * Get formatted timestamp: YYYY-MM-DD HH:MM:SS.mmm
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format log arguments with timestamp prefix
 */
function formatLog(level: string, args: unknown[]): unknown[] {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  // Handle different argument types
  if (args.length === 0) {
    return [prefix];
  }

  const first = args[0];
  if (typeof first === 'string') {
    return [`${prefix} ${first}`, ...args.slice(1)];
  }

  return [prefix, ...args];
}

/**
 * Format error object for logging
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ''}`;
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Initialize the backend logger
 * Patches console methods and sets up global error handlers
 */
function initBackendLogger(): void {
  // Skip if already initialized
  if ((globalThis as Record<string, unknown>).__backendLoggerInitialized) {
    return;
  }
  (globalThis as Record<string, unknown>).__backendLoggerInitialized = true;

  // Patch console.log
  console.log = (...args: unknown[]) => {
    originalConsole.log(...formatLog('log', args));
  };

  // Patch console.error
  console.error = (...args: unknown[]) => {
    originalConsole.error(...formatLog('error', args));
  };

  // Patch console.warn
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...formatLog('warn', args));
  };

  // Patch console.info
  console.info = (...args: unknown[]) => {
    originalConsole.info(...formatLog('info', args));
  };

  // Only set up process handlers in Node.js environment
  if (typeof process !== 'undefined' && process.on) {
    // Catch uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      originalConsole.error(
        ...formatLog('error', [
          `UNCAUGHT EXCEPTION:\n${formatError(error)}`
        ])
      );
      // Don't exit - let the app continue if possible
    });

    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      originalConsole.error(
        ...formatLog('error', [
          `UNHANDLED REJECTION:\n${formatError(reason)}`
        ])
      );
    });

    // Catch process warnings
    process.on('warning', (warning: Error) => {
      originalConsole.warn(
        ...formatLog('warn', [
          `PROCESS WARNING: ${warning.name}: ${warning.message}`
        ])
      );
    });

    // Log initialization
    originalConsole.log(
      ...formatLog('info', ['Backend logger initialized successfully'])
    );
  }
}

// Auto-initialize when module is loaded
initBackendLogger();

export { initBackendLogger, originalConsole };
```

### How It Works

1. **Auto-initialization**: Runs when module is imported
2. **Global patching**: Replaces `console.log`, `console.error`, `console.warn`, `console.info`
3. **Timestamp format**: `[YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] message`
4. **Error capture**: Catches uncaught exceptions and unhandled rejections
5. **Bulletproof**: Never crashes, always logs

### Example Output

```
[2025-01-22 14:30:45.123] [LOG] Server starting...
[2025-01-22 14:30:45.456] [INFO] Connected to database
[2025-01-22 14:30:46.789] [ERROR] UNCAUGHT EXCEPTION:
TypeError: Cannot read property 'x' of undefined
    at /app/src/lib/api.ts:42:15
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
```

### Integration with instrumentation.ts

The logger is loaded via `instrumentation.ts`:

```typescript
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    require('./src/lib/backend-logger');
  }
}
```

---

## src/lib/console-logger.ts

Client-side logger for development tools and remote monitoring.

### Complete console-logger.ts Template

```typescript
/**
 * Client-Side Console Logger
 *
 * Features:
 * - Intercepts all console methods (log, error, warn, info)
 * - Intercepts fetch calls for HTTP monitoring
 * - Sends logs to parent window via postMessage
 * - Handles unhandled errors and promise rejections
 * - Mobile-friendly with drag-to-scroll support
 *
 * Used for development tools integration with Totalum
 */

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'http';

interface LogMessage {
  type: 'console-log';
  level: LogLevel;
  message: string;
  timestamp: string;
}

class ConsoleLogger {
  private initialized = false;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  } | null = null;
  private originalFetch: typeof fetch | null = null;

  /**
   * Initialize the logger - intercepts console and fetch
   */
  init(): void {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    this.initialized = true;

    // Store original methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
    };
    this.originalFetch = window.fetch.bind(window);

    // Intercept console methods
    this.interceptConsole();

    // Intercept fetch for HTTP logging
    this.interceptFetch();

    // Intercept global errors
    this.interceptErrors();
  }

  /**
   * Send log to parent window via postMessage
   */
  private sendLog(level: LogLevel, ...args: unknown[]): void {
    const message = args
      .map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    const logMessage: LogMessage = {
      type: 'console-log',
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    // Send to parent window (for iframe embedding)
    if (window.parent !== window) {
      try {
        window.parent.postMessage(logMessage, '*');
      } catch {
        // Ignore cross-origin errors
      }
    }
  }

  /**
   * Intercept console methods
   */
  private interceptConsole(): void {
    if (!this.originalConsole) return;

    const levels: LogLevel[] = ['log', 'error', 'warn', 'info'];

    for (const level of levels) {
      const original = this.originalConsole[level];
      console[level] = (...args: unknown[]) => {
        // Call original
        original(...args);
        // Send to parent
        this.sendLog(level, ...args);
      };
    }
  }

  /**
   * Intercept fetch for HTTP request logging
   */
  private interceptFetch(): void {
    if (!this.originalFetch) return;

    const originalFetch = this.originalFetch;
    const sendLog = this.sendLog.bind(this);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      const startTime = performance.now();

      try {
        const response = await originalFetch(input, init);
        const duration = Math.round(performance.now() - startTime);

        sendLog('http', `${method} ${url} - ${response.status} (${duration}ms)`);

        return response;
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);
        sendLog('error', `${method} ${url} - FAILED (${duration}ms):`, error);
        throw error;
      }
    };
  }

  /**
   * Intercept global errors and unhandled rejections
   */
  private interceptErrors(): void {
    // Unhandled errors
    window.addEventListener('error', (event) => {
      this.sendLog('error', `Unhandled Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.sendLog('error', 'Unhandled Promise Rejection:', event.reason);
    });
  }

  /**
   * Toggle mobile styles for iframe preview
   */
  toggleMobileStyles(enable: boolean): void {
    if (typeof document === 'undefined') return;

    if (enable) {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y';
      document.documentElement.style.overflow = 'auto';
      this.enableDragToScroll();
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
    }
  }

  /**
   * Enable drag-to-scroll for mobile preview
   */
  private enableDragToScroll(): void {
    let isMouseDown = false;
    let startY = 0;
    let scrollTop = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      startY = e.pageY;
      scrollTop = window.scrollY;
      document.body.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
      isMouseDown = false;
      document.body.style.cursor = '';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      e.preventDefault();
      const deltaY = e.pageY - startY;
      window.scrollTo(0, scrollTop - deltaY);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
  }

  /**
   * Cleanup - restore original console and fetch
   */
  cleanup(): void {
    if (!this.initialized || !this.originalConsole || !this.originalFetch) {
      return;
    }

    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    window.fetch = this.originalFetch;

    this.initialized = false;
  }
}

export const consoleLogger = new ConsoleLogger();
```

### Usage in DevToolsHandler Component

```typescript
"use client";

import { useEffect } from 'react';
import { consoleLogger } from '@/lib/console-logger';

export function DevToolsHandler() {
  useEffect(() => {
    // Initialize logger on mount
    consoleLogger.init();

    // Listen for commands from parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'enable-mobile-preview') {
        consoleLogger.toggleMobileStyles(true);
      }
      if (event.data?.type === 'disable-mobile-preview') {
        consoleLogger.toggleMobileStyles(false);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      consoleLogger.cleanup();
    };
  }, []);

  return null;
}
```

### Features

| Feature | Description |
|---------|-------------|
| Console interception | Captures all console.log/error/warn/info calls |
| HTTP monitoring | Logs all fetch requests with timing |
| Error capture | Catches unhandled errors and promise rejections |
| Parent communication | Sends logs to parent window via postMessage |
| Mobile preview | Drag-to-scroll and touch support |

---

## Integration Summary

### Server-Side (backend-logger.ts)

1. Loaded via `instrumentation.ts` before app starts
2. Patches console globally with timestamps
3. Captures uncaught exceptions
4. Works in Node.js only (not Cloudflare Workers)

### Client-Side (console-logger.ts)

1. Initialized by `DevToolsHandler` component
2. Intercepts console and fetch
3. Sends logs to parent window (for Totalum iframe)
4. Provides mobile preview support

---

## Recovery Checklist

- [ ] src/lib/backend-logger.ts exists
- [ ] instrumentation.ts loads backend-logger in Node.js runtime
- [ ] src/lib/console-logger.ts exists
- [ ] DevToolsHandler component initializes consoleLogger
- [ ] DevToolsHandler is included in root layout.tsx
- [ ] Logs appear with timestamps in server console
- [ ] Logs are visible in Totalum development tools (if embedded)
