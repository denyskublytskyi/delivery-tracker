const ms = require('ms')
const axios = require('axios')
const LRU = require('lru-cache')
const chunk = require('lodash/chunk')
const get = require('lodash/get')
const compact = require('lodash/compact')

class DeliveryService {
    /**
     *
     * @param {String} apiUrl
     * @param {String} apiUserEmail
     * @param {String} apiUserPassword
     * @param logger
     */
    constructor({
        apiUrl, apiUserEmail, apiUserPassword, logger,
    }) {
        this._cache = new LRU({
            maxAge: ms('2h'),
        })
        this._logger = logger
        this._apiUrl = apiUrl
        this._apiUserEmail = apiUserEmail
        this._apiUserPassword = apiUserPassword
    }

    /**
     *
     * @returns {Promise<String>}
     * @private
     */
    async _getApiToken() {
        if (this._cache.has('apiToken')) {
            return this._cache.get('apiToken')
        }

        const response = await axios.post(`${this._apiUrl}/users/sign-in`, {
            email: this._apiUserEmail,
            password: this._apiUserPassword,
        }, {
            timeout: ms('1m'),
        })

        const { token } = response.data
        this._cache.set('apiToken', token)

        return token
    }

    async getDeliveriesInTransit() {
        const token = await this._getApiToken()
        const carts = await axios.get(`${this._apiUrl}/v2/deliveries`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                status: 'pending',
                orderDirections: ['desc'],
                accountType: 'gaming',
                orderBy: ['assignedAt', 'createdAt'],
            },
            timeout: ms('1m'),
        })

        return carts.data
    }

    async completeDeliveries({ cuids }) {
        /* eslint-disable */
        const results = []
        for (const cuidsChunk of chunk(cuids, 20)) {
            const chunkResults = await Promise.all(cuidsChunk.map(cuid => this.completeDelivery({ cuid })))
            results.push(...chunkResults)
        }

        return compact(results)
    }

    async completeDelivery({ cuid }) {
        const token = await this._getApiToken()

        let response
        try {
            response = await axios.put(`${this._apiUrl}/v2/deliveries/${cuid}/complete`, {}, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                timeout: ms('1m'),
            })
        } catch(e) {
            this._logger.error(e)
        }

        return get(response, 'data.data')
    }
}

/**
 *
 * @type {{DeliveryService: DeliveryService}}
 */
module.exports = { DeliveryService }
