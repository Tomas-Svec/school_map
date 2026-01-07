export type LayerType =
  | 'schools'
  | 'hospitals'
  | 'police'
  | 'fire_stations'
  | 'risk_zones'
  | 'burned_areas'
  | 'geology'
  | 'natural_areas'
  | 'natural_regions'
  | 'soil_map';

export interface LayerConfig {
  id: LayerType;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  wfsLayer?: string;
  overpassQuery?: string;
}

export interface LayerFeature {
  id: string;
  name: string;
  type: LayerType;
  coordinates: [number, number];
  polygon?: [number, number][];
  properties: Record<string, unknown>;
}

export const LAYER_CONFIGS: LayerConfig[] = [
  {
    id: 'schools',
    name: 'Escuelas',
    icon: '🏫',
    color: '#3498db',
    enabled: true,
    wfsLayer: 'idecor:establecimientos_educativos'
  },
  {
    id: 'hospitals',
    name: 'Centros de Salud',
    icon: '🏥',
    color: '#e74c3c',
    enabled: false,
    wfsLayer: 'idecor:Centros_Salud'
  },
  {
    id: 'police',
    name: 'Comisarías',
    icon: '👮',
    color: '#2c3e50',
    enabled: false,
    overpassQuery: 'node["amenity"="police"]({{bbox}});way["amenity"="police"]({{bbox}});'
  },
  {
    id: 'fire_stations',
    name: 'Bomberos',
    icon: '🚒',
    color: '#e67e22',
    enabled: false,
    wfsLayer: 'idecor:cuarteles_bbvv'
  },
  {
    id: 'risk_zones',
    name: 'Zonas de Riesgo',
    icon: '⚠️',
    color: '#9b59b6',
    enabled: false,
    wfsLayer: 'idecor:zonas_riesgo_cuarteles'
  },
  {
    id: 'burned_areas',
    name: 'Áreas Quemadas 2024',
    icon: '🔥',
    color: '#c0392b',
    enabled: false,
    wfsLayer: 'idecor:area_quemada_2024'
  },
  {
    id: 'geology',
    name: 'Mapa Geológico',
    icon: '🪨',
    color: '#795548',
    enabled: false,
    wfsLayer: 'idecor:litologia_geol'
  },
  {
    id: 'natural_areas',
    name: 'Áreas Naturales Protegidas',
    icon: '🌿',
    color: '#27ae60',
    enabled: false,
    wfsLayer: 'idecor:areas_naturales_provinciales'
  },
  {
    id: 'natural_regions',
    name: 'Regiones Naturales',
    icon: '🏞️',
    color: '#16a085',
    enabled: false,
    wfsLayer: 'idecor:regiones_naturales'
  },
  {
    id: 'soil_map',
    name: 'Carta de Suelos',
    icon: '🗺️',
    color: '#8d6e63',
    enabled: false,
    wfsLayer: 'idecor:carta_suelo_500mil_2024'
  }
];
