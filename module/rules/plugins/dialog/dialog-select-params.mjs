import { RULE_TYPES } from "../../types.mjs";
import { stepErrors } from "../../steps.mjs";
import { unknownTags } from "../../predicate.mjs";

/**
 * DialogSelect's round-11 params (the helpers are ./select.mjs): `optionsFrom`, and per option `when` / `pay`.
 * Loaded after group C's dialog.mjs (ext/index.mjs imports c.mjs first), which registers the rule type.
 */
const SELECT = RULE_TYPES.DialogSelect;
if (SELECT && !SELECT.params.optionsFrom) {
  SELECT.params.optionsFrom = { kind: 'object' };
  SELECT.params.options = { ...SELECT.params.options, required: false };
  const inner = SELECT.validate;
  SELECT.validate = rule => {
    const from = rule.optionsFrom;
    const options = Array.isArray(rule.options) ? rule.options : [];
    // With optionsFrom, one authored option (the "keep it as it is" choice) is enough.
    const base = (inner?.(rule) ?? []).filter(error => !(from && error == 'options must list at least two choices'));
    return [
      ...base,
      ...(from && !options.length ? ['optionsFrom needs at least one authored option (the first is the default)'] : []),
      ...(from !== undefined && (typeof from != 'object' || !from.picked) ? ['optionsFrom needs picked (the pick key)'] : []),
      ...(from?.labels !== undefined && from.labels != 'damageType' ? ['optionsFrom.labels must be damageType'] : []),
      ...(from?.pay !== undefined ? stepErrors(from.pay, 'optionsFrom.pay') : []),
      ...(from?.steps !== undefined ? stepErrors(from.steps, 'optionsFrom.steps') : []),
      ...options.flatMap((option, i) => [
        ...(option?.when !== undefined && !Array.isArray(option.when) ? [`options[${i}].when must be a list of tags`] : []),
        ...(Array.isArray(option?.when) ? unknownTags(option.when).map(tag => `options[${i}]: unknown tag "${tag}"`) : []),
        ...(option?.pay !== undefined ? stepErrors(option.pay, `options[${i}].pay`) : []),
      ]),
    ];
  };
}
