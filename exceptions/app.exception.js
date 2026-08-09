class AppException extends Error {
    constructor(statusCode = 500, message = 'Internal server error', context = {}) {
        super(message);
        this.name = this.constructor.name;
        this.status = statusCode;
        this.context = context;
    }
};
 
module.exports = AppException;