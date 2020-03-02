/* eslint-disable @typescript-eslint/camelcase */
import { GitHub } from '@actions/github'

export default async function addFeedback(
    client: GitHub, 
    issue_number: number,
    repo: string, 
    owner: string,
    indicator: string,
    body: string
) {

    // Check if we need to update or create an new comment.    
    // We do this is some steps;
    //   1. get all comments and filter the comment based 
    //      containing the indicator.
    //   2. if it does not exist; create the comment
    //   3. if it exist; update the comment.
    const { data } = await client.issues.listComments({ owner, repo, issue_number })

    // will hold the comment id if there is a comment with 
    // the given indicator
    let comment_id: number | null = null

    for (const comment of data) {
        // filter the comment based containing the indicator.
        if (comment.body.includes(indicator)) {
            comment_id = comment.id
            break
        }
    }

    if (comment_id === null) {
        // 2. it does not exist; create the comment
        return client.issues.createComment({ issue_number, owner, repo, body }) 
    } else {
        // 3. it exist; update the comment.
        return client.issues.updateComment({ comment_id, owner, repo, body }) 
    }
  }
  