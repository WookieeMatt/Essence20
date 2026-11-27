import { PowerItemData, sorcerousPowerCost } from "./power.mjs";

describe("a Sorcerous Power's cost is never below 1 (Finster's Monster-Matic Cookbook p.274)", () => {
  test("a cost taken down to 0 or below, or left blank, is 1; any other is its own", () => {
    expect(sorcerousPowerCost(0)).toBe(1);
    expect(sorcerousPowerCost(-1)).toBe(1);
    expect(sorcerousPowerCost(null)).toBe(1);
    expect(sorcerousPowerCost(3)).toBe(3);
  });

  test("only a Sorcerous Power is floored - a Grid or Personal Power keeps its own cost", () => {
    const prepare = system => {
      const data = Object.assign(Object.create(PowerItemData.prototype), { duration: {}, ...system });
      data.prepareDerivedData();
      return data.powerCost;
    };

    expect(prepare({ type: 'sorcerous', powerCost: 0 })).toBe(1);
    expect(prepare({ type: 'sorcerous', powerCost: 2 })).toBe(2);
    expect(prepare({ type: 'grid', powerCost: 0 })).toBe(0);
  });
});
