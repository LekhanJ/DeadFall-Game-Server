export const AmmoType = {
  Pistol: "pistol",
  Rifle: "rifle",
  Sniper: "sniper",
  Shotgun: "shotgun",
} as const;

export type AmmoType = typeof AmmoType[keyof typeof AmmoType];

export interface AmmoInventory {
  pistol: number;
  rifle: number;
  sniper: number;
  shotgun: number;
}

export class PlayerAmmoManager {
  private ammo: AmmoInventory;
  private maxAmmo: AmmoInventory;

  constructor() {
    this.ammo = {
      pistol: 60, // Starting ammo
      rifle: 30,
      sniper: 0,
      shotgun: 0,
    };

    this.maxAmmo = {
      pistol: 120,
      rifle: 90,
      sniper: 30,
      shotgun: 24,
    };
  }

  getAmmo(type: AmmoType): number {
    return this.ammo[type] || 0;
  }

  hasAmmo(type: AmmoType, amount: number = 1): boolean {
    return this.getAmmo(type) >= amount;
  }

  useAmmo(type: AmmoType, amount: number = 1): boolean {
    if (!this.hasAmmo(type, amount)) {
      return false;
    }

    this.ammo[type] -= amount;
    return true;
  }

  addAmmo(type: AmmoType, amount: number): boolean {
    const current = this.getAmmo(type);
    const max = this.maxAmmo[type];

    if (current >= max) {
      return false; // Already full
    }

    this.ammo[type] = Math.min(current + amount, max);
    return true;
  }

  setAmmo(type: AmmoType, amount: number): void {
    const max = this.maxAmmo[type];
    this.ammo[type] = Math.max(0, Math.min(amount, max));
  }

  getAllAmmo(): AmmoInventory {
    return { ...this.ammo };
  }

  serialize(): AmmoInventory {
    return this.getAllAmmo();
  }
}

// Helper function to convert weapon name to ammo type
export function getAmmoTypeForWeapon(weaponName: string): AmmoType | null {
  switch (weaponName) {
    case "Pistol":
    case "SMG":
      return AmmoType.Pistol;
    case "Rifle":
      return AmmoType.Rifle;
    case "Sniper":
      return AmmoType.Sniper;
    case "Shotgun":
      return AmmoType.Shotgun;
    default:
      return null;
  }
}