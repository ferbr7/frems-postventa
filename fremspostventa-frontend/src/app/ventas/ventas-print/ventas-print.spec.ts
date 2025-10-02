import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentasPrint } from './ventas-print';

describe('VentasPrint', () => {
  let component: VentasPrint;
  let fixture: ComponentFixture<VentasPrint>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentasPrint]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentasPrint);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
