import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';

function strongPassword(ctrl: AbstractControl): ValidationErrors | null {
  const v = String(ctrl.value || '');
  if (!v) return { required: true };
  const hasLen = v.length >= 8;
  const hasUpper = /[A-Z]/.test(v);
  const hasLower = /[a-z]/.test(v);
  const hasDigit = /\d/.test(v);
  const hasSym = /[^A-Za-z0-9]/.test(v);
  return hasLen && hasUpper && hasLower && hasDigit && hasSym ? null : { weak: true };
}

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

  // modo primer login: no se usa código ni email
  readonly firstLoginMode = this.route.snapshot.queryParamMap.get('first') === '1';
  showCode = !this.firstLoginMode;

  email =
    this.route.snapshot.queryParamMap.get('email') ||
    (typeof history.state?.email === 'string' ? history.state.email : '');

  isLoading = false;

  form: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    nuevaContrasena: ['', [strongPassword]],
    confirmarContrasena: ['', [Validators.required]],
  });

  get codigo() { return this.form.get('codigo'); }
  get nuevaContrasena() { return this.form.get('nuevaContrasena'); }
  get confirmarContrasena() { return this.form.get('confirmarContrasena'); }

  constructor() {
    // Ajusta validadores si es primer login (sin código)
    if (this.firstLoginMode) {
      this.codigo?.clearValidators();
      this.codigo?.setValue('');
      this.codigo?.disable({ emitEvent: false });
      this.codigo?.updateValueAndValidity({ emitEvent: false });
    }
  }

  restablecer() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.nuevaContrasena?.value !== this.confirmarContrasena?.value) {
      this.confirmarContrasena?.setErrors({ mismatch: true }); return;
    }

    const pwd = String(this.nuevaContrasena?.value || '');

    // Primer login: cambia contraseña autenticado, sin código ni email
    if (this.firstLoginMode) {
      this.isLoading = true;
      this.auth.changePassword(this.email,pwd)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: () => { alert('Contraseña actualizada'); this.router.navigate(['/home']); },
          error: (e) => { alert(e?.error?.message || 'No se pudo actualizar la contraseña'); }
        });
      return;
    }

    // Flujo normal con código
    if (!this.email) { alert('Falta el correo. Vuelve a solicitar el código.'); return; }
    const code = String(this.codigo?.value || '').trim();

    this.isLoading = true;
    this.auth.reset(this.email, code, pwd)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => { alert('Contraseña actualizada con éxito'); this.router.navigate(['/login']); },
        error: (e) => { this.codigo?.setErrors({ invalid: true }); alert(e?.error?.message || 'Código inválido o vencido'); }
      });
  }

  backToLogin() { this.router.navigate(['/login']); }
}
