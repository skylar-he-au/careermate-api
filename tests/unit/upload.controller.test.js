jest.mock('../../src/utils/s3', () => ({
    generatePresignedUploadUrl: jest.fn(),
    UPLOAD_URL_EXPIRES_IN: 300,
}));

const { generatePresignedUploadUrl } = require('../../src/utils/s3');
const { getPresignedUploadUrl } = require('../../src/controllers/upload.controller');

const createResponse = () => ({
    json: jest.fn(),
});

describe('upload controller', () => {
    test('returns a temporary key and presigned URL', async () => {
        generatePresignedUploadUrl.mockResolvedValue('https://upload.example');
        const req = {
            user: { id: '64f123456789abcdef123456' },
            body: {
                fileName: 'resume.pdf',
                contentType: 'application/pdf',
                category: 'resume',
                fileSize: 1024,
            },
        };
        const res = createResponse();

        await getPresignedUploadUrl(req, res);

        const [fileKey, contentType, fileSize] = generatePresignedUploadUrl.mock.calls[0];
        expect(fileKey).toMatch(/^tmp\/64f123456789abcdef123456\/[0-9a-f-]+\.pdf$/);
        expect(contentType).toBe('application/pdf');
        expect(fileSize).toBe(1024);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { uploadUrl: 'https://upload.example', fileKey, expiresIn: 300 },
        });
    });

    test('rejects a type that is not allowed for the category', async () => {
        const req = {
            user: { id: 'user' },
            body: { contentType: 'image/png', category: 'resume', fileSize: 100 },
        };

        await expect(getPresignedUploadUrl(req, createResponse()))
            .rejects.toMatchObject({ status: 400, message: 'File type is not allowed' });
    });

    test('rejects a file over the category limit', async () => {
        const req = {
            user: { id: 'user' },
            body: { contentType: 'application/pdf', category: 'resume', fileSize: 11 * 1024 * 1024 },
        };

        await expect(getPresignedUploadUrl(req, createResponse()))
            .rejects.toMatchObject({ status: 400, message: 'File exceeds limit' });
    });
});
