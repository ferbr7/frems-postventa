import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recuperar-reset.html'
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  email =
    this.route.snapshot.queryParamMap.get('email') ||
    (typeof history.state?.email === 'string' ? history.state.email : '');

  isLoading = false;

  form: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    nuevaContrasena: ['', [Validators.required, Validators.minLength(8)]],
    confirmarContrasena: ['', [Validators.required]],
  });

  get codigo() { return this.form.get('codigo'); }
  get nuevaContrasena() { return this.form.get('nuevaContrasena'); }
  get confirmarContrasena() { return this.form.get('confirmarContrasena'); }

  restablecer() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.nuevaContrasena?.value !== this.confirmarContrasena?.value) {
      this.confirmarContrasena?.setErrors({ mismatch: true }); return;
    }
    if (!this.email) { alert('Falta el correo. Vuelve a solicitar el código.'); return; }

    const code = String(this.codigo?.value || '').trim();
    const pwd = String(this.nuevaContrasena?.value || '');

    this.isLoading = true;
    this.auth.reset(this.email, code, pwd).pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => { alert('Contraseña actualizada con éxito'); this.router.navigate(['/login']); },
        error: (e) => { this.codigo?.setErrors({ invalid: true }); alert(e?.error?.message || 'Código inválido o vencido'); }
      });
  }

  backToLogin() { this.router.navigate(['/login']); }
}
