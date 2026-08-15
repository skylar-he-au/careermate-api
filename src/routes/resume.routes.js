const {Router} = require('express');
const { validate } = require('../models/user-model');
const { validateBody } = require('../middleware/validation.middleware');
const { createResumeSchema } = require('../validation/resume.validation');
const { createResume, getResumes, downloadResume, deleteResume } = require('../controllers/resume.controller');

const resumeRouter = Router();

resumeRouter.post('/', validateBody(createResumeSchema),createResume);
resumeRouter.get('/',getResumes);
resumeRouter.get('/:id/download', downloadResume);
resumeRouter.delete('/:id',deleteResume);

module.exports = resumeRouter;