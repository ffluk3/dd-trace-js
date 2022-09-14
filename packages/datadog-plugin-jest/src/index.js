const Plugin = require('../../dd-trace/src/plugins/plugin')
const { storage } = require('../../datadog-core')

const {
  CI_APP_ORIGIN,
  TEST_STATUS,
  JEST_TEST_RUNNER,
  finishAllTraceSpans,
  getTestEnvironmentMetadata,
  getTestParentSpan,
  getTestCommonTags,
  TEST_PARAMETERS,
  getCodeOwnersFileEntries,
  getCodeOwnersForFilename,
  TEST_CODE_OWNERS
} = require('../../dd-trace/src/plugins/util/test')

const { getSkippableTests } = require('../../dd-trace/src/ci-visibility/intelligent-test-runner/get-skippable-tests')

const TESTS_TO_FLAKY = [
  '__tests__/lib/array.test.js',
  '__tests__/components/exporter.test.js',
  '__tests__/lib/clone.test.js',
  '__tests__/lib/request.test.js',
  '__tests__/lib/log.test.js'
]

// https://github.com/facebook/jest/blob/d6ad15b0f88a05816c2fe034dd6900d28315d570/packages/jest-worker/src/types.ts#L38
const CHILD_MESSAGE_END = 2

function getTestSpanMetadata (tracer, test) {
  const childOf = getTestParentSpan(tracer)

  const { suite, name, runner, testParameters, isTestsSkipped } = test

  const commonTags = getTestCommonTags(name, suite, tracer._version)

  const tags = {
    childOf,
    ...commonTags,
    [JEST_TEST_RUNNER]: runner,
    [TEST_PARAMETERS]: testParameters
  }

  if (isTestsSkipped) {
    tags['_dd.ci.itr.tests_skipped'] = 'true'
  }

  return tags
}

class JestPlugin extends Plugin {
  static get name () {
    return 'jest'
  }

  constructor (...args) {
    super(...args)

    // Used to handle the end of a jest worker to be able to flush
    const handler = ([message]) => {
      if (message === CHILD_MESSAGE_END) {
        this.tracer._exporter._writer.flush(() => {
          // eslint-disable-next-line
          // https://github.com/facebook/jest/blob/24ed3b5ecb419c023ee6fdbc838f07cc028fc007/packages/jest-worker/src/workers/processChild.ts#L118-L133
          // Only after the flush is done we clean up open handles
          // so the worker process can hopefully exit gracefully
          process.removeListener('message', handler)
        })
      }
    }
    process.on('message', handler)

    this.testEnvironmentMetadata = getTestEnvironmentMetadata('jest', this.config)
    this.codeOwnersEntries = getCodeOwnersFileEntries()

    this.addSub('ci:jest:test:code-coverage', (coverageFiles) => {
      if (!this.config.isAgentlessEnabled || !this.config.isIntelligentTestRunnerEnabled) {
        return
      }
      const testSpan = storage.getStore().span
      this.tracer._exporter.exportCoverage({ testSpan, coverageFiles })
    })

    this.addSub('ci:jest:test:start', (test) => {
      const store = storage.getStore()
      const span = this.startTestSpan(test)

      if (TESTS_TO_FLAKY.includes(test.suite)) {
        const extraSpan = this.startTestSpan(test)
        extraSpan.setTag(TEST_STATUS, 'fail')
        extraSpan.finish()
      }

      this.enter(span, store)
    })

    this.addSub('ci:jest:test:finish', (status) => {
      const span = storage.getStore().span
      span.setTag(TEST_STATUS, status)
      span.finish()
      finishAllTraceSpans(span)
    })

    this.addSub('ci:jest:test:err', (error) => {
      if (error) {
        const span = storage.getStore().span
        span.setTag(TEST_STATUS, 'fail')
        span.setTag('error', error)
      }
    })

    this.addSub('ci:jest:test:skip', (test) => {
      const span = this.startTestSpan(test)
      span.setTag(TEST_STATUS, 'skip')
      span.finish()
    })

    this.addSub('ci:jest:test-session:finish', () => {
      this.tracer._exporter._writer.flush()
      if (this.tracer._exporter._coverageWriter) {
        this.tracer._exporter._coverageWriter.flush()
      }
    })

    this.addSub('ci:jest:test:skippable', ({ onResponse, onError }) => {
      if (!this.config.isAgentlessEnabled || !this.config.isIntelligentTestRunnerEnabled) {
        onResponse([])
        return
      }
      // This means that the git metadata hasn't been sent
      if (!this.tracer._gitMetadataPromise) {
        onError()
        return
      }
      // we only request after git upload has happened
      this.tracer._gitMetadataPromise.then(() => {
        const {
          'git.repository_url': repositoryUrl,
          'git.commit.sha': sha,
          'os.version': osVersion,
          'os.platform': osPlatform,
          'os.architecture': osArchitecture,
          'runtime.name': runtimeName,
          'runtime.version': runtimeVersion
        } = this.testEnvironmentMetadata

        getSkippableTests({
          site: this.config.site,
          env: this.tracer._env,
          service: this.config.service || this.tracer._service,
          repositoryUrl,
          sha,
          osVersion,
          osPlatform,
          osArchitecture,
          runtimeName,
          runtimeVersion
        }, (err, skippableTests) => {
          if (err) {
            onError(err)
          } else {
            onResponse(skippableTests)
          }
        })
      }).catch(onError)
    })
  }

  startTestSpan (test) {
    const { childOf, ...testSpanMetadata } = getTestSpanMetadata(this.tracer, test)

    const codeOwners = getCodeOwnersForFilename(test.suite, this.codeOwnersEntries)

    if (codeOwners) {
      testSpanMetadata[TEST_CODE_OWNERS] = codeOwners
    }

    const testSpan = this.tracer
      .startSpan('jest.test', {
        childOf,
        tags: {
          ...this.testEnvironmentMetadata,
          ...testSpanMetadata
        }
      })

    testSpan.context()._trace.origin = CI_APP_ORIGIN

    return testSpan
  }
}

module.exports = JestPlugin
