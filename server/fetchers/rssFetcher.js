const Parser = require('rss-parser')

const parser = new Parser()
const STOP_WORDS = new Set(['about', 'after', 'and', 'for', 'from', 'news', 'the', 'with'])

const SOURCES = [
  { name: 'BBC', url: 'http://feeds.bbci.co.uk/news/rss.xml', location: { lat: 51.5, lng: -0.1, city: 'London' } },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', location: { lat: 25.3, lng: 51.5, city: 'Doha' } },
  { name: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/latest.xml', location: { lat: 40.7, lng: -74, city: 'New York' } },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', location: { lat: 51.5, lng: -0.1, city: 'London' } },
  { name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-all', location: { lat: 50.7, lng: 7.1, city: 'Bonn' } },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', location: { lat: 48.8, lng: 2.3, city: 'Paris' } },
  { name: 'Euronews', url: 'https://www.euronews.com/rss', location: { lat: 45.7, lng: 4.8, city: 'Lyon' } },
  { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', location: { lat: 22.3, lng: 114.1, city: 'Hong Kong' } },
  { name: 'The Hindu', url: 'https://www.thehindu.com/feeder/default.rss', location: { lat: 13, lng: 80.2, city: 'Chennai' } },
  { name: 'Al Arabiya', url: 'https://english.alarabiya.net/tools/rss', location: { lat: 24.4, lng: 54.3, city: 'Abu Dhabi' } },
  { name: 'Times of Israel', url: 'https://www.timesofisrael.com/feed', location: { lat: 31.7, lng: 35.2, city: 'Jerusalem' } },
  { name: 'AllAfrica', url: 'https://allafrica.com/tools/headlines/rss/latest/news.xml', location: { lat: -1.2, lng: 36.8, city: 'Nairobi' } },
  { name: 'Buenos Aires Herald', url: 'https://buenosairesherald.com/feed', location: { lat: -34.6, lng: -58.3, city: 'Buenos Aires' } },
]

async function fetchRSS(source, query) {
  const feed = await parser.parseURL(source.url)
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
      source: source.name,
      location: source.location,
      title: item.title || '',
      content: (item.content || item.contentSnippet || item.description || '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 300),
      url: item.link || item.guid || '',
      publishedAt: item.isoDate || item.pubDate || null,
    }))
}

module.exports = { fetchRSS, SOURCES }
