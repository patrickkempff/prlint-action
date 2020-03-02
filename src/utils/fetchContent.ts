import { GitHub } from '@actions/github'
import assert from './assert'

export default async function fetchContent(
    client: GitHub,
    path: string,
    repo: string, 
    owner: string,    
    ref: string
  ): Promise<string> {
    const response = await client.repos.getContents({ owner, repo, path, ref });
    const data: any = response.data // eslint-disable-line @typescript-eslint/no-explicit-any

    assert(data.content !== null, `${path} does not exist`)
  
    return Buffer.from(data.content, 'base64').toString();
  }