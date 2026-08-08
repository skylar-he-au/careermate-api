const { Router } = require('express');
const { register, login } = require('../controllers/auth-controller');
const { validateBody } = require('../middleware/validation.middleware');
const { registerSchema, loginSchema } = require('../validation/auth.validation');

const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);

module.exports = authRouter