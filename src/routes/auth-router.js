const { Router } = require('express');
const { register, login, forgotPassword, verifyCode, resetPassword } = require('../controllers/auth-controller');
const { validateBody } = require('../middleware/validation.middleware');
const { registerSchema, loginSchema, forgotPasswordSchema, verifyCodeSchema, resetPasswordSchema } = require('../validation/auth.validation');
const authGuardMiddleware = require('../middleware/authGuard-middleware');

const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.post('/forgot-password',validateBody(forgotPasswordSchema), forgotPassword)
authRouter.post('/verify-code',validateBody(verifyCodeSchema), verifyCode);
authRouter.post('/reset-password',validateBody(resetPasswordSchema),resetPassword);

module.exports = authRouter;