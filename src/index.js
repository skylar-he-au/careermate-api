const { default: mongoose } = require('mongoose');
const app = require('./app');
const config = require('./utils/config');
const connectToDb = require('./utils/db');
const { logger } = require('./utils/logger');

const SHUTDOWN_TIMEOUT = 10 * 1000;

const startApp = async () => {
    await connectToDb();

    const server = app.listen(config.PORT, () => {
        logger.info(`server listening on port ${config.PORT}`);
    });

    const shutdown = (signal) => {
        logger.info(`${signal} received, shutting down now`);
        server.close(() => {
            mongoose.connection.close().then(() => {
                logger.info('DB connection closed');
                process.exit(0);
            });
        });

        setTimeout(() => {
            logger.error('Shutdown failed');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (err) => {
        logger.error('Unhandled rejection', { err });
        process.exit(1);
    })
    process.on('uncaughtException', (err) => {
        logger.error('Unhandled exception', { err });
        process.exit(1);
    })
};

startApp();