// Reduce verbose DOM snapshot output in testing-library errors
if (typeof document !== 'undefined') {
  import('@testing-library/dom').then(({ configure }) => {
    configure({
      getElementError: (message) => {
        const error = new Error(message ?? undefined)
        error.name = 'TestingLibraryElementError'
        return error
      },
    })
  }).catch(() => {})
}
