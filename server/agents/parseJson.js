function parseJson(content) {
  return JSON.parse(
    content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, ''),
  )
}

module.exports = { parseJson }
