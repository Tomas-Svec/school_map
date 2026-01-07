import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BufferAnalysisResult,
  BufferZoneStats,
  RISK_LEVEL_LABELS
} from '../../core/models/buffer-zone.model';

@Component({
  selector: 'app-statistics-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics-panel.component.html',
  styleUrl: './statistics-panel.component.scss'
})
export class StatisticsPanelComponent {
  @Input() analysisResult: BufferAnalysisResult | null = null;
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() zoneHover = new EventEmitter<number | null>();

  readonly riskLabels = RISK_LEVEL_LABELS;

  onClose(): void {
    this.close.emit();
  }

  onZoneMouseEnter(zoneId: number): void {
    this.zoneHover.emit(zoneId);
  }

  onZoneMouseLeave(): void {
    this.zoneHover.emit(null);
  }

  getRiskClass(stats: BufferZoneStats): string {
    return `risk-${stats.riskLevel}`;
  }

  getTotalInAllZones(): number {
    if (!this.analysisResult) return 0;
    return this.analysisResult.statistics.reduce((sum, s) => sum + s.total, 0);
  }

  getZoneRange(stats: BufferZoneStats, index: number): string {
    const prevRadius = index > 0 ? this.analysisResult!.statistics[index - 1].radiusKm : 0;
    return `${prevRadius}-${stats.radiusKm} km`;
  }
}
