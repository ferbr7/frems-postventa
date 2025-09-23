import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UsersService, UsuarioDTO } from '../../core/users.service';

@Component({
  standalone: true,
  selector: 'app-usuarios-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './usuarios-list.html',
})
export class UsuariosListComponent {
  items = signal<UsuarioDTO[]>([]);
  total = signal(0);
  page  = signal(1);
  limit = signal(10);
  search = signal('');

  constructor(private api: UsersService) {
    effect(() => { this.load(); });
  }

  load() {
    this.api.list({ page: this.page(), limit: this.limit(), search: this.search() })
      .subscribe(res => {
        if (res.ok) { this.items.set(res.items); this.total.set(res.total); }
      });
  }

  onSearch(v: string) { this.search.set(v); this.page.set(1); }
  next() { if (this.page() * this.limit() < this.total()) this.page.update(p => p + 1); }
  prev() { if (this.page() > 1) this.page.update(p => p - 1); }
}
