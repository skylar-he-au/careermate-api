const {logger} = require("../../utils/logger");

const errorHundler = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Something unexpected happened';

    if (status >= 500) {
        logger.error(message, { req, err });
    } else {
        logger.info(message, { req, err });
    }
    res.status(status).json({
        success: false,
        error: {
            message,
        }
    })
};

module.exports = errorHundler;