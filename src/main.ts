import * as Core from '@actions/core'
import * as GitHub from '@actions/github'

import assert from 'assert'
import table from 'markdown-table'

import loadConfig, { LintRule } from './config'

type Nullable<T> = T | null;
const FEEDBACK_INDICATOR = `<!-- ci_comment_type: body-lint -->\n`

async function run () {
    try {
        const args = getArgs()
        const pr = GitHub.context.payload.pull_request
        
        // This action can only work in PR context.
        assert(typeof pr?.number === 'number', 'Could not get pull request number from context, exiting')  

        const { repo, owner } = GitHub.context.repo
        const { sha } = GitHub.context

        // We will use the github client for all our interactions with the github api.
        const client = new GitHub.GitHub(args.authToken)
        const config = await loadConfig(client, args.configPath, repo, owner, sha)

        const results = lint(config.rules, pr?.title, pr?.body, pr?.head?.ref).map(error => 
            error.replace(/^\s+|\s+$/g, '')
        )

        let report = generateReport(results, args.comment.title, args.comment.intro, args.comment.content)
            ?.replace('{{title}}', pr?.title || 'null')
            ?.replace('{{body}}', pr?.body || 'null')
            ?.replace('{{branch}}', pr?.head?.ref || 'null')
            ?.replace('{{commit}}', sha || 'null')
            
        // Check if we need to update or create an new comment.    
        // We do this is some steps;
        //   1. get all comments and filter the comment based 
        //      containing the indicator.
        //   2. if it does not exist; create the comment
        //   3. if it exist; update the comment.
        const { data: comments } = await client.issues.listComments({ owner, repo, 'issue_number': pr!.number })

        // will hold the comment id if there is a comment with 
        // the given indicator
        let commentId: Nullable<number> = null

        for (const comment of comments) {
            // filter the comment based containing the indicator.
            if (comment.body.includes(FEEDBACK_INDICATOR)) {
                commentId = comment.id
                break
            }
        }

        if (report === null) {
            if (commentId !== null) {
                return client.issues.deleteComment({ 'comment_id': commentId, owner, repo })
            }
        } else {
            if (commentId === null) {
                return client.issues.createComment({ 'issue_number': pr!.number, owner, repo, 'body': `${FEEDBACK_INDICATOR}\n\n${report}` }) 
            } else {
                return client.issues.updateComment({ 'comment_id': commentId, owner, repo, 'body': `${FEEDBACK_INDICATOR}\n\n${report}` }) 
            }
        }     

    } catch (error) {
        Core.error(error)
        Core.setFailed(error.message)
    }    
}


function getArgs () {
    return {
        authToken: Core.getInput('repo-token', { required: true }),
        configPath: Core.getInput('configuration-path', { required: true }),
        comment: {
            title: Core.getInput('comment-title', { required: true }),
            intro: Core.getInput('comment-intro', { required: true }),
            content: Core.getInput('comment-content', { required: true }),
        }
    }
}

function generateReport (errors: string[],  header: string, intro: string, description: string): Nullable<string> {
    if (errors.length < 1) {
        return null
    }

    let report = intro
    
    report += `\n\n`
    report += `${table([ ['', header], ...errors.map(err => [':no_entry_sign:', err]), ], {
        align: ['l', 'l'], 
        padding: false
    })}`
    report += `\n\n`
    report += description

    return report    
}

function lint (rules: LintRule[], title?: string, body?: string, branch?: string): string[] {
    const errors: Nullable<string>[] = []

    for(const rule of rules) {
        errors.push(checkRule(rule, title, body, branch))
    }

    return errors.filter(error => typeof error === "string") as string[]
}

function checkRule (rule: LintRule, title?: string, body?: string, branch?: string): Nullable<string> {
    switch (rule.target) {
        case 'title': return (!title || !new RegExp(rule.pattern).test(title)) ? rule.message : null
        case 'body': return (!body || !new RegExp(rule.pattern).test(body)) ? rule.message : null
        case 'branch': return (!branch || !new RegExp(rule.pattern).test(branch)) ? rule.message : null
    }
}

run()
