'use client'

import { useEffect, useMemo, useState } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { Place } from '@/lib/places'

type PlacesMapProps = {
  places: Place[]
  selectedPlaceId: string | null
  onSelect: (placeId: string) => void
}

type LatLng = { lat: number; lng: number }

const FALLBACK_CENTER: LatLng = { lat: 51.5074, lng: -0.1278 } // London default

function MapContent({ places, selectedPlaceId, onSelect }: PlacesMapProps) {
  const map = useMap()
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null)

  const geoPlaces = useMemo(
    () => places.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number'),
    [places]
  )

  const selectedPlace = geoPlaces.find((p) => p.id === selectedPlaceId) ?? null

  useEffect(() => {
    // Only fit bounds if no specific place is selected or if the selected place changes
    if (!map || !geoPlaces.length || typeof window === 'undefined') return
    const g = (window as any).google
    if (!g?.maps) return
    const bounds = new g.maps.LatLngBounds()
    geoPlaces.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
    map.fitBounds(bounds)
    if (geoPlaces.length === 1) {
      map.setZoom(14)
    }
  }, [map, geoPlaces])

  useEffect(() => {
    // If selectedPlaceId is set, open info window. If null, close it.
    setInfoOpenId(selectedPlaceId)
  }, [selectedPlaceId])

  return (
    <>
      {geoPlaces.map((place) => (
        <AdvancedMarker
          key={place.id}
          position={{ lat: place.latitude!, lng: place.longitude! }}
          onClick={() => {
            onSelect(place.id)
            setInfoOpenId(place.id)
          }}
        />
      ))}

      {selectedPlace && infoOpenId === selectedPlace.id && (
        <InfoWindow
          position={{ lat: selectedPlace.latitude!, lng: selectedPlace.longitude! }}
          onCloseClick={() => {
             setInfoOpenId(null)
             onSelect('') // Clear selection in parent
          }}
          headerContent={
             <div className="font-bold text-sm pr-6 text-gray-900">{selectedPlace.name}</div>
          }
        >
          <div className="min-w-[200px] max-w-[260px] pt-1">
            {selectedPlace.address && (
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                {selectedPlace.address}
              </p>
            )}

            {selectedPlace.notes && (
              <div className="mb-2 p-2 bg-yellow-50 rounded border border-yellow-100">
                <p className="text-xs text-gray-700 italic">
                  "{selectedPlace.notes}"
                </p>
              </div>
            )}
            
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedPlace.cuisine_tags?.slice(0, 3).map((tag) => (
                <span 
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded-md border border-blue-100"
                >
                  {tag}
                </span>
              ))}
              {selectedPlace.cuisine_tags && selectedPlace.cuisine_tags.length > 3 && (
                <span className="px-1.5 py-0.5 text-[10px] text-gray-400">
                  +{selectedPlace.cuisine_tags.length - 3}
                </span>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              {selectedPlace.url && (
                <a 
                  href={selectedPlace.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View on Maps ↗
                </a>
              )}
              {selectedPlace.website && (
                <a 
                  href={selectedPlace.website} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  Website
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

export default function PlacesMap({ places, selectedPlaceId, onSelect }: PlacesMapProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  const geoPlaces = useMemo(
    () => places.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number'),
    [places]
  )

  const center: LatLng = geoPlaces.length
    ? { lat: geoPlaces[0].latitude!, lng: geoPlaces[0].longitude! }
    : FALLBACK_CENTER

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-center px-6" style={{ color: 'var(--text-muted)' }}>
        Add `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` (or `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) to enable the interactive map.
      </div>
    )
  }

  if (!geoPlaces.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm px-6 text-center" style={{ color: 'var(--text-muted)' }}>
        No locations with coordinates to display on the map.
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        mapId="tipjar-map"
        defaultCenter={center}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="w-full h-full"
        style={{ borderRadius: '16px' }}
      >
        <MapContent places={geoPlaces} selectedPlaceId={selectedPlaceId} onSelect={onSelect} />
      </Map>
    </APIProvider>
  )
}

