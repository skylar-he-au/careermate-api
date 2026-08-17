const cors = require('cors');
const helmet = require('helmet')
const express = require('express');
const v1Router = require('./routes/v1');
const { logger } = require('./utils/logger');
const morganMiddleware = require('./middleware/morgan-middleware');
const rateLimiter = require('./middleware/rateLimite-middleware');
const connectToDb = require('./utils/db');
const errorHundler = require('./middleware/error/error.middleware');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
    });
});
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
    });
});
app.use(cors());
app.use(morganMiddleware);
app.use(rateLimiter);
app.use(express.json());

app.use('/v1', v1Router);

app.use(errorHundler);

module.exports = app;