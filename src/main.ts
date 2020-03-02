import * as core from '@actions/core'
import {GitHub, context} from '@actions/github'
import * as yaml from 'js-yaml'

import assert from './utils/assert'
import addFeedback from './utils/addFeedback'
import fetchContent from './utils/fetchContent'

const FEEDBACK_INDICATOR = `<!-- ci_comment_type: body-lint -->\n`

async function run(): Promise<void> {
  try {
    const token = core.getInput('repo-token', {required: true})
    const configPath = core.getInput('configuration-path', {required: true})

    const pr_number = context.payload.pull_request?.number

    assert(
      typeof pr_number === 'number',
      'Could not get pull request number from context, exiting'
    )

    const client = new GitHub(token)

    core.debug(`fetching config file ${configPath} for pr #${pr_number}`)

    const configurationContent = await fetchContent(
      client,
      configPath,
      context.repo.repo,
      context.repo.owner,
      context.sha
    )

    const config: any = yaml.safeLoad(configurationContent)

    const pull_request = context.payload.pull_request

    const errors = await validate(
      config,
      pull_request?.title,
      pull_request?.body
    )

    // await addFeedback(
    //   client,
    //   context.issue.number,
    //   context.issue.repo,
    //   context.issue.owner,
    //   FEEDBACK_INDICATOR,
    //   'body'
    // )

    // const ms: string = core.getInput('milliseconds')
    // core.debug(`Waiting ${ms} milliseconds ...`)

    // core.debug(new Date().toTimeString())
    // await wait(parseInt(ms, 10))
    // core.debug(new Date().toTimeString())

    // core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

function validate(config: any, title?: string, body?: string) {
  console.log(config)
}

run()
