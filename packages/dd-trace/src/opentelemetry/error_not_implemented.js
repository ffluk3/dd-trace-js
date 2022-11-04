'use strict'

class NotImplementedError extends Error {
  constructor (obj, method) {
    const name = (typeof obj === 'object' && method === 'string')
      ? `${obj.constructor.name}.${method}`
      : obj

    super(name)
  }
}

module.exports = {
  NotImplementedError
}
