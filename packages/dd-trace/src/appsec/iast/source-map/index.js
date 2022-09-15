'use strict'
const path = require('path')
const fs = require('fs')
const { SourceMap } = require('./node_source_map')
const SOURCE_MAP_LINE_START = '//# sourceMappingURL='
const SOURCE_MAP_INLINE_LINE_START = '//# sourceMappingURL=data:application/json;base64,'
const CACHE_MAX_SIZE = 100
const LRU = require('lru-cache')
const pathSourceMapsCache = new LRU({ max: CACHE_MAX_SIZE })

function readAndCacheSourceMap (filename, filePath) {
  const cachedSourceMap = pathSourceMapsCache.get(filename)
  if (!cachedSourceMap) {
    const fileContent = fs.readFileSync(filename).toString()
    const fileLines = fileContent.trim().split('\n')
    const lastLine = fileLines[fileLines.length - 1]
    let rawSourceMap
    if (lastLine.indexOf(SOURCE_MAP_INLINE_LINE_START) === 0) {
      const sourceMapInBase64 = lastLine.substring(SOURCE_MAP_INLINE_LINE_START.length)
      rawSourceMap = Buffer.from(sourceMapInBase64, 'base64').toString('utf8')
    } else if (lastLine.indexOf(SOURCE_MAP_LINE_START) === 0) {
      let sourceMappingURL = lastLine.substring(SOURCE_MAP_LINE_START.length)
      if (sourceMappingURL) {
        sourceMappingURL = path.join(filePath, sourceMappingURL)
        rawSourceMap = fs.readFileSync(sourceMappingURL).toString()
      }
    }
    if (rawSourceMap) {
      const sm = new SourceMap(JSON.parse(rawSourceMap))
      pathSourceMapsCache.set(filename, sm)
      return sm
    }
    return null
  }
  return cachedSourceMap
}

function getSourcePathAndLineFromSourceMaps (filename, line, originalColumn = 0) {
  try {
    const filenameParts = filename.split(path.sep)
    filenameParts.pop()
    const filePath = filenameParts.join(path.sep)

    const sourceMap = readAndCacheSourceMap(filename, filePath)
    if (sourceMap) {
      const { originalSource, originalLine } = sourceMap.findEntry(line, originalColumn)
      return {
        path: path.join(filePath, originalSource),
        line: originalLine
      }
    }
  } catch (e) {
    // can not read the source maps, return original path and line
  }
  return { path: filename, line }
}

module.exports = {
  getSourcePathAndLineFromSourceMaps
}
