const express = require('express');
const { deleteUser, restoreUser, getMe } = require('../controllers/user-controller');
const roleGuardMiddleware = require('../middleware/roleGuard-Middleware');

const userRouter = express.Router();

userRouter.get('/me', getMe)

userRouter.delete('/:id', roleGuardMiddleware('admin'), deleteUser)
userRouter.post('/:id/restore', roleGuardMiddleware('admin'), restoreUser)

module.exports = userRouter;