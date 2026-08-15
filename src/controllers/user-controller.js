const User = require('../models/user-model')
const NotFoundException = require('../exceptions/NotFound.exception');
const BadRequestException = require('../exceptions/badRequest.exception');
const { logger } = require('../utils/logger');
const { success } = require('zod');
const { MAX_PASSWORD_HISTORY } = require('../utils/constant');
const ForbiddenException = require('../exceptions/forbidden.exception');
const { comparePassword, hashPassword } = require('../utils/password');
const { deleteObject } = require('../utils/s3');

const getMe = async (req, res) => {
    const userId = req.user.id;
    const user = await User.findById(userId).exec();
    if (!user) {
        throw new NotFoundException('User not found')
    }
    res.json({
        success: true,
        data: user,
    });
};

const updateMe = async (req, res) => {
    const userId = req.user.id;
    const user = await User.findByIdAndUpdate(userId, req.body, {
        new: true,
        runValidators: true,
    });
    if (!user) {
        throw new NotFoundException('User not found')
    }
    res.json({
        success: true,
        data: user,
    })
}

const updateMyPassword = async (req, res) => {
    const { newPassword, currentPassword } = req.body;
    const userId = req.user.id;
    const user = await User.findById(userId).exec();
    if (!user) {
        throw new NotFoundException('User not found')
    }
    const isMAtched = await comparePassword(currentPassword, user.password);
    if (!isMAtched) {
        throw new UnauthorizedException('Invalid email ro password')
    }
    for (const oldHash of user.passwordHistory) {
        const isSame = await comparePassword(newPassword, oldHash);
        if (isSame) {
            throw new BadRequestException(
                'New password must not be the same as the recent password'
            );
        }
    }
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;

    let passwordHistory = [...user.passwordHistory, hashedPassword];
    if (passwordHistory.length > MAX_PASSWORD_HISTORY) {
        passwordHistory = passwordHistory.slice(-MAX_PASSWORD_HISTORY);
    }
    user.passwordHistory = passwordHistory;
    await user.save();

    logger.info('Password updated successful', { userId: user._id });
    res.json({
        success: true,
        message: 'Password update',
    })
}

const updateAvatar = async (req,res)=>{
    const {fileKey: tmpKey} = req.body;
    const userId = req.user.id;
    if (!tmpKey.startsWith(`tmp/${userId}/`)) {
        throw new ForbiddenException("File key doesn't belong to the current user");
    }

    const head = await validateS3File(tmpKey, {
        allowedTypes: ALLOWED_TYPES.resume,
        maxFileSize: MAX_FILE_SIZE.resume,
    });

    // filename from the filekey
    const filename = tmpKey.slice(`tmp/${userId}/`.length);
    const fileKey = `avatar/${userId}/${filename}`;

    await copyObject(tmpKey, fileKey);
    await deleteObject(tmpKey);

    const user = await User.findById(userId).exec();
    if(!user){
        throw new NotFoundException('User not found');
    }
    const oldAvatarKey = user.avatar;
    user.avatar = fileKey;
    await user.save();

    if(oldAvatarKey && oldAvatarKey !== fileKey){
        deleteObject(oldAvatarKey).catch((err) =>{
            logger.warn('Failed to delete old avatar',{oldAvatarKey, err})
        });
    }

    res.status(201).json({
        success: true,
        data: {
            avatar:fileKey,
        }
    });
}

const deleteUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        throw new NotFoundException('user not found');
    }
    if (user.deletedAt) {
        throw new BadRequestException('User is already deleted')
    }
    user.deletedAt = new Date();
    await user.save();

    logger.info('User soft deleted', { userId: user.id, operator: req.user.id })
    res.json({
        success: true,
        message: 'User has been soft deleted',
    });
};

const restoreUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        throw new NotFoundException('user not found');
    }
    if (!user.deletedAt) {
        throw new BadRequestException('User is not deleted')
    }
    user.deletedAt = undefined
    await user.save();

    logger.info('User restored', { userId: user.id, operator: req.user.id })
    res.json({
        success: true,
        message: 'User has been restored',
    });
}

module.exports = {
    deleteUser,
    restoreUser,
    updateMe,
    getMe,
    updateMyPassword,
    updateAvatar,
}