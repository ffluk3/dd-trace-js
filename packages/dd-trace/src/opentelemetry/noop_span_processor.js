'use strict'

const { SpanProcessor } = require('./span_processor')

class NoopSpanProcessor extends SpanProcessor {
  forceFlush () {
    return Promise.resolve()
  }

  onStart (span, context) {}
  onEnd (span) {}

  shutdown () {
    return Promise.resolve()
  }
}

module.exports = {
  NoopSpanProcessor
}
