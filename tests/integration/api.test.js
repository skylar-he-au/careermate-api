jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/utils/password', () => ({
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
}));

jest.mock('../../src/utils/s3', () => ({
    generatePresignedUploadUrl: jest.fn(),
    generatePresignedGetUrl: jest.fn(),
    validateS3File: jest.fn(),
    copyObject: jest.fn(),
    deleteObject: jest.fn(),
    UPLOAD_URL_EXPIRES_IN: 300,
    DOWNLOAD_URL_EXPIRES_IN: 3600,
}));

jest.mock('../../src/models/user-model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../src/models/resume.model', () => ({
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user-model');
const Resume = require('../../src/models/resume.model');
const s3 = require('../../src/utils/s3');
const password = require('../../src/utils/password');
const { generateToken } = require('../../src/utils/jwt');

const userId = '64f123456789abcdef123456';
const token = generateToken({ id: userId, accountType: 'user' });
const auth = { Authorization: `Bearer ${token}` };

describe('HTTP API integration', () => {
    test('GET /health reports that the app is running', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('protected routes reject a missing bearer token', async () => {
        const response = await request(app).get('/v1/users/me');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            error: { message: 'Authentication required' },
        });
    });

    test('register validates input and creates a user', async () => {
        User.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
        password.hashPassword.mockResolvedValue('hashed-password');
        User.create.mockResolvedValue({ id: userId, email: 'student@example.com' });

        const response = await request(app).post('/v1/auth/register').send({
            fullName: 'Student',
            email: 'STUDENT@example.com',
            password: 'password1',
        });

        expect(response.status).toBe(201);
        expect(User.findOne).toHaveBeenCalledWith({ email: 'student@example.com' });
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            email: 'student@example.com',
            password: 'hashed-password',
        }));
    });

    test('upload endpoint validates input before calling the controller', async () => {
        const response = await request(app)
            .post('/v1/upload/presigned-url')
            .set(auth)
            .send({ category: 'resume' });

        expect(response.status).toBe(400);
        expect(s3.generatePresignedUploadUrl).not.toHaveBeenCalled();
    });

    test('upload endpoint returns a presigned URL and temporary key', async () => {
        s3.generatePresignedUploadUrl.mockResolvedValue('https://upload.example');

        const response = await request(app)
            .post('/v1/upload/presigned-url')
            .set(auth)
            .send({
                fileName: 'CV.pdf',
                contentType: 'application/pdf',
                category: 'resume',
                fileSize: 1024,
            });

        expect(response.status).toBe(200);
        expect(response.body.data.uploadUrl).toBe('https://upload.example');
        expect(response.body.data.fileKey)
            .toMatch(/^tmp\/64f123456789abcdef123456\/[0-9a-f-]+\.pdf$/);
    });

    test('resume endpoint validates S3 and persists the record', async () => {
        const tmpKey = `tmp/${userId}/resume.pdf`;
        s3.validateS3File.mockResolvedValue({ ContentLength: 2048 });
        s3.copyObject.mockResolvedValue({});
        s3.deleteObject.mockResolvedValue({});
        Resume.create.mockResolvedValue({ id: 'resume-id', fileName: 'CV.pdf' });

        const response = await request(app)
            .post('/v1/resumes')
            .set(auth)
            .send({ fileKey: tmpKey, fileName: 'CV.pdf' });

        expect(response.status).toBe(201);
        expect(s3.copyObject).toHaveBeenCalledWith(tmpKey, `resume/${userId}/resume.pdf`);
        expect(Resume.create).toHaveBeenCalledWith(expect.objectContaining({ fileSize: 2048 }));
    });

    test('avatar endpoint moves the image and updates the user', async () => {
        const user = { avatar: null, save: jest.fn().mockResolvedValue({}) };
        User.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(user) });
        s3.validateS3File.mockResolvedValue({ ContentType: 'image/png', ContentLength: 100 });
        s3.copyObject.mockResolvedValue({});
        s3.deleteObject.mockResolvedValue({});

        const response = await request(app)
            .post('/v1/users/me/avatar')
            .set(auth)
            .send({ fileKey: `tmp/${userId}/avatar.png` });

        expect(response.status).toBe(201);
        expect(response.body.data.avatar).toBe(`avatar/${userId}/avatar.png`);
        expect(user.save).toHaveBeenCalled();
    });

    test('download endpoint returns a presigned GET URL', async () => {
        Resume.findById.mockResolvedValue({
            user: { toString: () => userId },
            fileKey: `resume/${userId}/resume.pdf`,
            fileName: 'CV.pdf',
        });
        s3.generatePresignedGetUrl.mockResolvedValue('https://download.example');

        const response = await request(app)
            .get('/v1/resumes/resume-id/download')
            .set(auth);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({
            downloadUrl: 'https://download.example',
            fileName: 'CV.pdf',
            expiresIn: 3600,
        });
    });

    test('delete endpoint removes the S3 object and database record', async () => {
        const resume = {
            user: { toString: () => userId },
            fileKey: `resume/${userId}/resume.pdf`,
            deleteOne: jest.fn().mockResolvedValue({}),
        };
        Resume.findById.mockResolvedValue(resume);
        s3.deleteObject.mockResolvedValue({});

        const response = await request(app)
            .delete('/v1/resumes/resume-id')
            .set(auth);

        expect(response.status).toBe(204);
        expect(s3.deleteObject).toHaveBeenCalledWith(resume.fileKey);
        expect(resume.deleteOne).toHaveBeenCalled();
    });
});
