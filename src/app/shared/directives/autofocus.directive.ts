import type { AfterViewInit } from '@angular/core';
import { Directive, ElementRef, inject, input } from '@angular/core';

@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective implements AfterViewInit {
  readonly appAutofocus = input(true, { transform: (v: boolean | '') => v !== false });

  private readonly host = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    if (this.appAutofocus()) {
      setTimeout(() => this.host.nativeElement.focus());
    }
  }
}
