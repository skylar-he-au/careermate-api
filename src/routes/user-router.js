const express = require('express');
const { deleteUser, restoreUser, getMe, updateMe, updateMyPassword, updateAvatar } = require('../controllers/user-controller');
const roleGuardMiddleware = require('../middleware/roleGuard-Middleware');
const { validateBody } = require('../middleware/validation.middleware');
const { updateMeSchema, updateMyPasswordSchema, updateAvatarSchema } = require('../validation/user.validation');

const userRouter = express.Router();

userRouter.get('/me', getMe);
userRouter.put('/me', validateBody(updateMeSchema), updateMe)
userRouter.put('/me/password', validateBody(updateMyPasswordSchema), updateMyPassword)
userRouter.post('/me/avatar',validateBody(updateAvatarSchema),updateAvatar);

userRouter.delete('/:id', roleGuardMiddleware('admin'), deleteUser)
userRouter.post('/:id/restore', roleGuardMiddleware('admin'), restoreUser)

module.exports = userRouter;