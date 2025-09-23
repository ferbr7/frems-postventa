import { Component, signal, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IaService, IARec } from '../ia.service';

@Component({
  selector: 'app-ia-print',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ia-print.html',
})
export class IaPrintComponent implements AfterViewInit {
  private route = inject(ActivatedRoute);
  private ia = inject(IaService);

  rec = signal<IARec | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const data = this.ia.get(id);
    if (data) this.rec.set(data);
  }

  ngAfterViewInit(): void {
    // Pequeño delay para asegurar render antes de imprimir
    setTimeout(() => window.print(), 300);
  }

  waLink(): string {
    const r = this.rec();
    return r ? this.ia.waLink(r) : '';
  }
}
