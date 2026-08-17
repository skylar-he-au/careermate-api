const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    CopyObjectCommand,
} = require('@aws-sdk/client-s3');
const config = require('./config');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const NotFoundException = require('../exceptions/NotFound.exception');
const BadRequestException = require('../exceptions/badRequest.exception');

const UPLOAD_URL_EXPIRES_IN = 5 * 60;
const DOWNLOAD_URL_EXPIRES_IN = 60 * 60;

const s3Client = new S3Client({
    region: config.AWS_REGION,
    maxAttempts: 3,
});

const generatePresignedUploadUrl = async (fileKey, contentType, fileSize) => {
    const command = new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: fileKey,
        ContentType: contentType,
        ContentLength: fileSize,
    });
    return getSignedUrl(s3Client, command, {
        expiresIn: UPLOAD_URL_EXPIRES_IN,
        signableHeaders: new Set(['content-type', 'content-length']),
    });
};

const generatePresignedGetUrl = async (fileKey, fileName) => {
    const command = new GetObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: fileKey,
        ...(fileName && {
            ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        }),
    });
    return getSignedUrl(s3Client, command, {
        expiresIn: DOWNLOAD_URL_EXPIRES_IN,
    });
};

const headObject = async(fileKey)=>{
    const command = new HeadObjectCommand({
        Bucket:config.S3_BUCKET,
        Key:fileKey,
    })
    return s3Client.send(command);
};

const deleteObject = async(fileKey)=>{
    const command = new DeleteObjectCommand({
        Bucket:config.S3_BUCKET,
        Key:fileKey,
    })
    return s3Client.send(command);
};

const copyObject = async(sourceKey, destinationKey)=>{
    const encodedKey = sourceKey.split('/').map(encodeURIComponent).join('/');
    const command = new CopyObjectCommand({
        Bucket:config.S3_BUCKET,
        CopySource:`${config.S3_BUCKET}/${encodedKey}`,
        Key:destinationKey,
    });
    return s3Client.send(command);
};

const validateS3File = async(fileKey, {allowedTypes, maxFileSize})=>{
    let head;
    try{
        head = await headObject(fileKey);
    }catch(e){
        if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404){
            throw new NotFoundException('File not found in S3',{fileKey});
        }
        throw e;
    }
    if (!allowedTypes.includes(head.ContentType)){
        throw new BadRequestException(
            `File type ${head.ContentType} is not allowed, allowed types are: ${allowedTypes.join(', ')}.`,
        );
    }
    if (head.ContentLength > maxFileSize){
        throw new BadRequestException(`File exceeds ${maxFileSize} limit`);
    }
    return head;
}

module.exports = {
    UPLOAD_URL_EXPIRES_IN,
    DOWNLOAD_URL_EXPIRES_IN,
    generatePresignedGetUrl,
    generatePresignedUploadUrl,
    headObject,
    deleteObject,
    copyObject,
    validateS3File,
}
