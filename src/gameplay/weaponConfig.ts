import { BulletType } from "../entities/bullet.ts";

export interface WeaponConfig {
  name: string;
  damage: number;
  fireRate: number;
  magazineCapacity: number;
  reloadTime: number;
  bulletSpeed: number;
  bulletLifetime: number;
  bulletType: BulletType;
  pelletsPerShot?: number; // For shotguns
  spreadAngle?: number; // For shotguns
}

export const WeaponConfigs: { [key: string]: WeaponConfig } = {
  Pistol: {
    name: "Pistol",
    damage: 15,
    fireRate: 0.4,
    magazineCapacity: 12,
    reloadTime: 1.5,
    bulletSpeed: 0.5,
    bulletLifetime: 2000,
    bulletType: BulletType.Pistol,
  },

  SMG: {
    name: "SMG",
    damage: 10,
    fireRate: 0.1, // Very fast
    magazineCapacity: 30,
    reloadTime: 2.0,
    bulletSpeed: 0.55,
    bulletLifetime: 1800,
    bulletType: BulletType.Pistol, // Uses pistol ammo
  },

  Rifle: {
    name: "Rifle",
    damage: 25,
    fireRate: 0.2,
    magazineCapacity: 30,
    reloadTime: 2.5,
    bulletSpeed: 0.7,
    bulletLifetime: 2500,
    bulletType: BulletType.Rifle,
  },

  Sniper: {
    name: "Sniper",
    damage: 75,
    fireRate: 1.2, // Slow
    magazineCapacity: 5,
    reloadTime: 3.0,
    bulletSpeed: 1.2,
    bulletLifetime: 3000,
    bulletType: BulletType.Sniper,
  },

  Shotgun: {
    name: "Shotgun",
    damage: 12, // Per pellet
    fireRate: 0.8,
    magazineCapacity: 8,
    reloadTime: 2.5,
    bulletSpeed: 0.45,
    bulletLifetime: 1500,
    bulletType: BulletType.Shotgun,
    pelletsPerShot: 8,
    spreadAngle: 15,
  },
};

export function getWeaponConfig(weaponName: string): WeaponConfig | null {
  return WeaponConfigs[weaponName] || null;
}