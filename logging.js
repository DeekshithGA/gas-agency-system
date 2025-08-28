// logging.js

// Basic log levels
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

// Generic log method
export function log(level, message, meta = {}) {
  const time = new Date().toISOString();
  const logMsg = `[${time}] [${level}] ${message}`;
  if (level === LOG_LEVELS.ERROR) {
    console.error(logMsg, meta);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(logMsg, meta);
  } else {
    console.log(logMsg, meta);
  }
  // Optionally send logs to external storage or Firebase analytics here
}

// Info log
export function info(message, meta) {
  log(LOG_LEVELS.INFO, message, meta);
}

// Warning log
export function warn(message, meta) {
  log(LOG_LEVELS.WARN, message, meta);
}

// Error log, accepts error object
export function error(message, err) {
  log(LOG_LEVELS.ERROR, message, { error: err.message || err.toString(), stack: err.stack });
}
