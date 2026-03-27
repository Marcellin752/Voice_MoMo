import { PinManager } from "../../src/core/pin-manager/pin-manager";

describe("pin-manager", () => {
  const pm = new PinManager();

  test("encrypt puis decrypt retrouve le PIN", () => {
    const enc = pm.encrypt("1234");
    expect(enc).toMatch(/^aes256:[0-9a-f]+:[0-9a-f]+$/i);
    expect(pm.decrypt(enc)).toBe("1234");
  });

  test("valide 4 à 6 chiffres", () => {
    expect(pm.validate("1234")).toBe(true);
    expect(pm.validate("12")).toBe(false);
    expect(pm.validate("abcdef")).toBe(false);
  });
});
