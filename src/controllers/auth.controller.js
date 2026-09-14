const crypto = require('crypto');
const ConflictException = require("../exceptions/conflict.exception");
const UnauthorizedException = require("../exceptions/unauthorized.exception");
const User = require("../models/user-model");
const { generateToken } = require("../utils/jwt");
const { comparePassword, hashPassword } = require("../utils/password");
const ValidationException = require("../exceptions/validation.exception");
const { success } = require('zod');
const { logger } = require('../utils/logger');
const BadRequestException = require('../exceptions/badRequest.exception');
const { MAX_PASSWORD_HISTORY } = require('../utils/constant');

const RESET_ACTION_EXPIRY_TIME = 10 * 60 * 1000;

const register = async (req, res, next) => {
    const { fullName, email, password } = req.body;
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
        throw new ConflictException('Email already exists!');
    }
    const hashedPassword = await hashPassword(password);
    const user = await User.create({
        fullName,
        email,
        password: hashedPassword,
        passwordHistory: [hashedPassword],
    });

    res.status(201).json({
        success: true,
        data: {
            user,
        }
    });
};

const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).exec();
    if (!user) {
        throw new UnauthorizedException('Email and Password mismatch')
    }
    const isMAtched = await comparePassword(password, user.password);
    if (!isMAtched) {
        throw new UnauthorizedException('Invalid email ro password')
    }
    if(user.deletedAt){
        throw new UnauthorizedException('Account has been deleted')
    }

    const token = generateToken({ id: user.id, accountType: user.accountType })
    // const token = generateToken({ id: user.id })
    res.status(201).json({
        success: true,
        data: {
            user,
            token,
        }
    });
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email }).exec();
    if (!user) {
        logger.info(`user try to reset password with email: ${email}`)
        return res.json({
            success: true,
            message: 'If the email exists, a verification code will be sent'
        });
    }

    const code = Math.random().toString().slice(2, 8);

    // redis
    user.resetCode = code;
    user.resetCodeExpiry = new Date(Date.now() + RESET_ACTION_EXPIRY_TIME);
    await user.save();
    res.json({ success: true, message: 'verification code has been sent' })
}

const verifyCode = async (req, res) => {
    const { email, resetCode } = req.body;

    const user = await User.findOne({ email }).exec();
    if (!user || user.resetCode !== resetCode || user.resetCodeExpiry < new Date()) {
        throw new ValidationException('Invalid or expired code')
    }
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + RESET_ACTION_EXPIRY_TIME);
    await user.save();

    res.json({
        success: true,
        data: {
            resetToken,
        },
    });
}

const resetPassword = async (req, res) => {
    const { email, resetToken, newPassword } = req.body;
    const user = await User.findOne({ email }).exec();
    if (!user || user.resetToken !== resetToken || user.resetTokenExpiry < new Date()) {
        throw new ValidationException('Invalid or expired token')
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
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();
    res.json({
        success: true,
        message: 'Password reset successful',
    })
}

module.exports = {
    register,
    login,
    forgotPassword,
    verifyCode,
    resetPassword,
};