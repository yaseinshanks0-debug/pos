export class Category {
  constructor(
    public readonly id: string,
    public name: string,
    public parentId: string | null = null,
    public description: string | null = null,
    public isActive: boolean = true
  ) {}

  deactivate() {
    this.isActive = false;
  }
}
