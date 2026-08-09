const { logger } = require("../../utils/logger");

const errorHundler = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Something unexpected happened';

    const meta = {
        req: {
            method: req.method,
            url: req.originalUrl,
        },
    };

    if (status >= 500) {
        logger.error(message, {...meta, error: { name: err.name, stack: err.stack }});
    } else {
        logger.info(message, meta);
    }
    res.status(status).json({
        success: false,
        error: {
            message,
        }
    })
};

module.exports = errorHundler;