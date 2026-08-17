require("dotenv").config({ quiet: true });

const optionalConfigs = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    RATE_LIMIT_LIMIT: process.env.RATE_LIMIT_LIMIT || 100,
    AWS_REGION: process.env.AWS_REGION || 'ap-southeast-2',
    CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN
}

const requiredConfigs = {
    DB_CONNECTION_STRING: process.env.DB_CONNECTION_STRING,
    JWT_KEY: process.env.JWT_KEY,
    S3_BUCKET: process.env.S3_BUCKET
}

for (const key in requiredConfigs) {
    if (requiredConfigs[key] == null) {
        throw new Error(`Missing value for env var ${key}`);
    }
}

module.exports = {
    ...optionalConfigs,
    ...requiredConfigs,
};