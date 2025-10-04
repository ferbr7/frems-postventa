import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecsDetail } from './recs-detail';

describe('RecsDetail', () => {
  let component: RecsDetail;
  let fixture: ComponentFixture<RecsDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecsDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecsDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
