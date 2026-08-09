const ConflictException = require("../../exceptions/conflict.exception");
const UnauthorizedException = require("../../exceptions/unauthorized.exception");
const User = require("../models/user-model");
const { generateToken } = require("../utils/jwt");
const { comparePassword, hashPassword } = require("../utils/password");

const register = async (req, res, next) => {
    const { fullName, email, password } = req.body;
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
        throw new ConflictException('Email already exists!');
    }
    const hashedPassword = await hashPassword(password);
    const user = await User.create({ fullName, email, password: hashedPassword });

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

    const token = generateToken({ id: user.id })

    res.status(201).json({
        success: true,
        data: {
            user,
            token,
        }
    });
};

module.exports = {
    register,
    login,
};