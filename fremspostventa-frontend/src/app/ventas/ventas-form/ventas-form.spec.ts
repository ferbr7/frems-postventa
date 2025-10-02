import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentasForm } from './ventas-form';

describe('VentasForm', () => {
  let component: VentasForm;
  let fixture: ComponentFixture<VentasForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentasForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentasForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
