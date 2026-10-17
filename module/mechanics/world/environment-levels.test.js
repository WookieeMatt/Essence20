/**
 * The Severity <select> is rebuilt in a real form, so this suite needs a DOM.
 *
 * @jest-environment jsdom
 */
import { describeInterval, getEnvironmentLevelOptions, syncEnvironmentLevelSelect, wireEnvironmentLevelSelects } from "./environment-levels.mjs";

// Labels read back as "<level key> (<timing key>)" through jest.setup's pass-through i18n.
const values = (options) => options.map(option => option.value);

describe("describeInterval", () => {
  test("names each kind of timing", () => {
    expect(describeInterval(1)).toBe("E20.EnvironmentTimingRound");
    expect(describeInterval(5)).toBe("E20.EnvironmentTimingRounds");
    expect(describeInterval('scene')).toBe("E20.EnvironmentTimingScene");
    expect(describeInterval('hour')).toBe("E20.EnvironmentTimingHour");
    expect(describeInterval(0)).toBe("E20.EnvironmentTimingNone");
  });
});

describe("getEnvironmentLevelOptions", () => {
  test("lists only that environment's own levels, after Default", () => {
    expect(values(getEnvironmentLevelOptions("toxicAtmosphere"))).toEqual(["", "lethal", "strong", "dangerous", "harmful"]);
    expect(values(getEnvironmentLevelOptions("corrosiveAtmosphere"))).toEqual(["", "intense", "concentrated", "strong", "mild"]);
    expect(values(getEnvironmentLevelOptions("extremeHeat"))).toEqual(["", "lethal", "dangerous", "uncomfortable"]);
  });

  test("an environment with no severity table only offers Default", () => {
    expect(values(getEnvironmentLevelOptions("vacuum"))).toEqual([""]);
    expect(values(getEnvironmentLevelOptions("normal"))).toEqual([""]);
    expect(values(getEnvironmentLevelOptions(""))).toEqual([""]);
  });
});

describe("the Environment/Severity select pair", () => {
  function makeForm(environment, level) {
    document.body.innerHTML = `
      <form>
        <select name="flags.essence20.environment">
          <option value="toxicAtmosphere">Toxic</option>
          <option value="corrosiveAtmosphere">Corrosive</option>
          <option value="vacuum">Vacuum</option>
        </select>
        <select name="flags.essence20.environmentLevel"><option value="${level}">${level}</option></select>
      </form>`;
    const form = document.querySelector("form");
    form.querySelector('[name="flags.essence20.environment"]').value = environment;
    return form;
  }

  const levelSelect = (form) => form.querySelector('[name="flags.essence20.environmentLevel"]');

  test("a level from another environment's table drops back to Default instead of hiding", () => {
    const form = makeForm("toxicAtmosphere", "intense");
    wireEnvironmentLevelSelects(form);
    expect(levelSelect(form).value).toBe("");
    expect(values([...levelSelect(form).options])).toEqual(["", "lethal", "strong", "dangerous", "harmful"]);
  });

  test("keeps a level the environment has, and follows a change of environment", () => {
    const form = makeForm("corrosiveAtmosphere", "strong");
    wireEnvironmentLevelSelects(form);
    expect(levelSelect(form).value).toBe("strong");

    const environment = form.querySelector('[name="flags.essence20.environment"]');
    environment.value = "toxicAtmosphere";
    environment.dispatchEvent(new Event("change"));
    expect(levelSelect(form).value).toBe("strong");

    environment.value = "vacuum";
    environment.dispatchEvent(new Event("change"));
    expect(levelSelect(form).value).toBe("");
    expect(levelSelect(form).disabled).toBe(true);
  });

  test("does nothing on a sheet without the pair", () => {
    document.body.innerHTML = "<form></form>";
    expect(() => wireEnvironmentLevelSelects(document.querySelector("form"))).not.toThrow();
    const select = document.createElement("select");
    select.value = "";
    expect(() => syncEnvironmentLevelSelect({ value: "vacuum" }, select)).not.toThrow();
  });
});
