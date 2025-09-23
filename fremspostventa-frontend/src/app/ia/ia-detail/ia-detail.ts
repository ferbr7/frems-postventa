import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { IaService, IARec, Prox } from '../ia.service';

@Component({
  selector: 'app-ia-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ia-detail.html',
})
export class IaDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ia = inject(IaService);

  rec = signal<IARec | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const data = this.ia.get(id);
    if (data) this.rec.set(data);
  }

  waLink() {
    const r = this.rec();
    return r ? this.ia.waLink(r) : '';
  }

  /** Wrappers con nombres del template */
  posponer(dias: 1 | 3 | 7) {
    const r = this.rec();
    if (!r) return;
    const map: Record<number, Prox> = { 1: '1d', 3: '3d', 7: '7d' };
    this.ia.snooze(r.id, map[dias]);
    this.rec.set({ ...r, proximaAccion: map[dias] });
  }

  descartar() {
    const r = this.rec();
    if (!r) return;
    this.ia.discard(r.id);
    this.router.navigate(['/ia']);
  }

  back() {
    this.router.navigate(['/ia']);
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
