import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'
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

export default function WorldMap({ events = [], selectedSources = [], final = false }) {
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
    <div className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="px-4 py-3 text-sm font-semibold text-[#0F1117]">Live Source Map</div>
      <MapContainer
        center={CENTER}
        zoom={2}
        minZoom={2}
        maxZoom={5}
        scrollWheelZoom={false}
        style={{ width: '100%', height: 420 }}
      >
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
                    ? `${state.articlesFound || 0} articles found`
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
      <div className="flex gap-4 px-4 py-3 text-xs text-[#6B7280]">
        <span>● Grey = waiting</span>
        <span className="text-[#2563EB]">● Blue = fetching</span>
        <span className="text-[#16A34A]">● Green = done</span>
      </div>
    </div>
  )
}
