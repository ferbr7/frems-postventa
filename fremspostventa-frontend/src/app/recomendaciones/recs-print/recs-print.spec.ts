import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecsPrint } from './recs-print';

describe('RecsPrint', () => {
  let component: RecsPrint;
  let fixture: ComponentFixture<RecsPrint>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecsPrint]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecsPrint);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
