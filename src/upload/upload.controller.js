const BadRequestException = require("../exceptions/badRequest.exception");
const { generatePresignedUploadUrl, UPLOAD_URL_EXPIRES_IN } = require("../utils/s3");
const { ALLOWED_TYPES, MAX_FILE_SIZE, EXTENSION_MAP } = require("./upload.validation");

const getPresignedUploadUrl = async (req, res) => {
    const { fileName, contentType, category, fileSize } = req.body;
    const userId = req.user.id;

    const allowedTypes = ALLOWED_TYPES[category];
    if(!allowedTypes.include(contentType)){
        throw new BadRequestException('File type is not allowed');
    }

    const maxFileSize = MAX_FILE_SIZE[category];
    if (maxFileSize<fileSize){
        throw new BadRequestException('File exceeds limit');
    }

    const ext = EXTENSION_MAP[contentType];
    const fileKey = `tmp/${userId}/${crypto.randomUUID()}${ext}`;

    const uploadUrl = await generatePresignedUploadUrl(fileKey, contentType, fileSize);

    res.json({
        success:true,
        data:{
            uploadUrl,
            fileKey,
            expiresIn:UPLOAD_URL_EXPIRES_IN,
        },
    });
};

module.exports = {
    getPresignedUploadUrl,
};