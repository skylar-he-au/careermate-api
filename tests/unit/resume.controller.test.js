jest.mock('../../src/models/resume.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
}));

jest.mock('../../src/utils/s3', () => ({
    validateS3File: jest.fn(),
    copyObject: jest.fn(),
    deleteObject: jest.fn(),
    generatePresignedGetUrl: jest.fn(),
    DOWNLOAD_URL_EXPIRES_IN: 3600,
}));

const Resume = require('../../src/models/resume.model');
const s3 = require('../../src/utils/s3');
const {
    createResume,
    getResumes,
    downloadResume,
    deleteResume,
} = require('../../src/controllers/resume.controller');

const userId = '64f123456789abcdef123456';
const tmpKey = `tmp/${userId}/resume.pdf`;
const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    sendStatus: jest.fn(),
});

describe('resume controller', () => {
    test('validates, moves, and records a resume', async () => {
        s3.validateS3File.mockResolvedValue({ ContentLength: 321 });
        s3.copyObject.mockResolvedValue({});
        s3.deleteObject.mockResolvedValue({});
        const savedResume = { id: 'resume-id', fileKey: `resume/${userId}/resume.pdf` };
        Resume.create.mockResolvedValue(savedResume);
        const res = createResponse();

        await createResume({ user: { id: userId }, body: { fileKey: tmpKey, fileName: 'CV.pdf' } }, res);

        expect(s3.validateS3File).toHaveBeenCalledWith(tmpKey, {
            allowedTypes: ['application/pdf'],
            maxFileSize: 10 * 1024 * 1024,
        });
        expect(s3.copyObject).toHaveBeenCalledWith(tmpKey, `resume/${userId}/resume.pdf`);
        expect(s3.deleteObject).toHaveBeenCalledWith(tmpKey);
        expect(Resume.create).toHaveBeenCalledWith({
            user: userId,
            fileKey: `resume/${userId}/resume.pdf`,
            fileName: 'CV.pdf',
            fileSize: 321,
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('rejects a temporary key owned by another user', async () => {
        await expect(createResume({
            user: { id: userId },
            body: { fileKey: 'tmp/aaaaaaaaaaaaaaaaaaaaaaaa/file.pdf', fileName: 'CV.pdf' },
        }, createResponse())).rejects.toMatchObject({ status: 403 });

        expect(s3.validateS3File).not.toHaveBeenCalled();
    });

    test('paginates resume records', async () => {
        const query = {
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([{ id: 'one' }]),
        };
        Resume.find.mockReturnValue(query);
        Resume.countDocuments.mockResolvedValue(21);
        const res = createResponse();

        await getResumes({ user: { id: userId }, query: { page: '2', limit: '10' } }, res);

        expect(query.skip).toHaveBeenCalledWith(10);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: [{ id: 'one' }],
            pagination: { page: 2, limit: 10, total: 21 },
        });
    });

    test('returns a presigned download URL for the owner', async () => {
        Resume.findById.mockResolvedValue({
            user: { toString: () => userId },
            fileKey: `resume/${userId}/resume.pdf`,
            fileName: 'CV.pdf',
        });
        s3.generatePresignedGetUrl.mockResolvedValue('https://download.example');
        const res = createResponse();

        await downloadResume({ params: { id: 'resume-id' }, user: { id: userId } }, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { downloadUrl: 'https://download.example', fileName: 'CV.pdf', expiresIn: 3600 },
        });
    });

    test('deletes the S3 object before the database record', async () => {
        const resume = {
            user: { toString: () => userId },
            fileKey: `resume/${userId}/resume.pdf`,
            deleteOne: jest.fn().mockResolvedValue({}),
        };
        Resume.findById.mockResolvedValue(resume);
        s3.deleteObject.mockResolvedValue({});
        const res = createResponse();

        await deleteResume({ params: { id: 'resume-id' }, user: { id: userId } }, res);

        expect(s3.deleteObject).toHaveBeenCalledWith(resume.fileKey);
        expect(resume.deleteOne).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(204);
    });
});
