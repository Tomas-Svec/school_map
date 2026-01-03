import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { School } from '../models/school.model';
import { IdecorService } from './idecor.service';
import { OverpassService } from './overpass.service';

@Injectable({
  providedIn: 'root'
})
export class HybridSchoolService {
  private readonly idecorService = inject(IdecorService);
  private readonly overpassService = inject(OverpassService);

  getSchoolsCombined(): Observable<School[]> {
    return forkJoin({
      oficial: this.idecorService.getSchoolsInCordoba(),
      osm: this.overpassService.getSchoolsInCordoba()
    }).pipe(
      map(({ oficial, osm }) => this.mergeSchools(oficial, osm))
    );
  }

  private mergeSchools(oficiales: School[], osmSchools: School[]): School[] {
    const merged = oficiales.map(oficial => {
      const osmMatch = this.findNearestOSM(oficial, osmSchools);

      if (osmMatch && osmMatch.polygon.coordinates.length > 5) {
        return {
          ...oficial,
          polygon: osmMatch.polygon,
          additionalData: {
            ...oficial.additionalData,
            source: 'hybrid' as const
          }
        };
      }

      return oficial;
    });

    const oficialNames = new Set(
      oficiales.map(school => this.normalizeSchoolName(school.name))
    );

    const additionalOSM = osmSchools.filter(
      osm => !oficialNames.has(this.normalizeSchoolName(osm.name))
    );

    return [...merged, ...additionalOSM];
  }

  private findNearestOSM(oficial: School, osmSchools: School[]): School | null {
    const maxDistance = 0.002;
    const oficialCenter = this.getCenter(oficial.polygon.coordinates);

    for (const osm of osmSchools) {
      const osmCenter = this.getCenter(osm.polygon.coordinates);
      const distance = this.calculateDistance(oficialCenter, osmCenter);

      if (distance < maxDistance) {
        return osm;
      }
    }

    return null;
  }

  private getCenter(coords: [number, number][]): [number, number] {
    const sum = coords.reduce(
      (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0]
    );
    return [sum[0] / coords.length, sum[1] / coords.length];
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const dx = coord1[0] - coord2[0];
    const dy = coord1[1] - coord2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  private normalizeSchoolName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
}
