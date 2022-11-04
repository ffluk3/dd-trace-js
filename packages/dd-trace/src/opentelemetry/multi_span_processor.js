'use strict'

const { SpanProcessor } = require('./span_processor')

class MultiSpanProcessor extends SpanProcessor {
  constructor (spanProcessors) {
    super()
    this._processors = spanProcessors
  }

  forceFlush () {
    return Promise.all(
      this._processors.map(p => p.forceFlush())
    )
  }

  onStart (span, context) {
    for (const processor of this._processors) {
      processor.onStart(span, context)
    }
  }

  onEnd (span) {
    for (const processor of this._processors) {
      processor.onEnd(span)
    }
  }

  shutdown () {
    return Promise.all(
      this._processors.map(p => p.shutdown())
    )
  }
}

module.exports = {
  MultiSpanProcessor
}
