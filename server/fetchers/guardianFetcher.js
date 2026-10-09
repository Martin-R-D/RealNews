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

  return response.data.response.results.map((result) => {
    const raw = result.fields?.bodyText?.replace(/<[^>]*>/g, '') || ''
    return {
      source: 'The Guardian',
      title: result.fields?.headline || result.webTitle || '',
      contentShort: raw.slice(0, 300),
      contentFull: raw.slice(0, 800),
      url: result.webUrl,
      publishedAt: result.webPublicationDate,
      thumbnail: result.fields?.thumbnail || null,
      location: { lat: 51.5, lng: -0.1, city: 'London' },
    }
  })
}

module.exports = { fetchGuardian }
