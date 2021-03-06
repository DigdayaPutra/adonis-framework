'use strict'

/**
 * adonis-framework
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const nodeReq = require('node-req')
const nodeCookie = require('node-cookie')
const File = require('../File')
const pathToRegexp = require('path-to-regexp')
const _ = require('lodash')
const CatLog = require('cat-log')
const log = new CatLog('adonis:framework')
const util = require('../../lib/util')

/**
 * Glued http request object to read values for
 * a given request. Instance of this class
 * is generated automatically on every
 * new request.
 * @class
 */
class Request {

  constructor (request, response, Config) {
    this.request = request
    this.response = response
    this.config = Config
    this._body = {}
    this._files = []

    /**
     * secret to parse and decrypt cookies
     * @type {String}
     */
    this.secret = this.config.get('app.appKey')

    /**
     * holding references to cookies once they
     * have been parsed. It is required to
     * optimize performance as decrypting
     * is an expensive operation
     * @type {Object}
     */
    this.cookiesObject = {}

    /**
     * flag to find whether cookies have been
     * parsed once or not
     * @type {Boolean}
     */
    this.parsedCookies = false
  }

  /**
   * returns input value for a given key from post
   * and get values.
   *
   * @param  {String} key - Key to return value for
   * @param  {Mixed} defaultValue - default value to return when actual
   *                                 value is empty
   * @return {Mixed}
   *
   * @example
   * request.input('name')
   * request.input('profile.name')
   *
   * @public
   */
  input (key, defaultValue) {
    defaultValue = util.existy(defaultValue) ? defaultValue : null
    const input = this.all()
    const value = _.get(input, key)
    return util.existy(value) ? value : defaultValue
  }

  /**
   * returns merged values from get and post methods.
   *
   * @return {Object}
   *
   * @public
   */
  all () {
    return _.merge(this.get(), this.post())
  }

  /**
   * returns all input values except defined keys
   *
   * @param {Mixed} keys an array of keys or multiple keys to omit values for
   * @return {Object}
   *
   * @example
   * request.except('password', 'credit_card')
   * request.except(['password', 'credit_card'])
   *
   * @public
   */
  except () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    return _.omit(this.all(), args)
  }

  /**
   * returns all input values for defined keys only
   *
   * @param {Mixed} keys an array of keys or multiple keys to pick values for
   * @return {Object}
   *
   * @example
   * request.only('name', 'email')
   * request.only(['name', 'name'])
   *
   * @public
   */
  only () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    return _.pick(this.all(), args)
  }

  /**
   * returns query parameters from request querystring
   *
   * @return {Object}
   *
   * @public
   */
  get () {
    return nodeReq.get(this.request)
  }

  /**
   * returns post body from request, BodyParser
   * middleware needs to be enabled for this to work
   *
   * @return {Object}
   *
   * @public
   */
  post () {
    return this._body || {}
  }

  /**
   * returns header value for a given key
   *
   * @param  {String} key
   * @param  {Mixed} defaultValue - default value to return when actual
   *                                 value is undefined or null
   * @return {Mixed}
   *
   * @example
   * request.header('Authorization')
   *
   * @public
   */
  header (key, defaultValue) {
    defaultValue = util.existy(defaultValue) ? defaultValue : null
    const headerValue = nodeReq.header(this.request, key)
    return util.existy(headerValue) ? headerValue : defaultValue
  }

  /**
   * returns all request headers from a given request
   *
   * @return {Object}
   *
   * @public
   */
  headers () {
    return nodeReq.headers(this.request)
  }

  /**
   * tells whether request is fresh or not by
   * checking Etag and expires header
   *
   * @return {Boolean}
   *
   * @public
   */
  fresh () {
    return nodeReq.fresh(this.request, this.response)
  }

  /**
   * opposite of fresh
   *
   * @see fresh
   *
   * @return {Boolean}
   *
   * @public
   */
  stale () {
    return nodeReq.stale(this.request, this.response)
  }

  /**
   * returns most trusted ip address for a given request. Proxy
   * headers are trusted only when app.http.trustProxy is
   * enabled inside config file.
   *
   * @uses app.http.subdomainOffset
   *
   * @return {String}
   *
   * @public
   */
  ip () {
    return nodeReq.ip(this.request, this.config.get('app.http.trustProxy'))
  }

  /**
   * returns an array of ip addresses sorted from most to
   * least trusted. Proxy headers are trusted only when
   * app.http.trustProxy is enabled inside config file.
   *
   * @uses app.http.subdomainOffset
   *
   * @return {Array}
   *
   * @public
   */
  ips () {
    return nodeReq.ips(this.request, this.config.get('app.http.trustProxy'))
  }

  /**
   * tells whether request is on https or not
   *
   * @return {Boolean}
   *
   * @public
   */
  secure () {
    return nodeReq.secure(this.request)
  }

  /**
   * returns an array of subdomains from url. Proxy headers
   * are trusted only when app.http.trustProxy is enabled
   * inside config file.
   *
   * @uses app.http.subdomainOffset
   * @uses app.http.trustProxy
   *
   * @return {Array}
   *
   * @public
   */
  subdomains () {
    return nodeReq.subdomains(this.request, this.config.get('app.http.trustProxy'), this.config.get('app.http.subdomainOffset'))
  }

  /**
   * tells whether request is an ajax request or not
   *
   * @return {Boolean}
   *
   * @public
   */
  ajax () {
    return nodeReq.ajax(this.request)
  }

  /**
   * tells whether request is pjax or
   * not based on X-PJAX header
   *
   * @return {Boolean}
   *
   * @public
   */
  pjax () {
    return nodeReq.pjax(this.request)
  }

  /**
   * returns request hostname
   *
   * @uses app.http.subdomainOffset
   *
   * @return {String}
   *
   * @public
   */
  hostname () {
    return nodeReq.hostname(this.request, this.config.get('app.http.trustProxy'))
  }

  /**
   * returns request url without query string
   *
   * @return {String}
   *
   * @public
   */
  url () {
    return nodeReq.url(this.request)
  }

  /**
   * returns request original Url with query string
   *
   * @return {String}
   *
   * @public
   */
  originalUrl () {
    return nodeReq.originalUrl(this.request)
  }

  /**
   * tells whether request is of certain type
   * based upon Content-type header
   *
   * @return {Boolean}
   *
   * @example
   * request.is('text/html', 'text/plain')
   * request.is(['text/html', 'text/plain'])
   *
   * @public
   */
  is () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    return nodeReq.is(this.request, args)
  }

  /**
   * returns the best response type to be accepted using Accepts header
   *
   * @return {String}
   *
   * @example
   * request.accepts('text/html', 'application/json')
   * request.accepts(['text/html', 'application/json'])
   *
   * @public
   */
  accepts () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    return nodeReq.accepts(this.request, args)
  }

  /**
   * returns request method or verb in HTTP terms
   *
   * @return {String}
   *
   * @public
   */
  method () {
    return nodeReq.method(this.request)
  }

  /**
   * returns cookie value for a given key
   *
   * @param  {String} key - Key for which value should be returnd
   * @param  {Mixed} defaultValue - default value to return when actual
   *                                 value is undefined or null
   * @return {Mixed}
   *
   * @public
   */
  cookie (key, defaultValue) {
    defaultValue = util.existy(defaultValue) ? defaultValue : null
    const cookies = this.cookies()
    return util.existy(cookies[key]) ? cookies[key] : defaultValue
  }

  /**
   * returns all cookies associated to a given request
   *
   * @return {Object}
   *
   * @public
   */
  cookies () {
    const secret = this.secret || null
    const decrypt = !!this.secret

    /**
     * avoiding re-parsing of cookies if done once
     */
    if (!this.parsedCookies) {
      this.cookiesObject = nodeCookie.parse(this.request, secret, decrypt)
      this.parsedCookies = true
    }

    return this.cookiesObject
  }

  /**
   * return route param value for a given key
   *
   * @param  {String} key - key for which the value should be return
   * @param {Mixed} defaultValue - default value to be returned with actual
   *                               is null or undefined
   * @return {Mixed}
   *
   * @public
   */
  param (key, defaultValue) {
    defaultValue = util.existy(defaultValue) ? defaultValue : null
    return util.existy(this.params()[key]) ? this.params()[key] : defaultValue
  }

  /**
   * returns all route params
   *
   * @return {Object}
   *
   * @public
   */
  params () {
    return this._params || {}
  }

  /**
   * converts a file object to file instance
   * if already is not an instance
   *
   * @param  {Object}        file
   * @return {Object}
   * @private
   */
  _toFileInstance (file) {
    if (!(file instanceof File)) {
      file = new File(file)
    }
    return file
  }

  /**
   * returns uploaded file instance for a given key
   * @instance Request.file
   *
   * @param  {String} key
   * @return {Object}
   *
   * @example
   * request.file('avatar')
   * @public
   */
  file (key) {
    /**
     * if requested file was not uploaded return an
     * empty instance of file object.
     */
    if (!this._files[key]) {
      return this._toFileInstance({})
    }

    /**
     * grabbing file from uploaded files and
     * converting them to file instance
     */
    const fileToReturn = this._files[key].toJSON()

    /**
     * if multiple file upload , convert of them to
     * file instance
     */
    if (_.isArray(fileToReturn)) {
      return _.map(fileToReturn, (file) => {
        return this._toFileInstance(file)
      })
    }
    return this._toFileInstance(fileToReturn)
  }

  /**
   * returns all uploded files by converting
   * them to file instances
   *
   * @return {Array}
   *
   * @public
   */
  files () {
    return _.map(this._files, (file, index) => {
      return this.file(index)
    })
  }

  /**
   * flash an object of messages to session.
   *
   * @param  {Object} values
   *
   * @example
   * yield request.flash({error: 'Unable to create account'})
   *
   * @public
   */
  * flash (values) {
    if (typeof (values) !== 'object') {
      throw new Error('Flash values should be an object')
    }
    yield this.session.put('flash_messages', values)
  }

  /**
   * return values set via flash from
   * request session
   *
   * @param  {String} key - key for which to pull value for
   * @param  {Mixed} defaultValue - default value to return when actual value
   *                                is empty
   * @return {Mixed}
   *
   * @example
   * request.old('name')
   * request.old('form.name')
   *
   * @public
   */
  old (key, defaultValue) {
    if (!this._flash_messages) {
      log.warn('Make use of Flash middleware to enable flash messaging')
      this._flash_messages = {}
    }
    defaultValue = util.existy(defaultValue) ? defaultValue : null
    return util.existy(this._flash_messages[key]) ? this._flash_messages[key] : defaultValue
  }

  /**
   * flash all request input fields to session
   *
   * @return {void}
   *
   * @example
   * yield request.flashAll()
   * @public
   */
  * flashAll () {
    yield this.flash(this.all())
  }

  /**
   * flash values of defined keys to session flash
   *
   * @return {void}
   *
   * @example
   * yield request.flashOnly('name', 'age')
   *
   * @public
   */
  * flashOnly () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    yield this.flash(this.only(args))
  }

  /**
   * flash values from request to session except
   * the values of defined keys.
   *
   * @return {void}
   *
   * @example
   * yield request.flashExcept('name', 'age')
   *
   * @public
   */
  * flashExcept () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    yield this.flash(this.except(args))
  }

  /**
   * tells whether a given pattern matches the current url or not
   *
   * @param  {String} pattern
   * @return {Boolean}
   *
   * @example
   * request.match('/user/:id', 'user/(+.)')
   * request.match(['/user/:id', 'user/(+.)'])
   *
   * @public
   */
  match () {
    const args = _.isArray(arguments[0]) ? arguments[0] : _.toArray(arguments)
    const url = this.url()
    const pattern = pathToRegexp(args, [])
    return pattern.test(url)
  }

  /**
   * returns request format enabled by using
   * .formats on routes
   *
   * @return {String}
   *
   * @example
   * request.format()
   *
   * @public
   */
  format () {
    return this.param('format') ? this.param('format').replace('.', '') : null
  }

  /**
   * tells whether or not request has body. It can be
   * used by bodyParsers to decide whether or not to parse body
   *
   * @return {Boolean}
   *
   * @public
   */
  hasBody () {
    return nodeReq.hasBody(this.request)
  }

  /**
   * adds a new method to the request prototype
   *
   * @param  {String}   name
   * @param  {Function} callback
   *
   * @public
   */
  static macro (name, callback) {
    this.prototype[name] = callback
  }
}

module.exports = Request
