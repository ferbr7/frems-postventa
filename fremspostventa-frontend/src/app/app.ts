import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('frems-postventa');

  private auth = inject(AuthService);
  bootLoading = signal(false); // opcional: splash mientras rehidrata

  ngOnInit(): void {
    // Si hay token pero aún no tenemos el usuario en memoria → rehidratar /me
    if (this.auth.isLoggedIn && !this.auth.user) {
      this.bootLoading.set(true);
      this.auth.me().subscribe({
        next: () => this.bootLoading.set(false),
        error: () => this.bootLoading.set(false),
      });
    }
  }
}