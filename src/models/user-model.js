const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { string } = require('zod');

const schema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    displayName: {
        type: String,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['Student', 'Other']
    },
    field: {
        type: String,
        enum: ["FE", 'BE']
    },
    goal: {
        type: String,
        trim: true,
    },
    avatar: {
        type: String,
    },
    accountType: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    resetCode: {
        type: String,
    },
    resetCodeExpiry: {
        type: Date,
    },
    resetToken: {
        type: String,
    },
    resetTokenExpiry: {
        type: Date,
    },
    passwordHistory: {
        type: [String],
        default: [],
    },
    deletedAt: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(_, user) {
            delete user.password;
            delete user.__v;
            delete user.passwordHistory;
            delete user.accountType;
        }
    }
});

// schema.methods.hashPassword = async function () {
//     this.password = await bcrypt.hash(this.password, 12);
// };

// schema.methods.validatePassword = async function (password) {
//     return bcrypt.compare(password, this.password);
// };

const User = model("User", schema);

module.exports = User;