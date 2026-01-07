import * as L from 'leaflet';

export const MAP_CONFIG = {
  center: {
    lat: -31.4201,
    lng: -64.1888
  },
  zoom: {
    default: 13,
    min: 5,
    max: 18
  }
};

export const TILE_LAYERS = {
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: '© Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
      minZoom: 3
    }
  ),
  ignArgentina: L.tileLayer(
    'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{-y}.png',
    {
      attribution: '© <a href="https://www.ign.gob.ar/">IGN Argentina</a>',
      maxZoom: 18,
      minZoom: 3
    }
  ),
  openStreetMap: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }
  )
};

export const POLYGON_STYLE_DEFAULT: L.PathOptions = {
  color: '#3498db',
  fillOpacity: 0.4,
  weight: 2
};

export const POLYGON_STYLE_DETECTED: L.PathOptions = {
  color: '#2ecc71',
  fillOpacity: 0.6,
  weight: 2
};

export const POLYGON_STYLE_HOVER: L.PathOptions = {
  fillOpacity: 0.8,
  weight: 4
};

export const POLYGON_STYLE_HYBRID: L.PathOptions = {
  color: '#9b59b6',
  fillOpacity: 0.7,
  weight: 3
};

export const POLYGON_STYLE_OSM: L.PathOptions = {
  color: '#e67e22',
  fillOpacity: 0.4,
  weight: 2
};
