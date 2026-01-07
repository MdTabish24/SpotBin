/**
 * FreeMap Component - Uses FREE OpenStreetMap (No API Key Required!)
 * Works without Google Maps API key
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  title?: string;
  description?: string;
}

interface FreeMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerPress?: (marker: MapMarker) => void;
  style?: any;
  showUserLocation?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

export function FreeMap({
  center,
  zoom = 13,
  markers = [],
  onMarkerPress,
  style,
  showUserLocation = false,
  userLocation,
}: FreeMapProps) {
  const webViewRef = useRef<WebView>(null);

  // Generate HTML with Leaflet map
  const generateMapHTML = () => {
    const markersJS = markers.map(m => `
      L.circleMarker([${m.lat}, ${m.lng}], {
        radius: 10,
        fillColor: '${m.color || '#EF4444'}',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map)
        .bindPopup('<b>${m.title || 'Report'}</b><br>${m.description || ''}')
        .on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'marker', id: '${m.id}'}));
        });
    `).join('\n');

    const userMarkerJS = showUserLocation && userLocation ? `
      L.marker([${userLocation.lat}, ${userLocation.lng}], {
        icon: L.divIcon({
          className: 'user-marker',
          html: '<div style="width:20px;height:20px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map).bindPopup('Your Location');
    ` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-control-attribution { font-size: 8px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${center.lat}, ${center.lng}], ${zoom});
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    ${markersJS}
    ${userMarkerJS}
    
    // Fit bounds if markers exist
    ${markers.length > 0 ? `
      var bounds = L.latLngBounds([${markers.map(m => `[${m.lat}, ${m.lng}]`).join(',')}]);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    ` : ''}
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'marker' && onMarkerPress) {
        const marker = markers.find(m => m.id === data.id);
        if (marker) onMarkerPress(marker);
      }
    } catch (e) {
      console.log('Map message error:', e);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading Map...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
  },
  webview: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
});

export default FreeMap;
