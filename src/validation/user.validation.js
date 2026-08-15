const {z} = require('zod');
const { passwordSchema } = require('./auth.validation');
const { TMP_KEY_PATTERN } = require('../upload/upload.validation');

const updateMeSchema = z.object({
    fullName:z.string().trim().min(1).optional(),
    displayName:z.string().trim().optional(),
    role:z.enum(['Student', 'Other']).optional(),
    field:z.enum(['FE', 'BE']).optional(),
    goal:z.string().trim().optional(),
});

const updateMyPasswordSchema = z.object({
    currentPassword:passwordSchema,
    newPassword:passwordSchema,
})

const updateAcatarSchema = z.object({
    fileKey:z.string().regax(TMP_KEY_PATTERN)
})

module.exports = {
    updateMeSchema,
    updateMyPasswordSchema,
    updateAcatarSchema,
}