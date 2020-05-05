import * as Core from '@actions/core'
import * as GitHub from '@actions/github'

import assert from 'assert'
import table from 'markdown-table'

import loadConfig, {LintRule} from './config'


const XRegExp = require('xregexp') // eslint-disable-line @typescript-eslint/no-var-requires

type Nullable<T> = T | null
const FEEDBACK_INDICATOR = `<!-- ci_comment_type: prlint-feedback -->\n`

process.on('unhandledRejection', error => {
  Core.debug(`Got an error: ${error}`)

  if (error instanceof Error) {
    Core.setFailed(error.message)
    Core.error(error)
  } else {
    Core.setFailed('Unknown error')
  }
})

async function run() {
  const args = getArgs()
  const pr = GitHub.context.payload.pull_request

  // This action can only work in PR context.
  assert(typeof pr?.number === 'number', 'Could not get pull request number from context, exiting')

  const {repo, owner} = GitHub.context.repo
  const {sha} = GitHub.context

  // We will use the github client for all our interactions with the github api.
  const client = new GitHub.GitHub(args.authToken)
  const config = await loadConfig(client, args.configPath, repo, owner, sha)

  Core.debug('Linting')

  const results = lint(config.rules, pr?.title, pr?.body, pr?.head?.ref).map(error => error.replace(/^\s+|\s+$/g, ''))

  Core.debug(`Found linting issues: ${results.length}`)

  let report = generateReport(results, args.comment.title, args.comment.intro, args.comment.body)
    ?.replace(/{{title}}/g, pr?.title || 'null')
    ?.replace(/{{body}}/g, pr?.body || 'null')
    ?.replace(/{{branch}}/g, pr?.head?.ref || 'null')
    ?.replace(/{{count}}/g, results.length.toString())
    ?.replace(/{{commit}}/g, sha || 'null')

  Core.debug(`Generated report: ${report}`)

  // Check if we need to update or create an new comment.
  // We do this is some steps;
  //   1. get all comments and filter the comment based
  //      containing the indicator.
  //   2. if it does not exist; create the comment
  //   3. if it exist; update the comment.
  const {data: comments} = await client.issues.listComments({
    owner,
    repo,
    'issue_number': pr!.number
  })

  // will hold the comment id if there is a comment with
  // the given indicator
  let commentId: Nullable<number> = null

  Core.debug(`Already existing comment id: ${commentId}`)

  for (const comment of comments) {
    // filter the comment based containing the indicator.
    if (comment.body.includes(FEEDBACK_INDICATOR)) {
      commentId = comment.id
      break
    }
  }

  if (!report) {
    if (commentId !== null) {
      Core.debug(`Deleting comment with id: ${commentId}...`)

      return client.issues.deleteComment({'comment_id': commentId, owner, repo})
    }
  } else {
    if (commentId === null) {
      const result = await client.issues.createComment({
        'issue_number': pr!.number,
        owner,
        repo,
        body: `${FEEDBACK_INDICATOR}\n\n${report}`
      })

      return Core.setFailed(`This PR does not met the required rules. See ${result.data.url} for more info. (1)`)
    } else {
      const result = await client.issues.updateComment({
        'comment_id': commentId,
        owner,
        repo,
        body: `${FEEDBACK_INDICATOR}\n\n${report}`
      })

      return Core.setFailed(`This PR does not met the required rules. See ${result.data.url} for more info. (2)`)
    }
  }
}

function getArgs() {
  return {
    authToken: Core.getInput('repo-token', {required: true}),
    configPath: Core.getInput('configuration-path', {required: true}),
    comment: {
      title: Core.getInput('comment-table-header', {required: true}),
      intro: Core.getInput('comment-intro', {required: true}),
      body: Core.getInput('comment-body', {required: true})
    }
  }
}

function generateReport(errors: string[], header: string, intro: string, description: string): Nullable<string> {
  if (!errors || errors.length < 1) {
    return null
  }

  let report = intro

  report += `\n\n`
  report += `${table([['', header], ...errors.map(err => [':no_entry_sign:', err])], {
    align: ['l', 'l'],
    padding: false
  })}`
  report += `\n\n`
  report += description
  report += `\n\n`
  report +=
    '<p align="right">Generated by :zap: <a href="https://github.com/patrickkempff/prlint-action">PRLint</a> against {{commit}}</p>'

  return report
}

function lint(rules: LintRule[], title?: string, body?: string, branch?: string): string[] {
  const errors: Nullable<string>[] = []

  Core.debug(`Linting data:`)
  Core.debug(`title: ${title}`)
  Core.debug(`body: ${body}`)
  Core.debug(`branch: ${branch}`)

  for (const rule of rules) {
    errors.push(checkRule(rule, title, body, branch))
  }

  Core.debug(`errors: ${errors}`)

  return errors.filter(error => typeof error === 'string') as string[]
}



function checkRule(rule: LintRule, title?: string, body?: string, branch?: string): Nullable<string> {
  switch (rule.target) {
    case 'title':
      return !title || !XRegExp(rule.pattern).test(title) ? rule.message : null
    case 'body':
      return !body || !XRegExp(rule.pattern).test(body) ? rule.message : null
    case 'branch':
      return !branch || !XRegExp(rule.pattern).test(branch) ? rule.message : null
  }
}

try {
  run()
} catch (error) {
  Core.debug(`Got an error: ${error}`)
  Core.setFailed(error.message || 'Unknown error')
  Core.error(error)
}
