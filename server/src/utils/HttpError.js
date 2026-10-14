// An error with an HTTP status. Thrown by services/controllers and turned
// into { error: message } JSON by the error handler in app.js.
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

module.exports = HttpError;
