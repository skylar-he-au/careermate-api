const {z} = require('zod');
const { passwordSchema } = require('./auth.validation');

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

module.exports = {
    updateMeSchema,
    updateMyPasswordSchema,
}