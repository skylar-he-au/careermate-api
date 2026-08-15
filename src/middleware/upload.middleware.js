const {rateLimit} = require('express-rate-limit');
const config = require('../utils/config');

const uploadRateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: 10,
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    skip : () => config.NODE_ENV !== 'production',
})

module.exports = uploadRateLimiter;