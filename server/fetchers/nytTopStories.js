const axios = require('axios')

async function fetchTopStories(section = 'home') {
  const response = await axios.get(
    `https://api.nytimes.com/svc/topstories/v2/${section}.json`,
    { params: { 'api-key': process.env.NYT_API_KEY } },
  )

  return response.data.results.slice(0, 6).map((article) => {
    const multimedia = Array.isArray(article.multimedia)
      ? article.multimedia
      : []

    return {
      title: article.title,
      abstract: article.abstract,
      url: article.url,
      section: article.section,
      publishedAt: article.published_date,
      source: 'New York Times',
      thumbnail:
        multimedia.find((item) => item.format === 'mediumThreeByTwo440')?.url ||
        multimedia[0]?.url ||
        null,
    }
  })
}

module.exports = { fetchTopStories }
