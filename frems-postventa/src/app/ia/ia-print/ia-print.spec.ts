import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaPrint } from './ia-print';

describe('IaPrint', () => {
  let component: IaPrint;
  let fixture: ComponentFixture<IaPrint>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaPrint]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaPrint);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
