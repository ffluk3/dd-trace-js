'use strict'

const { NotImplementedError } = require('./error_not_implemented')

//  Reference implementation
class SpanProcessor {
  forceFlush () {
    return Promise.reject(new NotImplementedError(this, 'forceFlush'))
  }

  onStart (span, parentContext) {
    throw new NotImplementedError(this, 'onStart')
  }

  onEnd (span) {
    throw new NotImplementedError(this, 'onStart')
  }

  shutdown () {
    return Promise.reject(new NotImplementedError(this, 'shutdown'))
  }
}

module.exports = {
  SpanProcessor
}
