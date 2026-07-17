import { useMemo } from 'react'
import katex from 'katex'

interface TeXProps {
  children: string
  block?: boolean
}

/** Render a KaTeX formula. Inline by default, display-mode with `block`. */
export function TeX({ children, block = false }: TeXProps) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      }),
    [children, block],
  )
  return block ? (
    <div className="katex-block" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  )
}
