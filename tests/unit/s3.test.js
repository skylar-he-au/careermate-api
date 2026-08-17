const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
    class MockCommand {
        constructor(input) {
            this.input = input;
        }
    }

    return {
        S3Client: jest.fn(() => ({ send: mockSend })),
        PutObjectCommand: class PutObjectCommand extends MockCommand {},
        GetObjectCommand: class GetObjectCommand extends MockCommand {},
        HeadObjectCommand: class HeadObjectCommand extends MockCommand {},
        DeleteObjectCommand: class DeleteObjectCommand extends MockCommand {},
        CopyObjectCommand: class CopyObjectCommand extends MockCommand {},
    };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: mockGetSignedUrl,
}));

const {
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const {
    generatePresignedUploadUrl,
    generatePresignedGetUrl,
    headObject,
    deleteObject,
    copyObject,
    validateS3File,
    UPLOAD_URL_EXPIRES_IN,
    DOWNLOAD_URL_EXPIRES_IN,
} = require('../../src/utils/s3');

describe('S3 helpers', () => {
    beforeEach(() => {
        mockSend.mockReset();
        mockGetSignedUrl.mockReset();
    });

    test('creates a presigned PUT URL with the expected constraints', async () => {
        mockGetSignedUrl.mockResolvedValue('https://upload.example');

        await expect(generatePresignedUploadUrl('tmp/user/file.pdf', 'application/pdf', 1234))
            .resolves.toBe('https://upload.example');

        const [, command, options] = mockGetSignedUrl.mock.calls[0];
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toEqual({
            Bucket: 'test-bucket',
            Key: 'tmp/user/file.pdf',
            ContentType: 'application/pdf',
            ContentLength: 1234,
        });
        expect(options.expiresIn).toBe(UPLOAD_URL_EXPIRES_IN);
        expect(options.signableHeaders).toEqual(new Set(['content-type', 'content-length']));
    });

    test('creates a presigned GET URL with an encoded download filename', async () => {
        mockGetSignedUrl.mockResolvedValue('https://download.example');

        await generatePresignedGetUrl('resume/user/file.pdf', 'My Resume.pdf');

        const [, command, options] = mockGetSignedUrl.mock.calls[0];
        expect(command).toBeInstanceOf(GetObjectCommand);
        expect(command.input.ResponseContentDisposition)
            .toBe("attachment; filename*=UTF-8''My%20Resume.pdf");
        expect(options).toEqual({ expiresIn: DOWNLOAD_URL_EXPIRES_IN });
    });

    test('sends head and delete commands', async () => {
        mockSend.mockResolvedValue({ ok: true });

        await headObject('tmp/user/file.pdf');
        await deleteObject('tmp/user/file.pdf');

        expect(mockSend.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
        expect(mockSend.mock.calls[0][0].input).toEqual({ Bucket: 'test-bucket', Key: 'tmp/user/file.pdf' });
        expect(mockSend.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    });

    test('encodes and copies an S3 object', async () => {
        mockSend.mockResolvedValue({});

        await copyObject('tmp/user/My Resume.pdf', 'resume/user/My Resume.pdf');

        const command = mockSend.mock.calls[0][0];
        expect(command).toBeInstanceOf(CopyObjectCommand);
        expect(command.input).toEqual({
            Bucket: 'test-bucket',
            CopySource: 'test-bucket/tmp/user/My%20Resume.pdf',
            Key: 'resume/user/My Resume.pdf',
        });
    });

    test('returns S3 metadata for a valid file', async () => {
        const head = { ContentType: 'application/pdf', ContentLength: 500 };
        mockSend.mockResolvedValue(head);

        await expect(validateS3File('tmp/user/file.pdf', {
            allowedTypes: ['application/pdf'],
            maxFileSize: 1000,
        })).resolves.toBe(head);
    });

    test('maps an S3 404 to the application not-found error', async () => {
        mockSend.mockRejectedValue({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });

        await expect(validateS3File('missing.pdf', {
            allowedTypes: ['application/pdf'],
            maxFileSize: 1000,
        })).rejects.toMatchObject({ status: 404, message: 'File not found in S3' });
    });

    test('rejects an invalid content type', async () => {
        mockSend.mockResolvedValue({ ContentType: 'text/plain', ContentLength: 10 });

        await expect(validateS3File('file.txt', {
            allowedTypes: ['application/pdf'],
            maxFileSize: 1000,
        })).rejects.toMatchObject({ status: 400 });
    });

    test('rejects a file over the size limit', async () => {
        mockSend.mockResolvedValue({ ContentType: 'application/pdf', ContentLength: 1001 });

        await expect(validateS3File('file.pdf', {
            allowedTypes: ['application/pdf'],
            maxFileSize: 1000,
        })).rejects.toMatchObject({ status: 400 });
    });
});
