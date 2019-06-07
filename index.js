const bunyan = require('bunyan')

const { bootstrap } = require('./src')

/* eslint-disable */
const logger = bunyan.createLogger({
    name: process.env.npm_package_name || require('./package').name,
    version: process.env.npm_package_version || require('./package').version,
});

bootstrap({ logger })
    .then(() => {
        logger.info('Completed!')
        process.exit(0)
    })
    .catch((e) => {
        logger.error(e)
        process.exit(1)
    })

process.on('SIGTERM', () => {
    logger.info('Got SIGTERM')
    process.exit(0)
})

process.on('SIGINT', () => {
    logger.info('Got SIGINT')
    process.exit(0)
})

process.on('unhandledRejection', (e, promise) => {
    logger.log('Unhandled Rejection at:', promise, 'reason:', e)
    process.exit(1)
})

process.on('uncaughtException', () => {
    process.exit(1)
})
