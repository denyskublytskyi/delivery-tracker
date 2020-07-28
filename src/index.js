const map = require('lodash/fp/map')
const filter = require('lodash/fp/filter')
const compose = require('lodash/fp/compose')
const LRU = require('lru-cache')
const ms = require('ms')

const { NotificationService } = require('./modules/notifications/notification.service')
const { DeliveryService } = require('./modules/delivery')
const { PackageTrackerService, PackageStatuses } = require('./modules/package-tracker')

const bootstrap = async ({ logger }) => {
    const cache = new LRU({
        maxAge: ms('2h'),
    })

    const deliveryService = new DeliveryService({
        apiUrl: process.env.API_URL,
        apiUserEmail: process.env.API_USER_EMAIL,
        apiUserPassword: process.env.API_USER_PASSWORD,
        cache,
        logger,
    })
    const packageTrackerService = new PackageTrackerService({
        trackingUrl: process.env.TRACKING_URL,
        trackingStatusSelector: process.env.TRACKING_STATUS_SELECTOR,
        cache,
    })

    const notificationService = new NotificationService({
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
        trackingUrl: process.env.TRACKING_URL,
    })

    const { data: deliveries } = await deliveryService.getDeliveriesInTransit()
    logger.info({ deliveries }, `Found ${deliveries.length} deliveries in transit`)
    const trackingCodes = map('trackingCode')(deliveries)

    packageTrackerService.on(PackageTrackerService.events.TRACKED, ({ trackingCode, status }) => {
        logger.info({ trackingCode, status }, 'Tracked!')
    })

    const statuses = await packageTrackerService.getPackageStatuses({ trackingCodes })
    logger.info({ statuses: Array.from(statuses) }, 'Deliveries statuses')

    const deliveriesWithStatuses = map(delivery => ({
        ...delivery,
        trackStatus: statuses.get(delivery.trackingCode),
    }))(deliveries)

    const cuids = compose(
        map('cuid'),
        filter(['trackStatus', PackageStatuses.DELIVERED]),
    )(deliveriesWithStatuses)

    const completed = await deliveryService.completeDeliveries({ cuids })
    logger.info({ completed }, 'Deliveries completed')

    const message = await notificationService.notify({
        deliveries: deliveriesWithStatuses,
        completed,
    })
    logger.info({ message }, 'Message sent to slack!')
}

module.exports = { bootstrap }
