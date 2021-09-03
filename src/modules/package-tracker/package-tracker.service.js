const { EventEmitter } = require('events')
const assert = require('assert-plus')
const puppeteer = require('puppeteer')
const uniq = require('lodash/uniq')
const result = require('lodash/result')
const ms = require('ms')

/**
 * @typedef {{DELIVERED: string, NOT_FOUND: string}} PackageTrackingStatus
 */
const PackageStatuses = {
    DELIVERED: 'DELIVERED',
    NOT_FOUND: 'NOTFOUND',
    INTRANSIT: 'INTRANSIT',
    EXPIRED: 'EXPIRED',
    PICKUP: 'PICKUP',
    ALERT: 'ALERT',
    UNDELIVERED: 'UNDELIVERED',
}

const PackageStatusesList = Object.values(PackageStatuses)

class PackageTrackerService extends EventEmitter {
    /**
     *
     * @param {String} trackingUrl
     * @param {String} trackingStatusSelector
     * @param cache
     */
    constructor({ trackingUrl, trackingStatusSelector, cache }) {
        super()

        assert.string(trackingUrl, 'trackingUrl')
        assert.string(trackingStatusSelector, 'trackingStatusSelector')
        assert.object(cache, 'cache')

        this._trackingUrl = trackingUrl
        this._cache = cache
        this._trackingStatusSelector = trackingStatusSelector
    }

    /**
     *
     * @param trackingCodes
     * @returns {Promise<Map<String, PackageTrackingStatus>>}
     */
    async getPackageStatuses({ trackingCodes }) {
        const browser = await puppeteer.launch({
            executablePath: process.env.CHROME_BIN || null,
            args: ['--no-sandbox'],
            headless: true,
        })

        const packageStatuses = new Map()
        /* eslint-disable */
        for (const trackingCode of uniq(trackingCodes)) {
            let status = this._cache.get(trackingCode)
            if (!status) {
                const page = await browser.newPage()

                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => false, })
                })

                await page.setUserAgent(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36"
                );
                await page.setExtraHTTPHeaders({
                    "Accept-Language": "en;q=0.9",
                });

                await page.goto(this._trackingUrl.replace('{trackingCode}', trackingCode))

                let attempts = 0

                while (!PackageStatusesList.includes(status) && attempts++ < 5) {
                    await page.waitFor(ms('5s'))
                    const element = await page.$(this._trackingStatusSelector)
                    const statusText = await page.evaluate(element => element ? element.textContent : "INVALID_TRACKING_CODE", element)

                    status = result(statusText.replace(/\s/, '').match(/\w+/), '0.toUpperCase')
                }
                await page.close()

                this._cache.set(trackingCode, status)
            }

            packageStatuses.set(trackingCode, status)
            process.nextTick(() => this.emit(PackageTrackerService.events.TRACKED, ({ trackingCode, status })))
        }

        return packageStatuses
    }
}

PackageTrackerService.events = {
    TRACKED: 'TRACKED',
}

/**
 *
 * @type {{PackageStatuses: {DELIVERED: string, NOT_FOUND: string}, PackageTrackerService: PackageTrackerService}}
 */
module.exports = { PackageTrackerService, PackageStatuses }
