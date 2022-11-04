
const { context, propagation, trace } = require('@opentelemetry/api')

const { MultiSpanProcessor } = require('./multi_span_processor')
const { NoopSpanProcessor } = require('./noop_span_processor')
const { Tracer } = require('./tracer')

const tracers = new Map()

class TracerProvider {
  // TODO: Figure out what needs to go in the config
  constructor (config) {
    this.config = config
    this._processors = []

    // TODO: Figure out if we need default exporter and batch span processor
    this._activeProcessor = new NoopSpanProcessor()
  }

  // TODO: Figure out what goes in options
  getTracer (name, version, options) {
    const key = `${name}@${version}`
    if (!tracers.has(key)) {
      tracers.set(key, new Tracer(options))
    }
    return tracers.get(key)
  }

  addSpanProcessor (spanProcessor) {
    if (!this._processors.length) {
      this._activeProcessor.shutdown()
    }
    this._processors.push(spanProcessor)
    this._activeProcessor = new MultiSpanProcessor(
      this._processors
    )
  }

  getActiveSpanProcessor () {
    return this._activeProcessor
  }

  // TODO: Why is register needed?
  register (config) {
    trace.setGlobalTracerProvider(this)
    if (config.contextManager) {
      context.setGlobalContextManager(config.contextManager)
    }
    if (config.propagator) {
      propagation.setGlobalPropagator(config.propagator || this._buildPropagatorFromEnv())
    }
  }

  // TODO: Does this need a timeout?
  forceFlush () {
    return Promise.all(
      this._processors.map(p => p.forceFlush())
    )
  }

  shutdown () {
    return this._activeProcessor.shutdown()
  }
}

module.exports = TracerProvider
