import {_arrayToFormula} from './dice.mjs';

describe("_arrayToFormula", () => {
  test("handle no operands", () => {
    const input = [];
    const output = '';

    expect(_arrayToFormula(input)).toEqual(output);
  });

  test("handle one operand", () => {
    const input = ['1'];
    const output = '1';

    expect(_arrayToFormula(input)).toEqual(output);
  });

  test("handle two operands", () => {
    const input = ['1', '2'];
    const output = '1 + 2';

    expect(_arrayToFormula(input)).toEqual(output);
  });

  test("handle three operands", () => {
    const input = ['1', '2', '3'];
    const output = '1 + 2 + 3';

    expect(_arrayToFormula(input)).toEqual(output);
  });
});
