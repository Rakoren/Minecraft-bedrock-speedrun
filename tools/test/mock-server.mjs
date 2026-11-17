export const EntityComponentTypes = { Inventory: "minecraft:inventory", Equippable: "minecraft:equippable" };
export const EquipmentSlot = { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const ItemLockMode = { inventory: "inventory" };
export const system = { waitTicks: async () => {}, runInterval() {}, runTimeout() {} };
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = typeId.includes("bed") || typeId.includes("_pickaxe") ? 1 : 64; } setLore() {} }
export const world = {}; export class BlockVolume {} export const DisplaySlotId = {}; export const ObjectiveSortOrder = {};
