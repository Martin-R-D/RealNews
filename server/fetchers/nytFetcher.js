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

    return {
      source: 'New York Times',
      title: article.headline?.main || '',
      content: article.abstract?.replace(/<[^>]*>/g, '')?.slice(0, 300),
      url: article.web_url,
      publishedAt: article.pub_date,
      thumbnail:
        multimedia.find((item) => item.format === 'mediumThreeByTwo440')?.url ||
        multimedia[0]?.url ||
        null,
    }
  })
}

module.exports = { fetchNYT }
