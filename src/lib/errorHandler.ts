/**
 * Error handling utility to sanitize error messages for users
 * Prevents leaking sensitive information like database schema, SQL queries, etc.
 */

// Map PostgreSQL error codes to user-friendly messages
const ERROR_CODE_MAP: Record<string, string> = {
  '23505': 'This record already exists',
  '23503': 'Cannot complete - related records exist',
  '23502': 'Required information is missing',
  '42501': 'You do not have permission to perform this action',
  '42P01': 'Resource not found',
  'PGRST116': 'Record not found',
  'PGRST301': 'Request failed - please try again',
  '22P02': 'Invalid data format',
  '28000': 'Authentication failed',
  '28P01': 'Invalid credentials',
  '42703': 'Invalid request',
  '23514': 'Data validation failed',
};

// Patterns to detect and sanitize
const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /duplicate key/i, message: 'This record already exists' },
  { pattern: /foreign key/i, message: 'Cannot complete - related data exists' },
  { pattern: /violates row-level security/i, message: 'Access denied' },
  { pattern: /permission denied/i, message: 'You do not have permission' },
  { pattern: /not found/i, message: 'Record not found' },
  { pattern: /network/i, message: 'Network error - please check your connection' },
  { pattern: /timeout/i, message: 'Request timed out - please try again' },
  { pattern: /unauthorized/i, message: 'Please sign in to continue' },
  { pattern: /jwt expired/i, message: 'Session expired - please sign in again' },
  { pattern: /invalid token/i, message: 'Session invalid - please sign in again' },
  { pattern: /too many requests/i, message: 'Too many requests - please wait a moment' },
  { pattern: /constraint/i, message: 'Data validation failed' },
];

/**
 * Sanitizes an error for safe display to users
 * Logs full error in development mode only
 */
export function sanitizeError(error: unknown): string {
  // Log full error in development only
  if (import.meta.env.DEV) {
    console.error('[DEV Error]:', error);
  }

  if (!error) {
    return 'An unexpected error occurred';
  }

  // Handle string errors
  if (typeof error === 'string') {
    return sanitizeMessage(error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    const anyError = error as any;
    
    // Check for PostgreSQL error codes
    if (anyError.code && ERROR_CODE_MAP[anyError.code]) {
      return ERROR_CODE_MAP[anyError.code];
    }

    return sanitizeMessage(anyError.message || 'An error occurred');
  }

  // Handle Supabase error objects
  if (typeof error === 'object') {
    const anyError = error as any;
    
    // Check for PostgreSQL error codes
    if (anyError.code && ERROR_CODE_MAP[anyError.code]) {
      return ERROR_CODE_MAP[anyError.code];
    }

    // Check for message property
    if (anyError.message) {
      return sanitizeMessage(anyError.message);
    }

    // Check for error property
    if (anyError.error) {
      return sanitizeMessage(anyError.error);
    }
  }

  return 'An error occurred. Please try again.';
}

/**
 * Sanitizes a message string by matching against known patterns
 */
function sanitizeMessage(message: string): string {
  // Check against known patterns
  for (const { pattern, message: safeMessage } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return safeMessage;
    }
  }

  // If message looks like it contains sensitive info, return generic message
  const sensitivePatterns = [
    /sql/i,
    /query/i,
    /table/i,
    /column/i,
    /schema/i,
    /postgres/i,
    /supabase/i,
    /function/i,
    /trigger/i,
    /policy/i,
    /uuid/i,
    /path/i,
    /file/i,
    /stack/i,
    /line \d+/i,
    /at \w+\./i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return 'An error occurred. Please try again.';
    }
  }

  // If message is short and doesn't contain sensitive info, it might be safe
  if (message.length < 100 && !message.includes('\\n')) {
    return message;
  }

  return 'An error occurred. Please try again.';
}

/**
 * Creates a safe error handler for catch blocks
 * Usage: catch (error) { handleError(error, toast, 'Custom context message'); }
 */
export function handleError(
  error: unknown,
  toastFn: (opts: { variant?: string; title: string; description?: string }) => void,
  context?: string
): void {
  const safeMessage = sanitizeError(error);
  
  toastFn({
    variant: 'destructive',
    title: context || 'Error',
    description: safeMessage,
  });
}
