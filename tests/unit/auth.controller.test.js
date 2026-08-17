jest.mock('../../src/models/user-model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../../src/utils/password', () => ({
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
    generateToken: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const User = require('../../src/models/user-model');
const password = require('../../src/utils/password');
const { generateToken } = require('../../src/utils/jwt');
const {
    register,
    login,
    forgotPassword,
    verifyCode,
    resetPassword,
} = require('../../src/controllers/auth-controller');

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const findOneResult = (value) => {
    User.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(value) });
};

describe('auth controller', () => {
    test('register hashes the password and creates a user', async () => {
        findOneResult(null);
        password.hashPassword.mockResolvedValue('hashed');
        User.create.mockResolvedValue({ id: 'user-id' });
        const res = createResponse();

        await register({ body: { fullName: 'Student', email: 'student@example.com', password: 'password1' } }, res);

        expect(User.create).toHaveBeenCalledWith({
            fullName: 'Student',
            email: 'student@example.com',
            password: 'hashed',
            passwordHistory: ['hashed'],
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('register rejects an existing email', async () => {
        findOneResult({ id: 'existing' });

        await expect(register({
            body: { fullName: 'Student', email: 'student@example.com', password: 'password1' },
        }, createResponse())).rejects.toMatchObject({ status: 409 });
    });

    test('login returns a token for valid credentials', async () => {
        const user = { id: 'user-id', password: 'hash', accountType: 'user' };
        findOneResult(user);
        password.comparePassword.mockResolvedValue(true);
        generateToken.mockReturnValue('jwt-token');
        const res = createResponse();

        await login({ body: { email: 'student@example.com', password: 'password1' } }, res);

        expect(generateToken).toHaveBeenCalledWith({ id: 'user-id', accountType: 'user' });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { user, token: 'jwt-token' },
        });
    });

    test.each([
        ['missing user', null, true, 'Email and Password mismatch'],
        ['wrong password', { password: 'hash' }, false, 'Invalid email ro password'],
        ['deleted account', { password: 'hash', deletedAt: new Date() }, true, 'Account has been deleted'],
    ])('login rejects %s', async (_, user, passwordMatches, message) => {
        findOneResult(user);
        password.comparePassword.mockResolvedValue(passwordMatches);

        await expect(login({
            body: { email: 'student@example.com', password: 'password1' },
        }, createResponse())).rejects.toMatchObject({ status: 401, message });
    });

    test('forgot password returns the same response for an unknown email', async () => {
        findOneResult(null);
        const res = createResponse();

        await forgotPassword({ body: { email: 'missing@example.com' } }, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'If the email exists, a verification code will be sent',
        });
    });

    test('forgot password stores a temporary code for an existing user', async () => {
        const user = { save: jest.fn().mockResolvedValue({}) };
        findOneResult(user);
        const res = createResponse();

        await forgotPassword({ body: { email: 'student@example.com' } }, res);

        expect(user.resetCode).toMatch(/^\d{6}$/);
        expect(user.resetCodeExpiry).toBeInstanceOf(Date);
        expect(user.save).toHaveBeenCalled();
    });

    test('verify code creates a reset token and clears the code', async () => {
        const user = {
            resetCode: '123456',
            resetCodeExpiry: new Date(Date.now() + 60_000),
            save: jest.fn().mockResolvedValue({}),
        };
        findOneResult(user);
        const res = createResponse();

        await verifyCode({ body: { email: 'student@example.com', resetCode: '123456' } }, res);

        expect(user.resetCode).toBeUndefined();
        expect(user.resetToken).toMatch(/^[0-9a-f]{64}$/);
        expect(user.save).toHaveBeenCalled();
    });

    test('verify code rejects an expired code', async () => {
        findOneResult({ resetCode: '123456', resetCodeExpiry: new Date(Date.now() - 1) });

        await expect(verifyCode({
            body: { email: 'student@example.com', resetCode: '123456' },
        }, createResponse())).rejects.toMatchObject({ status: 400, message: 'Invalid or expired code' });
    });

    test('reset password replaces the password and clears the token', async () => {
        const user = {
            resetToken: 'valid-token',
            resetTokenExpiry: new Date(Date.now() + 60_000),
            passwordHistory: ['old-hash'],
            save: jest.fn().mockResolvedValue({}),
        };
        findOneResult(user);
        password.comparePassword.mockResolvedValue(false);
        password.hashPassword.mockResolvedValue('new-hash');
        const res = createResponse();

        await resetPassword({
            body: { email: 'student@example.com', resetToken: 'valid-token', newPassword: 'newpass1' },
        }, res);

        expect(user.password).toBe('new-hash');
        expect(user.passwordHistory).toEqual(['old-hash', 'new-hash']);
        expect(user.resetToken).toBeUndefined();
        expect(user.save).toHaveBeenCalled();
    });

    test('reset password rejects a recently used password', async () => {
        findOneResult({
            resetToken: 'valid-token',
            resetTokenExpiry: new Date(Date.now() + 60_000),
            passwordHistory: ['old-hash'],
        });
        password.comparePassword.mockResolvedValue(true);

        await expect(resetPassword({
            body: { email: 'student@example.com', resetToken: 'valid-token', newPassword: 'password1' },
        }, createResponse())).rejects.toMatchObject({ status: 400 });
    });
});
