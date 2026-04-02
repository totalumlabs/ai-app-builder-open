/**
 * Production Bulletproof Backend Logger
 *
 * Super simple, reliable logging with timestamps
 * Features:
 * - Catches ALL errors (uncaught exceptions, unhandled promises)
 * - Never crashes (bulletproof error handling)
 * - Automatic timestamps with millisecond precision
 * - No code changes needed - patches console globally
 * - Works in ALL environments (production, development, edge)
 */

let isInitialized = false;

/**
 * Get formatted timestamp
 */
function getTimestamp(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${date} ${time}.${ms}`;
}

/**
 * Format log message
 */
function formatLog(level: string, args: any[]): string {
  const timestamp = getTimestamp();
  const message = args
    .map((arg) => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');

  return `[${timestamp}] [${level}] ${message}`;
}

// Simple logger object for compatibility
const simpleLogger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  debug: (...args: any[]) => console.log(...args),
  child: (_context?: Record<string, any>) => simpleLogger,
};

/**
 * Initialize the backend logger
 * This patches console globally and sets up error handlers
 */
export function initBackendLogger() {
  // Only initialize once
  if (isInitialized || typeof console === 'undefined') {
    return;
  }

  try {
    // Store original console methods
    const originalLog = console.log.bind(console);
    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);
    const originalInfo = console.info.bind(console);

    /**
     * Patch console.log with timestamps
     */
    console.log = (...args: any[]) => {
      try {
        originalLog(formatLog('INFO', args));
      } catch (e) {
        originalLog(...args);
      }
    };

    /**
     * Patch console.error with timestamps
     */
    console.error = (...args: any[]) => {
      try {
        originalError(formatLog('ERROR', args));
      } catch (e) {
        originalError(...args);
      }
    };

    /**
     * Patch console.warn with timestamps
     */
    console.warn = (...args: any[]) => {
      try {
        originalWarn(formatLog('WARN', args));
      } catch (e) {
        originalWarn(...args);
      }
    };

    /**
     * Patch console.info with timestamps
     */
    console.info = (...args: any[]) => {
      try {
        originalInfo(formatLog('INFO', args));
      } catch (e) {
        originalInfo(...args);
      }
    };

    // Capture ALL unhandled errors
    if (typeof process !== 'undefined') {
      // Uncaught exceptions
      process.on('uncaughtException', (error: Error, origin: string) => {
        try {
          console.error('🔥 UNCAUGHT EXCEPTION:', error.message, '\nOrigin:', origin, '\nStack:', error.stack);
        } catch (e) {
          originalError('UNCAUGHT EXCEPTION:', error);
        }

      });

      // Unhandled promise rejections
      process.on('unhandledRejection', (reason: any) => {
        try {
          console.error('🔥 UNHANDLED PROMISE REJECTION:', reason);
        } catch (e) {
          originalError('UNHANDLED PROMISE REJECTION:', reason);
        }
      });

      // Process warnings (memory leaks, deprecations, etc.)
      process.on('warning', (warning: Error) => {
        try {
          console.warn('⚠️ PROCESS WARNING:', warning.message);
        } catch (e) {
          originalWarn('PROCESS WARNING:', warning);
        }
      });
    }

    isInitialized = true;
    console.log('Logger initialized');
  } catch (error) {
    // If initialization fails, log with original console
    console.error('Failed to initialize backend logger:', error);
  }
}

// Export logger for compatibility
export const logger = simpleLogger;

// Export helper for child loggers
export function createLogger(context?: Record<string, any>) {
  return simpleLogger.child(context);
}

// Auto-initialize logger when module loads (server-side only)
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    initBackendLogger();
  } catch (error) {
    console.error('Failed to auto-initialize logger:', error);
  }
}
