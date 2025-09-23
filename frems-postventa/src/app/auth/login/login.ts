import { Component } from '@angular/core';
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


  onSubmit() {
    if (this.loginForm.invalid) return;

    const { userOrEmail, password } = this.loginForm.getRawValue()!;
    this.loading = true;

    this.auth.login(userOrEmail!, password!)
      .subscribe({
        next: () => this.router.navigate(['/home']),
        error: err => this.errorMsg = err?.error?.message ?? 'Error de login',
      })
      .add(() => this.loading = false);
  }
}
