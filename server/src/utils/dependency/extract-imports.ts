import * as ts from 'typescript'

/**
 * Extract imports from typescript source code
 * @param source typescript source code
 */
export function extractImports(source: string): string[] {
  const imports: string[] = []

  const sourceFile = ts.createSourceFile(
    'temp.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  )

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text)
      }
    } else if (ts.isCallExpression(node)) {
        // Handle require('...')
        if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
            const args = node.arguments
            if (args.length > 0 && ts.isStringLiteral(args[0])) {
                imports.push(args[0].text)
            }
        }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}
