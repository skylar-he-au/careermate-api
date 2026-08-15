const { Router } = require('express');
const { presignedUploadSchema } = require('./upload.validation');
const { validateBody } = require('../middleware/validation.middleware');
const { getPresignedUploadUrl } = require('./upload.controller');
const uploadRateLimiter = require('./upload.middleware');

const uploadRouter = Router();

uploadRouter.post(
    '/presigned-url',
    uploadRateLimiter,
    validateBody(presignedUploadSchema),
    getPresignedUploadUrl,
);

module.exports = uploadRouter;