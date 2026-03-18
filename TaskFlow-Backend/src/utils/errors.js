class AppError extends Error {
  /**
   * @param {object} opts
   * @param {number} opts.status
   * @param {string} opts.message
   * @param {string} [opts.code]
   * @param {unknown} [opts.details]
   * @param {boolean} [opts.expose] Whether message/details are safe to send to client
   */
  constructor({ status, message, code, details, expose }) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose ?? status < 500;
  }
}

function httpError(status, message, opts = {}) {
  return new AppError({ status, message, ...opts });
}

module.exports = {
  AppError,
  httpError,
};

