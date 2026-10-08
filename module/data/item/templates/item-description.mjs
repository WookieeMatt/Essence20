import { makeStr, makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

export const itemDescription = () => ({
  description: new fields.HTMLField(),
  source: new fields.SchemaField({
    book: makeStr(''),
    page: makeInt(null),
  }),
  // What the system does for this item, in our own words - kept apart from `description` so the
  // Book Description Importer (which only ever fills `description`) can never overwrite it. A copy
  // on an actor reads its compendium original's notes live (Essence20Item#_prepareAutomation).
  automation: new fields.SchemaField({
    status: new fields.StringField({ initial: '', blank: true, choices: ['', 'full', 'partial', 'manual'] }),
    notes: new fields.HTMLField(),
  }),
  // The item's behaviour as data - typed rule objects run by module/rules/ (docs/RULES_ENGINE_PLAN.md).
  // Deliberately a list of plain objects, not a typed schema: the engine validates them
  // (rules/types.mjs#validateRule), so a rule this version doesn't know is kept, not stripped.
  rules: new fields.ArrayField(new fields.ObjectField()),
  // What taking this item requires: {when: [tags]} in the rules' condition language, checked when
  // it's added or attached (rules/prerequisites.mjs, docs/PREREQUISITES_PLAN.md), and shown in words
  // (prerequisiteText). The old typed `prerequisite` text was retired 2026-10-07.
  prerequisites: new fields.ObjectField(),
});
