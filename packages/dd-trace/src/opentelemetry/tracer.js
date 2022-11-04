'use strict'

const { NotImplementedError } = require('./error_not_implemented')

class Tracer {
  constructor (library, config, tracerProvider) {
    // Is there a reason this is public?
    this.instrumentationLibrary = library
    this._config = config
    this._tracerProvider = tracerProvider
  }

  // Why do we need to expose this?
  get resource () {
    return this._tracerProvider.resource
  }

  // TODO: Figure out how to implement this...
  startSpan (name, options, context) {
    throw new NotImplementedError(this, 'startSpan')
  }

  // TODO: Figure out how to implement this...
  startActiveSpan (name, options, context, fn) {
    throw new NotImplementedError(this, 'startActiveSpan')
  }
}

module.exports = {
  Tracer
}
