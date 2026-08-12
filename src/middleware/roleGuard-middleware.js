const ForbiddenException = require("../exceptions/forbidden.exception");

module.exports = (...allowedAccoutTypes) => (req, res, next) => {
    if (!allowedAccoutTypes.includes(req.user.accountType)) {
        throw new ForbiddenException('Insufficient permissions')
    }
    next();
};