import { ChangeDetectorRef, Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
})
export class LoginComponent {

  private cdr  = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  currentYear = new Date().getFullYear();
  showPassword = false;


  loginForm: FormGroup;


  errorMsg = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      userOrEmail: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false],
    });
  }


  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  showErrorModal = false;
  errorTitle = 'No pudimos iniciar sesión';
  errorMessage = 'Revisa tus credenciales e intenta de nuevo.';

  // Cierra modal y limpia password
  closeErrorModal() {
    this.showErrorModal = false;
    this.loginForm.get('password')?.reset();
  }

  // Opcional: cerrar con ESC
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.showErrorModal) this.closeErrorModal();
  }

  onSubmit() {
  if (this.loginForm.invalid) return;

  const { userOrEmail, password } = this.loginForm.getRawValue()!;
  this.loading = true;
  this.errorMsg = '';

  this.auth.login(userOrEmail!, password!)
    .subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        if (err?.status === 412 || err?.status === 402 || err?.error?.code === 'MUST_CHANGE_PASSWORD') {
          const email = err?.error?.email || userOrEmail!;
          this.router.navigate(
            ['/reset-password'],
            { queryParams: { first: '1', email } }
          );
          return;
        }

        this.errorTitle = 'No pudimos iniciar sesión';
        if (err?.status === 401) {
          this.errorMessage = 'Usuario o contraseña incorrectos.';
        } else if (err?.status === 429) {
          this.errorMessage = 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
        } else {
          this.errorMessage = err?.error?.message || 'Ocurrió un error inesperado.';
        }

        // 🔑 Forzar render inmediato del modal
        this.zone.run(() => {
          this.showErrorModal = true;
          this.cdr.detectChanges();
        });
      }
    })
    .add(() => {
      this.loading = false;
      // 🔑 Asegura que se pinte el nuevo estado del loading/modal
      this.cdr.detectChanges();
    });
}
}
