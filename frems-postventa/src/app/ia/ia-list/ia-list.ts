import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IaService, IARec, Prox } from '../ia.service';

@Component({
  selector: 'app-ia-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ia-list.html',
})
export class IaListComponent {
  recs: IARec[] = [];

  constructor(private ia: IaService) {
    this.recs = this.ia.list();
  }

  trackById = (_: number, r: IARec) => r.id;

  waLink(r: IARec) {
    return this.ia.waLink(r);
  }

  snooze(id: string, when: Prox) {
    this.ia.snooze(id, when);
    this.recs = this.ia.list();
  }

  discard(id: string) {
    this.ia.discard(id);
    this.recs = this.ia.list();
  }

  labelProx(code: Prox): string {
    switch (code) {
      case '1d': return 'en 1 día';
      case '3d': return 'en 3 días';
      case '7d': return 'en 7 días';
      default:   return 'hoy';
    }
  }
}
