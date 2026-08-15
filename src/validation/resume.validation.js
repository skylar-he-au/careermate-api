const { z } = require('zod');
const { TMP_KEY_PATTERN } = require('./upload.validation');

const createResumeSchema = z.object({
    fileKey: z.string().regex(TMP_KEY_PATTERN),
    fileName: z.string().trim().min(1),
});

module.exports = {
    createResumeSchema,
};