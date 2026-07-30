const winston = require('winston');
const path = require('path');
const config = require('./config');

const logDir = path.join(__dirname, '../../logs');

const createLogger = (filename) => {
    return winston.createLogger({
        level: config.LOG_LEVEL,
        defaultMeta: {
            filename: filename ? path.basename(filename) : undefined,
        },
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, filename, level, message, payload }) => {
                const fileInfo = filename ? ` [${filename}]` : '';
                const payloadInfo = payload ? `\n${JSON.stringify(payload)}` : '';
                return `[${timestamp}] [${level}]${fileInfo}: ${message}${payloadInfo}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
            }),
            new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error',
            }),
        ],
    });
};

module.exports = {
    createLogger,
    logger: createLogger(),
};