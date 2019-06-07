const ms = require('ms')
const get = require('lodash/get')
const find = require('lodash/find')
const map = require('lodash/map')
const values = require('lodash/values')
const path = require('path')
const nock = require('nock')

const deliveriesMock = require('./get_deliveries')

const { DeliveryService } = require('../modules/delivery/delivery.service')
const { PackageTrackerService, PackageStatuses } = require('../modules/package-tracker/package-tracker.service')

const logger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}

beforeAll(() => {
    nock(process.env.API_URL).post('/users/sign-in').reply(200, { token: '' })
    nock(process.env.API_URL).get(/v2\/deliveries\?./).replyWithFile(200, path.join(__dirname, 'get_deliveries.json'))
    nock(process.env.API_URL).post(/v2\/deliveries\/([a-z0-9])+\/complete/).reply(200, (uri) => {
        const cuid = get(uri.match(/deliveries\/([a-z0-9])\/complete/), '1')
        return find(deliveriesMock.data, ['cuid', cuid])
    })
})


describe('Package tracker module', () => {
    test('Get deliveries statuses', async () => {
        jest.setTimeout(ms('2m'))

        const trackingCodes = map(deliveriesMock.data, 'trackingCode')

        const packageTracker = new PackageTrackerService({
            trackingUrl: process.env.TRACKING_URL,
            trackingStatusSelector: process.env.TRACKING_STATUS_SELECTOR,
        })

        const statuses = await packageTracker.getPackageStatuses({ trackingCodes })

        expect(statuses instanceof Map).toBe(true)
        expect([...statuses]).toHaveLength(trackingCodes.length)
        expect([...statuses.values()]).arrayContaining(values(PackageStatuses))
    })
})


describe('Delivery module', () => {
    test('Get assigned deliveries', async () => {
        const deliveryService = new DeliveryService({
            apiUrl: process.env.API_URL,
            apiUserEmail: process.env.API_USER_EMAIL,
            apiUserPassword: process.env.API_USER_PASSWORD,
            logger,
        })

        const { data: deliveries, count } = await deliveryService.getDeliveriesInTransit()

        expect(Array.isArray(deliveries)).toBe(true)
        expect(deliveries).toHaveLength(deliveriesMock.data.length)
        expect(count).toBe(deliveries.length)
        expect(deliveries).toEqual(deliveriesMock.data)
    })
})
