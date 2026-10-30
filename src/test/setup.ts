// The UI tests run on a shared self-hosted runner next to suites that start hundreds of processes; under that load the
// event loop stalls for seconds, and testing-library's 1 s default budget for findBy*/waitFor then fails a screen that is
// right. 10 s is above the slowest test seen on that runner (6.7 s) and below the 30 s testTimeout, so a query that
// really never matches still fails with testing-library's own message and DOM dump.
// Only the jsdom test files render; the node ones (tests/, most of src/) skip loading testing-library.
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/react')
  configure({ asyncUtilTimeout: 10_000 })
}
