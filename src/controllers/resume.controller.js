const { success } = require("zod");
const ForbiddenException = require("../exceptions/forbidden.exception");
const Resume = require("../models/resume.model");
const { ALLOWED_TYPES, MAX_FILE_SIZE } = require("../upload/upload.validation");
const { validateS3File, copyObject, deleteObject, generatePresignedGetUrl, DOWNLOAD_URL_EXPIRES_IN } = require("../utils/s3");
const NotFoundException = require("../exceptions/NotFound.exception");

const createResume = async (req, res) => {
    const { fileKey: tmpKey, fileName } = req.body;
    const userId = req.user.id;
    if (!tmpKey.startsWith(`tmp/${userId}/`)) {
        throw new ForbiddenException("File key doesn't belong to the current user");
    }

    const head = await validateS3File(tmpKey, {
        allowedTypes: ALLOWED_TYPES.resume,
        maxFileSize: MAX_FILE_SIZE.resume,
    });

    // filename from the filekey
    const filename = tmpKey.slice(`tmp/${userId}/`.length);
    const fileKey = `resume/${userId}/${filename}`;

    await copyObject(tmpKey, fileKey);
    await deleteObject(tmpKey);

    const resume = await Resume.create({
        user: userId,
        fileKey,
        fileName,
        fileSize: head.ContentLength,
    });

    res.status(201).json({
        success: true,
        data: resume,
    });
};

const getResumes = async (req, res) => {
    const userId = req.user.id
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) + limit;

    const [resumes, total] = await Promise.all([
        Resume.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Resume.countDocuments({ user: userId }),
    ]);

    res.json({
        success: true,
        data: resumes,
        pagination: {
            page,
            limit,
            total,
        },
    });
};

const findOwnResume = async (req, res) => {
    const resume = await Resume.findById(resumeId);
    if(!resume){
        throw new NotFoundException('Resume not found');
    }
    if (resume.user.toString() !== userId){
        throw new ForbiddenException('Missing access permission')
    }
    return resume;
};

const downlaodResume = async (req, res) => {
    const resume = await findOwnResume(req.params.id, req.user.id);

    const downlaodUrl = await generatePresignedGetUrl(
        resume.findKey,
        resume.fileName,
    ); 

    res.json({
        success: true,
        data: {
            downlaodUrl,
            fileName: resume.fileName,
            expiresIn: DOWNLOAD_URL_EXPIRES_IN,
        },
    });
};

const deleteRusume = async(req,res)=>{
    const resume = await findOwnResume(req.params.id, req.user.id);

    await deleteObject(resume.fileKey);
    await resume.deleteOne();

    res.sendStatus(204);
}

module.exports = {
    getResumes,
    createResume,
    downlaodResume,
    deleteRusume,
};