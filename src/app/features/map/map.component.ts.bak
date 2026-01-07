import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { Subject, takeUntil } from 'rxjs';
import * as L from 'leaflet';
import { HybridSchoolService } from '../../core/services/hybrid-school.service';
import { School } from '../../core/models/school.model';
import {
  MAP_CONFIG,
  TILE_LAYERS,
  POLYGON_STYLE_DEFAULT,
  POLYGON_STYLE_DETECTED,
  POLYGON_STYLE_HOVER,
  POLYGON_STYLE_HYBRID,
  POLYGON_STYLE_OSM
} from '../../shared/config/map.config';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, LeafletModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  private readonly hybridService = inject(HybridSchoolService);
  private readonly destroy$ = new Subject<void>();
  private readonly polygonMap = new Map<string, L.Polygon>();

  map!: L.Map;
  polygonsLayer = L.layerGroup();
  schools: School[] = [];
  showSchools = true;
  isLoading = false;
  loadingMessage = '';
  errorMessage = '';

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

  toggleSchools(show: boolean): void {
    this.showSchools = show;

    if (show) {
      this.updatePolygons();
    } else {
      this.clearPolygons();
    }
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

    polygon.on('click', () => {
      this.onSchoolClick(school);
    });

    return polygon;
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
