import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RecsService, RecDetail } from '../../core/recs.service';
import { firstValueFrom } from 'rxjs';

type ViewOpt = { nombre: string; sku?: string | null; precio?: number | string | null; };
type ViewRec = {
  id: number;
  clienteNombre: string;
  telefono: string;
  correo: string;
  mensaje: string;
  opciones: ViewOpt[];
  proximaAccion: string | null;
};

@Component({
  standalone: true,
  selector: 'app-recs-detail',
  imports: [CommonModule, RouterModule],
  templateUrl: './recs-detail.html',
})
export class RecsDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api   = inject(RecsService);

  loading = signal<boolean>(false);
  rec = signal<ViewRec | null>(null);

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) return;
    await this.load(id);
  }

  private map(d: RecDetail): ViewRec {
    const nombre = [d?.clientes?.nombre, d?.clientes?.apellido].filter(Boolean).join(' ').trim() || 'Cliente';
    const tel    = (d?.clientes?.telefono || '—').toString().trim();
    const mail   = (d?.clientes?.email || '—').toString().trim();
    const opts: ViewOpt[] = (d?.recomendaciones_detalle || [])
      .slice(0, 3)
      .map(x => ({ nombre: x?.productos?.nombre || '—', sku: x?.productos?.sku ?? null, precio: x?.productos?.precioventa ?? null }));
    return {
      id: Number(d?.idrecomendacion),
      clienteNombre: nombre,
      telefono: tel || '—',
      correo: mail || '—',
      mensaje: d?.justificacion || 'Tengo unas recomendaciones para vos.',
      opciones: opts,
      proximaAccion: d?.next_action_at ?? null,
    };
  }

  private async load(id: number) {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.get(id));
      this.rec.set(this.map(resp.rec));
    } catch (e) {
      console.error('[RECS detail] error', e);
      this.rec.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  back() { this.router.navigate(['/recs']); }

  async posponer(days: number) {
    const r = this.rec(); if (!r) return;
    try {
      await firstValueFrom(this.api.defer(r.id, days));
      await this.load(r.id);
    } catch { alert('No se pudo posponer.'); }
  }

  async descartar() {
    const r = this.rec(); if (!r) return;
    if (!confirm(`Descartar recomendación #${r.id}?`)) return;
    try {
      await firstValueFrom(this.api.discard(r.id));
      this.back();
    } catch { alert('No se pudo descartar.'); }
  }

  waLink(): string {
    const r = this.rec(); if (!r) return 'javascript:void(0)';
    const digits = (r.telefono || '').replace(/\D+/g, '');
    if (!digits) return 'javascript:void(0)';
    const number = digits.startsWith('502') ? digits : `502${digits}`;
    const labels = ['Opción 1', 'Opción 2', 'Plus'];
    const chips  = r.opciones.map((o, i) => `${labels[i] || 'Opción'}: ${o.nombre}`).join(' · ');
    const text   = `¡Hola ${r.clienteNombre}!%0A${r.mensaje}%0A%0ASugerencias: ${chips}`;
    return `https://wa.me/${number}?text=${text}`;
  }

  labelProx(iso: string | null): string {
    if (!iso) return '—';
    const now = new Date();
    const dt  = new Date(iso);
    const d   = Math.round((dt.getTime() - now.getTime()) / 86400000);
    if (d === 0) return 'hoy';
    if (d === 1) return 'en 1 día';
    if (d < 0)   return `en ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'}`;
    return `en ${d} días`;
  }
}
