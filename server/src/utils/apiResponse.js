/**
 * Centralized API response helper for Utsanova Blog Management System
 * Conforms to fixed response schema:
 * Success: { success: true, data: ... }
 * Error:   { success: false, message: ... }
 */

export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

export const sendError = (res, message = 'Internal server error', statusCode = 500, extra = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra,
  });
};
