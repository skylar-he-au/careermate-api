const ConflictException = require("../../exceptions/conflict.exception");
const UnauthorizedException = require("../../exceptions/forbidden.exception");
const User = require("../models/user-model");
const { generateToken } = require("../utils/jwt");

const register = async (req, res, next) => {
    const { fullName, email, password } = req.body;
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
        throw new ConflictException('Email already exists!');
    }
    const user = await User.create({ fullName, email, password });

    await user.hashPassword();
    const token = generateToken({ id: user.id, fullName: user.fullName })

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
    const validPassword = await user.validatePassword(password);
    if (!validPassword) {
        throw new UnauthorizedException('Invalid email ro password')
    }

    const token = generateToken({ id: user.id, fullName: user.fullName, role: 'admin' })

    res.status(201).json({
        success: true,
        data: {
            user,
        }
    });
};

module.exports = {
    register,
    login,
};