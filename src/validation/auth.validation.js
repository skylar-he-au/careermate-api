const { z } = require('zod');

const emailSchema = z.email('Invalid email format').toLowerCase().trim();
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must have at leas tone letter')
    .regex(/[0-9]/, 'Password must have at least one number');

const registerSchema = z.object({
    email:emailSchema,
    password:passwordSchema,
    fullName:z.string().min(1, 'Full name is required').trim(),
});

const loginSchema = z.object({
    email:emailSchema,
    password:passwordSchema,
})

module.exports = {
    registerSchema,
    loginSchema,
}