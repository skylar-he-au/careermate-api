const UnauthorizedException = require("../exceptions/unauthorized.exception");
const { validateToken } = require("../utils/jwt");

module.exports = (req, res, next) => {
    const authorization = req.header('Authorization');
    if (!authorization) {
        throw new UnauthorizedException('Authentication required');
    };
    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
        throw new UnauthorizedException('Authentication required');
    }

    try {
        const user = validateToken(token);
        req.user = user;
        next()
    } catch (e) {
        throw new UnauthorizedException('Invalid or expired token', { error: e });
    }

};