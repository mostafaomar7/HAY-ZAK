import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RejectionReasonCode } from '@core/models/admin.model';
import type { ReviewDecision } from '@core/models/admin.model';
import { AdminReasonModal } from './admin-reason-modal';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminReasonModal],
  template: `
    <app-admin-reason-modal
      open
      [queue]="queue()"
      [refundHalalas]="refund()"
      (confirmed)="decision.set($event)"
    />
  `,
})
class Host {
  readonly queue = signal<'listing' | 'booking'>('listing');
  readonly refund = signal<number | null>(null);
  readonly decision = signal<ReviewDecision | null>(null);
}

describe('AdminReasonModal', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const confirmButton = () =>
    fixture.debugElement
      .queryAll(By.css('button'))
      .find((element) => element.nativeElement.textContent.includes('تأكيد الرفض'))!
      .nativeElement as HTMLButtonElement;

  const radios = () =>
    fixture.debugElement.queryAll(By.css('input[type="radio"]')).map((d) => d.nativeElement);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('cannot confirm before a reason is chosen', () => {
    expect(confirmButton().disabled).toBeTrue();
  });

  it('confirms once a reason is chosen', () => {
    radios()[0].click();
    fixture.detectChanges();

    expect(confirmButton().disabled).toBeFalse();

    confirmButton().click();
    expect(host.decision()?.reasonCode).toBe(RejectionReasonCode.UnclearPhotos);
  });

  it('holds the confirmation until "another reason" carries its note', () => {
    const others = radios();
    others[others.length - 1].click();
    fixture.detectChanges();

    expect(confirmButton().disabled)
      .withContext('the label promises an explanation, so the form must ask for one')
      .toBeTrue();

    const note = fixture.debugElement.query(By.css('textarea'))
      .nativeElement as HTMLTextAreaElement;
    note.value = 'الوحدة تقع خارج نطاق التغطية.';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(confirmButton().disabled).toBeFalse();

    confirmButton().click();
    expect(host.decision()).toEqual({
      reasonCode: RejectionReasonCode.Other,
      note: 'الوحدة تقع خارج نطاق التغطية.',
    });
  });

  it('states the refund before the button on the booking queue', () => {
    host.queue.set('booking');
    // 525.00 SAR, in halalas.
    host.refund.set(52_500);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('استرداد كامل');
    expect(text).toContain('525.00');
  });

  it('says nothing about a refund on the listing queue', () => {
    expect(fixture.nativeElement.textContent as string).not.toContain('استرداد كامل');
  });
});
