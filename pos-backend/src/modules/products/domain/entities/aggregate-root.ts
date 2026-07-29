export abstract class AggregateRoot {
  private _domainEvents: any[] = [];

  get domainEvents(): ReadonlyArray<any> {
    return this._domainEvents;
  }

  protected addDomainEvent(domainEvent: any): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}
