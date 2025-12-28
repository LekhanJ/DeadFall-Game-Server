import { PlayerAmmoManager, AmmoType } from "./ammoManager.ts";
import { Inventory, ItemType } from "./inventory.ts";
import { BulletType } from "../entities/bullet.ts";

export interface WeaponConfig {
  name: string;
  weaponType: WeaponType;
  ammoType: AmmoType;
  bulletType: BulletType;
  damage: number;
  fireRate: number; // seconds between shots
  magazineCapacity: number;
  reloadTime: number; // seconds
  bulletSpeed: number;
  bulletLifetime: number;
  pelletsPerShot?: number;
  spreadAngle?: number;
}

export const WeaponType = {
  Pistol: "Pistol",
  SMG: "SMG",
  Rifle: "Rifle",
  Sniper: "Sniper",
  Shotgun: "Shotgun",
} as const;

export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

export const WeaponConfigs: { [key: string]: WeaponConfig } = {
  Pistol: {
    name: "Pistol",
    weaponType: WeaponType.Pistol,
    ammoType: AmmoType.Pistol,
    bulletType: BulletType.Pistol,
    damage: 15,
    fireRate: 0.4,
    magazineCapacity: 12,
    reloadTime: 1.5,
    bulletSpeed: 0.5,
    bulletLifetime: 2000,
  },
  SMG: {
    name: "SMG",
    weaponType: WeaponType.SMG,
    ammoType: AmmoType.Pistol,
    bulletType: BulletType.Pistol,
    damage: 10,
    fireRate: 0.1,
    magazineCapacity: 30,
    reloadTime: 2.0,
    bulletSpeed: 0.55,
    bulletLifetime: 1800,
  },
  Rifle: {
    name: "Rifle",
    weaponType: WeaponType.Rifle,
    ammoType: AmmoType.Rifle,
    bulletType: BulletType.Rifle,
    damage: 25,
    fireRate: 0.2,
    magazineCapacity: 30,
    reloadTime: 2.5,
    bulletSpeed: 0.7,
    bulletLifetime: 2500,
  },
  Sniper: {
    name: "Sniper",
    weaponType: WeaponType.Sniper,
    ammoType: AmmoType.Sniper,
    bulletType: BulletType.Sniper,
    damage: 75,
    fireRate: 1.2,
    magazineCapacity: 5,
    reloadTime: 3.0,
    bulletSpeed: 1.2,
    bulletLifetime: 3000,
  },
  Shotgun: {
    name: "Shotgun",
    weaponType: WeaponType.Shotgun,
    ammoType: AmmoType.Shotgun,
    bulletType: BulletType.Shotgun,
    damage: 12,
    fireRate: 0.8,
    magazineCapacity: 8,
    reloadTime: 2.5,
    bulletSpeed: 0.45,
    bulletLifetime: 1500,
    pelletsPerShot: 8,
    spreadAngle: 15,
  },
};

interface WeaponState {
  currentAmmo: number;
  isReloading: boolean;
  canShoot: boolean;
  nextFireTime: number;
}

interface ShootResult {
  success: boolean;
  reason?: string;
  bullets?: Array<{ position: any; direction: any }>;
  bulletType?: BulletType;
  bulletSpeed?: number;
  bulletLifetime?: number;
  damage?: number;
}

interface ReloadResult {
  success: boolean;
  reason?: string;
  weaponName?: string;
  reloadTime?: number;
}

export class WeaponSystem {
  private ammoManager: PlayerAmmoManager;
  private inventory: Inventory;
  private weaponStates: Map<string, WeaponState>;
  private reloadTimer: number = 0;
  private currentReloadingWeapon: string | null = null;

  constructor(ammoManager: PlayerAmmoManager, inventory: Inventory) {
    this.ammoManager = ammoManager;
    this.inventory = inventory;
    this.weaponStates = new Map();

    // Initialize weapon states for all weapons
    Object.keys(WeaponConfigs).forEach((weaponName) => {
      const config = WeaponConfigs[weaponName];
      this.weaponStates.set(weaponName, {
        currentAmmo: config?.magazineCapacity || 0,
        isReloading: false,
        canShoot: true,
        nextFireTime: 0,
      });
    });
  }

  tryShoot(position: any, direction: any, weaponName: string): ShootResult {
    const config = WeaponConfigs[weaponName];
    if (!config) {
      return { success: false, reason: "Invalid weapon" };
    }

    const state = this.weaponStates.get(weaponName);
    if (!state) {
      return { success: false, reason: "Weapon state not found" };
    }

    // Check if reloading
    if (state.isReloading) {
      return { success: false, reason: "Reloading" };
    }

    // Check fire rate cooldown
    const now = Date.now();
    if (now < state.nextFireTime) {
      return { success: false, reason: "Fire rate cooldown" };
    }

    // Check magazine ammo
    if (state.currentAmmo <= 0) {
      return { success: false, reason: "Magazine empty" };
    }

    // Consume ammo
    state.currentAmmo--;
    state.nextFireTime = now + config.fireRate * 1000;

    // Generate bullet(s)
    const bullets: Array<{ position: any; direction: any }> = [];

    if (config.weaponType === WeaponType.Shotgun && config.pelletsPerShot) {
      // Shotgun: Multiple pellets with spread
      const baseAngle = Math.atan2(direction.y, direction.x) * (180 / Math.PI);

      for (let i = 0; i < config.pelletsPerShot; i++) {
        const spreadOffset =
          (Math.random() - 0.5) * 2 * (config.spreadAngle || 15);
        const pelletAngle = ((baseAngle + spreadOffset) * Math.PI) / 180;

        bullets.push({
          position: { x: position.x, y: position.y },
          direction: {
            x: Math.cos(pelletAngle),
            y: Math.sin(pelletAngle),
          },
        });
      }
    } else {
      // Single bullet
      bullets.push({
        position: { x: position.x, y: position.y },
        direction: { x: direction.x, y: direction.y },
      });
    }

    return {
      success: true,
      bullets: bullets,
      bulletType: config.bulletType,
      bulletSpeed: config.bulletSpeed,
      bulletLifetime: config.bulletLifetime,
      damage: config.damage,
    };
  }

  tryReload(): ReloadResult {
    const currentItem = this.inventory.getCurrentItem();
    if (!currentItem || currentItem.itemType !== ItemType.Weapon) {
      return { success: false, reason: "No weapon equipped" };
    }

    const weaponName = currentItem.weaponName!;
    const config = WeaponConfigs[weaponName];
    if (!config) {
      return { success: false, reason: "Invalid weapon" };
    }

    const state = this.weaponStates.get(weaponName);
    if (!state) {
      return { success: false, reason: "Weapon state not found" };
    }

    // Check if already reloading
    if (state.isReloading) {
      return { success: false, reason: "Already reloading" };
    }

    // Check if magazine is full
    if (state.currentAmmo >= config.magazineCapacity) {
      return { success: false, reason: "Magazine full" };
    }

    // Check if has reserve ammo
    if (!this.ammoManager.hasAmmo(config.ammoType, 1)) {
      return { success: false, reason: "No reserve ammo" };
    }

    // Start reload
    state.isReloading = true;
    this.reloadTimer = config.reloadTime * 1000; // Convert to ms
    this.currentReloadingWeapon = weaponName;

    return {
      success: true,
      weaponName: weaponName,
      reloadTime: config.reloadTime,
    };
  }

  update(deltaMs: number): boolean {
    if (this.reloadTimer > 0) {
      this.reloadTimer -= deltaMs;

      if (this.reloadTimer <= 0 && this.currentReloadingWeapon) {
        // Reload complete
        this.completeReload(this.currentReloadingWeapon);
        this.currentReloadingWeapon = null;
        return true; // Signal reload completed
      }
    }
    return false;
  }

  private completeReload(weaponName: string) {
    const config = WeaponConfigs[weaponName];
    const state = this.weaponStates.get(weaponName);

    if (!config || !state) return;

    // Calculate ammo needed
    const ammoNeeded = config.magazineCapacity - state.currentAmmo;
    const ammoAvailable = this.ammoManager.getAmmo(config.ammoType);

    // Take what we can
    const ammoToLoad = Math.min(ammoNeeded, ammoAvailable);

    if (this.ammoManager.useAmmo(config.ammoType, ammoToLoad)) {
      state.currentAmmo += ammoToLoad;
    }

    state.isReloading = false;

    console.log(
      `Reload complete: ${weaponName} now has ${state.currentAmmo}/${config.magazineCapacity}`
    );
  }

  onWeaponSwitch(weaponName: string) {
    // Cancel any ongoing reload
    if (this.currentReloadingWeapon) {
      const oldState = this.weaponStates.get(this.currentReloadingWeapon);
      if (oldState) {
        oldState.isReloading = false;
      }
      this.reloadTimer = 0;
      this.currentReloadingWeapon = null;
    }

    // Reset fire cooldown for new weapon
    const state = this.weaponStates.get(weaponName);
    if (state) {
      state.nextFireTime = 0;
    }
  }

  getWeaponState(weaponName: string): any {
    const config = WeaponConfigs[weaponName];
    const state = this.weaponStates.get(weaponName);

    if (!config || !state) return null;

    return {
      weaponName: weaponName,
      weaponType: config.weaponType,
      ammoType: config.ammoType,
      currentAmmo: state.currentAmmo,
      magazineCapacity: config.magazineCapacity,
      reserveAmmo: this.ammoManager.getAmmo(config.ammoType),
      isReloading: state.isReloading,
      reloadTimeRemaining: state.isReloading ? this.reloadTimer / 1000 : 0,
      damage: config.damage,
      fireRate: config.fireRate,
    };
  }
}