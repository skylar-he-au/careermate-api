const { Router } = require('express');
const authRouter = require('./auth.routes');
const { publicPath, privatePath, adminPath } = require('../controllers/test.controller');
const authGuardMiddleware = require('../middleware/authGuard-middleware');
const roleGuardMiddleware = require('../middleware/roleGuard-middleware');
const userRouter = require('./user.routes');
const uploadRouter = require('./upload.routes');
const resumeRouter = require('./resume.routes');

const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/users', authGuardMiddleware, userRouter);
v1Router.use('/upload', authGuardMiddleware, uploadRouter);
v1Router.use('/resumes', authGuardMiddleware, resumeRouter)

v1Router.get('/public', publicPath);
v1Router.get('/private', authGuardMiddleware, privatePath);
v1Router.get('/admin', authGuardMiddleware, roleGuardMiddleware('admin'), adminPath);

module.exports = v1Router;
