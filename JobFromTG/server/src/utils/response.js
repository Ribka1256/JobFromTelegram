/**
 * src/utils/response.js
 * Standardized HTTP response helpers.
 * Every API response follows the same envelope shape.
 */

/**
 * Success response envelope.
 * { success: true, data: ..., meta: ... }
 */
export function sendSuccess(res, data, meta = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

/**
 * Paginated list response.
 * Includes pagination metadata in the envelope.
 */
export function sendPaginated(res, data, { page, limit, total }) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
}

/**
 * Error response envelope.
 * { success: false, error: { code, message } }
 */
export function sendError(res, statusCode, message, code = "ERROR") {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

/**
 * 404 Not Found helper.
 */
export function sendNotFound(res, resource = "Resource") {
  return sendError(res, 404, `${resource} not found.`, "NOT_FOUND");
}

/**
 * 400 Bad Request helper.
 */
export function sendBadRequest(res, message) {
  return sendError(res, 400, message, "BAD_REQUEST");
}
