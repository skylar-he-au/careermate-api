const UserModel = require("../models/user-model");
const { generateToken } = require("../utils/jwt");

const register = async (req, res, next) => {
    const { username, password } = req.body;
    // input validation
    // conflicts
    const user = new UserModel({ username, password });
    await user.hashPassword();
    await user.save();

    const token = generateToken({id:user.id, username:user.username})
    res.status(201).json(token);
};
const login = async (req, res, next) => {
    const { username, password } = req.body;

    const user = await UserModel.findOne({ username }).exec();
    if (!user) {
        return res.status(401).json({ error: 'invalid credentials' });
    }
    const validPassword = await user.validatePassword(password);
    if (!validPassword) {
        return res.status(401).json({ error: 'invalid credentials' })
    }

    const token = generateToken({id:user.id, username:user.username, role:'admin'})

    res.json({token});
};

module.exports = {
    register,
    login,
};