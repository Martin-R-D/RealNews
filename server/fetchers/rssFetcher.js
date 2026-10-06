const Parser = require('rss-parser')

const parser = new Parser()
const STOP_WORDS = new Set(['about', 'after', 'and', 'for', 'from', 'news', 'the', 'with'])

const RSS_SOURCES = {
  BBC: 'http://feeds.bbci.co.uk/news/rss.xml',
  'Al Jazeera': 'https://www.aljazeera.com/xml/rss/all.xml',
  'Fox News': 'https://moxie.foxnews.com/google-publisher/latest.xml',
}

async function fetchRSS(source, url, query) {
  const feed = await parser.parseURL(url)
  const queries = String(query || '')
    .toLowerCase()
    .split(/\s+or\s+/i)
    .map((item) =>
      item
        .split(/\s+/)
        .map((keyword) => keyword.replace(/[^\w-]/g, ''))
        .filter(
          (keyword) =>
            keyword.length > 2 &&
            !STOP_WORDS.has(keyword) &&
            !/^\d{4}$/.test(keyword),
        ),
    )
    .filter((keywords) => keywords.length)

  return feed.items
    .filter((item) => {
      const searchableText = `${item.title || ''} ${
        item.content || item.contentSnippet || item.description || ''
      }`.toLowerCase()

      return queries.some((keywords) =>
        keywords.some((keyword) => searchableText.includes(keyword)),
      )
    })
    .slice(0, 3)
    .map((item) => ({
      source,
      title: item.title || '',
      content: (item.content || item.contentSnippet || item.description || '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 300),
      url: item.link || item.guid || '',
      publishedAt: item.isoDate || item.pubDate || null,
    }))
}

module.exports = { fetchRSS, RSS_SOURCES }
