/**
 * Creates an Error carrying an HTTP status. `expose: true` lets errorHandler show the message to
 * the client (it hides the message of 5xx errors in production unless it is exposed).
 */
export const httpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.expose = true;
  if (code) err.code = code;
  return err;
};

const MIGRATION_HINT =
  'A required database migration has not been applied yet (004 permissions/scheduling, 005 multi-owner). ' +
  'Run database/migrations/004_*.sql and 005_*.sql in order (see docs/user-management-and-scheduling.md).';

/** Turns "table/column does not exist" MySQL errors into a clear 503 with the migration hint. */
export const withMigrationHint = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_WARN_DATA_OUT_OF_RANGE' || err.code === 'WARN_DATA_TRUNCATED')) {
      throw httpError(503, MIGRATION_HINT, 'MIGRATION_REQUIRED');
    }
    throw err;
  }
};
