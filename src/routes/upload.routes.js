const { Router } = require('express');
const { presignedUploadSchema } = require('../validation/upload.validation');
const { validateBody } = require('../middleware/validation.middleware');
const { getPresignedUploadUrl } = require('../controllers/upload.controller');
const uploadRateLimiter = require('../middleware/upload.middleware');

const uploadRouter = Router();

uploadRouter.post(
    '/presigned-url',
    uploadRateLimiter,
    validateBody(presignedUploadSchema),
    getPresignedUploadUrl,
);

module.exports = uploadRouter;