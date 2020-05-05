/*  eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'assert'
import {GitHub} from '@actions/github'
import * as YAML from 'js-yaml'

export interface Config {
  rules: LintRule[]
}

export interface LintRule {
  pattern: RegExp
  target: 'title' | 'body' | 'branch'
  message: string
}

export default async function loadConfig(
  client: GitHub,
  path: string,
  repo: string,
  owner: string,
  ref: string
): Promise<Config> {
  const response = await client.repos.getContents({owner, repo, path, ref})
  const data: any = response.data

  assert(data.content !== null, `${path} does not exist`)

  return YAML.safeLoad(Buffer.from(data.content, 'base64').toString())
}
