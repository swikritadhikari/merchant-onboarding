import { Injectable } from '@nestjs/common';

@Injectable()
export class ShutdownStateService {
  private shuttingDown = false;

  public get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  public begin(): void {
    this.shuttingDown = true;
  }
}
