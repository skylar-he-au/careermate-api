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
            winston.format.printf(({ timestamp, filename, level, message, payload, ...meta }) => {
                const fileInfo = filename ? ` [${filename}]` : '';
                const payloadInfo = payload ? `\n${JSON.stringify(payload)}` : '';
                let log =  `[${timestamp}] [${level}]${fileInfo}: ${message}${payloadInfo}`;
                if(Object.keys(meta).length>0){
                    log+=`${JSON.stringify(meta)}`;
                }
                return log;
            })
        ),
        transports: [
            new winston.transports.Console(),
        ],
    });
};

module.exports = {
    createLogger,
    logger: createLogger(),
};