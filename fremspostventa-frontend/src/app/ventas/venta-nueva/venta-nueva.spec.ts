import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentaNueva } from './venta-nueva';

describe('VentaNueva', () => {
  let component: VentaNueva;
  let fixture: ComponentFixture<VentaNueva>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentaNueva]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentaNueva);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
