const axios = require('axios')

const NYT_API_URL =
  'https://api.nytimes.com/svc/search/v2/articlesearch.json'

async function fetchNYT(query) {
  const response = await axios.get(NYT_API_URL, {
    params: {
      q: query,
      'api-key': process.env.NYT_API_KEY,
    },
  })

  return response.data.response.docs.slice(0, 3).map((article) => {
    const multimedia = Array.isArray(article.multimedia)
      ? article.multimedia
      : []

    const raw = article.abstract?.replace(/<[^>]*>/g, '') || ''
    return {
      source: 'New York Times',
      title: article.headline?.main || '',
      contentShort: raw.slice(0, 300),
      contentFull: raw.slice(0, 800),
      url: article.web_url,
      publishedAt: article.pub_date,
      thumbnail:
        multimedia.find((item) => item.format === 'mediumThreeByTwo440')?.url ||
        multimedia[0]?.url ||
        null,
      location: { lat: 40.7, lng: -74, city: 'New York' },
    }
  })
}

module.exports = { fetchNYT }
