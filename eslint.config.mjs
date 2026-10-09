import neostandard from 'neostandard'

export default [
  // Vendored byte-identical from repository/active/base; lint it there.
  // dist/ is tsc output, checked against src by cli/check-dist.sh.
  { ignores: ['cli/check-lockfile-age.mjs', 'dist/'] },
  ...neostandard({ ts: true }),
  {
    // Project convention is snake_case for variables and functions.
    rules: { camelcase: 'off' }
  }
]
