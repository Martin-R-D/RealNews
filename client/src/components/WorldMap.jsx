import { useEffect, useState } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const CENTER = [20, 10]
const serverIcon = divIcon({
  className: '',
  html: `
    <div style="width:36px;height:36px;background:#2563EB;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(37,99,235,0.2);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
        <rect x="2" y="2" width="20" height="8" rx="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})
const permanentSources = [
  { name: 'The Guardian', location: { lat: 51.5, lng: -0.1, city: 'London' } },
  { name: 'New York Times', location: { lat: 40.7, lng: -74, city: 'New York' } },
]
const sourceLocations = {
  BBC: { lat: 51.5, lng: -0.1, city: 'London' },
  'Al Jazeera': { lat: 25.3, lng: 51.5, city: 'Doha' },
  'Fox News': { lat: 40.7, lng: -74, city: 'New York' },
  Reuters: { lat: 51.5, lng: -0.1, city: 'London' },
  'Deutsche Welle': { lat: 50.7, lng: 7.1, city: 'Bonn' },
  'France 24': { lat: 48.8, lng: 2.3, city: 'Paris' },
  Euronews: { lat: 45.7, lng: 4.8, city: 'Lyon' },
  'South China Morning Post': { lat: 22.3, lng: 114.1, city: 'Hong Kong' },
  'The Hindu': { lat: 13, lng: 80.2, city: 'Chennai' },
  'Al Arabiya': { lat: 24.4, lng: 54.3, city: 'Abu Dhabi' },
  'Times of Israel': { lat: 31.7, lng: 35.2, city: 'Jerusalem' },
  AllAfrica: { lat: -1.2, lng: 36.8, city: 'Nairobi' },
  'Buenos Aires Herald': { lat: -34.6, lng: -58.3, city: 'Buenos Aires' },
}

function sourceState(events, name, final) {
  if (final) return { status: 'done' }
  const event = [...events].reverse().find((item) => item.agent === name)
  return event || { status: 'waiting' }
}

function ResizeMap({ compact }) {
  const map = useMap()
  useEffect(() => {
    if (compact) map.dragging.disable()
    else map.dragging.enable()
  }, [compact, map])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

export default function WorldMap({ events = [], selectedSources = [], final = false }) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const sources = [
    ...selectedSources.map((source) =>
      typeof source === 'string'
        ? { name: source, location: sourceLocations[source] }
        : { name: source.name || source.source, location: source.location },
    ),
    ...permanentSources,
  ].filter(
    (source, index, all) =>
      source.location &&
      all.findIndex((item) => item.name === source.name) === index,
  )
  const showLines = final || events.some(
    (event) =>
      (event.agent === 'judge' || event.agent === 'analyst') &&
      event.status === 'active',
  )

  return (
    <section className="surface source-map">
      <div className="map-heading"><div><p className="section-kicker">THE GEOGRAPHY OF COVERAGE</p><h2 className="panel-title">Source map</h2></div><span>{sources.length} locations</span></div>
      <MapContainer
        center={CENTER}
        zoom={1}
        minZoom={1}
        maxZoom={5}
        scrollWheelZoom={false}
        className="map-canvas"
        dragging={!compact}
        style={{ width: '100%' }}
      >
        <ResizeMap compact={compact} />
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={CENTER} icon={serverIcon}>
          <Tooltip>Analysis engine</Tooltip>
        </Marker>
        {sources.map((source) => {
          const state = sourceState(events, source.name, final)
          const active = state.status === 'active'
          const done = state.status === 'done'
          return (
            <span key={source.name}>
              {active && (
                <CircleMarker
                  center={[source.location.lat, source.location.lng]}
                  radius={20}
                  pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.15, weight: 0, className: 'pulse-ring' }}
                />
              )}
              <CircleMarker
                center={[source.location.lat, source.location.lng]}
                radius={done ? 10 : active ? 12 : 8}
                pathOptions={{
                  color: done ? '#16A34A' : active ? '#2563EB' : '#94A3B8',
                  fillColor: done ? '#16A34A' : active ? '#2563EB' : '#94A3B8',
                  fillOpacity: done ? 0.9 : active ? 0.8 : 0.5,
                  weight: active ? 3 : 2,
                }}
              >
                <Tooltip>
                  <strong>{source.name}</strong>
                  <br />
                  <span className="text-[#6B7280]">{source.location.city}</span>
                  <br />
                  {done
                    ? final ? 'Publisher location' : `${state.articlesFound || 0} articles found`
                    : active
                      ? 'Fetching...'
                      : 'Waiting...'}
                </Tooltip>
              </CircleMarker>
            </span>
          )
        })}
        {showLines &&
          sources.map((source) => (
            <Polyline
              key={`${source.name}-line`}
              positions={[[source.location.lat, source.location.lng], CENTER]}
              pathOptions={{ color: '#2563EB', weight: 1, opacity: 0.3, dashArray: '4 4' }}
            />
          ))}
      </MapContainer>
      <div className="map-legend">
        {final ? <span>Explore where these publishers are based.</span> : <><span>Waiting</span>
        <span className="text-[#2563EB]">Fetching</span>
        <span className="text-[#16A34A]">Complete</span></>}
      </div>
    </section>
  )
}
