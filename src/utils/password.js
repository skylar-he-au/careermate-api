const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 12;

const hashPassword = async (password) =>{
    return bcrypt.hash(password, SALT_ROUNDS);
}

const comparePassword = async (password, hashPassword) =>{
    return bcrypt.compare(password, hashPassword);
};

module.exports = {
    hashPassword,
    comparePassword,
}