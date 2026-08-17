const {
    presignedUploadSchema,
    TMP_KEY_PATTERN,
    ALLOWED_TYPES,
    MAX_FILE_SIZE,
} = require('../../src/validation/upload.validation');
const { createResumeSchema } = require('../../src/validation/resume.validation');
const { updateAvatarSchema } = require('../../src/validation/user.validation');

const userId = '64f123456789abcdef123456';

describe('upload validation', () => {
    test('accepts a valid resume upload request', () => {
        const result = presignedUploadSchema.safeParse({
            fileName: 'resume.pdf',
            contentType: 'application/pdf',
            category: 'resume',
            fileSize: 1024,
        });

        expect(result.success).toBe(true);
    });

    test.each([
        ['unknown category', { fileName: 'a.pdf', contentType: 'application/pdf', category: 'other', fileSize: 1 }],
        ['zero file size', { fileName: 'a.pdf', contentType: 'application/pdf', category: 'resume', fileSize: 0 }],
        ['missing file name', { contentType: 'application/pdf', category: 'resume', fileSize: 1 }],
    ])('rejects %s', (_, payload) => {
        expect(presignedUploadSchema.safeParse(payload).success).toBe(false);
    });

    test('defines the expected category restrictions', () => {
        expect(ALLOWED_TYPES.resume).toEqual(['application/pdf']);
        expect(ALLOWED_TYPES.avatar).toEqual(['image/jpeg', 'image/png', 'image/webp']);
        expect(MAX_FILE_SIZE.avatar).toBe(5 * 1024 * 1024);
        expect(MAX_FILE_SIZE.resume).toBe(10 * 1024 * 1024);
    });
});

describe('temporary S3 key validation', () => {
    const validKey = `tmp/${userId}/550e8400-e29b-41d4-a716-446655440000.pdf`;

    test('matches a generated temporary key', () => {
        expect(TMP_KEY_PATTERN.test(validKey)).toBe(true);
        expect(createResumeSchema.safeParse({ fileKey: validKey, fileName: 'resume.pdf' }).success).toBe(true);
        expect(updateAvatarSchema.safeParse({ fileKey: validKey }).success).toBe(true);
    });

    test.each([
        'resume/64f123456789abcdef123456/file.pdf',
        'tmp/not-an-object-id/file.pdf',
        `tmp/${userId}/folder/file.pdf`,
    ])('rejects invalid key %s', (fileKey) => {
        expect(TMP_KEY_PATTERN.test(fileKey)).toBe(false);
    });
});
