export class Brand {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null = null,
    public isActive: boolean = true
  ) {}

  deactivate() {
    this.isActive = false;
  }
}
