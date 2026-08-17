process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';

const User = require('../../src/models/user-model');
const Resume = require('../../src/models/resume.model');

describe('Mongoose models', () => {
    test('user requires email, full name, and password', async () => {
        const error = await new User({}).validate().catch((validationError) => validationError);

        expect(error.errors.email).toBeDefined();
        expect(error.errors.fullName).toBeDefined();
        expect(error.errors.password).toBeDefined();
    });

    test('user JSON removes private fields', () => {
        const user = new User({
            email: 'student@example.com',
            fullName: 'Student',
            password: 'secret-hash',
            passwordHistory: ['old-hash'],
            accountType: 'admin',
        });

        const json = user.toJSON();

        expect(json.password).toBeUndefined();
        expect(json.passwordHistory).toBeUndefined();
        expect(json.accountType).toBeUndefined();
    });

    test('user exposes a CloudFront avatar URL when an avatar exists', () => {
        const user = new User({
            email: 'student@example.com',
            fullName: 'Student',
            password: 'hash',
            avatar: 'avatar/user/photo.png',
        });

        expect(user.avatarUrl).toBe('https://cdn.example.com/avatar/user/photo.png');
    });

    test('resume requires ownership and file metadata', async () => {
        const error = await new Resume({}).validate().catch((validationError) => validationError);

        expect(error.errors.user).toBeDefined();
        expect(error.errors.fileKey).toBeDefined();
        expect(error.errors.fileName).toBeDefined();
        expect(error.errors.fileSize).toBeDefined();
    });
});
