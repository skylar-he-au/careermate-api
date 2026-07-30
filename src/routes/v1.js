const { Router } = require('express');
const authRouter = require('./auth-router');
const { public, private, adminPath } = require('../controllers/test-contrller');
const authGuardMiddleware = require('../middleware/authGuard-middleware');
const roleGuardMiddleware = require('../middleware/roleGuard-Middleware')

const v1Router = Router();

v1Router.use('/auth', authRouter);

v1Router.get('/public', public);
v1Router.get('/private', authGuardMiddleware, private);
v1Router.get('/admin', authGuardMiddleware, roleGuardMiddleware('admin'), adminPath);

module.exports = v1Router;