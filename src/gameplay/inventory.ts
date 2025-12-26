export const ItemType = {
  Hand: "Hand",
  Weapon: "Weapon",
  Health: "Health",
  Shield: "Shield",
  Grenade: "Grenade",
} as const;

export type ItemType = typeof ItemType[keyof typeof ItemType];

export interface InventoryItem {
  itemType: ItemType;
  itemName: string;
  weaponName?: string;
  amount?: number;
  data?: any; 
}

export class Inventory {
  maxSlots: number = 6;
  slots: (InventoryItem | null)[];
  currentSlotIndex: number = 0;

  constructor() {
    this.slots = new Array(this.maxSlots).fill(null);

    this.slots[0] = {
      itemType: ItemType.Hand,
      itemName: "Hand",
    };
  }

  addItem(slotIndex: number, item: InventoryItem): boolean {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return false;
    if (slotIndex === 0) return false;
    
    this.slots[slotIndex] = item;
    return true;
  }

  removeItem(slotIndex: number): boolean {
    if (slotIndex <= 0 || slotIndex >= this.maxSlots) return false;
    
    this.slots[slotIndex] = null;
    return true;
  }

  switchToSlot(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return false;
    if (this.slots[slotIndex] === null) return false;
    
    this.currentSlotIndex = slotIndex;
    return true;
  }

  getCurrentItem(): InventoryItem | null {
    return this.slots[this.currentSlotIndex];
  }

  getItemAt(slotIndex: number): InventoryItem | null {
    if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;
    return this.slots[slotIndex];
  }

  useConsumable(slotIndex: number): InventoryItem | null {
    const item = this.slots[slotIndex];
    if (!item) return null;
    
    if (item.itemType === ItemType.Health || item.itemType === ItemType.Shield) {
      if (item.amount && item.amount > 1) {
        item.amount--;
      } else {
        this.slots[slotIndex] = null;
      }
      return item;
    }
    
    return null;
  }

  serialize() {
    return {
      slots: this.slots,
      currentSlotIndex: this.currentSlotIndex
    };
  }
}

export const ItemTemplates = {
  Pistol: (): InventoryItem => ({
    itemType: ItemType.Weapon,
    itemName: "Pistol",
    weaponName: "Pistol"
  }),
  
  Rifle: (): InventoryItem => ({
    itemType: ItemType.Weapon,
    itemName: "Rifle",
    weaponName: "Rifle"
  }),
  
  Shotgun: (): InventoryItem => ({
    itemType: ItemType.Weapon,
    itemName: "Shotgun",
    weaponName: "Shotgun"
  }),
  
  HealthPack: (amount: number = 1): InventoryItem => ({
    itemType: ItemType.Health,
    itemName: "Health Pack",
    amount: amount
  }),
  
  ShieldPack: (amount: number = 1): InventoryItem => ({
    itemType: ItemType.Shield,
    itemName: "Shield Pack",
    amount: amount
  }),
  
  Grenade: (amount: number = 3): InventoryItem => ({
    itemType: ItemType.Grenade,
    itemName: "Grenade",
    amount: amount
  })
};