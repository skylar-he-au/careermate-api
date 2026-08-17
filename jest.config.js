module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setup-env.js'],
    clearMocks: true,
    restoreMocks: true,
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/index.js',
        '!src/utils/logger.js',
        '!src/utils/swagger.js',
    ],
    coverageThreshold: {
        global: {
            branches: 35,
            functions: 50,
            lines: 65,
            statements: 65,
        },
    },
};
