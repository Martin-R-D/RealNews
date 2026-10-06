const axios = require('axios')

const GUARDIAN_API_URL = 'https://content.guardianapis.com/search'

async function fetchGuardian(query) {
  const response = await axios.get(GUARDIAN_API_URL, {
    params: {
      q: query,
      'api-key': process.env.GUARDIAN_API_KEY,
      'show-fields': 'bodyText,headline,thumbnail',
      'page-size': 3,
    },
  })

  return response.data.response.results.map((result) => ({
    source: 'The Guardian',
    title: result.fields?.headline || result.webTitle || '',
    content: result.fields?.bodyText?.replace(/<[^>]*>/g, '')?.slice(0, 300),
    url: result.webUrl,
    publishedAt: result.webPublicationDate,
    thumbnail: result.fields?.thumbnail || null,
  }))
}

module.exports = { fetchGuardian }
