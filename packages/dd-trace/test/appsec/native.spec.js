'use strict'

const { LibAppSec } = require('../../src/appsec/native')
const TEST_RULE = JSON.stringify(require('./testRule.json'))

describe('LibAppSec', () => {
  beforeEach(() => {
    LibAppSec.clearAll()
  })

  it('should throw when passed invalid config', () => {
    const badInit = () => new LibAppSec('{')

    expect(badInit).to.throw()
  })

  it('should return the WAF version', () => {
    const version = LibAppSec.version()

    expect(typeof version.major).to.equal('number')
    expect(typeof version.minor).to.equal('number')
    expect(typeof version.patch).to.equal('number')
  })

  describe('running the WAF', () => {
    let lib

    beforeEach(() => {
      lib = new LibAppSec(TEST_RULE)
    })

    it('should return nothing when passed no input', () => {
      const run = lib.run({}, 10000)

      expect(run.status).to.equal(undefined)
      expect(run.record).to.equal(undefined)
    })

    it('should return record and raise status when passed blocking attack', () => {
      const run = lib.run({ 'server.request.uri.raw': '/<script>' }, 10000)

      expect(run.status).to.equal('raise')
      expect(run.record).to.have.string('xss-blocking')
    })

    it('should return record and no status when passed non-blocking attack', () => {
      const run = lib.run({
        'server.request.headers.no_cookies': {
          'host': 'localhost:1337',
          'user-agent': 'Arachni/v1'
        }
      }, 10000)

      expect(run.status).to.equal(undefined)
      expect(run.record).to.have.string('security_scanner-monitoring')
    })

    it('should throw when called after being cleared', () => {
      lib.clear()

      const badRun = () => lib.run({}, 10000)

      expect(badRun).to.throw('calling a cleared instance of appsecLib')
    })
  })
})
