import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Cliente = {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  ultimaCompra: string;
  compras: number;
};

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clientes.html',
})
export class ClientesComponent {
  // ---- Datos demo
  clientes: Cliente[] = [
    { id: 1, nombre: 'Karla Núñez',  correo: 'karla@ejemplo.com',      telefono: '55 2233 4455', ultimaCompra: '09/2025', compras: 12 },
    { id: 2, nombre: 'Luis Martínez',correo: 'lmartinez@ejemplo.com',  telefono: '55 8790 1122', ultimaCompra: '09/2025', compras: 1  },
    { id: 3, nombre: 'María López',  correo: 'maria@ejemplo.com',      telefono: '55 1234 5678', ultimaCompra: '08/2025', compras: 6  },
    { id: 4, nombre: 'Ana Gómez',    correo: 'ana.gomez@ejemplo.com',  telefono: '55 3344 5566', ultimaCompra: '08/2025', compras: 3  },
    { id: 5, nombre: 'Carlos Ruiz',  correo: 'carlosruiz@ejemplo.com', telefono: '55 7788 9900', ultimaCompra: '07/2025', compras: 0  },
    // agrega más para probar paginación si gustas
  ];

  // ---- Búsqueda
  busqueda = '';
  onSearchChange() { this.page.set(1); }

  // ---- Paginación (signals)
  page = signal(1);
  pageSize = signal(10);
  pageSizeOptions = [5, 10, 25, 50];

  // Propiedad puente para ngModel del select (no bindear directamente a signal)
  pageSizeValue = this.pageSize();

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.pageSizeValue = size;
    this.page.set(1);
  }

  // ---- Filtro por búsqueda
  readonly filtrados = computed(() => {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.clientes;
    return this.clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.correo.toLowerCase().includes(q) ||
      c.telefono.toLowerCase().includes(q)
    );
  });

  // ---- Totales
  readonly total = computed(() => this.filtrados().length);
  readonly totalConCompras = computed(() =>
    this.filtrados().filter(c => c.compras > 0).length
  );

  // ---- Paginados
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );

  readonly paginados = computed(() => {
    const p = this.page();
    const size = this.pageSize();
    const startIdx = (p - 1) * size;
    return this.filtrados().slice(startIdx, startIdx + size);
  });

  readonly showingFrom = computed(() => {
    if (this.total() === 0) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });

  readonly showingTo = computed(() =>
    Math.min(this.total(), this.page() * this.pageSize())
  );

  // ---- Acciones (enlaza con tus drawers / rutas)
  verDetalle(c: Cliente) {
    console.log('Ver', c);
    // abre drawer o navega
  }

  abrirIA(c: Cliente) {
    console.log('IA', c);
    // abre drawer IA
  }

  // ---- Controles de paginación
  prevPage() {
    if (this.page() > 1) this.page.update(p => p - 1);
  }
  nextPage() {
    if (this.page() < this.totalPages()) this.page.update(p => p + 1);
  }
  goTo(n: number) {
    if (n >= 1 && n <= this.totalPages()) this.page.set(n);
  }
  
}
