import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { Subject, takeUntil } from 'rxjs';
import * as L from 'leaflet';
import { HybridSchoolService } from '../../core/services/hybrid-school.service';
import { IdecorLayersService } from '../../core/services/idecor-layers.service';
import { OverpassService } from '../../core/services/overpass.service';
import { BufferAnalysisService, BufferConfig } from '../../core/services/buffer-analysis.service';
import { School } from '../../core/models/school.model';
import { LayerType, LayerFeature, LAYER_CONFIGS, LayerConfig } from '../../core/models/layer.model';
import { BufferAnalysisResult } from '../../core/models/buffer-zone.model';
import { StatisticsPanelComponent } from '../statistics-panel/statistics-panel.component';
import {
  MAP_CONFIG,
  TILE_LAYERS,
  POLYGON_STYLE_DETECTED,
  POLYGON_STYLE_HOVER,
  POLYGON_STYLE_HYBRID,
  POLYGON_STYLE_OSM
} from '../../shared/config/map.config';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, LeafletModule, StatisticsPanelComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  private readonly hybridService = inject(HybridSchoolService);
  private readonly idecorLayersService = inject(IdecorLayersService);
  private readonly overpassService = inject(OverpassService);
  private readonly bufferAnalysisService = inject(BufferAnalysisService);
  private readonly destroy$ = new Subject<void>();
  private readonly polygonMap = new Map<string, L.Polygon>();

  map!: L.Map;
  polygonsLayer = L.layerGroup();
  markersLayer = L.layerGroup();
  additionalPolygonsLayer = L.layerGroup();
  bufferZonesLayer = L.layerGroup();

  schools: School[] = [];
  layerFeatures = new Map<LayerType, LayerFeature[]>();
  layerConfigs: LayerConfig[] = [...LAYER_CONFIGS];

  showSchools = true;
  isLoading = false;
  loadingMessage = '';
  errorMessage = '';

  bufferAnalysisResult: BufferAnalysisResult | null = null;
  showStatisticsPanel = false;
  isBufferMode = false;
  bufferCenter: [number, number] | null = null;
  highlightedZoneId: number | null = null;

  // Configuración dinámica del buffer
  bufferTotalRadius = 5;  // Radio total en km (1-20)
  bufferZoneWidth = 1;    // Ancho de cada zona en km (0.5-5)
  get bufferConfig(): BufferConfig {
    return {
      totalRadius: this.bufferTotalRadius,
      zoneWidth: this.bufferZoneWidth
    };
  }
  get numberOfZones(): number {
    return Math.ceil(this.bufferTotalRadius / this.bufferZoneWidth);
  }

  options: L.MapOptions = {
    layers: [TILE_LAYERS.satellite],
    zoom: MAP_CONFIG.zoom.default,
    center: L.latLng(MAP_CONFIG.center.lat, MAP_CONFIG.center.lng),
    minZoom: MAP_CONFIG.zoom.min,
    maxZoom: MAP_CONFIG.zoom.max
  };

  ngOnInit(): void {
    this.fixLeafletIcons();
    this.loadSchools();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fixLeafletIcons(): void {
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.polygonsLayer.addTo(map);
    this.additionalPolygonsLayer.addTo(map);
    this.markersLayer.addTo(map);
    this.bufferZonesLayer.addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.isBufferMode) {
        this.createBufferAnalysis([e.latlng.lat, e.latlng.lng]);
      }
    });
  }

  loadSchools(): void {
    this.isLoading = true;
    this.loadingMessage = 'Cargando datos oficiales de IDECOR y polígonos de OpenStreetMap...';
    this.errorMessage = '';

    this.hybridService.getSchoolsCombined()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (schools) => {
          this.schools = schools;
          this.isLoading = false;

          if (schools.length === 0) {
            this.errorMessage = 'No se encontraron escuelas';
          } else if (this.showSchools) {
            this.updatePolygons();
          }
        },
        error: (error) => {
          console.error('Error loading schools:', error);
          this.isLoading = false;
          this.errorMessage = 'Error al cargar las escuelas';
        }
      });
  }

  toggleLayer(layerConfig: LayerConfig): void {
    layerConfig.enabled = !layerConfig.enabled;

    if (layerConfig.id === 'schools') {
      this.toggleSchools(layerConfig.enabled);
    } else {
      this.loadAdditionalLayer(layerConfig);
    }
  }

  private loadAdditionalLayer(layerConfig: LayerConfig): void {
    if (!layerConfig.enabled) {
      this.removeLayerMarkers(layerConfig.id);
      return;
    }

    this.isLoading = true;
    this.loadingMessage = `Cargando ${layerConfig.name}...`;

    // Usar Overpass para comisarías ya que no está disponible en IDECOR
    if (layerConfig.id === 'police') {
      this.overpassService.getAmenities('police', 'police')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (features) => {
            this.layerFeatures.set(layerConfig.id, features);
            this.addLayerElements(features, layerConfig);
            this.isLoading = false;

            if (this.bufferCenter) {
              this.updateBufferAnalysis();
            }
          },
          error: (error) => {
            console.error(`Error loading ${layerConfig.name} from Overpass:`, error);
            this.isLoading = false;
            layerConfig.enabled = false;
          }
        });
      return;
    }

    // Usar IDECOR para el resto de capas
    this.idecorLayersService.getLayerFeatures(layerConfig.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (features) => {
          this.layerFeatures.set(layerConfig.id, features);
          this.addLayerElements(features, layerConfig);
          this.isLoading = false;

          if (this.bufferCenter) {
            this.updateBufferAnalysis();
          }
        },
        error: (error) => {
          console.error(`Error loading ${layerConfig.name}:`, error);
          this.isLoading = false;
          layerConfig.enabled = false;
        }
      });
  }

  // Capas que se renderizan como polígonos (áreas)
  private readonly polygonLayers: LayerType[] = [
    'risk_zones', 'burned_areas', 'geology', 'natural_areas', 'natural_regions', 'soil_map'
  ];

  private addLayerElements(features: LayerFeature[], config: LayerConfig): void {
    const isPolygonLayer = this.polygonLayers.includes(config.id);

    features.forEach(feature => {
      // Si tiene polígono y es una capa de áreas, dibujar polígono
      if (feature.polygon && isPolygonLayer) {
        const latLngs = feature.polygon.map(coord => L.latLng(coord[0], coord[1]));
        const polygon = L.polygon(latLngs, {
          color: config.color,
          fillColor: config.color,
          fillOpacity: 0.3,
          weight: 2
        });

        polygon.bindPopup(this.createFeaturePopup(feature, config));
        this.additionalPolygonsLayer.addLayer(polygon);
      } else {
        // Para el resto, dibujar marcador circular
        const marker = L.circleMarker(
          L.latLng(feature.coordinates[0], feature.coordinates[1]),
          {
            radius: 8,
            fillColor: config.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }
        );

        marker.bindPopup(this.createFeaturePopup(feature, config));
        this.markersLayer.addLayer(marker);
      }
    });
  }

  private createFeaturePopup(feature: LayerFeature, config: LayerConfig): string {
    let content = `
      <div class="feature-popup">
        <h3>${config.icon} ${feature.name}</h3>
        <p><strong>Tipo:</strong> ${config.name}</p>
    `;

    // Agregar propiedades específicas según el tipo de capa
    const props = feature.properties;
    if (props) {
      if (config.id === 'risk_zones' && props['zona_riesgo']) {
        content += `<p><strong>Zona:</strong> ${props['zona_riesgo']}</p>`;
      }
      if (config.id === 'geology' && props['litologia']) {
        content += `<p><strong>Litología:</strong> ${props['litologia']}</p>`;
      }
      if (config.id === 'natural_regions' && props['region']) {
        content += `<p><strong>Región:</strong> ${props['region']}</p>`;
      }
      if (config.id === 'burned_areas') {
        if (props['fecha']) content += `<p><strong>Fecha:</strong> ${props['fecha']}</p>`;
        if (props['superficie']) content += `<p><strong>Superficie:</strong> ${props['superficie']} ha</p>`;
      }
      if (config.id === 'natural_areas') {
        if (props['categoria']) content += `<p><strong>Categoría:</strong> ${props['categoria']}</p>`;
        if (props['superficie']) content += `<p><strong>Superficie:</strong> ${props['superficie']} ha</p>`;
      }
      if (config.id === 'soil_map' && props['tipo_suelo']) {
        content += `<p><strong>Tipo de suelo:</strong> ${props['tipo_suelo']}</p>`;
      }
    }

    content += '</div>';
    return content;
  }

  private removeLayerMarkers(layerType: LayerType): void {
    this.layerFeatures.delete(layerType);

    // Limpiar ambas capas y redibujar
    this.markersLayer.clearLayers();
    this.additionalPolygonsLayer.clearLayers();

    this.layerFeatures.forEach((features, type) => {
      const config = this.layerConfigs.find(c => c.id === type);
      if (config) {
        this.addLayerElements(features, config);
      }
    });
  }

  toggleSchools(show: boolean): void {
    this.showSchools = show;
    const schoolConfig = this.layerConfigs.find(c => c.id === 'schools');
    if (schoolConfig) {
      schoolConfig.enabled = show;
    }

    if (show) {
      this.updatePolygons();
    } else {
      this.clearPolygons();
    }
  }

  toggleBufferMode(): void {
    this.isBufferMode = !this.isBufferMode;

    if (!this.isBufferMode) {
      this.clearBufferAnalysis();
    }
  }

  private createBufferAnalysis(center: [number, number]): void {
    this.bufferCenter = center;
    this.loadAllEnabledLayersForAnalysis();
  }

  private loadAllEnabledLayersForAnalysis(): void {
    const enabledLayerTypes = this.layerConfigs
      .filter(c => c.enabled && c.id !== 'schools')
      .map(c => c.id);

    if (enabledLayerTypes.length === 0) {
      this.performBufferAnalysis();
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Cargando capas para análisis...';

    this.idecorLayersService.getAllLayers(enabledLayerTypes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (layerMap) => {
          layerMap.forEach((features, type) => {
            this.layerFeatures.set(type, features);
          });
          this.isLoading = false;
          this.performBufferAnalysis();
        },
        error: (error) => {
          console.error('Error loading layers for analysis:', error);
          this.isLoading = false;
          this.performBufferAnalysis();
        }
      });
  }

  private performBufferAnalysis(): void {
    if (!this.bufferCenter) return;

    this.bufferAnalysisResult = this.bufferAnalysisService.analyzeBufferZones(
      this.bufferCenter,
      this.schools,
      this.layerFeatures,
      this.bufferConfig
    );

    this.drawBufferZones();
    this.showStatisticsPanel = true;
  }

  onBufferConfigChange(): void {
    if (this.bufferCenter) {
      this.performBufferAnalysis();
    }
  }

  private updateBufferAnalysis(): void {
    if (this.bufferCenter) {
      this.performBufferAnalysis();
    }
  }

  private drawBufferZones(): void {
    this.bufferZonesLayer.clearLayers();

    if (!this.bufferAnalysisResult) return;

    const centerMarker = L.marker(
      L.latLng(this.bufferAnalysisResult.centerPoint[0], this.bufferAnalysisResult.centerPoint[1]),
      {
        icon: L.divIcon({
          className: 'buffer-center-icon',
          html: '<div class="center-marker">📍</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        })
      }
    );
    this.bufferZonesLayer.addLayer(centerMarker);

    const sortedZones = [...this.bufferAnalysisResult.zones].sort(
      (a, b) => b.radiusKm - a.radiusKm
    );

    sortedZones.forEach(zone => {
      if (zone.polygon) {
        const geoJsonLayer = L.geoJSON(zone.polygon, {
          style: {
            color: zone.color,
            fillColor: zone.color,
            fillOpacity: zone.fillOpacity,
            weight: 2,
            dashArray: zone.riskLevel === 'high' ? undefined : '5, 5'
          }
        });

        geoJsonLayer.bindTooltip(
          `Zona ${zone.id}: ${zone.radiusKm}km - ${this.getRiskLabel(zone.riskLevel)}`,
          { permanent: false, direction: 'center' }
        );

        this.bufferZonesLayer.addLayer(geoJsonLayer);
      }
    });
  }

  private getRiskLabel(riskLevel: string): string {
    const labels: Record<string, string> = {
      high: 'Alto Riesgo',
      medium: 'Riesgo Medio',
      low: 'Riesgo Bajo'
    };
    return labels[riskLevel] || riskLevel;
  }

  clearBufferAnalysis(): void {
    this.bufferZonesLayer.clearLayers();
    this.bufferAnalysisResult = null;
    this.showStatisticsPanel = false;
    this.bufferCenter = null;
    this.isBufferMode = false;
  }

  onStatisticsPanelClose(): void {
    this.showStatisticsPanel = false;
  }

  onZoneHover(zoneId: number | null): void {
    this.highlightedZoneId = zoneId;
  }

  private updatePolygons(): void {
    this.clearPolygons();

    this.schools.forEach(school => {
      if (school.polygon) {
        const polygon = this.createSchoolPolygon(school);
        this.polygonMap.set(school.id, polygon);
        this.polygonsLayer.addLayer(polygon);
      }
    });
  }

  private createSchoolPolygon(school: School): L.Polygon {
    const latLngs = school.polygon.coordinates.map(
      coord => L.latLng(coord[0], coord[1])
    );

    let style: L.PathOptions;
    switch (school.additionalData?.source) {
      case 'hybrid':
        style = { ...POLYGON_STYLE_HYBRID };
        break;
      case 'osm':
        style = { ...POLYGON_STYLE_OSM };
        break;
      default:
        style = { ...POLYGON_STYLE_DETECTED };
    }

    const polygon = L.polygon(latLngs, style);
    const originalStyle = { ...style };

    polygon.bindPopup(this.createPopupContent(school));

    polygon.on('mouseover', () => {
      polygon.setStyle({ ...originalStyle, ...POLYGON_STYLE_HOVER });
    });

    polygon.on('mouseout', () => {
      polygon.setStyle(originalStyle);
    });

    polygon.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.isBufferMode) {
        this.onSchoolClick(school);
      } else {
        L.DomEvent.stopPropagation(e);
        const center = this.getSchoolCenter(school);
        this.createBufferAnalysis(center);
      }
    });

    return polygon;
  }

  private getSchoolCenter(school: School): [number, number] {
    const coords = school.polygon.coordinates;
    const sumLat = coords.reduce((sum, c) => sum + c[0], 0);
    const sumLng = coords.reduce((sum, c) => sum + c[1], 0);
    return [sumLat / coords.length, sumLng / coords.length];
  }

  private clearPolygons(): void {
    this.polygonsLayer.clearLayers();
    this.polygonMap.clear();
  }

  private createPopupContent(school: School): string {
    const data = school.additionalData;
    let sourceClass = 'idecor';
    let sourceLabel = 'IDECOR';

    if (data?.source === 'hybrid') {
      sourceClass = 'hybrid';
      sourceLabel = 'Híbrido (IDECOR + OSM)';
    } else if (data?.source === 'osm') {
      sourceClass = 'osm';
      sourceLabel = 'OpenStreetMap';
    }

    let content = `
      <div class="school-popup">
        <h3>${school.name}</h3>
        <span class="source-badge ${sourceClass}">${sourceLabel}</span>
        <p><strong>Dirección:</strong> ${school.address}</p>
    `;

    if (school.contactInfo.phone) {
      content += `<p><strong>Teléfono:</strong> ${school.contactInfo.phone}</p>`;
    }

    if (school.contactInfo.email) {
      content += `<p><strong>Email:</strong> ${school.contactInfo.email}</p>`;
    }

    if (school.contactInfo.website) {
      content += `<p><strong>Web:</strong> <a href="${school.contactInfo.website}" target="_blank">${school.contactInfo.website}</a></p>`;
    }

    if (data?.nivel) {
      content += `<p><strong>Nivel:</strong> ${data.nivel}</p>`;
    }

    if (data?.sector) {
      content += `<p><strong>Sector:</strong> ${data.sector}</p>`;
    }

    if (data?.ambito) {
      content += `<p><strong>Ámbito:</strong> ${data.ambito}</p>`;
    }

    if (data?.cue) {
      content += `<p><strong>CUE:</strong> ${data.cue}</p>`;
    }

    content += '</div>';
    return content;
  }

  private onSchoolClick(school: School): void {
    console.log('Escuela clickeada:', school);
  }
}
