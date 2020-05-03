declare module 'markdown-table' {
  type MardownTableAlignOptions = 'l' | 'c' | 'r'

  interface MardownTableOptions {
    padding?: boolean
    delimiterStart?: boolean
    delimiterEnd?: boolean
    alignDelimiters?: boolean
    stringLength?: (s: string) => number
    align?: MardownTableAlignOptions[]
  }

  export default function(
    data: string[][],
    options: MardownTableOptions
  ): string
}
