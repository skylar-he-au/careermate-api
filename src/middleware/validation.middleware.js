const { model } = require("mongoose");
const ValidationException = require("../../exceptions/validation.exception");

const validateBody = (schema) => async (req, res, next) => {
    const result = await schema.safeParseAsync(req.body);
    if (!result.success) {
        const message = result.error.issues.map((i) => (i.message)).join(', ');
        throw new ValidationException(message);
    }
    req.body = result.data;
    next();
}

module.exports = { validateBody };