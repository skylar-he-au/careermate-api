jest.mock('../../src/models/user-model', () => ({
    findById: jest.fn(),
}));

jest.mock('../../src/utils/s3', () => ({
    validateS3File: jest.fn(),
    copyObject: jest.fn(),
    deleteObject: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const User = require('../../src/models/user-model');
const s3 = require('../../src/utils/s3');
const { updateAvatar } = require('../../src/controllers/user-controller');

const userId = '64f123456789abcdef123456';

describe('avatar controller', () => {
    test('moves the avatar, updates the user, and removes the old avatar', async () => {
        const user = {
            avatar: `avatar/${userId}/old.png`,
            save: jest.fn().mockResolvedValue({}),
        };
        User.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(user) });
        s3.validateS3File.mockResolvedValue({ ContentType: 'image/png', ContentLength: 100 });
        s3.copyObject.mockResolvedValue({});
        s3.deleteObject.mockResolvedValue({});
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const tmpKey = `tmp/${userId}/new.png`;

        await updateAvatar({ user: { id: userId }, body: { fileKey: tmpKey } }, res);

        expect(s3.validateS3File).toHaveBeenCalledWith(tmpKey, {
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
            maxFileSize: 5 * 1024 * 1024,
        });
        expect(s3.copyObject).toHaveBeenCalledWith(tmpKey, `avatar/${userId}/new.png`);
        expect(s3.deleteObject).toHaveBeenNthCalledWith(1, tmpKey);
        expect(s3.deleteObject).toHaveBeenNthCalledWith(2, `avatar/${userId}/old.png`);
        expect(user.avatar).toBe(`avatar/${userId}/new.png`);
        expect(user.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('rejects another user\'s temporary key before calling S3', async () => {
        await expect(updateAvatar({
            user: { id: userId },
            body: { fileKey: 'tmp/aaaaaaaaaaaaaaaaaaaaaaaa/avatar.png' },
        }, {})).rejects.toMatchObject({ status: 403 });

        expect(s3.validateS3File).not.toHaveBeenCalled();
    });
});
